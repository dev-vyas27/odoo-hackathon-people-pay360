'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { CreateScheduleBody } from '@/modules/employment/schemas'
import { useCreateResource } from '@/hooks/use-resource'
import { PageHeader } from '@/components/resource/page-header'
import { Button } from '@/components/ui/button'
import { ScheduleForm } from '../_components/schedule-form'

/** Monday to Friday, 9 to 5 with an hour for lunch — the common case, pre-filled. */
const STANDARD_WEEK: CreateScheduleBody['days'] = [1, 2, 3, 4, 5].map((day) => ({
  day: day as CreateScheduleBody['days'][number]['day'],
  start: '09:00',
  end: '17:00',
  breakMinutes: 60,
}))

export default function NewSchedulePage() {
  const router = useRouter()
  const create = useCreateResource<{ id: string }, CreateScheduleBody>('schedules', {
    successMessage: 'Schedule created',
  })

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="New working schedule"
        description="Define the weekly pattern. Weekly hours are derived from it and kept in step automatically."
      />

      <ScheduleForm
        submitLabel="Create schedule"
        defaultValues={{ name: '', days: STANDARD_WEEK }}
        cancel={
          <Button variant="ghost" asChild>
            <Link href="/schedules">Cancel</Link>
          </Button>
        }
        onSubmit={async (values) => {
          await create.mutateAsync(values)
          router.push('/schedules')
        }}
      />
    </div>
  )
}
