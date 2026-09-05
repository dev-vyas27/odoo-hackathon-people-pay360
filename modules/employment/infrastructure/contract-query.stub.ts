/**
 * Temporary stubs for ContractQueryPort and ScheduleQueryPort.
 *
 * Lets Dev C compile and wire the payslip engine before the Mongo adapters
 * exist. Replaced in Phase 3 (H10-H14), then deleted.
 */
import type {
  ContractQueryPort,
  ContractSnapshot,
} from '../application/ports/contract-query.port'
import type {
  ScheduleQueryPort,
  ScheduleSnapshot,
} from '../application/ports/schedule-query.port'

function pending(port: string, method: string): never {
  throw new Error(
    `${port}.${method}() is not implemented yet (owner: Dev B, employment module). ` +
      `Expected in Phase 3. If you need it sooner, ask rather than working around it.`,
  )
}

export class StubContractQuery implements ContractQueryPort {
  async findApplicableContract(): Promise<ContractSnapshot | null> {
    return pending('ContractQueryPort', 'findApplicableContract')
  }

  async findByEmployee(): Promise<ContractSnapshot[]> {
    return pending('ContractQueryPort', 'findByEmployee')
  }
}

export class StubScheduleQuery implements ScheduleQueryPort {
  async findById(): Promise<ScheduleSnapshot | null> {
    return pending('ScheduleQueryPort', 'findById')
  }

  async expectedHours(): Promise<number> {
    return pending('ScheduleQueryPort', 'expectedHours')
  }

  async expectedDays(): Promise<number> {
    return pending('ScheduleQueryPort', 'expectedDays')
  }
}
