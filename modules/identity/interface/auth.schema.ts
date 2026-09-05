/**
 * The schemas the login form AND the login route both use.
 *
 * One definition, two consumers. That is the whole reason this file sits in
 * `interface/` rather than next to the React component: the client cannot accept
 * something the server will reject, because they are literally the same object.
 */
import { z } from 'zod'
import { ROLES, email, nonEmpty } from '@/modules/shared'
import { checkPassword, describeProblems } from '../domain/password-policy'

export const loginSchema = z.object({
  email,
  // No composition rules on sign-in: the password either matches or it does not,
  // and telling an attacker our policy at the login screen helps only them.
  password: z.string().min(1, 'Enter your password'),
})

export type LoginValues = z.infer<typeof loginSchema>

/**
 * `employeeId` is gone: an account IS an employee since 0010, so there is no
 * second record to point at. Supplying the email of someone already on file
 * grants THAT person a login — see create-account.use-case.ts.
 *
 * There is NO password field. The administrator creating the account must not
 * choose someone else's password, and must not be able to read it afterwards
 * either. The account is created without one and an invitation link is emailed;
 * the person sets their own at /set-password.
 *
 * That also removes the awkward middle state where an admin invents a password,
 * sends it over chat, and nobody ever changes it.
 */
export const createAccountSchema = z.object({
  name: nonEmpty('Name'),
  email,
  role: z.enum(ROLES),
  isActive: z.boolean().default(true),
  /**
   * Whether to email the set-password link now. Off means the person exists as
   * an HR record with no login — a new starter who is on the payroll before
   * their first day.
   */
  sendInvite: z.boolean().default(true),
})

export type CreateAccountValues = z.infer<typeof createAccountSchema>

/**
 * The password field, enforcing the policy from `domain/password-policy.ts`.
 *
 * `superRefine` rather than chained `.min()/.regex()` so that all three broken
 * rules surface at once instead of one per submission.
 */
export const strongPassword = z.string().superRefine((value, ctx) => {
  for (const problem of checkPassword(value)) {
    ctx.addIssue({ code: 'custom', message: problem.message })
  }
})

/**
 * Redeeming an invitation. The confirm field is checked HERE, in the shared
 * schema, so the API rejects a mismatch too — a client that skips the
 * comparison cannot set a password the user did not type twice.
 */
export const setPasswordSchema = z
  .object({
    password: strongPassword,
    confirmPassword: z.string(),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: 'custom',
        path: ['confirmPassword'],
        message: 'The two passwords do not match',
      })
    }
  })

export type SetPasswordValues = z.infer<typeof setPasswordSchema>

/**
 * The administration edit form.
 *
 * Password is optional and blank-tolerant: leaving it empty means "do not
 * touch it", which is what an admin changing somebody's role expects. A blank
 * string is normalised away rather than failing the 8-character rule, because
 * the alternative is an unfixable form — you cannot save ANY change without
 * also resetting the password.
 */
export const updateAccountSchema = z.object({
  name: nonEmpty('Name'),
  role: z.enum(ROLES),
  isActive: z.boolean(),
  /**
   * Blank means "leave it alone", which is what an admin changing a role
   * expects. Anything non-blank must satisfy the same policy as a self-chosen
   * password — there is no weaker rule just because an admin typed it.
   */
  password: z
    .string()
    .optional()
    .or(z.literal(''))
    .superRefine((value, ctx) => {
      if (!value) return
      const problems = checkPassword(value)
      if (problems.length > 0) {
        ctx.addIssue({ code: 'custom', message: describeProblems(problems) })
      }
    }),
})

export type UpdateAccountValues = z.infer<typeof updateAccountSchema>
