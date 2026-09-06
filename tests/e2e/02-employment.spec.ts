import {
  test,
  expect,
  uniq,
  makeContract,
  makeEmployee,
  makeSchedule,
} from './_helpers/fixtures'

test.describe('Employment — working schedules', () => {
  test('creates a schedule and computes weekly hours server-side', async ({ api }) => {
    const name = uniq('Sched')
    const r = await api.post('/api/schedules', {
      name,
      days: [1, 2, 3, 4, 5].map((day) => ({
        day,
        start: '09:00',
        end: '18:00',
        breakMinutes: 60,
      })),
    })
    expect(r.status, JSON.stringify(r.raw)).toBe(201)
    expect(r.data.name).toBe(name)
    // 5 days x (9h - 1h break) = 40
    expect(r.data.weeklyHours).toBe(40)
  })

  test('ignores a client-supplied weeklyHours instead of trusting it', async ({ api }) => {
    const r = await api.post('/api/schedules', {
      name: uniq('Sched'),
      weeklyHours: 999,
      days: [{ day: 1, start: '09:00', end: '17:00', breakMinutes: 0 }],
    })
    expect(r.status).toBe(201)
    expect(r.data.weeklyHours, 'weeklyHours must be derived, never accepted').toBe(8)
  })

  test('rejects a schedule with no working days', async ({ api }) => {
    const r = await api.post('/api/schedules', { name: uniq('Sched'), days: [] })
    expect(r.status).toBe(400)
  })

  test('rejects a malformed time value', async ({ api }) => {
    const r = await api.post('/api/schedules', {
      name: uniq('Sched'),
      days: [{ day: 1, start: '25:00', end: '18:00', breakMinutes: 0 }],
    })
    expect(r.status).toBe(400)
  })

  test('rejects a day index outside 0-6', async ({ api }) => {
    const r = await api.post('/api/schedules', {
      name: uniq('Sched'),
      days: [{ day: 9, start: '09:00', end: '18:00', breakMinutes: 0 }],
    })
    expect(r.status).toBe(400)
  })

  test('rejects a break longer than the 600-minute cap', async ({ api }) => {
    const r = await api.post('/api/schedules', {
      name: uniq('Sched'),
      days: [{ day: 1, start: '09:00', end: '18:00', breakMinutes: 601 }],
    })
    expect(r.status).toBe(400)
  })

  test('updates a schedule and recomputes weekly hours', async ({ api }) => {
    const schedule = await makeSchedule(api)
    expect(schedule.weeklyHours).toBe(40)

    const updated = await api.patch(`/api/schedules/${schedule.id}`, {
      days: [
        { day: 1, start: '09:00', end: '13:00', breakMinutes: 0 },
        { day: 2, start: '09:00', end: '13:00', breakMinutes: 0 },
      ],
    })
    expect(updated.status, JSON.stringify(updated.raw)).toBe(200)
    expect(updated.data.weeklyHours, 'weekly hours must follow the new days').toBe(8)
  })

  test('deletes a schedule it created', async ({ api }) => {
    const schedule = await makeSchedule(api)
    const removed = await api.del(`/api/schedules/${schedule.id}`)
    expect([200, 204]).toContain(removed.status)
  })
})

test.describe('Employment — contracts', () => {
  test('creates an open-ended contract for an employee it created', async ({ api }) => {
    const employee = await makeEmployee(api)
    const r = await api.post('/api/contracts', {
      employeeId: employee.id,
      wage: 75000,
      start: '2024-01-01',
      end: null,
    })
    expect(r.status, JSON.stringify(r.raw)).toBe(201)
    expect(r.data.employeeId).toBe(employee.id)
    expect(Number(r.data.wage)).toBe(75000)
  })

  test('rejects an end date before the start date', async ({ api }) => {
    const employee = await makeEmployee(api)
    const r = await api.post('/api/contracts', {
      employeeId: employee.id,
      wage: 50000,
      start: '2024-06-01',
      end: '2024-01-01',
    })
    expect(r.status).toBe(400)
    expect(JSON.stringify(r.error?.details)).toContain('end')
  })

  test('rejects a negative wage', async ({ api }) => {
    const employee = await makeEmployee(api)
    const r = await api.post('/api/contracts', {
      employeeId: employee.id,
      wage: -1,
      start: '2024-01-01',
    })
    expect(r.status).toBe(400)
  })

  test('rejects a wage with more than two decimal places', async ({ api }) => {
    const employee = await makeEmployee(api)
    const r = await api.post('/api/contracts', {
      employeeId: employee.id,
      wage: 100.123,
      start: '2024-01-01',
    })
    expect(r.status).toBe(400)
  })

  test('rejects a contract for a non-existent employee as 4xx, not 500', async ({ api }) => {
    const r = await api.post('/api/contracts', {
      employeeId: '00000000-0000-4000-8000-000000000000',
      wage: 50000,
      start: '2024-01-01',
    })
    expect(r.status, JSON.stringify(r.raw)).toBeGreaterThanOrEqual(400)
    expect(r.status, 'a dangling FK must not surface as a 500').toBeLessThan(500)
  })

  test('refuses two overlapping contracts for the same employee', async ({ api }) => {
    const employee = await makeEmployee(api)
    const first = await api.post('/api/contracts', {
      employeeId: employee.id,
      wage: 50000,
      start: '2024-01-01',
      end: '2024-12-31',
    })
    expect(first.status).toBe(201)

    const overlapping = await api.post('/api/contracts', {
      employeeId: employee.id,
      wage: 60000,
      start: '2024-06-01',
      end: '2025-06-01',
    })
    expect(
      overlapping.status,
      `overlap must be refused, got ${overlapping.status}: ${JSON.stringify(overlapping.raw)}`,
    ).toBeGreaterThanOrEqual(400)
    expect(overlapping.status).toBeLessThan(500)
  })

  test('allows two adjacent, non-overlapping contracts', async ({ api }) => {
    const employee = await makeEmployee(api)
    const first = await api.post('/api/contracts', {
      employeeId: employee.id,
      wage: 50000,
      start: '2023-01-01',
      end: '2023-12-31',
    })
    expect(first.status).toBe(201)

    const second = await api.post('/api/contracts', {
      employeeId: employee.id,
      wage: 60000,
      start: '2024-01-01',
      end: '2024-12-31',
    })
    expect(second.status, JSON.stringify(second.raw)).toBe(201)
  })

  test('updates a contract wage and reads it back', async ({ api }) => {
    const employee = await makeEmployee(api)
    const contract = await makeContract(api, employee.id, { wage: 40000 })
    const updated = await api.patch(`/api/contracts/${contract.id}`, { wage: 45000 })
    expect(updated.status, JSON.stringify(updated.raw)).toBe(200)

    const read = await api.get(`/api/contracts/${contract.id}`)
    expect(Number(read.data.wage)).toBe(45000)
  })

  test('filters contracts by the employee it created', async ({ api }) => {
    const employee = await makeEmployee(api)
    await makeContract(api, employee.id)
    const r = await api.get(`/api/contracts?employeeId=${employee.id}&limit=200`)
    expect(r.status).toBe(200)
    expect(r.data.total).toBe(1)
  })

  test('deletes a contract it created', async ({ api }) => {
    const employee = await makeEmployee(api)
    const contract = await makeContract(api, employee.id)
    const removed = await api.del(`/api/contracts/${contract.id}`)
    expect([200, 204]).toContain(removed.status)
  })
})
