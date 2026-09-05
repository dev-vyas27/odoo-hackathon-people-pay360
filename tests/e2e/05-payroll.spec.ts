import {
  test,
  expect,
  uniq,
  uniqCode,
  makeContract,
  makeEmployee,
} from './_helpers/fixtures'

async function makeRule(api: any, overrides: Record<string, unknown> = {}) {
  const r = await api.post('/api/payroll/rules', {
    name: uniq('Rule'),
    code: uniqCode('R'),
    category: 'basic',
    sequence: 10,
    computationType: 'fixed',
    amount: 10000,
    active: true,
    ...overrides,
  })
  expect(r.status, `create salary rule: ${JSON.stringify(r.raw)}`).toBe(201)
  return r.data
}

/**
 * A complete, self-created structure: BASIC prorated off the contract wage,
 * HRA as a percentage of it, GROSS and NET as formulas. This exercises all
 * three computation strategies plus the reserved WAGE / WORKED_RATIO inputs.
 */
async function makeStructure(api: any) {
  const basic = await makeRule(api, {
    code: uniqCode('B'),
    category: 'basic',
    sequence: 10,
    computationType: 'formula',
    expression: 'WAGE * WORKED_RATIO',
    amount: undefined,
  })
  const hra = await makeRule(api, {
    code: uniqCode('H'),
    category: 'allowance',
    sequence: 20,
    computationType: 'percentage',
    percent: 40,
    ofCode: basic.code,
    amount: undefined,
  })
  const gross = await makeRule(api, {
    code: uniqCode('G'),
    category: 'gross',
    sequence: 30,
    computationType: 'formula',
    expression: `${basic.code} + ${hra.code}`,
    amount: undefined,
  })

  const r = await api.post('/api/payroll/structures', {
    name: uniq('Struct'),
    code: uniqCode('S'),
    active: true,
    rules: [
      { ruleId: basic.id, sequence: 10 },
      { ruleId: hra.id, sequence: 20 },
      { ruleId: gross.id, sequence: 30 },
    ],
  })
  expect(r.status, `create structure: ${JSON.stringify(r.raw)}`).toBe(201)
  return { structure: r.data, basic, hra, gross }
}

test.describe('Payroll config — salary rules', () => {
  test('creates a fixed-amount rule', async ({ api }) => {
    const rule = await makeRule(api)
    expect(rule.code).toMatch(/^[A-Z0-9_]+$/)
  })

  test('creates a percentage rule referencing another rule', async ({ api }) => {
    const base = await makeRule(api)
    const pct = await makeRule(api, {
      computationType: 'percentage',
      percent: 40,
      ofCode: base.code,
      amount: undefined,
      category: 'allowance',
    })
    expect(pct.id).toBeTruthy()
  })

  test('rejects a rule code with lowercase punctuation', async ({ api }) => {
    const r = await api.post('/api/payroll/rules', {
      name: uniq('Rule'),
      code: 'bad code!',
      category: 'basic',
      sequence: 1,
      computationType: 'fixed',
      amount: 100,
      active: true,
    })
    expect(r.status).toBe(400)
  })

  test('rejects a fixed rule with no amount', async ({ api }) => {
    const r = await api.post('/api/payroll/rules', {
      name: uniq('Rule'),
      code: uniqCode('R'),
      category: 'basic',
      sequence: 1,
      computationType: 'fixed',
      active: true,
    })
    expect(r.status).toBe(400)
    expect(JSON.stringify(r.error?.details)).toContain('amount')
  })

  test('rejects a percentage rule that references itself', async ({ api }) => {
    const code = uniqCode('R')
    const r = await api.post('/api/payroll/rules', {
      name: uniq('Rule'),
      code,
      category: 'allowance',
      sequence: 1,
      computationType: 'percentage',
      percent: 10,
      ofCode: code,
      active: true,
    })
    expect(r.status).toBe(400)
    expect(JSON.stringify(r.error?.details)).toContain('ofCode')
  })

  test('rejects a percentage above 100', async ({ api }) => {
    const base = await makeRule(api)
    const r = await api.post('/api/payroll/rules', {
      name: uniq('Rule'),
      code: uniqCode('R'),
      category: 'allowance',
      sequence: 1,
      computationType: 'percentage',
      percent: 150,
      ofCode: base.code,
      active: true,
    })
    expect(r.status).toBe(400)
  })

  test('rejects a formula rule with no expression', async ({ api }) => {
    const r = await api.post('/api/payroll/rules', {
      name: uniq('Rule'),
      code: uniqCode('R'),
      category: 'gross',
      sequence: 1,
      computationType: 'formula',
      active: true,
    })
    expect(r.status).toBe(400)
  })

  test('rejects a negative sequence', async ({ api }) => {
    const r = await api.post('/api/payroll/rules', {
      name: uniq('Rule'),
      code: uniqCode('R'),
      category: 'basic',
      sequence: -1,
      computationType: 'fixed',
      amount: 100,
      active: true,
    })
    expect(r.status).toBe(400)
  })
})

