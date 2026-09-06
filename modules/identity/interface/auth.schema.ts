


import { z } from 'zod'
import { ROLES, email, nonEmpty } from '@/modules/shared'
import { checkPassword, describeProblems } from '../domain/password-policy'

export const loginSchema = z.object({
  email,
  
  
  password: z.string().min(1, 'Enter your password'),
})

export type LoginValues = z.infer<typeof loginSchema>



export const createAccountSchema = z.object({
  name: nonEmpty('Name'),
  email,
  role: z.enum(ROLES),
  isActive: z.boolean().default(true),
  


  sendInvite: z.boolean().default(true),
})

export type CreateAccountValues = z.infer<typeof createAccountSchema>



export const forgotPasswordSchema = z.object({ email })

export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>



export const strongPassword = z.string().superRefine((value, ctx) => {
  for (const problem of checkPassword(value)) {
    ctx.addIssue({ code: 'custom', message: problem.message })
  }
})



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



export const updateAccountSchema = z.object({
  name: nonEmpty('Name'),
  role: z.enum(ROLES),
  isActive: z.boolean(),
  


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
