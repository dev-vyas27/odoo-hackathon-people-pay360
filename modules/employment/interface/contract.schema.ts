/**
 * Contract request schemas — the ONE definition shared by route handlers and
 * (once the UI kernel exists) the contract form, so client and server
 * validation cannot drift apart.
 */
import { z } from 'zod'
import { uuid, optionalUuid, nonEmpty, money, dateField } from '@/modules/shared'

const contractShape = {
  employeeId: uuid,
  wage: money,
  salaryStructureId: optionalUuid,
  workingScheduleId: optionalUuid,
  departmentId: optionalUuid,
  jobPositionName: nonEmpty('Job position').optional(),
  start: dateField,
  end: dateField.nullable().optional(),
}

function refineRange(data: { start: Date; end?: Date | null }, ctx: z.RefinementCtx) {
  if (data.end && data.end < data.start) {
    ctx.addIssue({ code: 'custom', path: ['end'], message: 'End date cannot be before the start date' })
  }
}

export const createContractSchema = z.object(contractShape).superRefine(refineRange)

export const updateContractSchema = z
  .object(contractShape)
  .partial()
  .superRefine((data, ctx) => {
    if (data.start && data.end) refineRange({ start: data.start, end: data.end }, ctx)
  })

export type CreateContractBody = z.infer<typeof createContractSchema>
export type UpdateContractBody = z.infer<typeof updateContractSchema>
