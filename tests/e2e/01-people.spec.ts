import {
  test,
  expect,
  uniq,
  uniqEmail,
  makeDepartment,
  makeEmployee,
  makeJobPosition,
} from './_helpers/fixtures'

test.describe('People — departments', () => {
  test('creates, reads back, updates and deletes a department', async ({ api }) => {
    const name = uniq('Dept')
    const created = await api.post('/api/departments', { name })
    expect(created.status).toBe(201)
    expect(created.data.name).toBe(name)
    expect(created.data.id).toMatch(/^[0-9a-f-]{36}$/)

    const read = await api.get(`/api/departments/${created.data.id}`)
    expect(read.status).toBe(200)
    expect(read.data.name).toBe(name)

    const renamed = `${name}-renamed`
    const updated = await api.patch(`/api/departments/${created.data.id}`, { name: renamed })
    expect(updated.status).toBe(200)
    expect(updated.data.name).toBe(renamed)

    const removed = await api.del(`/api/departments/${created.data.id}`)
    expect(removed.status).toBe(204)

    const gone = await api.get(`/api/departments/${created.data.id}`)
    expect(gone.status).toBe(404)
  })

  test('rejects a blank name with a field-level message', async ({ api }) => {
    const r = await api.post('/api/departments', { name: '   ' })
    expect(r.status).toBe(400)
    expect(r.error?.code).toBe('VALIDATION_ERROR')
    expect(JSON.stringify(r.error?.details)).toContain('name')
  })

  test('rejects a malformed managerId as 400, not 500', async ({ api }) => {
    const r = await api.post('/api/departments', { name: uniq('Dept'), managerId: 'not-a-uuid' })
    expect(r.status).toBe(400)
  })

  test('returns 404 for a well-formed but unknown id', async ({ api }) => {
    const r = await api.get('/api/departments/00000000-0000-4000-8000-000000000000')
    expect(r.status).toBe(404)
  })
})

test.describe('People — job positions', () => {
  test('creates a job position attached to a department it created', async ({ api }) => {
    const dept = await makeDepartment(api)
    const title = uniq('Role')
    const r = await api.post('/api/job-positions', { title, departmentId: dept.id })
    expect(r.status).toBe(201)
    expect(r.data.title).toBe(title)
    expect(r.data.departmentId).toBe(dept.id)
  })

  test('rejects a blank title', async ({ api }) => {
    const r = await api.post('/api/job-positions', { title: '' })
    expect(r.status).toBe(400)
    expect(r.error?.code).toBe('VALIDATION_ERROR')
  })
})

