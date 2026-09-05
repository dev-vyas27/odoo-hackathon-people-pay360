'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { checkInSchema, type CheckInBody } from '@/modules/attendance/schemas'
import { useCreateResource } from '@/hooks/use-resource'
import { PageHeader } from '@/components/resource/page-header'
import { ResourceForm } from '@/components/resource/resource-form'
import { Button } from '@/components/ui/button'
import { useEmployeeOptions } from '../../_components/options'

export default function NewAttendancePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const employeeId = searchParams.get('employeeId') ?? ''
  const employees = useEmployeeOptions()

  const create = useCreateResource<{ id: string }, CheckInBody>('attendance', {
    successMessage: 'Checked in',
  })

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Record attendance"
        description="Creates the check-in. Check-out is recorded separately, which is what makes a missing check-out visible rather than guessed."
      />

      <ResourceForm<CheckInBody>
        schema={checkInSchema}
        submitLabel="Check in"
        defaultValues={{ employeeId, checkIn: new Date(), breakMinutes: 0 }}
        cancel={
          <Button variant="ghost" asChild>
            <Link href="/attendance">Cancel</Link>
          </Button>
        }
        onSubmit={async (values) => {
          await create.mutateAsync(values)
          router.push(employeeId ? `/attendance?employeeId=${employeeId}` : '/attendance')
        }}
        fields={[
          {
            name: 'employeeId',
            label: 'Employee',
            type: 'select',
            options: employees.options,
            placeholder: employees.isLoading ? 'Loading...' : 'Select employee',
          },
          // A timestamp, not a date — see attendance-detail.tsx.
          { name: 'checkIn', label: 'Check in (UTC)', type: 'datetime-local' },
          {
            name: 'breakMinutes',
            label: 'Break (minutes)',
            type: 'number',
            span: 2,
            description: 'Deducted from worked hours when the day is closed out.',
          },
        ]}
      />
    </div>
  )
}
