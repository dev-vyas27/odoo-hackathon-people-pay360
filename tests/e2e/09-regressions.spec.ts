import { test, expect, makeEmployee, uniq, uniqCode, QA_EMAIL, QA_PASSWORD } from './_helpers/fixtures'




test.describe('Regression — F1 session cookie over plain HTTP', () => {
  test('the cookie is not marked Secure when the request is not HTTPS', async ({ anon }) => {
    const res = await anon.ctx.post('/api/auth/login', {
      data: { email: QA_EMAIL, password: QA_PASSWORD },
    })
    expect(res.status()).toBe(200)
    const setCookie = res.headers()['set-cookie'] ?? ''
    expect(
      setCookie,
      'a Secure cookie over http is silently discarded, so login would appear to succeed and never stick',
    ).not.toMatch(/;\s*Secure/i)
    expect(setCookie, 'the session must still be httpOnly').toMatch(/HttpOnly/i)
  })

  


  test('a spoofed x-forwarded-proto cannot turn the flag ON', async ({ anon }) => {
    const res = await anon.ctx.post('/api/auth/login', {
      data: { email: QA_EMAIL, password: QA_PASSWORD },
      headers: { 'x-forwarded-proto': 'https' },
    })
    expect(res.status()).toBe(200)
    expect(
      res.headers()['set-cookie'] ?? '',
      'no request header may influence the Secure flag',
    ).not.toMatch(/;\s*Secure/i)
  })

  test('a spoofed x-forwarded-proto cannot turn the flag OFF either', async ({ anon }) => {
    
    
    const res = await anon.ctx.post('/api/auth/login', {
      data: { email: QA_EMAIL, password: QA_PASSWORD },
      headers: { 'x-forwarded-proto': 'http,https', origin: 'https://evil.example' },
    })
    expect(res.status()).toBe(200)
    const setCookie = res.headers()['set-cookie'] ?? ''
    
    
    expect(setCookie).toMatch(/HttpOnly/i)
    expect(setCookie).toMatch(/SameSite=lax/i)
  })
})

test.describe('Regression — F2 validation errors must be 4xx', () => {
  const cases: Array<[string, string, unknown]> = [
    ['schedule with no days', '/api/schedules', { name: 'x', days: [] }],
    [
      'schedule with a bad time',
      '/api/schedules',
      { name: 'x', days: [{ day: 1, start: '25:00', end: '18:00', breakMinutes: 0 }] },
    ],
    [
      'contract ending before it starts',
      '/api/contracts',
      {
        employeeId: '00000000-0000-4000-8000-000000000000',
        wage: 1,
        start: '2024-06-01',
        end: '2024-01-01',
      },
    ],
    ['attendance with a bad employee id', '/api/attendance', { employeeId: 'nope' }],
  ]

  for (const [label, path, body] of cases) {
    test(`${label} is a 400 with field detail, never a 500`, async ({ api }) => {
      const r = await api.post(path, body)
      expect(r.status, JSON.stringify(r.raw)).toBe(400)
      expect(r.error?.code).toBe('VALIDATION_ERROR')
      expect(r.error?.details, 'the client needs to know WHICH field').toBeTruthy()
    })
  }
})

test.describe('Regression — F3 list filters must not be dropped', () => {
  test('contracts honour ?employeeId', async ({ api }) => {
    const employee = await makeEmployee(api)
    const created = await api.post('/api/contracts', {
      employeeId: employee.id,
      wage: 12345,
      start: '2021-01-01',
      end: null,
    })
    expect(created.status).toBe(201)

    const filtered = await api.get(`/api/contracts?employeeId=${employee.id}&limit=200`)
    const unfiltered = await api.get('/api/contracts?limit=200')
    expect(filtered.data.total, 'the filter must actually narrow the result').toBe(1)
    expect(
      filtered.data.total,
      'a dropped filter shows up as the filtered count equalling the whole table',
    ).toBeLessThan(unfiltered.data.total)
  })
})

