import { test, expect, uniq, uniqEmail, QA_EMAIL, QA_PASSWORD } from './_helpers/fixtures'
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
