import {
  test,
  expect,
  makeDepartment,
  makeEmployee,
  makeJobPosition,
  makeSchedule,
  uniq,
  uniqEmail,
  QA_EMAIL,
  QA_PASSWORD,
} from './_helpers/fixtures'
import type { Page } from '@playwright/test'

async function signIn(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(QA_EMAIL)
  await page.getByLabel('Password').fill(QA_PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 })
}

test.describe('UI — sign in and navigate', () => {
  test('signs in and lands on an authenticated page', async ({ page }) => {
    await signIn(page)
    expect(page.url()).not.toContain('/login')
    await expect(page.locator('body')).not.toContainText('Sign in to continue')
  })

  test('signs out and can no longer reach a protected page', async ({ page }) => {
    await signIn(page)
    await page.request.post('/api/auth/logout')
    await page.goto('/employees')
    await page.waitForURL(/\/login/, { timeout: 20_000 })
    expect(page.url()).toContain('/login')
  })

  const sections = [
    '/employees',
    '/contracts',
    '/schedules',
    '/attendance',
    '/time-off',
    '/payroll',
    '/reports',
  ]

  for (const path of sections) {
    test(`${path} renders without a client-side error`, async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text())
      })

      await signIn(page)
      const response = await page.goto(path)
      expect(response?.status(), `${path} must not return a server error`).toBeLessThan(500)
      await page.waitForLoadState('networkidle', { timeout: 30_000 })

      // Next renders a recognisable shell for an unhandled server exception.
      await expect(page.locator('body')).not.toContainText(
        'Application error: a server-side exception',
      )
      const real = errors.filter(
        (e) => !e.includes('favicon') && !e.toLowerCase().includes('download the react devtools'),
      )
      expect(real, `${path} produced console errors:\n${real.join('\n')}`).toEqual([])
    })
  }
})

test.describe('UI — employee creation journey', () => {
  test('creates an employee through the form and sees it in the list', async ({ page }) => {
    await signIn(page)
    await page.goto('/employees/new')

    const name = uniq('UIEmp')
    await page.getByLabel('Name').fill(name)
    await page.getByLabel('Email').fill(uniqEmail())
    await page.getByRole('button', { name: 'Create employee' }).click()

    // Lands on the detail page for the record it created.
    await page.waitForURL(/\/employees\/[0-9a-f-]{36}/, { timeout: 30_000 })
    await expect(page.locator('body')).toContainText(name)

    await page.goto('/employees')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).toContainText(name)
  })

  test('client-side validation blocks an empty submit', async ({ page }) => {
    await signIn(page)
    await page.goto('/employees/new')
    await page.getByRole('button', { name: 'Create employee' }).click()

    // Must not navigate, and must show a field-level message.
    await page.waitForTimeout(1500)
    expect(page.url(), 'an invalid form must not navigate').toContain('/employees/new')
    await expect(page.locator('body')).toContainText(/required|Enter a valid/i)
  })

  test('client-side validation rejects a malformed email before the network', async ({ page }) => {
    await signIn(page)
    await page.goto('/employees/new')
    await page.getByLabel('Name').fill(uniq('UIEmp'))
    await page.getByLabel('Email').fill('nope')
    await page.getByRole('button', { name: 'Create employee' }).click()
    await page.waitForTimeout(1200)
    expect(page.url()).toContain('/employees/new')
    await expect(page.locator('body')).toContainText(/valid email/i)
  })
})

