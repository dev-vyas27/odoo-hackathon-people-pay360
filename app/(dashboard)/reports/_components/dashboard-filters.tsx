'use client'



import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { LuX } from 'react-icons/lu'
import { EMPLOYEE_TYPES } from '@/modules/shared'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'


const ALL = '__all__'

const MONTH_FORMAT = new Intl.DateTimeFormat('en-GB', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

function recentMonths(count: number) {
  const today = new Date()
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1))
    return {
      value: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`,
      label: MONTH_FORMAT.format(date),
    }
  })
}

const TYPE_LABELS: Record<string, string> = {
  full_time: 'Full time',
  part_time: 'Part time',
  contract: 'Contract',
  intern: 'Intern',
}

export function DashboardFilters({
  departments,
}: {
  departments: Array<{ id: string; name: string }>
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const apply = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString())
    if (!value || value === ALL) next.delete(key)
    else next.set(key, value)
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }

  const months = recentMonths(12)
  const years = [...new Set(months.map((m) => m.value.slice(0, 4)))]
  const active = ['period', 'departmentId', 'employeeType'].some((k) => params.get(k))

  return (
    <div className="flex flex-wrap items-center gap-3 pb-6">
      <Select
        value={params.get('period') ?? months[0].value}
        onValueChange={(value) => apply('period', value)}
      >
        <SelectTrigger className="w-[12rem]" aria-label="Period">
          <SelectValue placeholder="Period" />
        </SelectTrigger>
        <SelectContent>
          {months.map((month) => (
            <SelectItem key={month.value} value={month.value}>
              {month.label}
            </SelectItem>
          ))}
          {}
          {years.map((year) => (
            <SelectItem key={year} value={year}>
              Full year {year}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={params.get('departmentId') ?? ALL}
        onValueChange={(value) => apply('departmentId', value)}
      >
        <SelectTrigger className="w-[12rem]" aria-label="Department">
          <SelectValue placeholder="Department" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All departments</SelectItem>
          {departments.map((department) => (
            <SelectItem key={department.id} value={department.id}>
              {department.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={params.get('employeeType') ?? ALL}
        onValueChange={(value) => apply('employeeType', value)}
      >
        <SelectTrigger className="w-[11rem]" aria-label="Employee type">
          <SelectValue placeholder="Employee type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All employee types</SelectItem>
          {EMPLOYEE_TYPES.map((type) => (
            <SelectItem key={type} value={type}>
              {TYPE_LABELS[type] ?? type}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {active ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.replace(pathname, { scroll: false })}
        >
          <LuX aria-hidden />
          Reset
        </Button>
      ) : null}
    </div>
  )
}
