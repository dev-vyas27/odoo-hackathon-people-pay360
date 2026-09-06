

import type { Period } from '@/modules/shared'

export interface ContractSnapshot {
  id: string
  employeeId: string
  wage: number
  salaryStructureId: string | null
  workingScheduleId: string | null
  departmentId: string | null
  jobPositionName: string | null
  start: Date
  end: Date | null
}

export interface ContractQueryPort {
  findApplicableContract(employeeId: string, period: Period): Promise<ContractSnapshot | null>
  findByEmployee(employeeId: string): Promise<ContractSnapshot[]>
}