test.describe('Regression — F4 the money validator must reject 3 decimals', () => {
  test('a wage of 100.123 is refused', async ({ api }) => {
    const employee = await makeEmployee(api)
    const r = await api.post('/api/contracts', {
      employeeId: employee.id,
      wage: 100.123,
      start: '2022-01-01',
    })
    expect(r.status).toBe(400)
  })

  test('a wage of 100.12 is still accepted', async ({ api }) => {
    const employee = await makeEmployee(api)
    const r = await api.post('/api/contracts', {
      employeeId: employee.id,
      wage: 100.12,
      start: '2022-01-01',
    })
    expect(r.status, 'binary floating point must not make a legal wage fail').toBe(201)
  })
})

test.describe('Regression — F5 attendance must return its DTO, not the aggregate', () => {
  test('a list item is flat and carries status and workedHours', async ({ api }) => {
    const employee = await makeEmployee(api)
    const created = await api.post('/api/attendance', {
      employeeId: employee.id,
      checkIn: '2025-04-07T09:00:00.000Z',
    })
    expect(created.status).toBe(201)
    await api.post(`/api/attendance/${created.data.id}/check-out`, {
      checkOut: '2025-04-07T17:00:00.000Z',
    })

    const list = await api.get(`/api/attendance?employeeId=${employee.id}`)
    expect(list.status).toBe(200)
    const item = list.data.items[0]

    expect(item, 'the list must return an item').toBeTruthy()
    expect(item.props, 'the aggregate internals must never reach the wire').toBeUndefined()
    expect(item.id).toBeTruthy()
    expect(item.employeeId).toBe(employee.id)
    expect(item.status, 'StatusBadge calls .replace() on this').toBeTruthy()
    expect(typeof item.workedHours, 'the Worked Hours column reads this').toBe('number')
    expect(item.workedHours).toBe(8)
  })

  


  test('EVERY attendance endpoint returns the same shape', async ({ api }) => {
    const employee = await makeEmployee(api)

    const shapeOf = (data: any) => ({
      flat: data?.props === undefined && data?.attendance === undefined,
      hasId: typeof data?.id === 'string',
      hasStatus: typeof data?.status === 'string',
      hasEmployeeId: data?.employeeId === employee.id,
      workedHoursType: data?.workedHours === null ? 'null' : typeof data?.workedHours,
    })

    
    const created = await api.post('/api/attendance', {
      employeeId: employee.id,
      checkIn: '2025-04-09T09:00:00.000Z',
    })
    expect(created.status).toBe(201)
    expect(shapeOf(created.data), 'POST /api/attendance').toEqual({
      flat: true,
      hasId: true,
      hasStatus: true,
      hasEmployeeId: true,
      workedHoursType: 'null',
    })

    
    const out = await api.post(`/api/attendance/${created.data.id}/check-out`, {
      checkOut: '2025-04-09T17:00:00.000Z',
    })
    expect(out.status).toBe(200)
    expect(shapeOf(out.data), 'POST .../check-out').toEqual({
      flat: true,
      hasId: true,
      hasStatus: true,
      hasEmployeeId: true,
      workedHoursType: 'number',
    })

    
    const detail = await api.get(`/api/attendance/${created.data.id}`)
    expect(detail.status).toBe(200)
    expect(shapeOf(detail.data), 'GET /api/attendance/[id]').toEqual({
      flat: true,
      hasId: true,
      hasStatus: true,
      hasEmployeeId: true,
      workedHoursType: 'number',
    })

    
    const corrected = await api.patch(`/api/attendance/${created.data.id}`, {
      breakMinutes: 30,
    })
    expect(corrected.status).toBe(200)
    expect(shapeOf(corrected.data), 'PATCH /api/attendance/[id]').toEqual({
      flat: true,
      hasId: true,
      hasStatus: true,
      hasEmployeeId: true,
      workedHoursType: 'number',
    })
    expect(corrected.data.manual, 'a correction always flags manual').toBe(true)
  })
})

