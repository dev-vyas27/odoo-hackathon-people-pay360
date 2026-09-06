'use client'



import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import {
  allocationSchema,
  type AllocationValues,
  type EmployeeOption,
  type TimeOffTypeView,
} from '@/modules/timeoff/schemas'
import { useCreateResource, useResourceList } from '@/hooks/use-resource'
import { apiFetch } from '@/lib/api-client'
import { PageHeader } from '@/components/resource/page-header'
import { ResourceForm } from '@/components/resource/resource-form'
import { Button } from '@/components/ui/button'

export default function NewAllocationPage() {
  const router = useRouter()

  const { data: employees = [] } = useQuery<EmployeeOption[]>({
    queryKey: ['time-off', 'employee-options'],
    queryFn: () => apiFetch<EmployeeOption[]>('/api/time-off/employee-options'),
  })

  const { page: types } = useResourceList<TimeOffTypeView>('time-off/types', {
    isActive: 'true',
    limit: 100,
  })

  


  const allocatable = types.items.filter((type) => type.requiresAllocation)

  const create = useCreateResource<{ id: string }, AllocationValues>('time-off/allocations', {
    successMessage: 'Allocation created — approve it to make it available',
  })

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="New allocation"
        description="Grants an entitlement for a validity window. It becomes spendable once approved."
      />

      <ResourceForm<AllocationValues>
        schema={allocationSchema}
        submitLabel="Create allocation"
        defaultValues={{ employeeId: '', timeOffTypeId: '', note: '' }}
        fields={[
          {
            name: 'employeeId',
            label: 'Employee',
            type: 'select',
            options: employees.map((e) => ({ value: e.id, label: e.name })),
          },
          {
            name: 'timeOffTypeId',
            label: 'Leave type',
            type: 'select',
            options: allocatable.map((t) => ({ value: t.id, label: `${t.name} (${t.code})` })),
            description: 'Only types that draw down a balance are listed.',
          },
          {
            name: 'allocated',
            label: 'Amount',
            type: 'number',
            description: 'In the unit of the selected leave type.',
          },
          { name: 'validFrom', label: 'Valid from', type: 'date' },
          {
            name: 'validTo',
            label: 'Valid to',
            type: 'date',
            description: 'A request must fall entirely inside this window.',
          },
          { name: 'note', label: 'Note', type: 'textarea', span: 2 },
        ]}
        cancel={
          <Button variant="ghost" asChild>
            <Link href="/time-off/allocations">Cancel</Link>
          </Button>
        }
        onSubmit={async (values) => {
          await create.mutateAsync(values)
          router.push('/time-off/allocations')
        }}
      />
    </div>
  )
}
