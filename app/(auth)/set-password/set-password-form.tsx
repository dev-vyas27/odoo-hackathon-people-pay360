'use client'



import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LuCheck, LuCircleCheck, LuTriangleAlert, LuX } from 'react-icons/lu'
import { PASSWORD_RULES } from '@/modules/identity/schemas'
import { setPasswordSchema, type SetPasswordValues } from '@/modules/identity/schemas'
import { ApiError, apiFetch } from '@/lib/api-client'
import { ResourceForm } from '@/components/resource/resource-form'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface LinkStatus {
  valid: boolean
  name?: string
  email?: string
  purpose?: 'invite' | 'reset'
}

export function SetPasswordForm({ token }: { token: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [typed, setTyped] = useState('')
  const [done, setDone] = useState(false)

  const [status, setStatus] = useState<LinkStatus | null>(null)

  


  useEffect(() => {
    if (!token) return
    let cancelled = false

    apiFetch<LinkStatus>(`/api/auth/set-password?token=${encodeURIComponent(token)}`)
      .then((result) => {
        if (!cancelled) setStatus(result)
      })
      .catch(() => {
        if (!cancelled) setStatus({ valid: false })
      })

    return () => {
      cancelled = true
    }
  }, [token])

  if (!token) return <LinkProblem>This link is missing its token.</LinkProblem>
  if (status === null) return <Skeleton className="h-64 w-full" />
  if (!status.valid) {
    return (
      <LinkProblem>
        This link is no longer valid. It may have been used already or expired.
        Ask an administrator to send a new one.
      </LinkProblem>
    )
  }

  if (done) {
    return (
      <div className="space-y-4">
        <p className="flex items-start gap-2 rounded-md border border-success/25 bg-success/8 px-3 py-2.5 text-sm">
          <LuCircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
          Your password is set. You can sign in now.
        </p>
        <Button className="w-full" onClick={() => router.push('/login')}>
          Go to sign in
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {status.purpose === 'reset' ? 'Resetting the password for ' : 'Setting up '}
        <span className="text-foreground">{status.email}</span>.
      </p>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/25 bg-destructive/8 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      <ResourceForm<SetPasswordValues>
        surface={false}
        schema={setPasswordSchema}
        submitLabel="Set password"
        defaultValues={{ password: '', confirmPassword: '' }}
        fields={[
          { name: 'password', label: 'Password', type: 'password', span: 2 },
          { name: 'confirmPassword', label: 'Confirm password', type: 'password', span: 2 },
        ]}
        onSubmit={async (values) => {
          setError(null)
          try {
            await apiFetch('/api/auth/set-password', {
              method: 'POST',
              body: JSON.stringify({ token, ...values }),
            })
            setDone(true)
          } catch (reason) {
            setError(
              reason instanceof ApiError ? reason.message : 'Could not set the password.',
            )
          }
        }}
      >
        {

}
        <ul
          className="space-y-1.5"
          onInput={(event) => {
            const target = event.target as HTMLInputElement
            if (target.name === 'password') setTyped(target.value)
          }}
        >
          {PASSWORD_RULES.map((rule) => {
            const met = rule.test(typed)
            return (
              <li
                key={rule.label}
                className={cn(
                  'flex items-center gap-2 text-xs',
                  met ? 'text-success' : 'text-muted-foreground',
                )}
              >
                {met ? (
                  <LuCheck className="size-3.5" aria-hidden />
                ) : (
                  <LuX className="size-3.5 opacity-40" aria-hidden />
                )}
                {rule.label}
              </li>
            )
          })}
        </ul>
      </ResourceForm>
    </div>
  )
}

function LinkProblem({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <p className="flex items-start gap-2 rounded-md border border-destructive/25 bg-destructive/8 px-3 py-2.5 text-sm text-destructive">
        <LuTriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        {children}
      </p>
      <Button variant="outline" className="w-full" asChild>
        <Link href="/login">Back to sign in</Link>
      </Button>
    </div>
  )
}
