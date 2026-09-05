import { test as base, expect, type APIRequestContext } from '@playwright/test'

/**
 * The QA account. Created once by:
 *   npx tsx --env-file-if-exists=.env.local scripts/create-admin.ts \
 *     --email qa-bot@peoplepay360.test --password "QaBot!Passw0rd" --name "QA Bot" --role admin
 *
 * This is the ONLY pre-existing record the suite depends on, and it exists
 * because the application deliberately has no self-registration. Every business
 * record below is created by the tests themselves.
 */
export const QA_EMAIL = 'qa-bot@peoplepay360.test'
export const QA_PASSWORD = 'QaBot!Passw0rd'

export interface ApiResult<T = any> {
  status: number
  /** Unwrapped `{ data }` payload. */
  data: T
  /** Unwrapped `{ error }` payload, when the call failed. */
  error?: { code: string; message: string; details?: any }
  raw: any
}

/**
 * Thin wrapper that unwraps the project's `{ data } | { error }` envelope and
 * never throws on a non-2xx — a QA suite asserts on failures as much as on
 * successes, so a 400 has to be a value, not an exception.
 */
export class Api {
  constructor(readonly ctx: APIRequestContext) {}

  private async wrap(res: any): Promise<ApiResult> {
    const status = res.status()
    let raw: any = null
    try {
      raw = await res.json()
    } catch {
      raw = await res.text().catch(() => null)
    }
    return {
      status,
      data: raw && typeof raw === 'object' ? raw.data : undefined,
      error: raw && typeof raw === 'object' ? raw.error : undefined,
      raw,
    }
  }

  async get<T = any>(path: string): Promise<ApiResult<T>> {
    return this.wrap(await this.ctx.get(path))
  }
  async post<T = any>(path: string, data?: unknown): Promise<ApiResult<T>> {
    return this.wrap(await this.ctx.post(path, { data: data ?? {} }))
  }
  async patch<T = any>(path: string, data?: unknown): Promise<ApiResult<T>> {
    return this.wrap(await this.ctx.patch(path, { data: data ?? {} }))
  }
  async put<T = any>(path: string, data?: unknown): Promise<ApiResult<T>> {
    return this.wrap(await this.ctx.put(path, { data: data ?? {} }))
  }
  async del<T = any>(path: string): Promise<ApiResult<T>> {
    return this.wrap(await this.ctx.delete(path))
  }
}

/** Unique-per-call suffix so parallel workers never collide on a unique index. */
let counter = 0
export function uniq(prefix = 'QA'): string {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}-${process.pid.toString(36)}-${counter}`
}

export function uniqEmail(): string {
  return `${uniq('qa').toLowerCase()}@peoplepay360.test`
}

/**
 * An uppercase code that satisfies RULE_CODE_PATTERN / time-off code rules.
 *
 * Random rather than time-plus-counter. Codes are capped at 10 characters, and
 * a timestamp in base36 already eats eight of them — so the counter that was
 * supposed to disambiguate got truncated away, and four parallel workers
 * generating a code in the same millisecond collided on the unique index.
 */
export function uniqCode(prefix = 'Q'): string {
  counter += 1
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let tail = ''
  while (tail.length < 10 - prefix.length) {
    tail += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return `${prefix}${tail}`
}

export const test = base.extend<{ api: Api; anon: Api }>({
  /** Authenticated as the QA admin. */
  api: async ({ playwright, baseURL }, use) => {
    const ctx = await playwright.request.newContext({ baseURL })
    const res = await ctx.post('/api/auth/login', {
      data: { email: QA_EMAIL, password: QA_PASSWORD },
    })
    if (res.status() !== 200) {
      throw new Error(
        `QA login failed (${res.status()}): ${await res.text()}\n` +
          `Create the account with scripts/create-admin.ts — see fixtures.ts.`,
      )
    }
    await use(new Api(ctx))
    await ctx.dispose()
  },

  /** No session at all. */
  anon: async ({ playwright, baseURL }, use) => {
    const ctx = await playwright.request.newContext({ baseURL })
    await use(new Api(ctx))
    await ctx.dispose()
  },
})

export { expect }

// ── data factory ────────────────────────────────────────────────────────────
// Every helper here CREATES a record through the public API. Nothing reads a
// pre-existing row, which is the point: a green suite proves the write paths
// work, not that someone seeded the database once.

export async function makeDepartment(api: Api, name = uniq('Dept')) {
  const r = await api.post('/api/departments', { name })
  expect(r.status, `create department: ${JSON.stringify(r.raw)}`).toBe(201)
  return r.data
}

export async function makeJobPosition(api: Api, departmentId?: string) {
  const r = await api.post('/api/job-positions', { title: uniq('Role'), departmentId })
  expect(r.status, `create job position: ${JSON.stringify(r.raw)}`).toBe(201)
  return r.data
}

export async function makeSchedule(api: Api, opts: { name?: string; days?: any[] } = {}) {
  const days =
    opts.days ??
    [1, 2, 3, 4, 5].map((day) => ({ day, start: '09:00', end: '18:00', breakMinutes: 60 }))
  const r = await api.post('/api/schedules', { name: opts.name ?? uniq('Sched'), days })
  expect(r.status, `create schedule: ${JSON.stringify(r.raw)}`).toBe(201)
  return r.data
}

export async function makeEmployee(
  api: Api,
  overrides: Record<string, unknown> = {},
) {
  const body = {
    name: uniq('Emp'),
    email: uniqEmail(),
    employeeType: 'full_time',
    bankAccount: '000111222333',
    isActive: true,
    ...overrides,
  }
  const r = await api.post('/api/employees', body)
  expect(r.status, `create employee: ${JSON.stringify(r.raw)}`).toBe(201)
  return r.data
}

export async function makeContract(
  api: Api,
  employeeId: string,
  overrides: Record<string, unknown> = {},
) {
  const body = {
    employeeId,
    wage: 60000,
    start: '2020-01-01',
    end: null,
    ...overrides,
  }
  const r = await api.post('/api/contracts', body)
  expect(r.status, `create contract: ${JSON.stringify(r.raw)}`).toBe(201)
  return r.data
}
