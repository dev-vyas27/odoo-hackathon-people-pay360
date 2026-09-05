/**
 * Shared zod building blocks.
 *
 * Project rule: every form uses react-hook-form with a zod schema, and the SAME
 * schema validates the request in the route handler. Defining a schema once, in
 * the module's `interface/` folder, and importing it into both places is what
 * stops client and server validation from drifting apart — the classic bug where
 * the UI accepts something the API then rejects with an unhelpful 500.
 *
 * These are the primitives every module reuses so that "what is a valid id" or
 * "what is a valid wage" has one answer across the whole app.
 */
import { z } from 'zod'

/**
 * Every primary key in this schema is a uuid (`gen_random_uuid()`).
 *
 * Validating the format at the edge matters: passing a malformed string into
 * a `uuid` column raises
 * `22P02 invalid input syntax`, which surfaces as a 500. Catching it here turns
 * that into a 400 with a field-level message.
 */
export const uuid = z.string().uuid('Not a valid id')

/** Optional reference: empty select values arrive as '' and must become undefined. */
export const optionalUuid = z
  .union([uuid, z.literal('')])
  .optional()
  .transform((v) => (v === '' ? undefined : v))

export const nonEmpty = (label: string, max = 200) =>
  z.string().trim().min(1, `${label} is required`).max(max, `${label} is too long`)

export const email = z.string().trim().toLowerCase().email('Enter a valid email address')

/**
 * Money as entered by a human: a non-negative amount with at most 2 decimals.
 * Convert to the Money value object at the domain boundary, never before.
 */
export const money = z
  .number({ message: 'Enter an amount' })
  .nonnegative('Amount cannot be negative')
  /**
   * `Number.isInteger(Math.round(n * 100))` was the obvious way to write this
   * and it never rejected anything: Math.round always returns an integer, so
   * the predicate was constant-true and 100.123 was accepted as a wage.
   * Compare the scaled value against its own rounding instead, with a
   * tolerance for binary floating point — 100.12 * 100 is 10011.999999999998,
   * which an exact comparison would reject.
   */
  .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-9, 'At most 2 decimal places')

export const percentage = z
  .number({ message: 'Enter a percentage' })
  .min(0, 'Cannot be below 0%')
  .max(100, 'Cannot exceed 100%')

/** Accepts an ISO string or a Date (date inputs give strings). */
export const dateField = z.coerce.date({ message: 'Enter a valid date' })

/** "HH:mm" as produced by <input type="time">. */
export const timeField = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm, for example 09:30')

/**
 * A start/end pair where end must not precede start.
 *
 * Attach with `.superRefine` on the object rather than on the individual fields,
 * so the error lands on `end` where the user can actually see it.
 */
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

/** Query-string paging shared by every list endpoint. */
export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().trim().optional(),
})

export type PageQueryInput = z.infer<typeof pageQuerySchema>
