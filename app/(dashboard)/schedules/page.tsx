'use client'

/**
 * The Working Schedule list (spec A3): "list view should show key metrics like
 * name, type, and weekly hours".
 */
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { ColumnDef } from '@tanstack/react-table'
import { LuPlus } from 'react-icons/lu'
import type { ScheduleListItem } from '@/modules/employment/schemas'
import { SCHEDULE_TYPE_LABELS, WEEKDAY_LABELS } from '@/modules/employment/schemas'
import { useResourceList } from '@/hooks/use-resource'
import { PageHeader } from '@/components/resource/page-header'
import { ResourceTable } from '@/components/resource/resource-table'
import { FilterBar, useFilterParams } from '@/components/resource/filter-bar'
import { Pagination } from '@/components/resource/pagination'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const columns: ColumnDef<ScheduleListItem, unknown>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
  },
  {
    accessorKey: 'type',
    header: 'Type',
    cell: ({ row }) => (
      <Badge variant={row.original.type === 'full_time' ? 'default' : 'outline'}>
        {SCHEDULE_TYPE_LABELS[row.original.type]}
      </Badge>
    ),
  },
  {
    id: 'days',
    header: 'Working days',
    enableSorting: false,
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1">
        {row.original.days.length === 0 ? (
          <span className="text-muted-foreground">No pattern set</span>
        ) : (
          [...row.original.days]
            .sort((a, b) => a.day - b.day)
            .map((d) => (
              <Badge key={d.day} variant="outline" className="font-normal">
                {WEEKDAY_LABELS[d.day].slice(0, 3)}
              </Badge>
            ))
        )}
      </div>
    ),
  },
  {
    accessorKey: 'weeklyHours',
    header: 'Weekly hours',
    cell: ({ row }) => (
      <span className="tabular font-medium">{row.original.weeklyHours.toFixed(2)} h</span>
    ),
  },
]

export default function SchedulesPage() {
  const router = useRouter()
  const params = useFilterParams([])
  const { page, isLoading } = useResourceList<ScheduleListItem>('schedules', params)

  return (
    <div>
      <PageHeader
        title="Working Schedules"
        description="The weekly pattern attendance is judged against and payroll prorates by. Weekly hours are calculated, never typed."
        actions={
          <Button asChild>
            <Link href="/schedules/new">
              <LuPlus aria-hidden />
              New schedule
            </Link>
          </Button>
        }
      />

      <FilterBar searchPlaceholder="Search schedules..." />

      <ResourceTable
        data={page.items}
        columns={columns}
        isLoading={isLoading}
        onRowClick={(row) => router.push(`/schedules/${row.id}`)}
        emptyMessage="No working schedules yet"
        emptyAction={
          <Button variant="outline" asChild>
            <Link href="/schedules/new">Create the first one</Link>
          </Button>
        }
      />

      <Pagination page={page.page} pages={page.pages} total={page.total} limit={page.limit} />
    </div>
  )
}
