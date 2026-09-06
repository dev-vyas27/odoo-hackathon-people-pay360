'use client'

/**
 * Edit an account: rename, change role, activate/deactivate, reset the
 * password, or revoke the login.
 *
 * Editing YOURSELF is deliberately restricted. The role and active fields are
 * disabled, and revoke is hidden, because all three would lock you out and the
 * damage only shows on the next page load. The API refuses them too — this just
 * means you find out before you click rather than after.
 */
import { use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LuArrowLeft, LuKeyRound, LuTriangleAlert } from 'react-icons/lu'
import { useQuery } from '@tanstack/react-query'
import { ROLES, ROLE_LABELS, type CurrentUser } from '@/modules/shared'
import type { AccountView } from '@/modules/identity/schemas'
import { updateAccountSchema, type UpdateAccountValues } from '@/modules/identity/schemas'
import { apiFetch } from '@/lib/api-client'
import { useResourceAction, useResourceItem, useUpdateResource } from '@/hooks/use-resource'
import { PageHeader } from '@/components/resource/page-header'
import { ResourceForm } from '@/components/resource/resource-form'
import { ConfirmDialog } from '@/components/resource/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export default function EditAccountPage({ params }: { params: Promise<{ id: string }> }) {
  // Next 16: params is a promise. `use()` unwraps it in a client component.
  const { id } = use(params)
  const router = useRouter()

  const { data: account, isLoading } = useResourceItem<AccountView>('users', id)

  // Who am I? Needed to know whether this is my own account.
  const { data: me } = useQuery<CurrentUser>({
    queryKey: ['auth', 'me'],
    queryFn: () => apiFetch<CurrentUser>('/api/auth/me'),
  })

  const update = useUpdateResource<AccountView, UpdateAccountValues>('users', {
    successMessage: 'Account updated',
  })
  const revoke = useResourceAction('users', 'revoke-login', {
    successMessage: 'Login revoked — the employee record is untouched',
  })
  const invite = useResourceAction<{ emailed: boolean; link: string }>('users', 'invite', {
    successMessage: 'Set-password link sent',
  })

  if (isLoading || !account) return <Skeleton className="h-72 w-full max-w-3xl" />

  const isSelf = me?.employeeId === account.id

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={account.name}
        description={account.email}
        actions={
          <Button variant="outline" asChild>
            <Link href="/admin/users">
              <LuArrowLeft aria-hidden />
              Back
            </Link>
          </Button>
        }
      />

      {isSelf ? (
        <p className="mb-6 flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <LuTriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          This is your own account. Role and status are locked, and the login
          cannot be revoked — otherwise you could lock yourself out with no way back.
        </p>
      ) : null}

      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted/40 px-3 py-2.5">
        <LuKeyRound className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <p className="flex-1 text-xs text-muted-foreground">
          {account.hasLogin
            ? 'This person can sign in. Send a link if they need to reset their password.'
            : 'This person is an HR record with no login. Send them a link to set one.'}
        </p>
        {/*
          Issuing a new link invalidates any outstanding one, so resending after
          a typo in the address genuinely revokes the first email.
        */}
        <Button
          size="sm"
          variant="outline"
          disabled={invite.isPending}
          onClick={() => invite.mutate({ id })}
        >
          {account.hasLogin ? 'Send reset link' : 'Send invitation'}
        </Button>
      </div>

      {invite.data && !invite.data.emailed ? (
        <p className="mb-6 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs">
          <span className="text-warning-foreground">
            Email could not be sent. Give them this link instead:
          </span>
          <code className="mt-1 block truncate rounded border border-border bg-background px-2 py-1">
            {invite.data.link}
          </code>
        </p>
      ) : null}

      <ResourceForm<UpdateAccountValues>
        schema={updateAccountSchema}
        submitLabel="Save changes"
        defaultValues={{
          name: account.name,
          role: account.role,
          isActive: account.isActive,
          password: '',
        }}
        fields={[
          { name: 'name', label: 'Name' },
          {
            name: 'role',
            label: 'Role',
            type: 'select',
            options: ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] })),
            disabled: isSelf,
            description: isSelf ? 'Locked on your own account.' : undefined,
          },
          {
            name: 'password',
            label: account.hasLogin ? 'New password' : 'Set a password',
            type: 'password',
            span: 2,
            description:
              'Leave blank to keep the current one. Prefer the link above — a password you type here is one you know.',
          },
          {
            name: 'isActive',
            label: 'Active',
            type: 'checkbox',
            span: 2,
            disabled: isSelf,
            description: isSelf
              ? 'Locked on your own account.'
              : 'A deactivated account cannot sign in even with the right password.',
          },
        ]}
        cancel={
          !isSelf && account.hasLogin ? (
            <ConfirmDialog
              title="Revoke this login?"
              description="They will no longer be able to sign in. Their employee record, contracts, payslips and leave history all stay exactly as they are."
              confirmLabel="Revoke login"
              destructive
              onConfirm={() => revoke.mutateAsync({ id })}
              trigger={
                <Button variant="ghost" type="button">
                  Revoke login
                </Button>
              }
            />
          ) : null
        }
        onSubmit={async (values) => {
          await update.mutateAsync({ id, values })
          router.push('/admin/users')
        }}
      />
    </div>
  )
}
