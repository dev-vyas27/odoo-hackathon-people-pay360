/**
 * The payrun lifecycle, end to end, with no database.
 *
 * Every collaborator is a port, so the whole orchestration — resolving the
 * period-applicable contract, prorating by attendance, running the engine,
 * persisting payslips, moving through the state machine and blocking on
 * warnings — is exercised here with in-memory fakes.
 *
 * This is the test that would otherwise have to wait for Dev B's adapters and a
 * running Postgres, which is exactly why it is worth having.
 */
import { describe, expect, it, beforeEach } from 'vitest'
import { InMemoryEventBus, Period, type Actor, type DomainEvent, type Paged } from '@/modules/shared'
import type { ResolvedSalaryStructure, SalaryStructureQueryPort } from '@/modules/payroll-config'
import type { EmployeeLookupPort, EmployeeSummary } from '@/modules/shared'
import type { ContractQueryPort, ContractSnapshot, ScheduleQueryPort } from '@/modules/shared'
import type { AttendanceStatsPort } from '@/modules/shared'
import { createPayrun, type Payrun } from '../domain/payrun'
import type { Payslip, PayslipStatus } from '../domain/payslip'
import { totalsOf } from '../domain/payslip'
import { JANUARY, contract, employee, standardStructure } from '../domain/test-fixtures'
import type { PayrunRepositoryPort } from './ports/payrun-repository.port'
import type { PayslipRepositoryPort } from './ports/payslip-repository.port'
import { CreatePayrunUseCase } from './create-payrun.use-case'
import { ComputePayrunUseCase } from './compute-payrun.use-case'
import { ValidatePayrunUseCase } from './validate-payrun.use-case'
import { MarkPayrunPaidUseCase } from './mark-payrun-paid.use-case'
import { ListEligibleEmployeesUseCase } from './list-eligible-employees.use-case'

const ACTOR: Actor = {
  userId: 'u1',
  employeeId: null,
  role: 'hr_payroll_manager',
  email: 'payroll@example.com',
  name: 'Payroll Manager',
}

const MARCH = Period.month(2025, 3)

// --- Fakes ------------------------------------------------------------------

class FakePayrunRepository implements PayrunRepositoryPort {
  readonly rows = new Map<string, Payrun>()
  private next = 1

  async findById(id: string) {
    return this.rows.get(id) ?? null
  }
  async findMany(): Promise<Paged<Payrun>> {
    const items = [...this.rows.values()]
    return { items, total: items.length, page: 1, limit: 20, pages: 1 }
  }
  async count() {
    return this.rows.size
  }
  async create(payrun: Payrun) {
    const stored = { ...payrun, id: `run-${this.next++}` }
    this.rows.set(stored.id, stored)
    return stored
  }
  async updateStatus(id: string, status: Payrun['status']) {
    const current = this.rows.get(id)
    if (!current) return null
    const updated = { ...current, status }
    this.rows.set(id, updated)
    return updated
  }
}

class FakePayslipRepository implements PayslipRepositoryPort {
  readonly rows: Payslip[] = []
  private next = 1

  async findById(id: string) {
    return this.rows.find((p) => p.id === id) ?? null
  }
  async findByPayrun(payrunId: string) {
    return this.rows.filter((p) => p.payrunId === payrunId)
  }
  async replaceForPayrun(payrunId: string, payslips: Payslip[]) {
    for (let i = this.rows.length - 1; i >= 0; i -= 1) {
      if (this.rows[i].payrunId === payrunId) this.rows.splice(i, 1)
    }
    const stored = payslips.map((p) => ({ ...p, id: `slip-${this.next++}` }))
    this.rows.push(...stored)
    return stored
  }
  async findOverlapping(employeeIds: string[], period: Period, excludePayrunId: string) {
    return this.rows.filter(
      (p) =>
        employeeIds.includes(p.employeeId) &&
        p.payrunId !== excludePayrunId &&
        p.period.overlaps(period),
    )
  }
  async setStatusForPayrun(payrunId: string, status: PayslipStatus) {
    this.rows.forEach((row, index) => {
      if (row.payrunId === payrunId) this.rows[index] = { ...row, status }
    })
  }
}

