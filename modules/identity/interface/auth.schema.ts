/**
 * The schemas the login form AND the login route both use.
 *
 * One definition, two consumers. That is the whole reason this file sits in
 * `interface/` rather than next to the React component: the client cannot accept
 * something the server will reject, because they are literally the same object.
 */
import { z } from 'zod'
import { ROLES, email, nonEmpty, optionalUuid } from '@/modules/shared'

export const loginSchema = z.object({
  email,
  // No composition rules on sign-in: the password either matches or it does not,
  // and telling an attacker our policy at the login screen helps only them.
  password: z.string().min(1, 'Enter your password'),
})

export type LoginValues = z.infer<typeof loginSchema>

export const createUserSchema = z.object({
  name: nonEmpty('Name'),
  email,
  password: z
    .string()
    .min(8, 'Use at least 8 characters')
    .max(72, 'bcrypt ignores anything past 72 characters'),
  role: z.enum(ROLES),
  employeeId: optionalUuid,
  isActive: z.boolean().default(true),
})

export type CreateUserValues = z.infer<typeof createUserSchema>
