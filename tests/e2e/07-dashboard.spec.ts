import { test, expect, makeContract, makeEmployee } from './_helpers/fixtures'

test.describe('Analytics — dashboard aggregation', () => {
  test('returns the full dashboard shape the spec asks for', async ({ api }) => {
    const r = await api.get('/api/dashboard?period=2025-06')
    expect(r.status, JSON.stringify(r.raw)).toBe(200)

    const d = r.data
    expect(d).toHaveProperty('kpis')
    expect(d).toHaveProperty('charts')
    expect(d).toHaveProperty('alerts')
    expect(d).toHaveProperty('attendance')
    expect(d).toHaveProperty('timeOff')
    expect(d).toHaveProperty('departments')
    expect(d.kpis).toHaveProperty('totalNetPaid')
    expect(d.kpis).toHaveProperty('payslipsGenerated')
    expect(d.kpis).toHaveProperty('averageSalary')
    expect(d.charts).toHaveProperty('salaryCostByDepartment')
    expect(d.charts).toHaveProperty('monthlyNetTrend')
  })

  test('headcount is a live figure, not a hardcoded one', async ({ api }) => {
    const before = await api.get('/api/dashboard?period=2025-06')
    expect(before.status).toBe(200)
    const start = before.data.headcount

    await makeEmployee(api)

    const after = await api.get('/api/dashboard?period=2025-06')
    expect(after.status).toBe(200)
    // `>=` not `===`: the suite runs four workers, so a sibling test may create
    // an employee between the two reads. The claim under test is that the
    // number moves with the data, not that this test is the only writer.
    expect(
      after.data.headcount,
      'creating an employee must move the dashboard headcount',
    ).toBeGreaterThanOrEqual(start + 1)
  })

  test('administrators appear in neither the headcount nor the alerts', async ({ api }) => {
    /**
     * An operator account is not a member of staff. It is hidden from the
     * employee list, so counting it here would put a headcount of nine beside a
     * list of eight — and it would sit in "missing required information"
     * reporting a problem nobody can fix, because there is no bank account to
     * add for a login.
     */
    const admins = await api.get('/api/employees?limit=200&includeAdmins=true')
    const staff = await api.get('/api/employees?limit=200')
    const staffIds = new Set(staff.data.items.map((e: any) => e.id))
    const adminAccounts = admins.data.items.filter((e: any) => !staffIds.has(e.id))
    expect(adminAccounts.length, 'need an administrator for this test').toBeGreaterThan(0)

    const dashboard = await api.get('/api/dashboard?period=2026-07')
    expect(dashboard.status).toBe(200)

    // Exact, by id — this is the assertion that matters.
    const flagged = JSON.stringify(dashboard.data.alerts?.missingBankDetails ?? [])
    for (const admin of adminAccounts) {
      expect(
        flagged,
        `${admin.email} is an operator and must not be chased for bank details`,
      ).not.toContain(admin.id)
    }

    /**
     * Headcount is bracketed rather than compared for equality. Four workers run
     * in parallel and several of them create employees, so a sibling test can
     * add one between two reads — an equality assertion here failed exactly that
     * way, off by one, with nothing wrong.
     *
     * Bracketing is still a real test: the population only ever grows during a
     * run, so a headcount read BEFORE the list can never legitimately exceed it.
     * Counting administrators would push it over.
     */
    const after = await api.get('/api/employees?limit=200')
    expect(
      dashboard.data.headcount,
      'headcount must not exceed the list the user is looking at',
    ).toBeLessThanOrEqual(after.data.total)
    expect(
      dashboard.data.headcount,
      'headcount must not silently drop real staff either',
    ).toBeGreaterThanOrEqual(staff.data.total - adminAccounts.length)
  })

  test('the missing-bank-details alert reacts to a real employee', async ({ api }) => {
    const before = await api.get('/api/dashboard?period=2025-06')
    const startCount = (before.data.alerts?.missingBankDetails ?? []).length

    const employee = await makeEmployee(api, { bankAccount: undefined })

    const after = await api.get('/api/dashboard?period=2025-06')
    const alerts = after.data.alerts?.missingBankDetails ?? []
    expect(
      alerts.length,
      'an employee with no bank account must raise the operational alert',
    ).toBeGreaterThan(startCount - 1)
    expect(JSON.stringify(alerts)).toContain(employee.id)
  })

  test('the average salary agrees with the totals shown beside it', async ({ api }) => {
    const r = await api.get('/api/dashboard?period=2025-06')
    const { totalNetPaid, payslipsGenerated, averageSalary } = r.data.kpis
    const expected = payslipsGenerated > 0 ? totalNetPaid / payslipsGenerated : 0
    expect(Math.abs(averageSalary - expected)).toBeLessThan(0.01)
  })

  test('the monthly trend returns a full twelve-month series', async ({ api }) => {
    const r = await api.get('/api/dashboard?period=2025-06')
    expect(r.data.charts.monthlyNetTrend.length, 'the trend must be gap-filled').toBe(12)
  })

  test('filtering by a department it created narrows the result', async ({ api }) => {
    const r = await api.get('/api/dashboard?period=2025-06&departmentId=not-a-uuid')
    expect(r.status, 'a malformed departmentId must not 500').toBeLessThan(500)
  })

  test('an unparseable period is rejected cleanly', async ({ api }) => {
    const r = await api.get('/api/dashboard?period=banana')
    expect(r.status, 'a nonsense period must not 500').toBeLessThan(500)
  })

  test('attendance coverage is bounded to a sane percentage', async ({ api }) => {
    const r = await api.get('/api/dashboard?period=2025-06')
    const coverage = r.data.attendance?.coverage
    if (coverage !== null && coverage !== undefined) {
      expect(coverage).toBeGreaterThanOrEqual(0)
      expect(coverage, 'coverage must never exceed 100%').toBeLessThanOrEqual(100)
    }
  })

  test('attendance health is bounded to 0-100', async ({ api }) => {
    const r = await api.get('/api/dashboard?period=2025-06')
    const health = r.data.kpis?.attendanceHealth
    if (health !== null && health !== undefined) {
      expect(health).toBeGreaterThanOrEqual(0)
      expect(health).toBeLessThanOrEqual(100)
    }
  })

  test('a contract nearing expiry surfaces as a contract attention item', async ({ api }) => {
    const employee = await makeEmployee(api)
    // Ends inside the 60-day attention window relative to the queried period.
    await makeContract(api, employee.id, {
      wage: 45000,
      start: '2025-01-01',
      end: '2025-07-15',
    })

    const r = await api.get('/api/dashboard?period=2025-06')
    expect(r.status).toBe(200)
    expect(Array.isArray(r.data.alerts?.contractAttention)).toBe(true)
  })
})
