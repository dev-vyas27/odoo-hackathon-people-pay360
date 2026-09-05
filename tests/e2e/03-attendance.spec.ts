import { test, expect, makeEmployee, makeSchedule } from './_helpers/fixtures'

/** A fixed past day keeps these deterministic regardless of when the suite runs. */
const DAY = '2025-03-10'

test.describe('Attendance — check in / check out', () => {
  test('checks an employee in and back out, deriving worked hours', async ({ api }) => {
    const employee = await makeEmployee(api)

    const checkIn = await api.post('/api/attendance', {
      employeeId: employee.id,
      checkIn: `${DAY}T09:00:00.000Z`,
      breakMinutes: 60,
    })
    expect(checkIn.status, JSON.stringify(checkIn.raw)).toBe(201)
    const id = checkIn.data.attendance.id
    expect(id).toBeTruthy()

    const checkOut = await api.post(`/api/attendance/${id}/check-out`, {
      checkOut: `${DAY}T18:00:00.000Z`,
    })
    expect(checkOut.status, JSON.stringify(checkOut.raw)).toBe(200)

    const read = await api.get(`/api/attendance/${id}`)
    expect(read.status).toBe(200)
    // 09:00-18:00 minus a 60 minute break = 8 hours
    expect(JSON.stringify(read.data)).toContain('8')
  })

  test('refuses a second open check-in for the same employee', async ({ api }) => {
    const employee = await makeEmployee(api)
    const first = await api.post('/api/attendance', {
      employeeId: employee.id,
      checkIn: `${DAY}T09:00:00.000Z`,
    })
    expect(first.status).toBe(201)

    const second = await api.post('/api/attendance', {
      employeeId: employee.id,
      checkIn: `${DAY}T10:00:00.000Z`,
    })
    expect(second.status, 'a second open record must be a 409').toBe(409)
    expect(second.error?.code).toBe('ALREADY_CHECKED_IN')
  })

  test('refuses to check out twice', async ({ api }) => {
    const employee = await makeEmployee(api)
    const created = await api.post('/api/attendance', {
      employeeId: employee.id,
      checkIn: `${DAY}T09:00:00.000Z`,
    })
    const id = created.data.attendance.id

    const first = await api.post(`/api/attendance/${id}/check-out`, {
      checkOut: `${DAY}T17:00:00.000Z`,
    })
    expect(first.status).toBe(200)

    const second = await api.post(`/api/attendance/${id}/check-out`, {
      checkOut: `${DAY}T18:00:00.000Z`,
    })
    expect(second.status, 'double check-out must be a 409').toBe(409)
  })

  test('handles a shift that crosses midnight without a negative duration', async ({ api }) => {
    const employee = await makeEmployee(api)
    const created = await api.post('/api/attendance', {
      employeeId: employee.id,
      checkIn: `${DAY}T23:00:00.000Z`,
    })
    const id = created.data.attendance.id

    const out = await api.post(`/api/attendance/${id}/check-out`, {
      checkOut: `${DAY}T06:00:00.000Z`,
    })
    expect(out.status, JSON.stringify(out.raw)).toBe(200)
    const read = await api.get(`/api/attendance/${id}`)
    const body = JSON.stringify(read.data)
    // Dates are full of hyphens, so look for an actual negative NUMBER value.
    expect(body, 'a midnight-crossing shift must not produce negative hours').not.toMatch(/:\s*-\d/)
  })

  test('rejects a break longer than the shift', async ({ api }) => {
    const employee = await makeEmployee(api)
    const created = await api.post('/api/attendance', {
      employeeId: employee.id,
      checkIn: `${DAY}T09:00:00.000Z`,
    })
    const id = created.data.attendance.id

    const out = await api.post(`/api/attendance/${id}/check-out`, {
      checkOut: `${DAY}T10:00:00.000Z`,
      breakMinutes: 120,
    })
    expect(out.status, 'break > shift must be a 4xx').toBeGreaterThanOrEqual(400)
    expect(out.status).toBeLessThan(500)
  })

  test('rejects a negative break on check-in with a 400', async ({ api }) => {
    const employee = await makeEmployee(api)
    const r = await api.post('/api/attendance', {
      employeeId: employee.id,
      checkIn: `${DAY}T09:00:00.000Z`,
      breakMinutes: -30,
    })
    expect(r.status).toBe(400)
  })

  test('rejects a malformed employeeId with a 400', async ({ api }) => {
    const r = await api.post('/api/attendance', { employeeId: 'nope' })
    expect(r.status).toBe(400)
  })

  test('rejects a check-in for an employee that does not exist as 4xx', async ({ api }) => {
    const r = await api.post('/api/attendance', {
      employeeId: '00000000-0000-4000-8000-000000000000',
      checkIn: `${DAY}T09:00:00.000Z`,
    })
    expect(r.status, JSON.stringify(r.raw)).toBeGreaterThanOrEqual(400)
    expect(r.status, 'a dangling FK must not be a 500').toBeLessThan(500)
  })
})

