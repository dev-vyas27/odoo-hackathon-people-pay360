

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