test.describe('Regression — F6 payslip lines must persist', () => {
  test('a computed payrun writes its lines instead of dying on a type mismatch', async ({
    api,
  }) => {
    const employee = await makeEmployee(api, { bankAccount: '424242424242' })
    await api.post('/api/contracts', {
      employeeId: employee.id,
      wage: 60000,
      start: '2020-01-01',
      end: null,
    })

    const rule = await api.post('/api/payroll/rules', {
      name: uniq('RegBasic'),
      code: uniqCode('RB'),
      category: 'basic',
      sequence: 10,
      computationType: 'fixed',
      amount: 5000,
      active: true,
    })
    expect(rule.status, JSON.stringify(rule.raw)).toBe(201)

    const structure = await api.post('/api/payroll/structures', {
      name: uniq('RegStruct'),
      code: uniqCode('RS'),
      active: true,
      rules: [{ ruleId: rule.data.id, sequence: 10 }],
    })
    expect(structure.status, JSON.stringify(structure.raw)).toBe(201)

    const payrun = await api.post('/api/payruns', {
      name: uniq('RegPayrun'),
      structureId: structure.data.id,
      periodStart: '2025-05-01',
      periodEnd: '2025-05-31',
      employeeIds: [employee.id],
    })
    expect(payrun.status, JSON.stringify(payrun.raw)).toBe(201)

    const computed = await api.post(`/api/payruns/${payrun.data.id}/compute`)
    expect(computed.status, JSON.stringify(computed.raw)).toBe(200)

    const slip = computed.data.payslips?.[0]
    expect(slip, 'compute must produce a payslip').toBeTruthy()
    expect(slip.lines?.length, 'the lines are the payslip — they must be written').toBeGreaterThan(0)
    expect(Number(slip.lines[0].amount)).toBe(5000)
  })
})

test.describe('Regression — F7 a night shift must be recordable', () => {
  test('23:00 to 06:00 stores and reports seven hours', async ({ api }) => {
    const employee = await makeEmployee(api)
    const created = await api.post('/api/attendance', {
      employeeId: employee.id,
      checkIn: '2025-04-08T23:00:00.000Z',
    })
    expect(created.status).toBe(201)

    const out = await api.post(`/api/attendance/${created.data.id}/check-out`, {
      checkOut: '2025-04-08T06:00:00.000Z',
    })
    expect(
      out.status,
      `a shift crossing midnight must persist: ${JSON.stringify(out.raw)}`,
    ).toBe(200)

    const list = await api.get(`/api/attendance?employeeId=${employee.id}`)
    const item = list.data.items[0]
    expect(item.workedHours, '23:00 -> 06:00 is seven hours').toBe(7)
    expect(
      new Date(item.checkOut).getTime(),
      'the check-out must be stored on the following day',
    ).toBeGreaterThan(new Date(item.checkIn).getTime())
  })
})

test.describe('Regression — F10 "Load demo data" must actually load', () => {
  


  test('seeds every part and returns credentials that all sign in', async ({ anon }) => {
    const seed = await anon.post('/api/demo/seed', {})
    expect(seed.status, JSON.stringify(seed.raw).slice(0, 400)).toBe(200)

    const parts: Array<{ name: string; rows: number }> = seed.data.parts ?? []
    expect(parts.length, 'every seed part must run').toBe(7)
    expect(
      parts.find((p) => p.name === 'identity')?.rows,
      'one account per role',
    ).toBe(5)

    const credentials: Array<{ role: string; email: string; password: string }> =
      seed.data.credentials ?? []
    expect(credentials.length).toBe(5)

    for (const credential of credentials) {
      const login = await anon.post('/api/auth/login', {
        email: credential.email,
        password: credential.password,
      })
      expect(
        login.status,
        `${credential.role} (${credential.email}) could not sign in: ${JSON.stringify(login.raw)}`,
      ).toBe(200)
      expect(login.data.employeeId, 'an account IS an employee since 0010').toBeTruthy()
    }
  })
})

