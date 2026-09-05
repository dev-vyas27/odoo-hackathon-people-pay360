/**
 * Wire format for the payroll API.
 *
 * Domain objects hold `Money` and `Period`; the wire holds numbers and ISO
 * strings. Doing that conversion in one place means the payrun list, the
 * processing screen and the payslip screen cannot each invent their own shape.
 */
import type { Payrun } from '../domain/payrun'
import type { PayrunStatus } from '../domain/payrun-state'

export interface PayrunView {
  id: string
  name: string
  structureId: string
  structureName: string
  periodStart: string
  periodEnd: string
  status: PayrunStatus
  employeeIds: string[]
  employeeCount: number
  createdAt: string
}

const day = (date: Date): string => date.toISOString().slice(0, 10)

export function toPayrunView(payrun: Payrun): PayrunView {
  return {
    id: payrun.id,
    name: payrun.name,
    structureId: payrun.structureId,
    structureName: payrun.structureName,
    periodStart: day(payrun.period.start),
    periodEnd: day(payrun.period.end),
    status: payrun.status,
    employeeIds: [...payrun.employeeIds],
    employeeCount: payrun.employeeIds.length,
    createdAt: payrun.createdAt.toISOString(),
  }
}