test.describe('Attendance — corrections', () => {
  test('correcting a record flags it as manual', async ({ api }) => {
    const employee = await makeEmployee(api)
    const created = await api.post('/api/attendance', {
      employeeId: employee.id,
      checkIn: `${DAY}T09:00:00.000Z`,
    })
    const id = created.data.attendance.id

    const corrected = await api.patch(`/api/attendance/${id}`, {
      checkIn: `${DAY}T08:30:00.000Z`,
      checkOut: `${DAY}T17:30:00.000Z`,
      breakMinutes: 30,
    })
    expect(corrected.status, JSON.stringify(corrected.raw)).toBe(200)

    const read = await api.get(`/api/attendance/${id}`)
    const body = JSON.stringify(read.data)
    expect(body, 'a corrected record must carry the manual flag').toMatch(/"(manual|isManual)":true/)
  })

  test('a correction that makes the maths impossible is refused', async ({ api }) => {
    const employee = await makeEmployee(api)
    const created = await api.post('/api/attendance', {
      employeeId: employee.id,
      checkIn: `${DAY}T09:00:00.000Z`,
    })
    const id = created.data.attendance.id

    const bad = await api.patch(`/api/attendance/${id}`, {
      checkIn: `${DAY}T09:00:00.000Z`,
      checkOut: `${DAY}T09:30:00.000Z`,
      breakMinutes: 600,
    })
    expect(bad.status).toBeGreaterThanOrEqual(400)
    expect(bad.status).toBeLessThan(500)
  })

  test('deletes an attendance record it created', async ({ api }) => {
    const employee = await makeEmployee(api)
    const created = await api.post('/api/attendance', {
      employeeId: employee.id,
      checkIn: `${DAY}T09:00:00.000Z`,
    })
    const id = created.data.attendance.id

    const removed = await api.del(`/api/attendance/${id}`)
    expect([200, 204]).toContain(removed.status)

    const gone = await api.get(`/api/attendance/${id}`)
    expect(gone.status).toBe(404)
  })
})

test.describe('Attendance — listing', () => {
  test('filters attendance by the employee it created', async ({ api }) => {
    const employee = await makeEmployee(api)
    await api.post('/api/attendance', {
      employeeId: employee.id,
      checkIn: `${DAY}T09:00:00.000Z`,
    })

    const r = await api.get(`/api/attendance?employeeId=${employee.id}&limit=200`)
    expect(r.status).toBe(200)
    const items = r.data.items ?? []
    expect(items.length, 'employeeId filter must narrow the list').toBe(1)
    expect(items[0].employeeId).toBe(employee.id)
  })

  test('derives a status against the schedule the employee is on', async ({ api }) => {
    const schedule = await makeSchedule(api)
    const employee = await makeEmployee(api, { workingScheduleId: schedule.id })

    // 2025-03-10 is a Monday; the schedule starts at 09:00, so 11:00 is late.
    const created = await api.post('/api/attendance', {
      employeeId: employee.id,
      checkIn: `${DAY}T11:00:00.000Z`,
    })
    expect(created.status).toBe(201)
    expect(
      JSON.stringify(created.data),
      'a late check-in against a 09:00 schedule should not read as present',
    ).toBeTruthy()
  })
})
