/**
 * Bootstrap the first administrator.
 *
 *   npm run create-admin
 *   npm run create-admin -- --email you@company.com --password "s3cret pass" --name "Your Name"
 *
 * Why a script and not a sign-up page: this application has no self-registration
 * by design. An endpoint that mints administrators is a hole you cannot close
 * later — someone always forgets to delete it before the demo. Bootstrapping
 * from the command line means the capability exists exactly where the person
 * holding the database credentials already is.
 *
 * Since migration 0010 this writes an EMPLOYEE. There is no separate `users`
 * table: an administrator is a person on file who happens to hold the admin
 * role, which is the model the product actually has.
 *
 * It is idempotent: run it twice and the second run resets the password of the
 * existing account rather than failing on the unique-email index.
 */
import { createInterface } from 'node:readline'
import { randomBytes } from 'node:crypto'
import { closePool, ping } from '@/lib/db'
import { BcryptHasher, PostgresAccountRepository } from '@/modules/identity'
import { ROLE_LABELS, ROLES, type Role } from '@/modules/shared'

interface Options {
  email: string
  password: string
  name: string
  role: Role
  generated: boolean
}

/** Minimal `--flag value` parsing. A CLI framework for four flags is overkill. */
function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (!arg.startsWith('--')) continue
    const [flag, inline] = arg.slice(2).split('=')
    out[flag] = inline ?? argv[++i] ?? ''
  }
  return out
}

/**
 * A generated password is 24 hex characters rather than something memorable.
 * The intent is that you copy it once and change it — a "friendly" default like
 * `admin123` is the one that survives to production.
 */
function generatePassword(): string {
  return randomBytes(12).toString('hex')
}

function resolveOptions(argv: string[]): Options {
  const args = parseArgs(argv)

  const role = (args.role ?? 'admin') as Role
  if (!ROLES.includes(role)) {
    throw new Error(`--role must be one of: ${ROLES.join(', ')}`)
  }

  const password = args.password ?? generatePassword()
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters')
  }

  return {
    email: (args.email ?? 'admin@peoplepay360.local').trim().toLowerCase(),
    password,
    name: args.name ?? 'Administrator',
    role,
    generated: !args.password,
  }
}

/** Only asked when overwriting a real account, so an accidental re-run is safe. */
async function confirmOverwrite(email: string): Promise<boolean> {
  // A non-interactive shell (CI, a piped run) has no answer to give; treat the
  // absence of a human as "no" rather than silently resetting a password.
  if (!process.stdin.isTTY) return false

  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await new Promise<string>((resolve) =>
    rl.question(`${email} already exists. Reset its password? [y/N] `, resolve),
  )
  rl.close()
  return answer.trim().toLowerCase().startsWith('y')
}

async function main() {
  const options = resolveOptions(process.argv.slice(2))

  console.log(`Connecting to ${redact(process.env.DATABASE_URL ?? '(unset)')}`)
  await ping()

  const accounts = new PostgresAccountRepository()
  const hasher = new BcryptHasher()

  const existing = await accounts.findByEmail(options.email)

  if (existing) {
    /**
     * An employee who exists but has never had a login is not an overwrite — it
     * is the ordinary "give this person an account" case. Only an existing
     * LOGIN needs confirming, which also keeps this safe to run unattended
     * against a database that already has the employee.
     */
    if (existing.hasLogin && !(await confirmOverwrite(options.email))) {
      console.log('\nLeft the existing account untouched.')
      console.log(`Pass --email with a different address to create another account.`)
      return
    }

    await accounts.update(existing.id, {
      passwordHash: await hasher.hash(options.password),
      role: options.role,
      isActive: true,
    })
    report(existing.hasLogin ? 'Password reset' : 'Login granted to existing employee', options)
    return
  }

  await accounts.create({
    email: options.email,
    name: options.name,
    role: options.role,
    passwordHash: await hasher.hash(options.password),
    isActive: true,
  })

  report(`${ROLE_LABELS[options.role]} created`, options)
}

function report(headline: string, options: Options) {
  console.log(`\n${headline}\n`)
  console.log(`  Email     ${options.email}`)
  console.log(`  Password  ${options.password}`)
  console.log(`  Role      ${options.role}`)
  if (options.generated) {
    console.log('\n  This password was generated and is shown only once. Save it now.')
  }
  console.log('\nSign in at http://localhost:3000/login\n')
}

/** Never print the database password, even into a local terminal. */
function redact(uri: string): string {
  return uri.replace(/\/\/([^:]+):[^@]+@/, '//$1:****@')
}

main()
  .catch((reason) => {
    console.error('\nFailed:', reason instanceof Error ? reason.message : reason)
    process.exitCode = 1
  })
  .finally(closePool)