test.describe('People — employees', () => {
  test('creates an employee with every optional relation populated', async ({ api }) => {
    const dept = await makeDepartment(api)
    const position = await makeJobPosition(api, dept.id)
    const manager = await makeEmployee(api)

    const name = uniq('Emp')
    const email = uniqEmail()
    const r = await api.post('/api/employees', {
      name,
      email,
      employeeType: 'full_time',
      departmentId: dept.id,
      jobPositionId: position.id,
      managerId: manager.id,
      bankAccount: '123456789012',
      isActive: true,
    })
    expect(r.status, JSON.stringify(r.raw)).toBe(201)
    expect(r.data.name).toBe(name)
    expect(r.data.email).toBe(email)
    expect(r.data.departmentId).toBe(dept.id)
    expect(r.data.managerId).toBe(manager.id)
  })

  test('lowercases and trims the email, per the shared zod primitive', async ({ api }) => {
    const raw = uniqEmail().toUpperCase()
    const r = await api.post('/api/employees', {
      name: uniq('Emp'),
      email: `  ${raw}  `,
      employeeType: 'full_time',
    })
    expect(r.status).toBe(201)
    expect(r.data.email).toBe(raw.toLowerCase())
  })

  test('rejects an invalid email address', async ({ api }) => {
    const r = await api.post('/api/employees', {
      name: uniq('Emp'),
      email: 'not-an-email',
      employeeType: 'full_time',
    })
    expect(r.status).toBe(400)
    expect(JSON.stringify(r.error?.details)).toContain('email')
  })

  test('rejects an unknown employeeType', async ({ api }) => {
    const r = await api.post('/api/employees', {
      name: uniq('Emp'),
      email: uniqEmail(),
      employeeType: 'freelance_wizard',
    })
    expect(r.status).toBe(400)
  })

  test('rejects a duplicate email rather than creating a second record', async ({ api }) => {
    const email = uniqEmail()
    const first = await api.post('/api/employees', {
      name: uniq('Emp'),
      email,
      employeeType: 'full_time',
    })
    expect(first.status).toBe(201)

    const second = await api.post('/api/employees', {
      name: uniq('Emp'),
      email,
      employeeType: 'full_time',
    })
    expect(
      second.status,
      `duplicate email should be rejected, got ${second.status}: ${JSON.stringify(second.raw)}`,
    ).toBeGreaterThanOrEqual(400)
    expect(second.status).toBeLessThan(500)
  })

  test('the detail endpoint returns a FLAT record, not the use case shape', async ({ api }) => {
    /**
     * It used to return `{ employee: {...}, counts: {...} }` while the screen
     * was typed against a flat `EmployeeDetailView`. Every field read as
     * undefined, so the form rendered empty and every select fell back to its
     * placeholder — while `counts` lined up by coincidence and made it look
     * like a form bug rather than a contract bug.
     */
    const dept = await makeDepartment(api)
    const employee = await makeEmployee(api, { departmentId: dept.id, bankAccount: '5555' })

    const detail = await api.get(`/api/employees/${employee.id}`)
    expect(detail.status).toBe(200)

    expect(detail.data.employee, 'the aggregate must not be nested under a key').toBeUndefined()
    expect(detail.data.id).toBe(employee.id)
    expect(detail.data.name).toBe(employee.name)
    expect(detail.data.email).toBe(employee.email)
    expect(detail.data.departmentId).toBe(dept.id)
    expect(detail.data.bankAccount).toBe('5555')
    expect(detail.data.employeeType).toBe('full_time')
    expect(detail.data.isActive).toBe(true)
    expect(detail.data.counts, 'the smart-button counts still travel with it').toBeTruthy()
  })

  test('updates an employee and reads the change back', async ({ api }) => {
    const employee = await makeEmployee(api)
    const newName = uniq('Renamed')
    const patched = await api.patch(`/api/employees/${employee.id}`, { name: newName })
    expect(patched.status).toBe(200)

    const detail = await api.get(`/api/employees/${employee.id}`)
    expect(detail.status).toBe(200)
    const payload = JSON.stringify(detail.data)
    expect(payload).toContain(newName)
  })

  test('archiving deactivates rather than destroying the record', async ({ api }) => {
    const employee = await makeEmployee(api)
    const archived = await api.del(`/api/employees/${employee.id}`)
    expect(archived.status).toBe(200)

    const detail = await api.get(`/api/employees/${employee.id}`)
    expect(detail.status, 'archived employee must still be readable').toBe(200)
    expect(JSON.stringify(detail.data)).toContain('false')
  })

  test('filters the list by employeeType', async ({ api }) => {
    const intern = await makeEmployee(api, { employeeType: 'intern' })
    const r = await api.get('/api/employees?employeeType=intern&limit=200')
    expect(r.status).toBe(200)
    const types = r.data.items.map((e: any) => e.employeeType)
    expect(new Set(types)).toEqual(new Set(['intern']))
    expect(r.data.items.some((e: any) => e.id === intern.id)).toBe(true)
  })

  test('filters the list by the department it just created', async ({ api }) => {
    const dept = await makeDepartment(api)
    const employee = await makeEmployee(api, { departmentId: dept.id })
    const r = await api.get(`/api/employees?departmentId=${dept.id}&limit=200`)
    expect(r.status).toBe(200)
    expect(r.data.total).toBe(1)
    expect(r.data.items[0].id).toBe(employee.id)
  })

  test('search matches a name it just created', async ({ api }) => {
    const employee = await makeEmployee(api)
    const r = await api.get(`/api/employees?search=${encodeURIComponent(employee.name)}`)
    expect(r.status).toBe(200)
    expect(r.data.items.some((e: any) => e.id === employee.id)).toBe(true)
  })

  test('paging envelope is internally consistent', async ({ api }) => {
    const r = await api.get('/api/employees?page=1&limit=2')
    expect(r.status).toBe(200)
    expect(r.data.items.length).toBeLessThanOrEqual(2)
    expect(r.data.limit).toBe(2)
    expect(r.data.page).toBe(1)
    expect(r.data.pages).toBe(Math.max(1, Math.ceil(r.data.total / 2)))
  })

  test('an unknown filter key is ignored rather than causing a 500', async ({ api }) => {
    const r = await api.get('/api/employees?nonsenseColumn=whatever')
    expect(r.status).toBe(200)
  })
})

test.describe('People — administrator accounts are not staff', () => {
  test('the employee list hides administrators', async ({ api }) => {
    const listed = await api.get('/api/employees?limit=200')
    expect(listed.status).toBe(200)

    const withAdmins = await api.get('/api/employees?limit=200&includeAdmins=true')
    expect(withAdmins.status).toBe(200)

    const hiddenIds = new Set(listed.data.items.map((e: any) => e.id))
    const admins = withAdmins.data.items.filter((e: any) => !hiddenIds.has(e.id))

    expect(admins.length, 'there is at least one administrator to hide').toBeGreaterThan(0)
    for (const admin of admins) {
      expect(
        listed.data.items.some((e: any) => e.id === admin.id),
        `${admin.email} is an administrator and must not appear on the employee list`,
      ).toBe(false)
    }
  })

  test('the paging total counts what the list actually shows', async ({ api }) => {
    /**
     * The reason the filter lives in the repository rather than the UI: a
     * client-side filter leaves `total` counting rows the user cannot see, so
     * page 2 of a 1-page list is reachable and empty.
     */
    const listed = await api.get('/api/employees?limit=200')
    const withAdmins = await api.get('/api/employees?limit=200&includeAdmins=true')

    expect(listed.data.total).toBe(listed.data.items.length)
    expect(
      listed.data.total,
      'hiding rows must reduce the total, not just the page',
    ).toBeLessThan(withAdmins.data.total)
  })

  test('an administrator is still reachable by id — hidden is not deleted', async ({ api }) => {
    const withAdmins = await api.get('/api/employees?limit=200&includeAdmins=true')
    const listed = await api.get('/api/employees?limit=200')
    const hiddenIds = new Set(listed.data.items.map((e: any) => e.id))
    const admin = withAdmins.data.items.find((e: any) => !hiddenIds.has(e.id))

    expect(admin, 'need an administrator for this test').toBeTruthy()
    const detail = await api.get(`/api/employees/${admin.id}`)
    expect(detail.status, 'the record must still exist and be openable').toBe(200)
  })

  test('hiding administrators does not remove ordinary employees', async ({ api }) => {
    const employee = await makeEmployee(api)
    const listed = await api.get('/api/employees?limit=200')
    expect(
      listed.data.items.some((e: any) => e.id === employee.id),
      'a normal employee must survive the admin filter',
    ).toBe(true)
  })
})
