'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { CreateEmployeeBody } from '@/modules/people/schemas'
import { useCreateResource } from '@/hooks/use-resource'
import { PageHeader } from '@/components/resource/page-header'
import { Button } from '@/components/ui/button'
import { EmployeeForm } from '../_components/employee-form'

export default function NewEmployeePage() {
  const router = useRouter()
  const create = useCreateResource<{ id: string }, CreateEmployeeBody>('employees', {
    successMessage: 'Employee created',
  })

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="New employee"
        description="Creates the record everything else attaches to. A contract can be added once this exists."
      />

      <EmployeeForm
        submitLabel="Create employee"
        defaultValues={{
          name: '',
          email: '',
          employeeType: 'full_time',
          departmentId: undefined,
          jobPositionId: undefined,
          managerId: undefined,
          workingScheduleId: undefined,
          bankAccount: undefined,
          isActive: true,
        }}
        cancel={
          <Button variant="ghost" asChild>
            <Link href="/employees">Cancel</Link>
          </Button>
        }
        onSubmit={async (values) => {
          const created = await create.mutateAsync(values)
          router.push(`/employees/${created.id}`)
        }}
      />
    </div>
  )
}
