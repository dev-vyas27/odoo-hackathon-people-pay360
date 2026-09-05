/**
 * Contract — aggregate root.
 *
 * A contract's validity range (`start`/`end`) is the input to
 * `contract-resolution.ts` and to write-time overlap prevention. `end: null`
 * means open-ended. History is never mutated: a new contract, not an edit to
 * an old one, is how a raise or promotion is recorded.
 */
import type { Money } from '@/modules/shared'

export interface Contract {
  readonly id: string
  readonly employeeId: string
  readonly wage: Money
  readonly salaryStructureId: string | null
  readonly workingScheduleId: string | null
  readonly departmentId: string | null
  readonly jobPositionName: string | null
  readonly start: Date
  readonly end: Date | null
  readonly createdAt: Date
  readonly updatedAt: Date
}
