import { describe, expect, it } from 'vitest'
import { createPayslip } from './payslip-factory'
import { linesInSequence, totalsOf } from './payslip'
import { JANUARY, standardStructure } from './test-fixtures'

function build(overrides: Partial<Parameters<typeof createPayslip>[0]> = {}) {
  return createPayslip({
    id: 'slip-1',
    payrunId: 'run-1',
    payrunName: 'January 2026',
    employeeId: 'emp-1',
    employeeName: 'Asha Menon',
    departmentId: 'dept-1',
    contract: { id: 'contract-1', wage: 50000 },
    structure: standardStructure(),
    period: JANUARY,
    workedDays: 22,
    workedUnits: 22,
    expectedUnits: 22,
    ...overrides,
  })
}

describe('createPayslip', () => {
  it('computes every line from the structure, in sequence, with codes intact', () => {
    const payslip = build()

    expect(linesInSequence(payslip).map((l) => l.code)).toEqual([
      'BASIC',
      'HRA',
      'GROSS',
      'PF',
      'NET',
    ])
  })

  it('produces totals per category that agree with the lines', () => {
    const totals = totalsOf(build())

    expect(totals.basic.toNumber()).toBe(50000)
    expect(totals.allowances.toNumber()).toBe(20000)
    expect(totals.gross.toNumber()).toBe(70000)
    expect(totals.deductions.toNumber()).toBe(6000)
    expect(totals.net.toNumber()).toBe(64000)
  })

  it('records the contract that applied to the period, not an employee-level one', () => {
    const payslip = build({ contract: { id: 'contract-expired', wage: 30000 } })

    expect(payslip.contractId).toBe('contract-expired')
    expect(totalsOf(payslip).basic.toNumber()).toBe(30000)
  })

  it('prorates by worked units against the expected units of the schedule', () => {
    const payslip = build({ workedDays: 11, workedUnits: 11, expectedUnits: 22 })

    
    expect(totalsOf(payslip).basic.toNumber()).toBe(25000)
    expect(totalsOf(payslip).allowances.toNumber()).toBe(10000)
    expect(totalsOf(payslip).net.toNumber()).toBe(32000)
  })

  it('pays in full rather than zero when the schedule expects no units', () => {
    const payslip = build({ workedDays: 0, workedUnits: 0, expectedUnits: 0 })

    expect(totalsOf(payslip).basic.toNumber()).toBe(50000)
  })

  it('opens as computed, not as draft', () => {
    expect(build().status).toBe('computed')
  })

  it('pays two different amounts for two different contracts of the same employee', () => {
    
    
    const onOldContract = build({ contract: { id: 'contract-2024', wage: 30000 } })
    const onNewContract = build({ contract: { id: 'contract-2026', wage: 50000 } })

    expect(totalsOf(onOldContract).net.toNumber()).toBe(38400)
    expect(totalsOf(onNewContract).net.toNumber()).toBe(64000)
  })
})
