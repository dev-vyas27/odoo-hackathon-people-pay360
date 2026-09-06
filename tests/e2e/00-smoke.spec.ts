import { test, expect } from './_helpers/fixtures'

test.describe('Smoke — the harness itself', () => {
  test('health endpoint reports the database is up', async ({ anon }) => {
    const r = await anon.get('/api/health')
    expect(r.status).toBe(200)
    expect(r.raw.status).toBe('ok')
    expect(r.raw.database).toBe('up')
  })

  test('QA session is authenticated and is an admin', async ({ api }) => {
    const r = await api.get('/api/auth/me')
    expect(r.status).toBe(200)
    expect(r.data?.role ?? r.raw?.data?.role).toBe('admin')
  })

  test('an anonymous API call is rejected with the JSON error envelope', async ({ anon }) => {
    const r = await anon.get('/api/employees')
    expect(r.status).toBe(401)
    expect(r.error?.code).toBe('UNAUTHENTICATED')
  })
})
