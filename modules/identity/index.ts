/**
 * Public surface of the "identity" module.
 *
 * Everything other modules are allowed to use is re-exported HERE and nowhere
 * else. Internals under domain/, application/, infrastructure/ and interface/
 * are private and the ESLint boundary rule will reject imports that reach in.
 *
 * Owner: Dev A — see docs/plans/DEV-A-platform.md.
 *
 * SERVER ONLY. This barrel reaches the Postgres repository, which imports the
 * `pg` driver, so importing it from a `'use client'` file breaks the browser
 * bundle. Client components import `@/modules/identity/schemas` instead — same
 * zod definitions, no database.
 */
export {
  login,
  me,
  createAccount,
  listAccounts,
  getAccount,
  updateAccount,
  revokeLogin,
  inviteAccount,
  setPassword,
  checkSetupLink,
  type CreatedAccount,
} from './interface/auth.controller'
export {
  loginSchema,
  createAccountSchema,
  type LoginValues,
  type CreateAccountValues,
} from './interface/auth.schema'
export type { AccountView } from './domain/account'

/**
 * Bootstrap-only escape hatch.
 *
 * `scripts/create-admin.ts` has to write an employee directly: going through the
 * HTTP API to create the very first administrator is a chicken-and-egg
 * problem, and the use case would demand an authenticated actor that does not
 * exist yet. Exporting the two concrete classes keeps that honest rather than
 * having a script reach into `infrastructure/` and trip the boundary rule.
 */
export { PostgresAccountRepository } from './infrastructure/postgres-account.repository'
export { BcryptHasher } from './infrastructure/bcrypt-hasher'