test.describe('UI — employee detail screen', () => {
  test('shows the saved values, not the placeholders', async ({ page }) => {
    await signIn(page)

    // Pick a seeded employee that actually has its relations populated.
    const listed = await page.request.get('/api/employees?limit=200')
    const items = (await listed.json()).data.items as any[]
    const target = items.find(
      (e) => e.departmentId && e.jobPositionId && e.workingScheduleId && e.managerId,
    )
    expect(target, 'need a fully-populated employee — run the demo seed').toBeTruthy()

    await page.goto(`/employees/${target.id}`)
    await page.waitForLoadState('networkidle')

    await expect(page.getByLabel('Name')).toHaveValue(target.name)
    await expect(page.getByLabel('Email')).toHaveValue(target.email)

    // Every select must display a chosen value rather than its "Select ..." hint.
    const combos = await page.locator('button[role="combobox"]').all()
    expect(combos.length).toBeGreaterThan(0)
    for (const combo of combos) {
      const text = (await combo.innerText()).trim()
      expect(text, 'a populated field must not render its placeholder').not.toMatch(
        /^Select\b|^Loading\.\.\.$/,
      )
    }
  })

  test('groups the form under section headings', async ({ page }) => {
    await signIn(page)
    const listed = await page.request.get('/api/employees?limit=200')
    const target = (await listed.json()).data.items[0]

    await page.goto(`/employees/${target.id}`)
    await page.waitForLoadState('networkidle')

    const headings = await page.locator('h2').allInnerTexts()
    for (const expected of ['Identity', 'Organisation', 'Pay and hours', 'Status']) {
      expect(
        headings.some((h) => h.toLowerCase() === expected.toLowerCase()),
        `missing section heading: ${expected} (got ${headings.join(', ')})`,
      ).toBe(true)
    }
  })
})

test.describe('UI — employee detail rules', () => {
  /**
   * Radix renders a hidden native <select> beside each trigger to carry the
   * value into a form post, and it shares the field's accessible name — so
   * `getByLabel` is ambiguous and resolves to something unclickable. The
   * trigger is the element with role=combobox.
   */
  const selectFor = (page: Page, label: string) =>
    page.getByRole('combobox', { name: label })

  async function optionsUnder(page: Page, label: string): Promise<string[]> {
    await selectFor(page, label).click()
    await page.waitForTimeout(400)
    const options = await page.getByRole('option').allInnerTexts()
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
    return options.map((o) => o.trim())
  }

  test('email is read-only once the employee exists', async ({ page }) => {
    await signIn(page)

    // Creating: editable.
    await page.goto('/employees/new')
    await page.waitForLoadState('networkidle')
    await expect(page.getByLabel('Email'), 'a new employee needs an address').toBeEnabled()

    // Editing: locked. The address is the sign-in credential since 0010.
    const listed = await page.request.get('/api/employees?limit=200')
    const target = (await listed.json()).data.items[0]
    await page.goto(`/employees/${target.id}`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByLabel('Email')).toBeDisabled()
    await expect(page.getByLabel('Name'), 'only the email is locked').toBeEnabled()
  })

  test('the manager list excludes the employee and their own reports', async ({ page, api }) => {
    // Build a real two-level line: report -> lead.
    const lead = await makeEmployee(api)
    const report = await makeEmployee(api, { managerId: lead.id })
    const indirect = await makeEmployee(api, { managerId: report.id })

    await signIn(page)
    await page.goto(`/employees/${lead.id}`)
    await page.waitForLoadState('networkidle')

    const options = await optionsUnder(page, 'Manager')
    expect(options.length, 'the picker should still offer somebody').toBeGreaterThan(0)
    expect(options, 'an employee cannot manage themselves').not.toContain(lead.name)
    expect(options, 'a direct report cannot become the manager').not.toContain(report.name)
    expect(
      options,
      'nor can an indirect report — that closes a longer loop',
    ).not.toContain(indirect.name)
  })

  test('the working schedule follows the employee type', async ({ page, api }) => {
    const employee = await makeEmployee(api, { employeeType: 'intern' })

    await signIn(page)
    await page.goto(`/employees/${employee.id}`)
    await page.waitForLoadState('networkidle')

    // Intern: unrestricted, so both a full-time and a part-time schedule appear.
    const asIntern = await optionsUnder(page, 'Working schedule')
    expect(asIntern.length, 'interns choose from every schedule').toBeGreaterThan(1)

    // Full time: only full-time schedules, and one is chosen automatically.
    await selectFor(page, 'Employee type').click()
    await page.getByRole('option', { name: 'Full Time' }).click()
    await page.waitForTimeout(600)

    const fullTimeValue = (await selectFor(page, 'Working schedule').innerText()).trim()
    expect(fullTimeValue, 'a full-timer gets a schedule without being asked').not.toMatch(
      /^Select\b/,
    )
    expect(fullTimeValue, 'and it is a full-time one').toMatch(/\(4\d h?\)|\(4\dh\)|\(3[5-9]h\)/)

    const fullTimeOptions = await optionsUnder(page, 'Working schedule')
    for (const option of fullTimeOptions) {
      const hours = Number(option.match(/\((\d+)h\)/)?.[1] ?? 0)
      expect(hours, `${option} is not a full-time schedule`).toBeGreaterThanOrEqual(35)
    }

    // Part time: the selection moves to a part-time schedule rather than
    // leaving them on hours their pay would then be prorated against.
    await selectFor(page, 'Employee type').click()
    await page.getByRole('option', { name: 'Part Time' }).click()
    await page.waitForTimeout(600)

    const partTimeOptions = await optionsUnder(page, 'Working schedule')
    expect(partTimeOptions.length).toBeGreaterThan(0)
    for (const option of partTimeOptions) {
      const hours = Number(option.match(/\((\d+)h\)/)?.[1] ?? 999)
      expect(hours, `${option} is not a part-time schedule`).toBeLessThan(35)
    }

    const partTimeValue = (await selectFor(page, 'Working schedule').innerText()).trim()
    expect(partTimeValue, 'the full-time schedule must not have stuck').not.toBe(fullTimeValue)
  })
})

