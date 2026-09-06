import { test as base, expect, type APIRequestContext } from '@playwright/test'

export const QA_EMAIL = 'qa-bot@peoplepay360.test'
export const QA_PASSWORD = 'QaBot!Passw0rd'

export interface ApiResult<T = any> {
  status: number
  
  data: T
  
  error?: { code: string; message: string; details?: any }
  raw: any
}

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

let counter = 0
export function uniq(prefix = 'QA'): string {
  counter += 1
  return `${prefix}-${Date.now().toString(36)}-${process.pid.toString(36)}-${counter}`
}

export function uniqEmail(): string {
  return `${uniq('qa').toLowerCase()}@peoplepay360.test`
}

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

  
  anon: async ({ playwright, baseURL }, use) => {
    const ctx = await playwright.request.newContext({ baseURL })
    await use(new Api(ctx))
    await ctx.dispose()
  },
})

export { expect }

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

export async function grantLogin(
  api: Api,
  employee: { id: string; name: string; email: string },
  role = 'employee',
) {
  const password = 'QaEmployee!2026'

  const account = await api.post('/api/users', {
    name: employee.name,
    email: employee.email,
    role,
    isActive: true,
  })
  expect(account.status, `create account: ${JSON.stringify(account.raw)}`).toBe(201)
  expect(account.data.id, 'the login must land on the employee row').toBe(employee.id)

  const invite = await api.post(`/api/users/${employee.id}/invite`)
  expect(invite.status, `invite: ${JSON.stringify(invite.raw)}`).toBe(200)

  const token = new URL(invite.data.link).searchParams.get('token')
  expect(token, `no token in ${invite.data.link}`).toBeTruthy()

  const redeemed = await api.post('/api/auth/set-password', {
    token,
    password,
    confirmPassword: password,
  })
  expect(redeemed.status, `set password: ${JSON.stringify(redeemed.raw)}`).toBe(200)

  return { email: employee.email, password }
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
