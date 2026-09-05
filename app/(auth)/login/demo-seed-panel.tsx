'use client'

/**
 * "Load demo data" on the login screen.
 *
 * Rendered only when `DEMO_SEED_ENABLED=true`, and the decision is made on the
 * server (see page.tsx) — this component never reads the flag itself, so there
 * is no client-side check to bypass. With the flag off the endpoint 404s
 * anyway; the hidden button is convenience, the flag is the control.
 *
 * After seeding it lists the accounts with click-to-fill, because the demo
 * failure mode this exists to prevent is somebody mistyping a password on stage.
 */
import { useState } from 'react'
import { LuCheck, LuCopy, LuDatabase, LuLoaderCircle, LuTriangleAlert } from 'react-icons/lu'
import { ApiError, apiFetch } from '@/lib/api-client'
import { Button } from '@/components/ui/button'

interface SeedCredential {
  role: string
  email: string
  password: string
}

interface SeedSummary {
  reset: boolean
  parts: Array<{ name: string; documents: number }>
  credentials: SeedCredential[]
  durationMs: number
}

export function DemoSeedPanel({
  onPick,
}: {
  /** Fills the sign-in form above, so a demo is two clicks rather than typing. */
  onPick?: (credential: { email: string; password: string }) => void
}) {
  const [summary, setSummary] = useState<SeedSummary | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const seed = async (reset: boolean) => {
    setBusy(true)
    setError(null)
    try {
      const result = await apiFetch<SeedSummary>('/api/demo/seed', {
        method: 'POST',
        body: JSON.stringify({ reset }),
      })
      setSummary(result)
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? reason.message
          : 'Could not reach the seed endpoint. Is the database up?',
      )
    } finally {
      setBusy(false)
    }
  }

  const copy = async (credential: SeedCredential) => {
    onPick?.({ email: credential.email, password: credential.password })
    try {
      await navigator.clipboard.writeText(credential.password)
      setCopied(credential.email)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      // Clipboard access is denied over plain http on some browsers. The form
      // was already filled above, which is the part that actually matters.
    }
  }

  return (
    <section className="space-y-3 rounded-md border border-dashed border-border bg-secondary-50 p-4">
      <div className="flex items-start gap-2.5">
        <LuDatabase className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="space-y-1">
          <p className="text-sm">Demo data</p>
          <p className="text-xs text-muted-foreground">
            Creates one account per role plus leave types, allocations and requests.
            Safe to run twice — records are keyed by fixed ids.
          </p>
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/25 bg-destructive/8 px-3 py-2 text-xs text-destructive"
        >
          <LuTriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => seed(false)} disabled={busy}>
          {busy ? <LuLoaderCircle className="size-4 animate-spin" aria-hidden /> : null}
          {summary ? 'Reload demo data' : 'Load demo data'}
        </Button>
        {summary ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => seed(true)}
            disabled={busy}
            title="Clears the seeded collections first"
          >
            Reset and reload
          </Button>
        ) : null}
      </div>

      {summary ? (
        <div className="space-y-2 pt-1">
          <p className="text-xs text-muted-foreground">
            {summary.parts.map((p) => `${p.name} ${p.documents}`).join(' · ')} — in{' '}
            <span className="tabular">{summary.durationMs}</span>ms. Click an account to fill
            the form.
          </p>

          <ul className="divide-y divide-border overflow-hidden rounded-md border border-border">
            {summary.credentials.map((credential) => (
              <li key={credential.email}>
                <button
                  type="button"
                  onClick={() => copy(credential)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-accent"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs">{credential.email}</span>
                    <span className="block text-[0.7rem] text-muted-foreground">
                      {credential.role} · {credential.password}
                    </span>
                  </span>
                  {copied === credential.email ? (
                    <LuCheck className="size-3.5 shrink-0 text-success" aria-hidden />
                  ) : (
                    <LuCopy className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