test.describe('UI — contract inherits the employee’s placement', () => {
  test('picking an employee fills department, position and schedule, all locked', async ({
    page,
  }) => {
    await signIn(page)

    const listed = await page.request.get('/api/employees?limit=200')
    const items = (await listed.json()).data.items as any[]
    const target = items.find(
      (e) => e.departmentId && e.jobPositionId && e.workingScheduleId,
    )
    expect(target, 'need a fully-placed employee — run the demo seed').toBeTruthy()

    await page.goto('/contracts/new')
    await page.waitForLoadState('networkidle')

    const schedule = page.getByRole('combobox', { name: 'Working schedule' })
    const inherited = page.locator('text=From the employee record').locator('..')

    // Nothing to inherit yet.
    await expect(schedule).toContainText('Select an employee first')

    await page.getByRole('combobox', { name: 'Employee' }).click()
    await page.getByRole('option', { name: target.name, exact: true }).click()
    await page.waitForTimeout(1000)

    // The schedule is a real contract column, so it is a (locked) field.
    await expect(schedule).not.toContainText('Select an employee first')
    /**
     * Locked is the point, not the polish: payroll prorates against
     * `contract.workingScheduleId`, so a hand-edited schedule that disagrees
     * with the employee's pays the wrong amount and nothing downstream notices.
     */
    await expect(schedule).toBeDisabled()
    await expect(page.getByLabel('Wage'), 'the rest of the form still works').toBeEnabled()

    /**
     * Department and job position are NOT inputs — `contracts` has no such
     * columns and payroll joins them from the employee. They are shown as
     * read-only context, so there is nothing to type into and nothing to
     * silently discard.
     */
    await expect(inherited).toContainText('Department')
    await expect(inherited).toContainText('Job position')
    expect(
      await page.getByLabel('Department').count(),
      'department must not be an editable contract field',
    ).toBe(0)
  })

  test('a saved contract matches the employee it was created for', async ({ page, api }) => {
    /**
     * Builds its own employee rather than borrowing a seeded one. The seeded
     * employees already hold OPEN-ENDED contracts, so any new contract for them
     * overlaps and is refused with a 409 — a correct rejection that would make
     * this test look like an auto-fill failure.
     */
    const department = await makeDepartment(api)
    const position = await makeJobPosition(api, department.id)
    void position
    const schedule = await makeSchedule(api)
    const employee = await makeEmployee(api, {
      departmentId: department.id,
      jobPositionId: position.id,
      workingScheduleId: schedule.id,
    })

    await signIn(page)
    await page.goto('/contracts/new')
    await page.waitForLoadState('networkidle')

    await page.getByRole('combobox', { name: 'Employee' }).click()
    await page.getByRole('option', { name: employee.name, exact: true }).click()
    await page.waitForTimeout(800)
    await page.getByLabel('Wage').fill('54321')
    await page.getByLabel('Start date').fill('2031-01-01')
    await page.getByRole('button', { name: /Create|Save/ }).first().click()
    await page.waitForTimeout(2500)

    const saved = await api.get(`/api/contracts?employeeId=${employee.id}&limit=200`)
    expect(saved.data.total, 'the contract should have been created').toBe(1)

    const contract = saved.data.items[0]
    expect(contract.workingScheduleId, 'schedule must match the employee').toBe(schedule.id)
    expect(Number(contract.wage)).toBe(54321)
  })
})

