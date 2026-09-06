import { describe, expect, it, vi } from 'vitest'
import type {
  Actor,
  EmailMessage,
  EmployeeLookupPort,
  MailerPort,
  PayslipView,
} from '@/modules/shared'
import type { CompanyIdentity } from '../domain/payslip-document'
import type { DocumentRendererPort } from './ports/document-renderer.port'
import type { DocumentStoragePort } from './ports/document-storage.port'
import type { PayslipQueryPort } from './ports/payslip-query.port'
import { SendPayrunPayslipsUseCase } from './send-payrun-payslips.use-case'

const payrollActor: Actor = {
  employeeId: 'emp-admin',
  role: 'hr_payroll_manager',
  email: 'payroll@x.com',
  name: 'Payroll',
}

const company: CompanyIdentity = {
  name: 'PeoplePay360',
  addressLines: ['Ahmedabad'],
  email: 'payroll@x.com',
}

function payslip(overrides: Partial<PayslipView> = {}): PayslipView {
  return {
    id: 'slip-1',
    employeeId: 'emp-1',
    employeeName: 'Rahul Verma',
    employeeEmail: 'rahul@x.com',
    payrunId: 'run-1',
    payrunName: 'September 2025',
    periodStart: new Date('2025-09-01'),
    periodEnd: new Date('2025-09-30'),
    structureName: 'Standard',
    workedDays: 22,
    lines: [{ code: 'BASIC', name: 'Basic', category: 'basic', sequence: 10, amount: 40000 }],
    basic: 40000,
    gross: 40000,
    deductions: 0,
    net: 40000,
    status: 'validated',
    ...overrides,
  }
}

function harness(options: {
  payslips: PayslipView[]
  employeeEmail?: string | null
  storageConfigured?: boolean
  storageFails?: boolean
  mailFails?: boolean
}) {
  const sent: EmailMessage[] = []

  const payslipQuery: PayslipQueryPort = {
    async findById() {
      return null
    },
    async findByPayrun() {
      return options.payslips
    },
  }

  const employees: EmployeeLookupPort = {
    async findById() {
      if (options.employeeEmail === null) return null
      return {
        id: 'emp-1',
        name: 'Rahul Verma',
        email: options.employeeEmail ?? 'rahul@x.com',
        departmentId: null,
        departmentName: 'Sales',
        jobPositionName: 'Account Executive',
        employeeType: 'full_time',
        managerId: null,
        workingScheduleId: null,
        bankAccount: '1234',
        isActive: true,
      }
    },
    async findManyByIds() {
      return []
    },
    async findEligible() {
      return []
    },
  }

  const renderer: DocumentRendererPort = {
    async render() {
      return { bytes: new Uint8Array([37, 80, 68, 70]), contentType: 'application/pdf' }
    },
  }

  const storage: DocumentStoragePort = {
    configured: options.storageConfigured ?? true,
    async put(key, body) {
      if (options.storageFails) {
        return { ok: false, key, bytes: body.byteLength, reason: 'bucket on fire' }
      }
      return { ok: true, key, bytes: body.byteLength }
    },
    async viewUrl() {
      return null
    },
  }

  const mailer: MailerPort = {
    async send(message) {
      sent.push(message)
      if (options.mailFails) return { to: message.to, sent: false, error: 'mailbox full' }
      return { to: message.to, sent: true }
    },
  }

  return {
    sent,
    useCase: new SendPayrunPayslipsUseCase(
      payslipQuery,
      employees,
      renderer,
      storage,
      mailer,
      company,
    ),
  }
}

describe('sending a pay run’s payslips', () => {
  it('emails each payslip with the PDF attached', async () => {
    const { useCase, sent } = harness({ payslips: [payslip()] })
    const result = await useCase.execute({ actor: payrollActor, payrunId: 'run-1' })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.sent).toBe(1)
    expect(result.value.failed).toBe(0)
    expect(result.value.deliveries[0].archived).toBe(true)

    expect(sent).toHaveLength(1)
    expect(sent[0].to).toBe('rahul@x.com')
    expect(sent[0].attachments?.[0].contentType).toBe('application/pdf')
    expect(sent[0].attachments?.[0].filename).toMatch(/\.pdf$/)
  })

  it('refuses a run whose payslips are not final', async () => {
    
    
    const { useCase, sent } = harness({ payslips: [payslip({ status: 'computed' })] })
    const result = await useCase.execute({ actor: payrollActor, payrunId: 'run-1' })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('PAYRUN_NOT_VALIDATED')
    expect(sent, 'nothing may go out').toHaveLength(0)
  })

  it('refuses a run with nothing computed', async () => {
    const { useCase } = harness({ payslips: [] })
    const result = await useCase.execute({ actor: payrollActor, payrunId: 'run-1' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('PAYRUN_HAS_NO_PAYSLIPS')
  })

  it('reports an employee with no address instead of skipping them quietly', async () => {
    const { useCase, sent } = harness({
      payslips: [payslip({ employeeEmail: null })],
      employeeEmail: null,
    })
    const result = await useCase.execute({ actor: payrollActor, payrunId: 'run-1' })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.sent).toBe(0)
    expect(result.value.failed).toBe(1)
    expect(result.value.deliveries[0].reason).toMatch(/email/i)
    expect(sent).toHaveLength(0)
  })

  it('carries on past a failure so the rest still get paid their payslip', async () => {
    const { useCase } = harness({
      payslips: [
        payslip({ id: 'a', employeeName: 'A' }),
        payslip({ id: 'b', employeeName: 'B' }),
        payslip({ id: 'c', employeeName: 'C' }),
      ],
      mailFails: true,
    })
    const result = await useCase.execute({ actor: payrollActor, payrunId: 'run-1' })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    
    expect(result.value.deliveries).toHaveLength(3)
    expect(result.value.failed).toBe(3)
    expect(result.value.deliveries.every((d) => d.reason === 'mailbox full')).toBe(true)
  })

  it('still sends when archiving fails — the bucket is not the point', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { useCase, sent } = harness({ payslips: [payslip()], storageFails: true })
    const result = await useCase.execute({ actor: payrollActor, payrunId: 'run-1' })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.sent, 'a broken bucket must not withhold a payslip').toBe(1)
    expect(result.value.deliveries[0].archived).toBe(false)
    expect(sent).toHaveLength(1)
    spy.mockRestore()
  })

  it('sends with no storage configured at all', async () => {
    const { useCase, sent } = harness({ payslips: [payslip()], storageConfigured: false })
    const result = await useCase.execute({ actor: payrollActor, payrunId: 'run-1' })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.sent).toBe(1)
    expect(result.value.deliveries[0].archived).toBe(false)
    expect(sent).toHaveLength(1)
  })

  it('refuses a role that may only read payslips', async () => {
    const { useCase, sent } = harness({ payslips: [payslip()] })
    const result = await useCase.execute({
      actor: { ...payrollActor, role: 'employee' },
      payrunId: 'run-1',
    })
    expect(result.ok).toBe(false)
    expect(sent, 'bulk mail is not a read').toHaveLength(0)
  })
})
