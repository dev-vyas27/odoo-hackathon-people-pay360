'use client'

/**
 * The Payroll Dashboard — spec B9.
 *
 * Section by section, in the spec's own order:
 *   KPI cards        Total Net Salary Paid, Payslips Generated, Average Salary,
 *                    Approved Time Off, Attendance Health
 *   Charts           Salary Cost by Department, Monthly Net Salary Trend
 *   Operational      missing bank details, duplicate payslips, contract
 *   alerts           attention items
 *   Attendance       Present, Late, Absent, Overtime, missing check-outs,
 *   overview         manual edits, coverage
 *   Department       headcount plus total salary expenditure
 *   breakdown
 *
 * Every figure comes from an aggregation over real rows — spec A7 requires
 * "live metrics derived from actual system records", and there is not a
 * hardcoded number on this page.
 */
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  LuBanknote,
  LuCalendarCheck,
  LuCircleAlert,
  LuFileText,
  LuHeartPulse,
  LuTrendingUp,
  LuTriangleAlert,
  LuUsers,
} from 'react-icons/lu'
import type { DashboardView } from '@/modules/analytics/schemas'
import { useQuery } from '@tanstack/react-query'
import { apiFetch, toQueryString, type ApiError } from '@/lib/api-client'
import { PageHeader } from '@/components/resource/page-header'
import { BarChart } from '@/components/charts/bar-chart'
import { LineChart } from '@/components/charts/line-chart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { KpiCard } from './_components/kpi-card'
import { DashboardFilters } from './_components/dashboard-filters'

const money = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

/** ₹4.4L rather than ₹440,400 on a tile, which has to fit in one line. */
function compactMoney(value: number): string {
  if (value >= 10_000_000) return `₹${(value / 10_000_000).toFixed(2)} Cr`
  if (value >= 100_000) return `₹${(value / 100_000).toFixed(2)} L`
  return money.format(value)
}

