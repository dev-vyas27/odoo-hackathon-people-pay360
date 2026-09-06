


import { z } from 'zod'



export const uuid = z.string().uuid('Not a valid id')


export const optionalUuid = z
  .union([uuid, z.literal('')])
  .optional()
  .transform((v) => (v === '' ? undefined : v))

export const nonEmpty = (label: string, max = 200) =>
  z.string().trim().min(1, `${label} is required`).max(max, `${label} is too long`)

export const email = z.string().trim().toLowerCase().email('Enter a valid email address')



export const money = z
  .number({ message: 'Enter an amount' })
  .nonnegative('Amount cannot be negative')
  


  .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-9, 'At most 2 decimal places')

export const percentage = z
  .number({ message: 'Enter a percentage' })
  .min(0, 'Cannot be below 0%')
  .max(100, 'Cannot exceed 100%')


export const dateField = z.coerce.date({ message: 'Enter a valid date' })


export const timeField = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm, for example 09:30')



export const dateRangeRefinement = <T extends { start: Date; end?: Date | null }>(
  data: T,
  ctx: z.RefinementCtx,
) => {
  if (data.end && data.end < data.start) {
    ctx.addIssue({
      code: 'custom',
      path: ['end'],
      message: 'End date cannot be before the start date',
    })
  }
}


export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().trim().optional(),
})

export type PageQueryInput = z.infer<typeof pageQuerySchema>
