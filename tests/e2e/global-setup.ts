import { execFileSync } from 'node:child_process'
import { QA_EMAIL, QA_PASSWORD } from './_helpers/fixtures'

/**
 * Guarantee the QA account exists before anything runs.
 *
 * The suite creates every business record it touches, but it cannot create the
 * account it signs in WITH — the application has no self-registration by
 * design, so bootstrapping is a command-line job. Doing it here rather than in
 * a README step matters because `npm run seed -- --reset` deletes every row in
 * the seeded tables, `users` included: a teammate reseeding mid-run otherwise
 * deletes the QA login out from under the suite and every test fails with a
 * 401 that looks like an auth bug and is not one. That happened once.
 *
 * `create-admin` is idempotent and non-interactive here, so an existing account
 * is left exactly as it is.
 */
async function globalSetup() {
  try {
    const out = execFileSync(
      'npx',
      [
        'tsx',
        '--env-file-if-exists=.env.local',
        'scripts/create-admin.ts',
        '--email',
        QA_EMAIL,
        '--password',
        QA_PASSWORD,
        '--name',
        'QA Bot',
        '--role',
        'admin',
      ],
      { encoding: 'utf8', shell: process.platform === 'win32' },
    )
    const created = out.includes('created') || out.includes('reset')
    console.log(`[qa] account ${QA_EMAIL}: ${created ? 'created' : 'already present'}`)
  } catch (reason) {
    throw new Error(
      `Could not ensure the QA account exists. Run it by hand:\n` +
        `  npx tsx --env-file-if-exists=.env.local scripts/create-admin.ts ` +
        `--email ${QA_EMAIL} --password "${QA_PASSWORD}" --name "QA Bot" --role admin\n\n` +
        String(reason),
    )
  }
}

export default globalSetup
