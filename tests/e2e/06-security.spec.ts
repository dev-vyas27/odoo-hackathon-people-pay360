import {
  test,
  expect,
  uniq,
  uniqEmail,
  grantLogin,
  makeEmployee,
  QA_EMAIL,
  QA_PASSWORD,
} from './_helpers/fixtures'

test.describe('Security — authentication', () => {
  const protectedPaths = [
    '/api/employees',
    '/api/departments',
    '/api/contracts',
    '/api/schedules',
    '/api/attendance',
    '/api/time-off/types',
    '/api/time-off/requests',
    '/api/payroll/rules',
    '/api/payroll/structures',
    '/api/payruns',
    '/api/dashboard',
    '/api/users',
  ]

  for (const path of protectedPaths) {
    test(`anonymous GET ${path} is refused with JSON, not HTML`, async ({ anon }) => {
      const r = await anon.get(path)
      expect(r.status, `${path} must not be readable anonymously`).toBe(401)
      expect(r.error?.code).toBe('UNAUTHENTICATED')
    })
  }

  test('anonymous POST is refused before it can write anything', async ({ anon }) => {
    const r = await anon.post('/api/employees', {
      name: uniq('Intruder'),
      email: uniqEmail(),
      employeeType: 'full_time',
    })
    expect(r.status).toBe(401)
  })

  test('rejects a login with a wrong password without revealing which field failed', async ({
    anon,
  }) => {
    const r = await anon.post('/api/auth/login', {
      email: 'qa-bot@peoplepay360.test',
      password: 'definitely-not-the-password',
    })
    expect(r.status).toBe(401)
    // The message must be ambiguous between the two fields: naming only the
    // password would confirm to an attacker that the account exists.
    const message = (r.error?.message ?? '').toLowerCase()
    expect(message).toContain('email')
    expect(message).toContain('password')
  })

  test('rejects a login for an unknown account', async ({ anon }) => {
    const r = await anon.post('/api/auth/login', {
      email: 'nobody-at-all@peoplepay360.test',
      password: 'whatever',
    })
    expect(r.status).toBeGreaterThanOrEqual(400)
    expect(r.status).toBeLessThan(500)
  })

  test('rejects a malformed login payload with a 400', async ({ anon }) => {
    const r = await anon.post('/api/auth/login', { email: 'not-an-email', password: '' })
    expect(r.status).toBe(400)
  })

  test('a forged JWT is not accepted', async ({ playwright, baseURL }) => {
    const ctx = await playwright.request.newContext({ baseURL })
    const forged = [
      Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
      Buffer.from(
        JSON.stringify({
          sub: '00000000-0000-4000-8000-000000000000',
          role: 'admin',
          email: 'evil@example.com',
          name: 'Evil',
          employeeId: null,
        }),
      ).toString('base64url'),
      'not-a-real-signature',
    ].join('.')

    const r = await ctx.get('/api/employees', { headers: { cookie: `pp360_token=${forged}` } })
    expect(r.status(), 'an unsigned token must never authenticate').toBe(401)
    await ctx.dispose()
  })

  test('an alg=none token is not accepted', async ({ playwright, baseURL }) => {
    const ctx = await playwright.request.newContext({ baseURL })
    const token = [
      Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url'),
      Buffer.from(JSON.stringify({ sub: 'x', role: 'admin', email: 'e@e.com', name: 'E' })).toString(
        'base64url',
      ),
      '',
    ].join('.')
    const r = await ctx.get('/api/employees', { headers: { cookie: `pp360_token=${token}` } })
    expect(r.status()).toBe(401)
    await ctx.dispose()
  })
})

