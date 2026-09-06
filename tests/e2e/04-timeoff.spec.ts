import { test, expect, uniq, uniqCode, makeEmployee } from './_helpers/fixtures'

async function makeType(api: any, overrides: Record<string, unknown> = {}) {
  const r = await api.post('/api/time-off/types', {
    name: uniq('Leave'),
    code: uniqCode('L'),
    unit: 'day',
    requiresAllocation: true,
    isPaid: true,
    isActive: true,
    ...overrides,
  })
  expect(r.status, `create time-off type: ${JSON.stringify(r.raw)}`).toBe(201)
  return r.data
}

async function makeAllocation(
  api: any,
  employeeId: string,
  timeOffTypeId: string,
  overrides: Record<string, unknown> = {},
) {
  const r = await api.post('/api/time-off/allocations', {
    employeeId,
    timeOffTypeId,
    allocated: 20,
    validFrom: '2025-01-01',
    validTo: '2025-12-31',
    ...overrides,
  })
  expect(r.status, `create allocation: ${JSON.stringify(r.raw)}`).toBe(201)
  return r.data
}

test.describe('Time Off — types', () => {
  test('creates a type and uppercases its code', async ({ api }) => {
    const code = uniqCode('L')
    const r = await api.post('/api/time-off/types', {
      name: uniq('Leave'),
      code: code.toLowerCase(),
      unit: 'day',
      requiresAllocation: true,
      isPaid: true,
      isActive: true,
    })
    expect(r.status, JSON.stringify(r.raw)).toBe(201)
    expect(r.data.code).toBe(code)
  })

  test('rejects a code containing punctuation', async ({ api }) => {
    const r = await api.post('/api/time-off/types', {
      name: uniq('Leave'),
      code: 'BAD-CODE!',
      unit: 'day',
      requiresAllocation: true,
      isPaid: true,
      isActive: true,
    })
    expect(r.status).toBe(400)
  })

  test('rejects an unknown unit', async ({ api }) => {
    const r = await api.post('/api/time-off/types', {
      name: uniq('Leave'),
      code: uniqCode('L'),
      unit: 'fortnight',
      requiresAllocation: true,
      isPaid: true,
      isActive: true,
    })
    expect(r.status).toBe(400)
  })

  test('updates a type it created', async ({ api }) => {
    const type = await makeType(api)
    const renamed = uniq('Renamed')
    const r = await api.patch(`/api/time-off/types/${type.id}`, {
      name: renamed,
      code: type.code,
      unit: type.unit,
      requiresAllocation: type.requiresAllocation,
      isPaid: type.isPaid,
      isActive: type.isActive,
    })
    expect(r.status, JSON.stringify(r.raw)).toBe(200)
    expect(r.data.name).toBe(renamed)
  })
})

test.describe('Time Off — allocations', () => {
  test('allocates leave to an employee it created', async ({ api }) => {
    const employee = await makeEmployee(api)
    const type = await makeType(api)
    const allocation = await makeAllocation(api, employee.id, type.id, { allocated: 15 })
    expect(Number(allocation.allocated)).toBe(15)
  })

  test('rejects a validity window that ends before it starts', async ({ api }) => {
    const employee = await makeEmployee(api)
    const type = await makeType(api)
    const r = await api.post('/api/time-off/allocations', {
      employeeId: employee.id,
      timeOffTypeId: type.id,
      allocated: 10,
      validFrom: '2025-12-31',
      validTo: '2025-01-01',
    })
    expect(r.status).toBe(400)
    expect(JSON.stringify(r.error?.details)).toContain('validTo')
  })

  test('rejects a zero or negative allocation', async ({ api }) => {
    const employee = await makeEmployee(api)
    const type = await makeType(api)
    const r = await api.post('/api/time-off/allocations', {
      employeeId: employee.id,
      timeOffTypeId: type.id,
      allocated: 0,
      validFrom: '2025-01-01',
      validTo: '2025-12-31',
    })
    expect(r.status).toBe(400)
  })

  test('approves an allocation it created', async ({ api }) => {
    const employee = await makeEmployee(api)
    const type = await makeType(api)
    const allocation = await makeAllocation(api, employee.id, type.id)
    const r = await api.post(`/api/time-off/allocations/${allocation.id}/approve`)
    expect(r.status, JSON.stringify(r.raw)).toBe(200)
  })

  test('refuses an allocation it created', async ({ api }) => {
    const employee = await makeEmployee(api)
    const type = await makeType(api)
    const allocation = await makeAllocation(api, employee.id, type.id)
    const r = await api.post(`/api/time-off/allocations/${allocation.id}/refuse`)
    expect(r.status, JSON.stringify(r.raw)).toBe(200)
  })
})

