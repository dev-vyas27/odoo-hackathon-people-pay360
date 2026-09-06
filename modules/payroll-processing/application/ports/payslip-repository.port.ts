


import type { Period } from '@/modules/shared'
import type { Payslip } from '../../domain/payslip'
import type { PayslipStatus } from '../../domain/payslip'

export interface PayslipRepositoryPort {
  findById(id: string): Promise<Payslip | null>

  findByPayrun(payrunId: string): Promise<Payslip[]>

  
  replaceForPayrun(payrunId: string, payslips: Payslip[]): Promise<Payslip[]>

  


  findOverlapping(
    employeeIds: string[],
    period: Period,
    excludePayrunId: string,
  ): Promise<Payslip[]>

  
  setStatusForPayrun(payrunId: string, status: PayslipStatus): Promise<void>
}
