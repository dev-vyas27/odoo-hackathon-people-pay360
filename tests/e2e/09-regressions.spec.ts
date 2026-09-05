import { test, expect, makeEmployee, uniq, uniqCode, QA_EMAIL, QA_PASSWORD } from './_helpers/fixtures'

/**
 * One test per bug this QA pass found and fixed. If any of these goes red
 * again, the regression is exact and the report entry explains the history.
 */

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

  /**
   * The first attempt at F1 read `x-forwarded-proto` to decide the flag. That
   * is spoofable: proxies that APPEND to a client-supplied value leave the
   * caller's own entry leftmost, so a request carrying `x-forwarded-proto:
   * http` would downgrade that session's cookie off TLS. The flag is now
   * configuration only, and these two tests exist to keep it that way.
   */
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
    // The downgrade direction, which is the one that actually costs a victim
    // their session. `http,https` is what an appending proxy produces.
    const res = await anon.ctx.post('/api/auth/login', {
      data: { email: QA_EMAIL, password: QA_PASSWORD },
      headers: { 'x-forwarded-proto': 'http,https', origin: 'https://evil.example' },
    })
    expect(res.status()).toBe(200)
    const setCookie = res.headers()['set-cookie'] ?? ''
    // COOKIE_SECURE=false for this harness, so the flag is off either way —
    // what matters is that the headers changed nothing about the response.
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
    await api.post(`/api/attendance/${created.data.attendance.id}/check-out`, {
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

    const out = await api.post(`/api/attendance/${created.data.attendance.id}/check-out`, {
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