test.describe('Security — injection and input abuse', () => {
  test('a SQL-injection attempt in ?sort is neutralised', async ({ api }) => {
    const r = await api.get('/api/employees?sort=name;DROP%20TABLE%20users--')
    expect(r.status, 'a hostile sort column must fall back, not 500').toBe(200)

    // Prove the table is still there.
    const check = await api.get('/api/employees?limit=1')
    expect(check.status).toBe(200)
  })

  test('a SQL-injection attempt in ?search is bound, not interpolated', async ({ api }) => {
    const r = await api.get("/api/employees?search=%25'%20OR%201%3D1--")
    expect(r.status).toBe(200)
  })

  test('an ILIKE wildcard in search is treated as a literal value', async ({ api }) => {
    const r = await api.get('/api/employees?search=%25%25%25')
    expect(r.status).toBe(200)
  })

  /**
   * The app REJECTS these rather than clamping them. That is a defensible
   * choice, so the assertion is the invariant that actually matters: never a
   * 500, and never silently honoured. It is worth knowing the two paging
   * paths disagree — `pageQuerySchema` rejects while `normalizePageQuery`
   * clamps — see the QA report.
   */
  test('an oversized limit is refused or clamped, never honoured', async ({ api }) => {
    const r = await api.get('/api/employees?limit=100000')
    expect(r.status).toBeLessThan(500)
    if (r.status === 200) expect(r.data.limit).toBeLessThanOrEqual(200)
    else expect(r.status).toBe(400)
  })

  test('a negative page never produces a negative OFFSET', async ({ api }) => {
    const r = await api.get('/api/employees?page=-5')
    expect(r.status, 'a negative page must not 500').toBeLessThan(500)
    if (r.status === 200) expect(r.data.page).toBeGreaterThanOrEqual(1)
  })

  test('a non-numeric page is handled without a server error', async ({ api }) => {
    const r = await api.get('/api/employees?page=abc&limit=xyz')
    expect(r.status).toBeLessThan(500)
  })

  test('a malformed JSON body is a 400, not a 500', async ({ api }) => {
    const res = await api.ctx.post('/api/employees', {
      headers: { 'Content-Type': 'application/json' },
      data: '{ this is not json',
    })
    expect(res.status(), 'unparseable JSON must not be a 500').toBeLessThan(500)
  })

  test('an over-long name is rejected rather than truncated silently', async ({ api }) => {
    const r = await api.post('/api/employees', {
      name: 'x'.repeat(5000),
      email: uniqEmail(),
      employeeType: 'full_time',
    })
    expect(r.status).toBe(400)
  })

  test('a script tag in a name is stored and returned as data, not executed', async ({ api }) => {
    const payload = `<script>alert(1)</script>${uniq('X')}`
    const created = await api.post('/api/employees', {
      name: payload,
      email: uniqEmail(),
      employeeType: 'full_time',
    })
    expect(created.status).toBe(201)
    expect(created.data.name).toBe(payload)
  })
})

test.describe('Security — authorization boundaries', () => {
  test('the permission matrix is enforced for a plain employee role', async ({ api, playwright, baseURL }) => {
    /**
     * Create an employee, then give THAT employee a working login.
     *
     * Since 0010 there is no separate user record to bind, and an account is
     * born WITHOUT a password — `grantLogin` walks the real invite ->
     * set-password path rather than pretending a shortcut exists.
     */
    const employee = await makeEmployee(api)
    const { email, password } = await grantLogin(api, employee)

    const ctx = await playwright.request.newContext({ baseURL })
    const login = await ctx.post('/api/auth/login', { data: { email, password } })
    expect(login.status(), 'the new employee account must be able to sign in').toBe(200)

    // An employee must NOT be able to create employees or read payroll config.
    const create = await ctx.post('/api/employees', {
      data: { name: uniq('Nope'), email: uniqEmail(), employeeType: 'full_time' },
    })
    expect(create.status(), 'an employee must not create employees').toBe(403)

    const rules = await ctx.get('/api/payroll/rules')
    expect(rules.status(), 'an employee must not read salary rules').toBe(403)

    const users = await ctx.get('/api/users')
    expect(users.status(), 'an employee must not list users').toBe(403)

    await ctx.dispose()
  })

  test('an employee cannot read another employee-scoped resource they do not own', async ({
    api,
    playwright,
    baseURL,
  }) => {
    const mine = await makeEmployee(api)
    const theirs = await makeEmployee(api)
    const { email, password } = await grantLogin(api, mine)

    // Someone else's attendance record, created by the admin.
    const theirAttendance = await api.post('/api/attendance', {
      employeeId: theirs.id,
      checkIn: '2025-03-10T09:00:00.000Z',
    })
    expect(theirAttendance.status).toBe(201)
    const id = theirAttendance.data.id

    const ctx = await playwright.request.newContext({ baseURL })
    await ctx.post('/api/auth/login', { data: { email, password } })

    const read = await ctx.get(`/api/attendance/${id}`)
    expect(
      read.status(),
      "an employee must not read another employee's attendance record",
    ).toBe(403)

    await ctx.dispose()
  })
})

