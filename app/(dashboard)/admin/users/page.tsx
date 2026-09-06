'use client'

/**
 * User administration — spec section 3's Admin role: "User management, role
 * assignment, permission updates, and complete system administration."
 *
 * Reachable from the user menu rather than the top nav. The nav is the six
 * sections the spec names in B1, and quietly adding a seventh would make the
 * screenshot disagree with the document. Administration is a setting, not a
 * daily workflow.
 *
 * Since migration 0010 an account IS an employee row, so this list shows people
 * who can sign in alongside people who cannot — the "Login" column is the
 * difference, and it is the thing an administrator actually came here to change.
 */
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { ColumnDef } from '@tanstack/react-table'
import { LuKeyRound, LuPlus, LuShieldCheck } from 'react-icons/lu'
import { ROLES, ROLE_LABELS } from '@/modules/shared'
import type { AccountView } from '@/modules/identity/schemas'
import { useResourceList } from '@/hooks/use-resource'
import { PageHeader } from '@/components/resource/page-header'
import { ResourceTable } from '@/components/resource/resource-table'
import { StatusBadge } from '@/components/resource/status-badge'
import { FilterBar, useFilterParams } from '@/components/resource/filter-bar'
import { Pagination } from '@/components/resource/pagination'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const ROLE_OPTIONS = ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] }))

const columns: ColumnDef<AccountView, unknown>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
  },
  { accessorKey: 'email', header: 'Email' },
  {
    id: 'role',
    accessorFn: (account) => ROLE_LABELS[account.role],
    header: 'Role',
    cell: ({ row }) => (
      <Badge variant="outline" className="font-normal">
        {ROLE_LABELS[row.original.role]}
      </Badge>
    ),
  },
  {
    accessorKey: 'hasLogin',
    header: 'Login',
    enableSorting: false,
    cell: ({ row }) =>
      row.original.hasLogin ? (
        <span className="inline-flex items-center gap-1.5 text-sm">
          <LuKeyRound className="size-3.5 text-success" aria-hidden />
          Can sign in
        </span>
      ) : (
        /* An employee with no password hash: on the payroll, but no account. */
        <span className="text-sm text-muted-foreground">HR record only</span>
      ),
  },
  {
    accessorKey: 'isActive',
    header: 'Status',
    cell: ({ row }) => <StatusBadge status={row.original.isActive ? 'active' : 'archived'} />,
  },
]

export default function UserAdminPage() {
  const router = useRouter()
  const params = useFilterParams(['role', 'isActive'])
  const { page, isLoading } = useResourceList<AccountView>('users', params)

  return (
    <div>
      <PageHeader
        title="User administration"
        description="Who can sign in, and what they may do once they have. Roles come from the same permission table the API enforces."
        actions={
          <Button asChild>
            <Link href="/admin/users/new">
              <LuPlus aria-hidden />
              New account
            </Link>
          </Button>
        }
      />

      <FilterBar
        searchPlaceholder="Search by name or email..."
        filters={[
          { name: 'role', label: 'Role', options: ROLE_OPTIONS },
          {
            name: 'isActive',
            label: 'Status',
            options: [
              { value: 'true', label: 'Active' },
              { value: 'false', label: 'Deactivated' },
            ],
          },
        ]}
      />

      <ResourceTable
        data={page.items}
        columns={columns}
        isLoading={isLoading}
        onRowClick={(row) => router.push(`/admin/users/${row.id}`)}
        emptyMessage="No accounts match these filters"
      />

      <Pagination page={page.page} pages={page.pages} total={page.total} limit={page.limit} />

      <p className="mt-6 flex items-start gap-2 text-xs text-muted-foreground">
        <LuShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        A role decides which sections appear in the navigation AND which API calls
        succeed — both read `ROLE_PERMISSIONS`, so they cannot disagree.
      </p>
    </div>
  )
}