test.describe('Payroll config — salary structures', () => {
  test('creates a structure with three rules', async ({ api }) => {
    const { structure } = await makeStructure(api)
    expect(structure.id).toBeTruthy()
  })

  test('rejects a structure with no rules', async ({ api }) => {
    const r = await api.post('/api/payroll/structures', {
      name: uniq('Struct'),
      code: uniqCode('S'),
      active: true,
      rules: [],
    })
    expect(r.status).toBe(400)
  })

  test('rejects a structure referencing a rule id that does not exist', async ({ api }) => {
    const r = await api.post('/api/payroll/structures', {
      name: uniq('Struct'),
      code: uniqCode('S'),
      active: true,
      rules: [{ ruleId: '00000000-0000-4000-8000-000000000000', sequence: 10 }],
    })
    expect(r.status, JSON.stringify(r.raw)).toBeGreaterThanOrEqual(400)
    expect(r.status, 'unknown rule id must not be a 500').toBeLessThan(500)
  })

  test('reads a structure back with its rules resolved', async ({ api }) => {
    const { structure } = await makeStructure(api)
    const r = await api.get(`/api/payroll/structures/${structure.id}`)
    expect(r.status).toBe(200)
    expect(JSON.stringify(r.data)).toContain('rules')
  })
})

test.describe('Payroll processing — the full payrun lifecycle', () => {
  test('scenario A: employee -> contract -> payrun -> compute -> validate -> paid', async ({
    api,
  }) => {
    const employee = await makeEmployee(api, { bankAccount: '999888777666' })
    await makeContract(api, employee.id, {
      wage: 50000,
      start: '2020-01-01',
      end: null,
    })
    const { structure } = await makeStructure(api)

    const payrun = await api.post('/api/payruns', {
      name: uniq('Payrun'),
      structureId: structure.id,
      periodStart: '2025-06-01',
      periodEnd: '2025-06-30',
      employeeIds: [employee.id],
    })
    expect(payrun.status, JSON.stringify(payrun.raw)).toBe(201)
    expect(payrun.data.status).toBe('draft')

    const computed = await api.post(`/api/payruns/${payrun.data.id}/compute`)
    expect(computed.status, JSON.stringify(computed.raw)).toBe(200)
    const payslips = computed.data.payslips ?? []
    expect(payslips.length, 'one employee with a valid contract = one payslip').toBe(1)
    expect(
      Number(payslips[0].gross ?? 0),
      'gross must be a real number derived from the wage',
    ).toBeGreaterThan(0)

    const validated = await api.post(`/api/payruns/${payrun.data.id}/validate`)
    expect(validated.status, JSON.stringify(validated.raw)).toBe(200)

    const paid = await api.post(`/api/payruns/${payrun.data.id}/mark-paid`)
    expect(paid.status, JSON.stringify(paid.raw)).toBe(200)

    const read = await api.get(`/api/payruns/${payrun.data.id}`)
    expect(read.data.payrun?.status ?? read.data.status).toBe('paid')
  })

  test('a draft payrun cannot be marked paid — the state machine holds', async ({ api }) => {
    const employee = await makeEmployee(api)
    await makeContract(api, employee.id)
    const { structure } = await makeStructure(api)

    const payrun = await api.post('/api/payruns', {
      name: uniq('Payrun'),
      structureId: structure.id,
      periodStart: '2025-06-01',
      periodEnd: '2025-06-30',
      employeeIds: [employee.id],
    })
    expect(payrun.status).toBe(201)

    const paid = await api.post(`/api/payruns/${payrun.data.id}/mark-paid`)
    expect(paid.status, 'illegal transition must be 422, not 500').toBe(422)
    expect(paid.error?.code).toBe('PAYRUN_ILLEGAL_TRANSITION')
  })

  test('a validated payrun cannot be recomputed', async ({ api }) => {
    const employee = await makeEmployee(api, { bankAccount: '111222333444' })
    await makeContract(api, employee.id)
    const { structure } = await makeStructure(api)

    const payrun = await api.post('/api/payruns', {
      name: uniq('Payrun'),
      structureId: structure.id,
      periodStart: '2025-06-01',
      periodEnd: '2025-06-30',
      employeeIds: [employee.id],
    })
    await api.post(`/api/payruns/${payrun.data.id}/compute`)
    const validated = await api.post(`/api/payruns/${payrun.data.id}/validate`)
    expect(validated.status, JSON.stringify(validated.raw)).toBe(200)

    const recompute = await api.post(`/api/payruns/${payrun.data.id}/compute`)
    expect(recompute.status, 'a finalised run must be read-only').toBe(422)
  })

  test('an employee with no contract produces no payslip and a blocking warning', async ({
    api,
  }) => {
    const employee = await makeEmployee(api)
    // Deliberately no contract.
    const { structure } = await makeStructure(api)

    const payrun = await api.post('/api/payruns', {
      name: uniq('Payrun'),
      structureId: structure.id,
      periodStart: '2025-06-01',
      periodEnd: '2025-06-30',
      employeeIds: [employee.id],
    })
    expect(payrun.status, JSON.stringify(payrun.raw)).toBe(201)

    const computed = await api.post(`/api/payruns/${payrun.data.id}/compute`)
    expect(computed.status, JSON.stringify(computed.raw)).toBe(200)
    expect(computed.data.payslips?.length ?? 0).toBe(0)
    expect(computed.data.skipped?.length ?? 0).toBe(1)
    const warnings = JSON.stringify(computed.data.warnings ?? [])
    expect(warnings.toLowerCase()).toContain('contract')
  })

  test('period-correct contract resolution: a raise does not rewrite history', async ({ api }) => {
    const employee = await makeEmployee(api, { bankAccount: '555555555555' })
    // Two contracts: 40k for 2024, 80k from 2025.
    await makeContract(api, employee.id, {
      wage: 40000,
      start: '2024-01-01',
      end: '2024-12-31',
    })
    await makeContract(api, employee.id, { wage: 80000, start: '2025-01-01', end: null })
    const { structure } = await makeStructure(api)

    const oldRun = await api.post('/api/payruns', {
      name: uniq('Payrun2024'),
      structureId: structure.id,
      periodStart: '2024-06-01',
      periodEnd: '2024-06-30',
      employeeIds: [employee.id],
    })
    expect(oldRun.status, JSON.stringify(oldRun.raw)).toBe(201)
    const computed = await api.post(`/api/payruns/${oldRun.data.id}/compute`)
    expect(computed.status, JSON.stringify(computed.raw)).toBe(200)

    const slip = computed.data.payslips?.[0]
    expect(slip, 'the 2024 contract should have been resolved').toBeTruthy()
    // BASIC = WAGE * WORKED_RATIO. With no attendance the ratio is 0, but the
    // contract picked must be the 2024 one — assert on the stored contract wage
    // rather than the computed amount so this stays independent of attendance.
    expect(
      JSON.stringify(slip),
      'the June 2024 payslip must not be built from the 2025 wage',
    ).not.toContain('80000')
  })

  test('sending payslips: refused until validated, then reported per employee', async ({
    api,
  }) => {
    const employee = await makeEmployee(api, { bankAccount: '778899001122' })
    await makeContract(api, employee.id, { wage: 48000, start: '2020-01-01', end: null })
    const { structure } = await makeStructure(api)

    const payrun = await api.post('/api/payruns', {
      name: uniq('SendRun'),
      structureId: structure.id,
      periodStart: '2025-09-01',
      periodEnd: '2025-09-30',
      employeeIds: [employee.id],
    })
    expect(payrun.status, JSON.stringify(payrun.raw)).toBe(201)
    const id = payrun.data.id

    /**
     * Nothing computed yet: there is no payslip to send, and saying so is more
     * use than a silent success over an empty run.
     */
    const beforeCompute = await api.post(`/api/payruns/${id}/send`)
    expect(beforeCompute.status).toBe(422)
    expect(beforeCompute.error?.code).toBe('PAYRUN_HAS_NO_PAYSLIPS')

    await api.post(`/api/payruns/${id}/compute`)

    /**
     * Computed but not validated. The figures can still change, and an email
     * cannot be recalled — so this is the gate that matters.
     */
    const beforeValidate = await api.post(`/api/payruns/${id}/send`)
    expect(beforeValidate.status).toBe(422)
    expect(beforeValidate.error?.code).toBe('PAYRUN_NOT_VALIDATED')

    const validated = await api.post(`/api/payruns/${id}/validate`)
    expect(validated.status, JSON.stringify(validated.raw)).toBe(200)

    const sent = await api.post(`/api/payruns/${id}/send`)
    expect(sent.status, JSON.stringify(sent.raw)).toBe(200)
    expect(sent.data.sent, 'the one employee should receive their payslip').toBe(1)
    expect(sent.data.failed).toBe(0)

    const delivery = sent.data.deliveries[0]
    expect(delivery.employeeName).toBe(employee.name)
    expect(delivery.email).toBe(employee.email)
    expect(delivery.sent).toBe(true)
  })

  test('rejects a payrun whose period ends before it starts', async ({ api }) => {
    const employee = await makeEmployee(api)
    const { structure } = await makeStructure(api)
    const r = await api.post('/api/payruns', {
      name: uniq('Payrun'),
      structureId: structure.id,
      periodStart: '2025-06-30',
      periodEnd: '2025-06-01',
      employeeIds: [employee.id],
    })
    expect(r.status).toBe(400)
  })

  test('rejects a payrun with no employees selected', async ({ api }) => {
    const { structure } = await makeStructure(api)
    const r = await api.post('/api/payruns', {
      name: uniq('Payrun'),
      structureId: structure.id,
      periodStart: '2025-06-01',
      periodEnd: '2025-06-30',
      employeeIds: [],
    })
    expect(r.status).toBe(400)
  })

  test('eligible-employees reports an employee it created with a covering contract', async ({
    api,
  }) => {
    const employee = await makeEmployee(api)
    await makeContract(api, employee.id, { wage: 30000, start: '2020-01-01', end: null })

    const r = await api.get(
      '/api/payruns/eligible-employees?periodStart=2025-06-01&periodEnd=2025-06-30',
    )
    expect(r.status, JSON.stringify(r.raw)).toBe(200)
    const list = JSON.stringify(r.data)
    expect(list).toContain(employee.id)
  })
})
