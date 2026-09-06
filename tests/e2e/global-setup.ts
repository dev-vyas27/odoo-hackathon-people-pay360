import { execFileSync } from 'node:child_process'
import { QA_EMAIL, QA_PASSWORD } from './_helpers/fixtures'

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