test.describe('Time Off — requests and the state machine', () => {
  test('full lifecycle: draft -> submit -> approve, with balance deducted', async ({ api }) => {
    const employee = await makeEmployee(api)
    const type = await makeType(api)
    const allocation = await makeAllocation(api, employee.id, type.id, { allocated: 20 })
    await api.post(`/api/time-off/allocations/${allocation.id}/approve`)

    const before = await api.get(
      `/api/time-off/balance?employeeId=${employee.id}&on=2025-06-15`,
    )
    expect(before.status, JSON.stringify(before.raw)).toBe(200)

    const created = await api.post('/api/time-off/requests', {
      employeeId: employee.id,
      timeOffTypeId: type.id,
      start: '2025-06-02',
      end: '2025-06-04',
      asDraft: true,
    })
    expect(created.status, JSON.stringify(created.raw)).toBe(201)
    expect(created.data.status).toBe('draft')

    const submitted = await api.post(`/api/time-off/requests/${created.data.id}/submit`)
    expect(submitted.status, JSON.stringify(submitted.raw)).toBe(200)
    expect(submitted.data.status).toBe('to_approve')

    const approved = await api.post(`/api/time-off/requests/${created.data.id}/approve`)
    expect(approved.status, JSON.stringify(approved.raw)).toBe(200)
    expect(approved.data.status).toBe('approved')

    const after = await api.get(`/api/time-off/balance?employeeId=${employee.id}&on=2025-06-15`)
    const row = (after.data ?? []).find((b: any) => b.timeOffTypeId === type.id)
    expect(row, 'balance must include the type just allocated').toBeTruthy()
    expect(Number(row.taken), '3 inclusive days must be deducted').toBe(3)
  })

  test('a draft request cannot be approved before it is submitted', async ({ api }) => {
    const employee = await makeEmployee(api)
    const type = await makeType(api)
    const allocation = await makeAllocation(api, employee.id, type.id)
    await api.post(`/api/time-off/allocations/${allocation.id}/approve`)

    const created = await api.post('/api/time-off/requests', {
      employeeId: employee.id,
      timeOffTypeId: type.id,
      start: '2025-07-01',
      end: '2025-07-02',
      asDraft: true,
    })
    expect(created.status).toBe(201)

    const approved = await api.post(`/api/time-off/requests/${created.data.id}/approve`)
    expect(approved.status, 'illegal transition must be 422, not 500').toBe(422)
    expect(approved.error?.code).toBe('LEAVE_ILLEGAL_TRANSITION')
  })

  test('a refused request cannot be approved afterwards', async ({ api }) => {
    const employee = await makeEmployee(api)
    const type = await makeType(api)
    const allocation = await makeAllocation(api, employee.id, type.id)
    await api.post(`/api/time-off/allocations/${allocation.id}/approve`)

    const created = await api.post('/api/time-off/requests', {
      employeeId: employee.id,
      timeOffTypeId: type.id,
      start: '2025-08-01',
      end: '2025-08-02',
    })
    expect(created.status).toBe(201)
    if (created.data.status === 'draft') {
      await api.post(`/api/time-off/requests/${created.data.id}/submit`)
    }
    const refused = await api.post(`/api/time-off/requests/${created.data.id}/refuse`)
    expect(refused.status, JSON.stringify(refused.raw)).toBe(200)

    const approved = await api.post(`/api/time-off/requests/${created.data.id}/approve`)
    expect(approved.status).toBe(422)
  })

  test('refuses a request with no allocation to draw from', async ({ api }) => {
    const employee = await makeEmployee(api)
    const type = await makeType(api)
    
    const r = await api.post('/api/time-off/requests', {
      employeeId: employee.id,
      timeOffTypeId: type.id,
      start: '2025-09-01',
      end: '2025-09-02',
    })
    expect(r.status, 'no allocation must be a business error, not a 500').toBeGreaterThanOrEqual(400)
    expect(r.status).toBeLessThan(500)
    expect(r.error?.code).toBe('NO_ALLOCATION')
  })

  test('refuses a request larger than the remaining balance', async ({ api }) => {
    const employee = await makeEmployee(api)
    const type = await makeType(api)
    const allocation = await makeAllocation(api, employee.id, type.id, { allocated: 2 })
    await api.post(`/api/time-off/allocations/${allocation.id}/approve`)

    const r = await api.post('/api/time-off/requests', {
      employeeId: employee.id,
      timeOffTypeId: type.id,
      start: '2025-06-02',
      end: '2025-06-20',
    })
    expect(r.status).toBeGreaterThanOrEqual(400)
    expect(r.status).toBeLessThan(500)
    expect(r.error?.code).toBe('INSUFFICIENT_BALANCE')
  })

  test('refuses two overlapping leave requests for the same employee', async ({ api }) => {
    const employee = await makeEmployee(api)
    const type = await makeType(api)
    const allocation = await makeAllocation(api, employee.id, type.id, { allocated: 30 })
    await api.post(`/api/time-off/allocations/${allocation.id}/approve`)

    const first = await api.post('/api/time-off/requests', {
      employeeId: employee.id,
      timeOffTypeId: type.id,
      start: '2025-06-02',
      end: '2025-06-06',
    })
    expect(first.status, JSON.stringify(first.raw)).toBe(201)

    const overlapping = await api.post('/api/time-off/requests', {
      employeeId: employee.id,
      timeOffTypeId: type.id,
      start: '2025-06-04',
      end: '2025-06-10',
    })
    expect(overlapping.status).toBe(409)
    expect(overlapping.error?.code).toBe('LEAVE_OVERLAP')
  })

  test('rejects a leave request that ends before it starts', async ({ api }) => {
    const employee = await makeEmployee(api)
    const type = await makeType(api)
    const r = await api.post('/api/time-off/requests', {
      employeeId: employee.id,
      timeOffTypeId: type.id,
      start: '2025-06-10',
      end: '2025-06-01',
    })
    expect(r.status).toBe(400)
  })

  test('pending requests reduce the bookable balance without counting as taken', async ({
    api,
  }) => {
    const employee = await makeEmployee(api)
    const type = await makeType(api)
    const allocation = await makeAllocation(api, employee.id, type.id, { allocated: 10 })
    await api.post(`/api/time-off/allocations/${allocation.id}/approve`)

    const created = await api.post('/api/time-off/requests', {
      employeeId: employee.id,
      timeOffTypeId: type.id,
      start: '2025-06-02',
      end: '2025-06-04',
    })
    expect(created.status).toBe(201)
    if (created.data.status === 'draft') {
      await api.post(`/api/time-off/requests/${created.data.id}/submit`)
    }

    const balance = await api.get(
      `/api/time-off/balance?employeeId=${employee.id}&on=2025-06-15`,
    )
    const row = (balance.data ?? []).find((b: any) => b.timeOffTypeId === type.id)
    expect(row).toBeTruthy()
    expect(Number(row.taken), 'pending must not count as taken').toBe(0)
    expect(Number(row.pending), 'pending must be visible').toBe(3)
    expect(Number(row.remaining), 'remaining must subtract pending').toBe(7)
  })
})