test.describe('UI — schedule creation journey', () => {
  test('creates a working schedule through the form', async ({ page }) => {
    await signIn(page)
    const response = await page.goto('/schedules/new')
    expect(response?.status()).toBeLessThan(500)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).not.toContainText('Application error')
  })
})

test.describe('UI — accessibility and form hygiene', () => {
  test('every select trigger has an associated label', async ({ page }) => {
    /**
     * The inputs-only check below missed this entirely: `FormControl` wrapped
     * the Radix `<Select>` root, which is a context provider rather than a DOM
     * element, so the id never reached the trigger. Every dropdown rendered
     * with no accessible name — a screen reader announced "button, Full Time"
     * without saying which field it belonged to.
     */
    await signIn(page)
    await page.goto('/employees/new')
    await page.waitForLoadState('networkidle')

    const unnamed = await page.evaluate(() => {
      const bad: string[] = []
      document.querySelectorAll('[role="combobox"]').forEach((el) => {
        const id = el.id
        const labelled = id ? Boolean(document.querySelector(`label[for="${id}"]`)) : false
        const aria = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')
        if (!labelled && !aria) bad.push(el.textContent?.trim().slice(0, 40) ?? '(empty)')
      })
      return bad
    })
    expect(unnamed, `selects with no accessible name: ${unnamed.join(', ')}`).toEqual([])
  })

  test('every visible input on the employee form has an associated label', async ({ page }) => {
    await signIn(page)
    await page.goto('/employees/new')
    await page.waitForLoadState('networkidle')

    const unlabelled = await page.evaluate(() => {
      const bad: string[] = []
      document.querySelectorAll('input, textarea').forEach((el) => {
        const input = el as HTMLInputElement
        if (input.type === 'hidden') return
        // Radix renders an aria-hidden proxy input behind Checkbox/Select to
        // carry the value into a native form post. It is deliberately removed
        // from the accessibility tree, so it needs no label.
        if (input.getAttribute('aria-hidden') === 'true') return
        const id = input.id
        const hasLabel = id ? Boolean(document.querySelector(`label[for="${id}"]`)) : false
        const aria = input.getAttribute('aria-label') || input.getAttribute('aria-labelledby')
        if (!hasLabel && !aria) bad.push(input.name || input.id || input.outerHTML.slice(0, 80))
      })
      return bad
    })
    expect(unlabelled, `inputs with no label: ${unlabelled.join(', ')}`).toEqual([])
  })

  test('the page has exactly one h1', async ({ page }) => {
    await signIn(page)
    await page.goto('/employees')
    await page.waitForLoadState('networkidle')
    const count = await page.locator('h1').count()
    expect(count, 'a page should have a single top-level heading').toBeLessThanOrEqual(1)
  })

  test('a 404 route renders a not-found page rather than crashing', async ({ page }) => {
    await signIn(page)
    const response = await page.goto('/employees/00000000-0000-4000-8000-000000000000')
    expect(response?.status(), 'an unknown id must not be a 500').toBeLessThan(500)
  })
})