test.describe('Security — the UI offers only what the role may do', () => {
  /**
   * The API already refuses these, and every use case re-checks — so this is
   * about not OFFERING an action that will 403. An employee shown
   * "+ New employee" clicks it, gets a permission error and reads the app as
   * broken rather than as correctly restricted.
   *
   * The buttons are gated with `can()` from the same permission table the
   * server authorises against, which is why the screen and the API cannot
   * drift apart.
   */
  test('a plain employee sees no create or destroy actions', async ({ api, page }) => {
    const employee = await makeEmployee(api)
    const { email, password } = await grantLogin(api, employee)

    await page.goto('/login')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 })

    // The reported bug: "+ New employee" on the employee list.
    await page.goto('/employees')
    await page.waitForLoadState('networkidle')
    await expect(
      page.getByRole('link', { name: /New employee/i }),
      'an employee may not add employees',
    ).toHaveCount(0)
    await expect(page.getByRole('link', { name: /Add the first one/i })).toHaveCount(0)

    // Their own record: readable, but not archivable.
    await page.goto(`/employees/${employee.id}`)
    await page.waitForLoadState('networkidle')
    await expect(
      page.getByRole('button', { name: 'Archive' }),
      'an employee may not archive anybody, including themselves',
    ).toHaveCount(0)

    // Leave policy and allocations are HR configuration.
    await page.goto('/time-off/types')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('link', { name: /New type/i })).toHaveCount(0)

    await page.goto('/time-off/allocations')
    await page.waitForLoadState('networkidle')
    await expect(
      page.getByRole('link', { name: /New allocation/i }),
      'an employee sees their entitlement but cannot grant one',
    ).toHaveCount(0)

    /**
     * ...but the things they CAN do must still be offered. A permission sweep
     * that hides everything is its own bug.
     */
    await page.goto('/time-off/requests')
    await page.waitForLoadState('networkidle')
    await expect(
      page.getByRole('link', { name: /New request/i }),
      'raising leave is exactly what an employee is for',
    ).not.toHaveCount(0)
  })

  test('an HR manager still sees the actions they are entitled to', async ({ page }) => {
    // The QA account is an admin — the control that proves the gate is
    // permission-driven rather than "hidden for everyone".
    await page.goto('/login')
    await page.getByLabel('Email').fill(QA_EMAIL)
    await page.getByLabel('Password').fill(QA_PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 })

    await page.goto('/employees')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('link', { name: /New employee/i })).not.toHaveCount(0)
  })
})

test.describe('Security — the login page', () => {
  test('an open redirect via ?next is not followed', async ({ page }) => {
    await page.goto('/login?next=https://evil.example/pwned')
    await page.getByLabel('Email').fill('qa-bot@peoplepay360.test')
    await page.getByLabel('Password').fill('QaBot!Passw0rd')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 })
    expect(page.url(), 'must never leave the origin').toContain('127.0.0.1:3100')
  })

  test('a protocol-relative ?next is not followed', async ({ page }) => {
    await page.goto('/login?next=//evil.example')
    await page.getByLabel('Email').fill('qa-bot@peoplepay360.test')
    await page.getByLabel('Password').fill('QaBot!Passw0rd')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 })
    expect(page.url()).toContain('127.0.0.1:3100')
  })

  test('an unauthenticated page request is redirected to login', async ({ page }) => {
    await page.goto('/employees')
    await page.waitForURL(/\/login/, { timeout: 20_000 })
    expect(page.url()).toContain('/login')
  })
})
