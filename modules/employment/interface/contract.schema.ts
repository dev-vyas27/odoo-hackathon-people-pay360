/**
 * Contract request schemas — the ONE definition shared by route handlers and
 * (once the UI kernel exists) the contract form, so client and server
 * validation cannot drift apart.
 */
import { z } from 'zod'
import { uuid, optionalUuid, money, dateField } from '@/modules/shared'

/**
 * `departmentId` and `jobPositionName` are deliberately ABSENT.
 *
 * They used to be here, and they were a lie: the `contracts` table has no such
 * columns, so the API accepted both, returned 201, and silently discarded them.
 * Anyone who edited them on the form believed they had changed something.
 *
 * Both are DERIVED — `contract-query.adapter.ts` joins them through the
 * employee, which is what payroll reads. The employee record is the one place
 * a person's department and post live; a contract quotes it rather than
 * carrying its own copy.
 *
 * `workingScheduleId` is different and stays: it IS a column, payroll prorates
 * against it, and it is genuinely part of the contract.
 */
const contractShape = {
  employeeId: uuid,
  wage: money,
  salaryStructureId: optionalUuid,
  workingScheduleId: optionalUuid,
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
