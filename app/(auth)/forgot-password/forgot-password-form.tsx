'use client'



import { useState } from 'react'
import Link from 'next/link'
import { LuArrowLeft, LuMailCheck } from 'react-icons/lu'
import { forgotPasswordSchema, type ForgotPasswordValues } from '@/modules/identity/schemas'
import { ApiError, apiFetch } from '@/lib/api-client'
import { ResourceForm } from '@/components/resource/resource-form'
import { Button } from '@/components/ui/button'

export function ForgotPasswordForm() {
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (sentTo) {
    return (
      <div className="space-y-4">
        <p className="flex items-start gap-2 rounded-md border border-success/25 bg-success/8 px-3 py-2.5 text-sm">
          <LuMailCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
          <span>
            If there is an account for <span className="text-foreground">{sentTo}</span>, a
            reset link is on its way. It works once and expires in an hour.
          </span>
        </p>
        <p className="text-xs text-muted-foreground">
          Nothing arrived? Check the spam folder, or ask an administrator to send you
          one from your account page.
        </p>
        <Button variant="outline" className="w-full" asChild>
          <Link href="/login">
            <LuArrowLeft aria-hidden />
            Back to sign in
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/25 bg-destructive/8 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      <ResourceForm<ForgotPasswordValues>
        surface={false}
        schema={forgotPasswordSchema}
        submitLabel="Send reset link"
        defaultValues={{ email: '' }}
        fields={[
          { name: 'email', label: 'Email', type: 'email', span: 2, placeholder: 'you@company.com' },
        ]}
        cancel={
          <Button variant="ghost" asChild>
            <Link href="/login">Back to sign in</Link>
          </Button>
        }
        onSubmit={async (values) => {
          setError(null)
          try {
            await apiFetch('/api/auth/forgot-password', {
              method: 'POST',
              body: JSON.stringify(values),
            })
            setSentTo(values.email)
          } catch (reason) {
            setError(
              reason instanceof ApiError ? reason.message : 'Could not send the link. Try again.',
            )
          }
        }}
      />
    </div>
  )
}