export default function ReportsPage() {
  const params = useSearchParams()

  const filters = {
    period: params.get('period') ?? undefined,
    departmentId: params.get('departmentId') ?? undefined,
    employeeType: params.get('employeeType') ?? undefined,
  }

  const { data, isLoading, error } = useQuery<DashboardView, ApiError>({
    queryKey: ['dashboard', filters],
    queryFn: () => apiFetch<DashboardView>(`/api/dashboard${toQueryString(filters)}`),
    placeholderData: (previous) => previous,
  })

  if (error) {
    return (
      <div>
        <PageHeader title="Reports" />
        <p className="rounded-md border border-destructive/25 bg-destructive/8 px-4 py-3 text-sm text-destructive">
          {error.message}
        </p>
      </div>
    )
  }

  if (isLoading || !data) {
    return (
      <div>
        <PageHeader title="Reports" description="Payroll, attendance and leave across the organisation." />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="mt-6 h-64" />
      </div>
    )
  }

  const { kpis, charts, alerts, attendance, timeOff, departments } = data
  const alertCount =
    alerts.missingBankDetails.length +
    alerts.duplicatePayslips.length +
    alerts.contractAttention.length

  return (
    <div>
      <PageHeader
        title="Payroll Dashboard"
        description={`${data.filters.periodLabel} · ${data.headcount} employee${data.headcount === 1 ? '' : 's'} in scope`}
      />

      <DashboardFilters departments={data.departmentOptions} />

      {/*
        Known gap, stated rather than hidden. `PayrollStatsPort` gained an
        `employeeType` parameter (see modules/shared/contracts/dto.ts); the
        payroll-processing adapter has not read it yet, so the filter narrows
        headcount and attendance but not money. A filter that silently does
        nothing is worse than one that says what it does.
        DELETE THIS BLOCK once PayrollStatsAdapter.totals/costByDepartment
        accept and apply the third argument.
      */}
      {data.filters.employeeType ? (
        <p className="-mt-2 mb-6 flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <LuCircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          The employee type filter currently narrows headcount and attendance.
          Payroll totals are not yet filtered by employee type.
        </p>
      ) : null}

      {/*
        ── KPI cards ────────────────────────────────────────────────────────
        Six columns, not five: total net paid takes two of them and is the one
        tile allowed the display size. It is the figure the page exists to
        answer, and giving the other four equal weight would bury it.
      */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <KpiCard
          featured
          className="sm:col-span-2"
          label="Total net paid"
          value={compactMoney(kpis.totalNetPaid)}
          hint="Paid payslips only"
          icon={LuBanknote}
        />
        <KpiCard
          label="Payslips generated"
          value={String(kpis.payslipsGenerated)}
          hint="In this period"
          icon={LuFileText}
        />
        <KpiCard
          label="Average salary"
          value={compactMoney(kpis.averageSalary)}
          hint="Per payslip issued"
          icon={LuTrendingUp}
        />
        <KpiCard
          label="Approved time off"
          value={`${kpis.approvedTimeOff} days`}
          hint={`${timeOff.pendingRequests} pending`}
          icon={LuCalendarCheck}
        />
        <KpiCard
          label="Attendance health"
          value={kpis.attendanceHealth === null ? null : `${kpis.attendanceHealth}%`}
          hint="Records with no exception"
          icon={LuHeartPulse}
          tone={
            kpis.attendanceHealth === null
              ? 'default'
              : kpis.attendanceHealth >= 95
                ? 'success'
                : kpis.attendanceHealth >= 85
                  ? 'warning'
                  : 'danger'
          }
        />
      </div>

      {/* ── Charts ────────────────────────────────────────────────────────── */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="eyebrow">
              Salary cost by department
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              data={charts.salaryCostByDepartment}
              format={(value) => money.format(value)}
              emptyMessage="Nothing paid in this period"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="eyebrow">
              Monthly net salary trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LineChart
              data={charts.monthlyNetTrend}
              format={(value) => money.format(value)}
              emptyMessage="No payroll history yet"
            />
          </CardContent>
        </Card>
      </div>

      {/* ── Operational alerts ────────────────────────────────────────────── */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
            <LuCircleAlert className="size-4" aria-hidden />
            Operational alerts
            {alertCount > 0 ? (
              <Badge variant="outline" className="border-warning/30 bg-warning/15 text-warning-foreground">
                {alertCount}
              </Badge>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {alertCount === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nothing needs attention in this period.
            </p>
          ) : (
            <div className="grid gap-6 md:grid-cols-3">
              <AlertGroup
                title="Missing bank details"
                subtitle="Cannot be paid until filled in"
                items={alerts.missingBankDetails.map((e) => ({ key: e.employeeId, primary: e.name }))}
              />
              <AlertGroup
                title="Duplicate payslips"
                subtitle="Paid more than once this period"
                items={alerts.duplicatePayslips.map((e) => ({
                  key: e.employeeId,
                  primary: e.employeeName,
                  secondary: `${e.count} payslips`,
                }))}
              />
              <AlertGroup
                title="Contract attention"
                subtitle="Expiring or missing"
                items={alerts.contractAttention.map((c) => ({
                  key: `${c.employeeId}-${c.contractId}`,
                  primary: c.employeeName,
                  secondary: c.issue,
                }))}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Attendance overview and department breakdown ──────────────────── */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="eyebrow">
              Attendance overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              <Stat label="Present" value={attendance.present} />
              <Stat label="Late" value={attendance.late} tone={attendance.late > 0 ? 'warning' : undefined} />
              <Stat label="Absent" value={attendance.absent} tone={attendance.absent > 0 ? 'danger' : undefined} />
              <Stat label="Overtime hours" value={attendance.overtimeHours} />
              <Stat
                label="Missing check-outs"
                value={attendance.missingCheckouts}
                tone={attendance.missingCheckouts > 0 ? 'warning' : undefined}
              />
              <Stat label="Manual edits" value={attendance.manualEdits} />
            </dl>

            <div className="mt-5 border-t border-border pt-4">
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-muted-foreground">Coverage</span>
                <span className="tabular">
                  {attendance.coverage === null ? 'No data' : `${attendance.coverage}%`}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Records filed against business days elapsed. Approximate until working
                schedules drive the expected days.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="eyebrow">
              Department breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {departments.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No departments configured.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="pb-2 text-left font-normal">Department</th>
                    <th className="pb-2 text-right font-normal">Headcount</th>
                    <th className="pb-2 text-right font-normal">Total cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {departments.map((department) => (
                    <tr key={department.departmentId}>
                      <td className="py-2">{department.departmentName}</td>
                      <td className="tabular py-2 text-right">{department.headcount}</td>
                      <td className="tabular py-2 text-right">
                        {department.totalCost > 0 ? money.format(department.totalCost) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Time off figures come from{' '}
        <Link href="/time-off/requests" className="underline underline-offset-2">
          Time Off
        </Link>
        . Every number on this page is aggregated from live records.
      </p>
    </div>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: 'warning' | 'danger'
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={
          tone === 'danger'
            ? 'tabular text-lg text-destructive'
            : tone === 'warning'
              ? 'tabular text-lg text-warning-foreground'
              : 'tabular text-lg'
        }
      >
        {value}
      </dd>
    </div>
  )
}

function AlertGroup({
  title,
  subtitle,
  items,
}: {
  title: string
  subtitle: string
  items: Array<{ key: string; primary: string; secondary?: string }>
}) {
  return (
    <div className="flex flex-col">
      <div className="shrink-0">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          {items.length > 0 ? (
            <LuTriangleAlert className="size-3.5 text-warning-foreground" aria-hidden />
          ) : null}
          {title}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
      </div>

      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">None</p>
      ) : (
        <div className="mt-3 max-h-72 overflow-y-auto pr-1.5">
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.key} className="text-sm">
                <span className="flex items-center gap-1.5">
                  <LuUsers className="size-3 shrink-0 text-muted-foreground" aria-hidden />
                  {item.primary}
                </span>
                {item.secondary ? (
                  <span className="ml-4.5 block text-xs text-muted-foreground">
                    {item.secondary}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