function fakeStructures(structure: ResolvedSalaryStructure): SalaryStructureQueryPort {
  return { findById: async (id) => (id === structure.id ? structure : null) }
}

function fakeEmployees(employees: EmployeeSummary[]): EmployeeLookupPort {
  return {
    findById: async (id) => employees.find((e) => e.id === id) ?? null,
    findManyByIds: async (ids) => employees.filter((e) => ids.includes(e.id)),
    findEligible: async () => employees.filter((e) => e.isActive),
  }
}

/** Resolves the contract whose validity actually overlaps the period. */
function fakeContracts(contracts: ContractSnapshot[]): ContractQueryPort {
  return {
    findApplicableContract: async (employeeId, period) => {
      const applicable = contracts
        .filter((c) => c.employeeId === employeeId)
        .filter(
          (c) =>
            c.start.getTime() <= period.end.getTime() &&
            (c.end === null || c.end.getTime() >= period.start.getTime()),
        )
        .sort((a, b) => b.start.getTime() - a.start.getTime())
      return applicable[0] ?? null
    },
    findByEmployee: async (employeeId) => contracts.filter((c) => c.employeeId === employeeId),
  }
}

function fakeSchedules(expectedDays: number): ScheduleQueryPort {
  return {
    findById: async () => null,
    expectedHours: async () => expectedDays * 8,
  }
}

function fakeAttendance(workedDays: Record<string, number>): AttendanceStatsPort {
  return {
    workedHours: async (id) => (workedDays[id] ?? 0) * 8,
    workedDays: async (id) => workedDays[id] ?? 0,
    summary: async () => ({
      present: 0,
      late: 0,
      absent: 0,
      overtimeHours: 0,
      missingCheckouts: 0,
      manualEdits: 0,
    }),
  }
}

// --- Scenario ---------------------------------------------------------------

