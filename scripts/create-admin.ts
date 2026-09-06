


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


async function confirmOverwrite(email: string): Promise<boolean> {
  
  
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


function redact(uri: string): string {
  return uri.replace(/\/\/([^:]+):[^@]+@/, '//$1:****@')
}

main()
  .catch((reason) => {
    console.error('\nFailed:', reason instanceof Error ? reason.message : reason)
    process.exitCode = 1
  })
  .finally(closePool)
