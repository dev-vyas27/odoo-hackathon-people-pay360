'use client'

/**
 * The demo accounts, listed on the sign-in screen.
 *
 * This replaced a "Load demo data" button. That button seeded the database and
 * only THEN showed the credentials, which meant the first thing an evaluator
 * did was wait — and the second was wonder whether they had broken something.
 * The data is seeded by `npm run seed`; by the time anyone opens this page it
 * is already there, so the accounts can simply be listed.
 *
 * Tap an account to fill the form above, then Sign in. Two taps, no typing, and
 * the password is never guessed at from a screenshot.
 *
 * Deliberately NOT a one-tap sign-in. Filling the form leaves the chosen
 * account visible in the fields, so whoever is presenting can say which role
 * they are about to demonstrate before they demonstrate it — and can correct a
 * mis-tap without being dropped into the wrong dashboard.
 *
 * Rendered only when `DEMO_SEED_ENABLED` is set, decided on the server. These
 * are plaintext passwords on a public page; the flag is the only thing that
 * makes that acceptable, and it is checked where it cannot be flipped from a
 * client bundle.
 */
import { LuChevronRight, LuUsers } from 'react-icons/lu'
import type { SeedCredential } from '@/scripts/seed/types'

export function DemoAccountsPanel({
  accounts,
  onPick,
  activeEmail,
}: {
  accounts: SeedCredential[]
  /** Fills the sign-in form above. See login-screen.tsx for how it is applied. */
  onPick: (credential: { email: string; password: string }) => void
  /** The account currently filled in, so the list shows where you are. */
  activeEmail?: string
}) {
  if (accounts.length === 0) return null

  return (
    <section className="space-y-3 rounded-md border border-dashed border-border bg-sunken p-4">
      <div className="flex items-start gap-2.5">
        <LuUsers className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="space-y-1">
          <p className="text-sm font-medium">Demo accounts</p>
          <p className="text-xs text-muted-foreground">
            Pick one to fill the form, then sign in. Each sees a different part of the system.
          </p>
        </div>
      </div>

      <ul className="divide-y divide-border overflow-hidden rounded-md border border-border bg-card">
        {accounts.map((account) => {
          const active = activeEmail === account.email
          return (
            <li key={account.email}>
              <button
                type="button"
                onClick={() => onPick({ email: account.email, password: account.password })}
                aria-current={active ? 'true' : undefined}
                className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent ${
                  active ? 'bg-accent' : ''
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="truncate text-sm font-medium">{account.name}</span>
                    <span className="shrink-0 text-xs text-primary">{account.role}</span>
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {account.email}
                  </span>
                </span>
                <LuChevronRight
                  className={`size-4 shrink-0 ${active ? 'text-primary' : 'text-muted-foreground'}`}
                  aria-hidden
                />
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