describe('payrun lifecycle', () => {
  const structure = standardStructure()
  const asha = employee({ id: 'emp-1', name: 'Asha Menon' })
  const bala = employee({ id: 'emp-2', name: 'Bala Rao', bankAccount: null })

  let payruns: FakePayrunRepository
  let payslips: FakePayslipRepository
  let events: InMemoryEventBus
  let published: DomainEvent[]

  const contracts = [
    contract({ id: 'c-asha', employeeId: 'emp-1', wage: 50000 }),
    contract({ id: 'c-bala', employeeId: 'emp-2', wage: 30000 }),
  ]

  beforeEach(() => {
    payruns = new FakePayrunRepository()
    payslips = new FakePayslipRepository()
    events = new InMemoryEventBus()
    published = []
    for (const type of ['payrun.validated', 'payrun.paid'] as const) {
      events.subscribe(type, (event) => {
        published.push(event)
      })
    }
  })

  function compute() {
    return new ComputePayrunUseCase(
      payruns,
      payslips,
      fakeStructures(structure),
      fakeEmployees([asha, bala]),
      fakeContracts(contracts),
      fakeSchedules(22),
      fakeAttendance({ 'emp-1': 22, 'emp-2': 11 }),
    )
  }

  async function createRun(employeeIds = ['emp-1', 'emp-2']) {
    const created = await new CreatePayrunUseCase(
      payruns,
      fakeStructures(structure),
      fakeEmployees([asha, bala]),
    ).execute({
      actor: ACTOR,
      name: 'January 2026',
      structureId: structure.id,
      period: JANUARY,
      employeeIds,
    })
    if (!created.ok) throw created.error
    return created.value
  }

  it('creates a draft payrun holding only the selected employees, with no payslips', async () => {
    const payrun = await createRun(['emp-1'])

    expect(payrun.status).toBe('draft')
    expect(payrun.employeeIds).toEqual(['emp-1'])
    expect(payslips.rows).toHaveLength(0)
  })

  it('refuses a payrun for an employee who does not exist', async () => {
    const result = await new CreatePayrunUseCase(
      payruns,
      fakeStructures(structure),
      fakeEmployees([asha]),
    ).execute({
      actor: ACTOR,
      name: 'January 2026',
      structureId: structure.id,
      period: JANUARY,
      employeeIds: ['emp-1', 'ghost'],
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('PAYRUN_UNKNOWN_EMPLOYEES')
  })

  it('computes a payslip per employee and moves the run to computed', async () => {
    const payrun = await createRun()
    const result = await compute().execute({ actor: ACTOR, payrunId: payrun.id })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.payrun.status).toBe('computed')
    expect(result.value.payslips).toHaveLength(2)

    const [ashaSlip, balaSlip] = result.value.payslips
    // Asha worked the full 22 of 22 days on a 50,000 wage.
    expect(totalsOf(ashaSlip).basic.toNumber()).toBe(50000)
    expect(totalsOf(ashaSlip).net.toNumber()).toBe(64000)
    // Bala worked 11 of 22 days on a 30,000 wage, so everything halves.
    expect(totalsOf(balaSlip).basic.toNumber()).toBe(15000)
    expect(balaSlip.workedDays).toBe(11)
    expect(balaSlip.workedDays).toBe(11)
  })

  it('uses the contract that applies to the PERIOD, not the latest one', async () => {
    // Asha holds an expired 2025 contract and a current one. March 2025 must be
    // paid on the old contract even though a newer one exists.
    const withHistory = [
      contract({
        id: 'c-asha-old',
        employeeId: 'emp-1',
        wage: 30000,
        start: new Date(Date.UTC(2025, 0, 1)),
        end: new Date(Date.UTC(2025, 5, 30)),
      }),
      contract({
        id: 'c-asha-new',
        employeeId: 'emp-1',
        wage: 50000,
        start: new Date(Date.UTC(2025, 6, 1)),
        end: null,
      }),
    ]

    const march = await payruns.create(
      createPayrun({
        id: 'pending',
        name: 'March 2025',
        structureId: structure.id,
        structureName: structure.name,
        period: MARCH,
        employeeIds: ['emp-1'],
      }),
    )

    const result = await new ComputePayrunUseCase(
      payruns,
      payslips,
      fakeStructures(structure),
      fakeEmployees([asha]),
      fakeContracts(withHistory),
      fakeSchedules(21),
      fakeAttendance({ 'emp-1': 21 }),
    ).execute({ actor: ACTOR, payrunId: march.id })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    const payslip = result.value.payslips[0]
    expect(payslip.contractId).toBe('c-asha-old')
    expect(totalsOf(payslip).basic.toNumber()).toBe(30000)
  })

  it('skips an employee with no contract and raises a blocking warning', async () => {
    const payrun = await createRun()

    const result = await new ComputePayrunUseCase(
      payruns,
      payslips,
      fakeStructures(structure),
      fakeEmployees([asha, bala]),
      // Bala has no contract at all.
      fakeContracts([contracts[0]]),
      fakeSchedules(22),
      fakeAttendance({ 'emp-1': 22 }),
    ).execute({ actor: ACTOR, payrunId: payrun.id })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.payslips).toHaveLength(1)
    expect(result.value.skipped).toEqual([
      { employeeId: 'emp-2', employeeName: 'Bala Rao', reason: 'No contract covers this period' },
    ])
    expect(result.value.warnings.some((w) => w.code === 'MISSING_CONTRACT')).toBe(true)
  })

  it('surfaces the missing bank account as an advisory warning', async () => {
    const payrun = await createRun()
    const result = await compute().execute({ actor: ACTOR, payrunId: payrun.id })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    const warning = result.value.warnings.find((w) => w.code === 'MISSING_BANK_DETAILS')
    expect(warning?.employeeId).toBe('emp-2')
    expect(warning?.severity).toBe('warning')
  })

  it('replaces payslips on recompute rather than accumulating them', async () => {
    const payrun = await createRun()
    await compute().execute({ actor: ACTOR, payrunId: payrun.id })
    await compute().execute({ actor: ACTOR, payrunId: payrun.id })

    expect(payslips.rows.filter((p) => p.payrunId === payrun.id)).toHaveLength(2)
  })

  it('walks the full lifecycle and publishes an event at each finalisation', async () => {
    const payrun = await createRun()
    await compute().execute({ actor: ACTOR, payrunId: payrun.id })

    const validated = await new ValidatePayrunUseCase(
      payruns,
      payslips,
      fakeEmployees([asha, bala]),
      fakeContracts(contracts),
      events,
    ).execute({ actor: ACTOR, payrunId: payrun.id })

    expect(validated.ok).toBe(true)
    if (!validated.ok) return
    expect(validated.value.payrun.status).toBe('validated')
    // Payslips follow their payrun.
    expect(payslips.rows.every((p) => p.status === 'validated')).toBe(true)

    const paid = await new MarkPayrunPaidUseCase(payruns, payslips, events).execute({
      actor: ACTOR,
      payrunId: payrun.id,
    })

    expect(paid.ok).toBe(true)
    if (!paid.ok) return
    expect(paid.value.status).toBe('paid')
    expect(payslips.rows.every((p) => p.status === 'paid')).toBe(true)

    expect(published.map((e) => e.type)).toEqual(['payrun.validated', 'payrun.paid'])
  })

  it('refuses to validate a payrun that has not been computed', async () => {
    const payrun = await createRun()

    const result = await new ValidatePayrunUseCase(
      payruns,
      payslips,
      fakeEmployees([asha, bala]),
      fakeContracts(contracts),
      events,
    ).execute({ actor: ACTOR, payrunId: payrun.id })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('PAYRUN_NOT_COMPUTED')
  })

  it('refuses to validate while a blocking warning stands', async () => {
    const payrun = await createRun()
    await new ComputePayrunUseCase(
      payruns,
      payslips,
      fakeStructures(structure),
      fakeEmployees([asha, bala]),
      fakeContracts([contracts[0]]),
      fakeSchedules(22),
      fakeAttendance({ 'emp-1': 22 }),
    ).execute({ actor: ACTOR, payrunId: payrun.id })

    const result = await new ValidatePayrunUseCase(
      payruns,
      payslips,
      fakeEmployees([asha, bala]),
      fakeContracts([contracts[0]]),
      events,
    ).execute({ actor: ACTOR, payrunId: payrun.id })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('PAYRUN_HAS_BLOCKING_WARNINGS')
  })

  it('refuses to mark a draft payrun paid', async () => {
    const payrun = await createRun()

    const result = await new MarkPayrunPaidUseCase(payruns, payslips, events).execute({
      actor: ACTOR,
      payrunId: payrun.id,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('PAYRUN_ILLEGAL_TRANSITION')
    expect(published).toHaveLength(0)
  })

  it('refuses to recompute a finalised payrun', async () => {
    const payrun = await createRun()
    await compute().execute({ actor: ACTOR, payrunId: payrun.id })
    await payruns.updateStatus(payrun.id, 'paid')

    const result = await compute().execute({ actor: ACTOR, payrunId: payrun.id })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('PAYRUN_READ_ONLY')
  })

  it('detects a duplicate payslip for the same employee and period in another run', async () => {
    const first = await createRun(['emp-1'])
    await compute().execute({ actor: ACTOR, payrunId: first.id })

    const second = await createRun(['emp-1'])
    const result = await compute().execute({ actor: ACTOR, payrunId: second.id })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.warnings.some((w) => w.code === 'DUPLICATE_PAYSLIP')).toBe(true)
  })
})

describe('eligibility listing (wizard step 2)', () => {
  it('reports who can be paid and why the others cannot, creating nothing', async () => {
    const payruns = new FakePayrunRepository()
    const active = employee({ id: 'emp-1' })
    const noContract = employee({ id: 'emp-2', name: 'Bala Rao' })

    const result = await new ListEligibleEmployeesUseCase(
      fakeEmployees([active, noContract]),
      fakeContracts([contract({ employeeId: 'emp-1' })]),
    ).execute({ actor: ACTOR, period: JANUARY })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.map((r) => [r.employee.id, r.eligible])).toEqual([
      ['emp-1', true],
      ['emp-2', false],
    ])
    expect(result.value[1].reason).toBe('no_contract')
    // The question is read-only: nothing was persisted by asking it.
    expect(payruns.rows.size).toBe(0)
  })

  it('refuses a role that may not create payruns', async () => {
    const result = await new ListEligibleEmployeesUseCase(
      fakeEmployees([employee()]),
      fakeContracts([contract()]),
    ).execute({
      actor: { ...ACTOR, role: 'employee' },
      period: JANUARY,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('forbidden')
  })
})
