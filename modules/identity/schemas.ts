/**
 * Client-safe surface of `identity`.
 *
 * `@/modules/identity` (index.ts) reaches its controller, which reaches its
 * repository, which imports the `pg` driver. Importing that barrel from a
 * `'use client'` file drags a Node-only database client into the browser
 * bundle, and the page dies at module evaluation.
 *
 * So the module publishes two entry points:
 *
 *   @/modules/identity           server only — controllers, use cases, repos
 *   @/modules/identity/schemas   safe anywhere — zod schemas and their types
 *
 * The schema is the thing both sides genuinely share (the form validates with
 * it, the route handler validates with it), and it depends on nothing but zod.
 *
 * Dev B and Dev C: do the same in your modules. It is one file and it is the
 * difference between a form component that builds and one that explodes.
 */
export {
  loginSchema,
  createAccountSchema,
  updateAccountSchema,
  setPasswordSchema,
  strongPassword,
  type LoginValues,
  type CreateAccountValues,
  type UpdateAccountValues,
  type SetPasswordValues,
} from './interface/auth.schema'

/**
 * `AccountView` is the safe projection the API returns. It lives in `domain/`,
 * which imports nothing but `@/modules/shared`, so a table component can be
 * typed against the exact shape the endpoint sends without pulling in the
 * server barrel.
 */
export type { AccountView } from './domain/account'

/**
 * The password policy, so the form can show a live checklist driven by the same
 * rules the validator enforces. Pure functions over a string — no database, no
 * server dependency.
 */
export {
  PASSWORD_RULES,
  PASSWORD_MIN_LENGTH,
  checkPassword,
  isPasswordAcceptable,
} from './domain/password-policy'