test.describe('Account invitations', () => {
  test('an account is born with no login until the link is redeemed', async ({ api, anon }) => {
    const employee = await makeEmployee(api)
    const password = 'QaInvite!2026'

    const account = await api.post('/api/users', {
      name: employee.name,
      email: employee.email,
      role: 'employee',
      isActive: true,
    })
    expect(account.status, JSON.stringify(account.raw)).toBe(201)
    expect(account.data.hasLogin, 'nobody but the holder chooses the password').toBe(false)

    
    const early = await anon.post('/api/auth/login', { email: employee.email, password })
    expect(early.status, 'an un-redeemed account must not authenticate').toBe(401)

    const invite = await api.post(`/api/users/${employee.id}/invite`)
    expect(invite.status, JSON.stringify(invite.raw)).toBe(200)
    const token = new URL(invite.data.link).searchParams.get('token')
    expect(token).toBeTruthy()

    
    const status = await anon.get(`/api/auth/set-password?token=${token}`)
    expect(status.status).toBe(200)

    const redeemed = await anon.post('/api/auth/set-password', {
      token,
      password,
      confirmPassword: password,
    })
    expect(redeemed.status, JSON.stringify(redeemed.raw)).toBe(200)

    const login = await anon.post('/api/auth/login', { email: employee.email, password })
    expect(login.status, 'redeeming the link must produce a working login').toBe(200)
    expect(login.data.employeeId).toBe(employee.id)
  })

  test('a set-password link is single use', async ({ api, anon }) => {
    const employee = await makeEmployee(api)
    await api.post('/api/users', {
      name: employee.name,
      email: employee.email,
      role: 'employee',
      isActive: true,
    })
    const invite = await api.post(`/api/users/${employee.id}/invite`)
    const token = new URL(invite.data.link).searchParams.get('token')

    const first = await anon.post('/api/auth/set-password', {
      token,
      password: 'QaFirst!2026aa',
      confirmPassword: 'QaFirst!2026aa',
    })
    expect(first.status).toBe(200)

    const second = await anon.post('/api/auth/set-password', {
      token,
      password: 'QaSecond!2026a',
      confirmPassword: 'QaSecond!2026a',
    })
    expect(second.status, 'a spent token must not work twice').toBeGreaterThanOrEqual(400)
    expect(second.status).toBeLessThan(500)

    
    const login = await anon.post('/api/auth/login', {
      email: employee.email,
      password: 'QaFirst!2026aa',
    })
    expect(login.status).toBe(200)
  })

  test('mismatched confirmation is refused by the API, not just the form', async ({
    api,
    anon,
  }) => {
    const employee = await makeEmployee(api)
    await api.post('/api/users', {
      name: employee.name,
      email: employee.email,
      role: 'employee',
      isActive: true,
    })
    const invite = await api.post(`/api/users/${employee.id}/invite`)
    const token = new URL(invite.data.link).searchParams.get('token')

    const mismatched = await anon.post('/api/auth/set-password', {
      token,
      password: 'QaOne!2026aaaa',
      confirmPassword: 'QaTwo!2026aaaa',
    })
    expect(mismatched.status).toBe(400)
  })
})

test.describe('Regression — F8 a dangling reference is the caller’s error', () => {
  test('a contract for a non-existent employee is a 4xx, not a 500', async ({ api }) => {
    const r = await api.post('/api/contracts', {
      employeeId: '00000000-0000-4000-8000-000000000000',
      wage: 50000,
      start: '2024-01-01',
    })
    expect(r.status).toBe(400)
    expect(r.error?.code).toBe('RELATED_RECORD_NOT_FOUND')
  })
})
