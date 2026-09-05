import { describe, expect, it } from 'vitest'
import { Period } from '@/modules/shared'
import { createPayslip } from '../payslip-factory'
import { JANUARY, contract, employee, standardStructure } from '../test-fixtures'
import type { PayrunWarningContext } from './warning.port'
import { blockingWarnings, runWarningChecks } from './warning.registry'
import { MissingBankDetailsCheck } from './missing-bank-details.check'
import { DuplicatePayslipCheck } from './duplicate-payslip.check'
import { MissingContractCheck } from './missing-contract.check'
import { ContractExpiringCheck } from './contract-expiring.check'

function payslipFor(employeeId: string, name: string, payrunName = 'January 2026', period = JANUARY) {
  return createPayslip({
    id: `slip-${employeeId}`,
    payrunId: 'run-1',
    payrunName,
    employeeId,
    employeeName: name,
    departmentId: 'dept-1',
    contract: { id: 'contract-1', wage: 50000 },
    structure: standardStructure(),
    period,
    workedDays: 22,
    workedUnits: 22,
    expectedUnits: 22,
  })
}

function context(overrides: Partial<PayrunWarningContext> = {}): PayrunWarningContext {
  const employees = [employee()]
  return {
    payrunId: 'run-1',
    period: JANUARY,
    employees,
    contracts: new Map([['emp-1', contract()]]),
    payslips: [payslipFor('emp-1', 'Asha Menon')],
    payslipsElsewhere: [],
    ...overrides,
  }
}

describe('MissingBankDetailsCheck', () => {
  it('fires for an employee with no bank account', () => {
    const warnings = new MissingBankDetailsCheck().check(
      context({ employees: [employee({ bankAccount: null })] }),
    )

    expect(warnings).toHaveLength(1)
    expect(warnings[0].severity).toBe('warning')
    expect(warnings[0].message).toMatch(/no bank account/)
  })

  it('treats a blank string as missing', () => {
    const warnings = new MissingBankDetailsCheck().check(
      context({ employees: [employee({ bankAccount: '   ' })] }),
    )

    expect(warnings).toHaveLength(1)
  })

  it('stays quiet when the account is present', () => {
    expect(new MissingBankDetailsCheck().check(context())).toEqual([])
  })
})

describe('MissingContractCheck', () => {
  it('fires as an error when no contract covers the period', () => {
    const warnings = new MissingContractCheck().check(
      context({ contracts: new Map([['emp-1', null]]) }),
    )

    expect(warnings).toHaveLength(1)
    expect(warnings[0].severity).toBe('error')
    expect(warnings[0].employeeId).toBe('emp-1')
  })

  it('stays quiet when a contract was resolved', () => {
    expect(new MissingContractCheck().check(context())).toEqual([])
  })
})

describe('DuplicatePayslipCheck', () => {
  it('fires when the same employee appears twice in one run', () => {
    const warnings = new DuplicatePayslipCheck().check(
      context({
        payslips: [payslipFor('emp-1', 'Asha Menon'), payslipFor('emp-1', 'Asha Menon')],
      }),
    )

    expect(warnings).toHaveLength(1)
    expect(warnings[0].severity).toBe('error')
    expect(warnings[0].message).toMatch(/more than once/)
  })

  it('fires when another payrun already covers an overlapping period', () => {
    const warnings = new DuplicatePayslipCheck().check(
      context({
        payslipsElsewhere: [payslipFor('emp-1', 'Asha Menon', 'January rerun')],
      }),
    )

    expect(warnings).toHaveLength(1)
    expect(warnings[0].message).toMatch(/already has a payslip in "January rerun"/)
  })

  it('ignores another payrun for a period that does not overlap', () => {
    const warnings = new DuplicatePayslipCheck().check(
      context({
        payslipsElsewhere: [
          payslipFor('emp-1', 'Asha Menon', 'February 2026', Period.month(2026, 2)),
        ],
      }),
    )

    expect(warnings).toEqual([])
  })

  it('ignores an overlapping payslip for someone not in this run', () => {
    const warnings = new DuplicatePayslipCheck().check(
      context({ payslipsElsewhere: [payslipFor('emp-9', 'Someone Else')] }),
    )

    expect(warnings).toEqual([])
  })
})

describe('ContractExpiringCheck', () => {
  it('fires when the contract ended before the period closed', () => {
    const warnings = new ContractExpiringCheck().check(
      context({
        contracts: new Map([['emp-1', contract({ end: new Date(Date.UTC(2026, 0, 15)) })]]),
      }),
    )

    expect(warnings).toHaveLength(1)
    expect(warnings[0].message).toMatch(/ended on 2026-01-15/)
  })

  it('fires when the contract expires shortly after the period', () => {
    const warnings = new ContractExpiringCheck().check(
      context({
        contracts: new Map([['emp-1', contract({ end: new Date(Date.UTC(2026, 1, 10)) })]]),
      }),
    )

    expect(warnings[0].message).toMatch(/expires on 2026-02-10/)
  })

  it('stays quiet for an open-ended contract', () => {
    expect(new ContractExpiringCheck().check(context())).toEqual([])
  })

  it('stays quiet for a contract expiring well beyond the horizon', () => {
    const warnings = new ContractExpiringCheck().check(
      context({
        contracts: new Map([['emp-1', contract({ end: new Date(Date.UTC(2027, 0, 1)) })]]),
      }),
    )

    expect(warnings).toEqual([])
  })
})

describe('the registry', () => {
  it('runs every registered check and reports a clean run as clean', () => {
    expect(runWarningChecks(context())).toEqual([])
  })

  it('collects warnings from several checks at once', () => {
    const warnings = runWarningChecks(
      context({
        employees: [employee({ bankAccount: null })],
        contracts: new Map([['emp-1', contract({ end: new Date(Date.UTC(2026, 0, 10)) })]]),
      }),
    )

    expect(warnings.map((w) => w.code).sort()).toEqual([
      'CONTRACT_EXPIRING',
      'MISSING_BANK_DETAILS',
    ])
  })

  it('separates blocking errors from advisory warnings', () => {
    const warnings = runWarningChecks(
      context({
        employees: [employee({ bankAccount: null })],
        contracts: new Map([['emp-1', null]]),
      }),
    )

    expect(warnings).toHaveLength(2)
    expect(blockingWarnings(warnings).map((w) => w.code)).toEqual(['MISSING_CONTRACT'])
  })

  it('accepts an injected check list, so adding a check never edits the caller', () => {
    const custom = {
      code: 'CUSTOM',
      check: () => [
        {
          code: 'CUSTOM',
          severity: 'warning' as const,
          message: 'hello',
          employeeId: 'emp-actor',
          employeeName: null,
        },
      ],
    }

    expect(runWarningChecks(context(), [custom])).toHaveLength(1)
  })
})
