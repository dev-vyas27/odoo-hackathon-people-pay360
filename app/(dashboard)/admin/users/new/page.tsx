'use client'

/**
 * Create an account.
 *
 * This is the ONLY way a person enters the system — the Employees screen has no
 * create button, because since migration 0010 an account IS an employee row and
 * two creation paths writing one table is how duplicates happen.
 *
 * There is no password field. An administrator must not choose somebody else's
 * password and must not be able to read it afterwards, so the account is created
 * without one and an invitation link is emailed; the person sets their own at
 * /set-password. Untick "Send an invitation" to create an HR record with no
 * login at all — a new starter on the payroll before their first day.
 *
 * The email decides between two outcomes — see `create-account.use-case.ts`:
 *
 *   unknown email        creates the person
 *   known employee email grants THAT person a login
 */
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LuCircleCheck, LuCopy, LuTriangleAlert } from 'react-icons/lu'
import { ROLES, ROLE_LABELS } from '@/modules/shared'
import { createAccountSchema, type CreateAccountValues } from '@/modules/identity/schemas'
import { useCreateResource } from '@/hooks/use-resource'
import { PageHeader } from '@/components/resource/page-header'
import { ResourceForm } from '@/components/resource/resource-form'
import { Button } from '@/components/ui/button'

interface CreatedAccount {
  id: string
  name: string
  email: string
  invite: { emailed: boolean; link: string; expiresAt: string } | null
}

export default function NewAccountPage() {
  const router = useRouter()
  const [created, setCreated] = useState<CreatedAccount | null>(null)
  const [copied, setCopied] = useState(false)

  const create = useCreateResource<CreatedAccount, CreateAccountValues>('users', {
    successMessage: 'Account created',
  })

  /**
   * When the invitation could not be emailed, the account still exists and the
   * link is still valid — so the screen shows it rather than navigating away
   * and leaving the admin with an account nobody can get into.
   */
  if (created) {
    const invite = created.invite
    return (
      <div className="max-w-3xl space-y-6">
        <PageHeader title="Account created" description={created.email} />

        {invite === null ? (
          <p className="rounded-md border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            No invitation was sent. {created.name} exists as an HR record and cannot
            sign in yet — send a set-password link from their account page when
            they are ready.
          </p>
        ) : invite.emailed ? (
          <p className="flex items-start gap-2 rounded-md border border-success/25 bg-success/8 px-4 py-3 text-sm">
            <LuCircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
            <span>
              A set-password link has been emailed to {created.email}. It works once
              and expires in 72 hours.
            </span>
          </p>
        ) : (
          <div className="space-y-3 rounded-md border border-warning/30 bg-warning/10 px-4 py-3">
            <p className="flex items-start gap-2 text-sm text-warning-foreground">
              <LuTriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                The account was created but the email could not be sent. Give them
                this link instead — it works once and expires in 72 hours.
              </span>
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded border border-border bg-background px-2 py-1.5 text-xs">
                {invite.link}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await navigator.clipboard.writeText(invite.link).catch(() => {})
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1500)
                }}
              >
                <LuCopy aria-hidden />
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button onClick={() => router.push('/admin/users')}>Back to accounts</Button>
          <Button variant="ghost" onClick={() => setCreated(null)}>
            Create another
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="New account"
        description="Adds a person to the system. They choose their own password from a link we email — nobody else ever sees it."
      />

      <ResourceForm<CreateAccountValues>
        schema={createAccountSchema}
        submitLabel="Create account"
        defaultValues={{
          name: '',
          email: '',
          role: 'employee',
          isActive: true,
          sendInvite: true,
        }}
        fields={[
          { name: 'name', label: 'Name', placeholder: 'Priya Sharma' },
          {
            name: 'email',
            label: 'Email',
            type: 'email',
            placeholder: 'priya@company.com',
            description: 'The invitation goes here. An existing employee email grants that person a login.',
          },
          {
            name: 'role',
            label: 'Role',
            type: 'select',
            options: ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] })),
            description: 'Decides both the navigation they see and the API calls they may make.',
          },
          {
            name: 'isActive',
            label: 'Active',
            type: 'checkbox',
            description: 'A deactivated account cannot sign in even with the right password.',
          },
          {
            name: 'sendInvite',
            label: 'Send an invitation to set a password',
            type: 'checkbox',
            description: 'Untick to create an HR record with no login for now.',
          },
        ]}
        cancel={
          <Button variant="ghost" asChild>
            <Link href="/admin/users">Cancel</Link>
          </Button>
        }
        onSubmit={async (values) => {
          setCreated(await create.mutateAsync(values))
        }}
      />
    </div>
  )
}
