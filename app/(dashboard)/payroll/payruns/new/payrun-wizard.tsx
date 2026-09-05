'use client'

/**
 * The payrun creation wizard.
 *
 * The rule that matters: **step 1 creates nothing**. Choosing a structure and a
 * period only moves the wizard forward — the scope lives in React state, step 2
 * asks a read-only question (`GET /api/payruns/eligible-employees`), and the one
 * and only write is the single `POST /api/payruns` behind "Create pay run". You
 * can watch that in the network tab, which is the point.
 *
 * Built local to this route rather than on a shared wizard shell, so the payroll
 * screens do not block on the platform kit landing; it swaps over cleanly when
 * that arrives.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import toast from 'react-hot-toast'
import { LuArrowLeft, LuArrowRight, LuCheck, LuLoaderCircle, LuTriangleAlert } from 'react-icons/lu'
import {
  payrunScopeSchema,
  type PayrunScopeValues,
  type PayrunView,
} from '@/modules/payroll-processing'
import { EMPLOYEE_TYPES, type EmployeeType } from '@/modules/shared'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError, apiGet, apiPost } from '../../_lib/api'
import { formatMoney, monthBounds } from '../../_lib/format'
import { ErrorState, WarningNote } from '../../_components/states'

interface StructureOption {
  id: string
  name: string
  ruleCount: number
}

const EMPLOYEE_TYPE_LABELS: Record<EmployeeType, string> = {
  full_time: 'Full time',
  part_time: 'Part time',
  contract: 'Contract',
  intern: 'Intern',
}

/** The row shape returned by the eligible-employees endpoint. */
interface EligibleRow {
  id: string
  name: string
  email: string
  departmentName: string | null
  jobPositionName: string | null
  employeeType: string
  hasBankAccount: boolean
  wage: number | null
  eligible: boolean
  reason: string | null
  message: string | null
}

export function PayrunWizard({ structures }: { structures: StructureOption[] }) {
  const router = useRouter()
  const month = monthBounds()

  const [step, setStep] = useState<1 | 2>(1)
  const [scope, setScope] = useState<PayrunScopeValues | null>(null)
  const [candidates, setCandidates] = useState<EligibleRow[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)

  const form = useForm<PayrunScopeValues>({
    resolver: zodResolver(payrunScopeSchema as never),
    mode: 'onTouched',
    defaultValues: {
      name: defaultName(),
      structureId: structures[0]?.id ?? '',
      periodStart: month.start as unknown as Date,
      periodEnd: month.end as unknown as Date,
      departmentId: undefined,
      employeeType: undefined,
    },
  })

  /** Step 1 -> step 2. Reads who is eligible; writes nothing. */
  async function continueToSelection(values: PayrunScopeValues) {
    setScope(values)
    setStep(2)
    setLoading(true)
    setLoadError(null)

    try {
      const query = new URLSearchParams({
        periodStart: toIso(values.periodStart),
        periodEnd: toIso(values.periodEnd),
        ...(values.employeeType ? { employeeType: values.employeeType } : {}),
        ...(values.departmentId ? { departmentId: values.departmentId } : {}),
      })
      const rows = await apiGet<EligibleRow[]>(`/api/payruns/eligible-employees?${query}`)
      setCandidates(rows)
      // Pre-tick everyone who can actually be paid; the user unticks exceptions.
      setSelected(new Set(rows.filter((r) => r.eligible).map((r) => r.id)))
    } catch (reason) {
      setCandidates(null)
      setLoadError(
        reason instanceof ApiError ? reason.message : 'Could not load the employee list.',
      )
    } finally {
      setLoading(false)
    }
  }

  /** The wizard's only write. */
  async function createPayrun() {
    if (!scope || !selected.size) return
    setCreating(true)

    try {
      const payrun = await apiPost<PayrunView>('/api/payruns', {
        name: scope.name,
        structureId: scope.structureId,
        periodStart: toIso(scope.periodStart),
        periodEnd: toIso(scope.periodEnd),
        departmentId: scope.departmentId,
        employeeIds: [...selected],
      })
      toast.success(`Created "${payrun.name}"`)
      router.push(`/payroll/payruns/${payrun.id}`)
      router.refresh()
    } catch (reason) {
      toast.error(reason instanceof ApiError ? reason.message : 'Could not create this pay run')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      <Steps current={step} />

      {step === 1 ? (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(continueToSelection)} className="space-y-6" noValidate>
            <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Pay run name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="January 2026 payroll" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="structureId"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Salary structure</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Choose a structure" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {structures.map((structure) => (
                          <SelectItem key={structure.id} value={structure.id}>
                            {structure.name} ({structure.ruleCount} rules)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Every payslip in this run is computed from this structure.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="periodStart"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Period start</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" value={toIso(field.value)} />
                    </FormControl>
                    <FormDescription>First day of the payroll period.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="periodEnd"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Period end</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" value={toIso(field.value)} />
                    </FormControl>
                    <FormDescription>Last day of the payroll period.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="employeeType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employee type (optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="All types" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {EMPLOYEE_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {EMPLOYEE_TYPE_LABELS[type]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex items-center gap-3 border-t border-border pt-5">
              <Button type="submit">
                Continue
                <LuArrowRight className="size-4" aria-hidden />
              </Button>
              <Button asChild type="button" variant="ghost">
                <Link href="/payroll/payruns">Cancel</Link>
              </Button>
              <p className="ml-auto text-xs text-muted-foreground">
                Continuing does not create anything yet.
              </p>
            </div>
          </form>
        </Form>
      ) : (
        <SelectionStep
          scope={scope}
          candidates={candidates}
          selected={selected}
          setSelected={setSelected}
          loading={loading}
          loadError={loadError}
          creating={creating}
          onBack={() => setStep(1)}
          onCreate={createPayrun}
        />
      )}
    </div>
  )
}

function SelectionStep({
  scope,
  candidates,
  selected,
  setSelected,
  loading,
  loadError,
  creating,
  onBack,
  onCreate,
}: {
  scope: PayrunScopeValues | null
  candidates: EligibleRow[] | null
  selected: Set<string>
  setSelected: (next: Set<string>) => void
  loading: boolean
  loadError: string | null
  creating: boolean
  onBack: () => void
  onCreate: () => void
}) {
  function toggle(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const eligible = candidates?.filter((row) => row.eligible) ?? []
  const ineligible = candidates?.filter((row) => !row.eligible) ?? []

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-muted/25 px-5 py-3 text-sm">
        <span className="text-foreground">{scope?.name}</span>
        <span className="text-muted-foreground">
          {' '}
          · {toIso(scope?.periodStart)} to {toIso(scope?.periodEnd)}
        </span>
      </div>

      {loading ? (
        <div className="space-y-2 rounded-2xl border border-border p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : loadError ? (
        <ErrorState title="Could not load eligible employees" message={loadError} />
      ) : (
        <>
          {eligible.length ? (
            <div className="overflow-hidden rounded-2xl border border-border">
              <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-4 py-2.5 text-xs uppercase tracking-wide text-muted-foreground">
                <span className="w-5" />
                <span className="flex-1">Employee</span>
                <span className="w-40">Department</span>
                <span className="w-28 text-right">Wage</span>
              </div>

              {eligible.map((row) => (
                <label
                  key={row.id}
                  className="flex cursor-pointer items-center gap-3 border-b border-border px-4 py-3 text-sm last:border-b-0 hover:bg-accent/40"
                >
                  <Checkbox
                    checked={selected.has(row.id)}
                    onCheckedChange={() => toggle(row.id)}
                    aria-label={`Include ${row.name}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-foreground">{row.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {row.email}
                      {row.hasBankAccount ? '' : ' · no bank account on file'}
                    </span>
                  </span>
                  <span className="w-40 truncate text-muted-foreground">
                    {row.departmentName ?? '—'}
                  </span>
                  <span className="w-28 text-right tabular-nums text-muted-foreground">
                    {row.wage === null ? '—' : formatMoney(row.wage)}
                  </span>
                </label>
              ))}
            </div>
          ) : (
            <ErrorState
              title="Nobody is eligible for this period"
              message="No active employee has a contract covering it. Check the period, or add contracts first."
            />
          )}

          {ineligible.length ? (
            <WarningNote>
              <p className="font-medium">
                {ineligible.length} employee{ineligible.length === 1 ? '' : 's'} cannot be included
              </p>
              <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
                {ineligible.map((row) => (
                  <li key={row.id}>{row.message ?? row.name}</li>
                ))}
              </ul>
            </WarningNote>
          ) : null}
        </>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
        <Button type="button" variant="outline" onClick={onBack} disabled={creating}>
          <LuArrowLeft className="size-4" aria-hidden />
          Back
        </Button>

        <Button type="button" onClick={onCreate} disabled={creating || !selected.size}>
          {creating ? (
            <>
              <LuLoaderCircle className="size-4 animate-spin" aria-hidden />
              Creating...
            </>
          ) : (
            <>
              <LuCheck className="size-4" aria-hidden />
              Create pay run
            </>
          )}
        </Button>

        <p className="text-sm text-muted-foreground">
          {selected.size} employee{selected.size === 1 ? '' : 's'} selected
        </p>

        {!selected.size && !loading ? (
          <p className="flex items-center gap-1.5 text-sm text-warning-foreground">
            <LuTriangleAlert className="size-4" aria-hidden />
            Select at least one employee
          </p>
        ) : null}
      </div>
    </div>
  )
}

function Steps({ current }: { current: 1 | 2 }) {
  const steps = [
    { number: 1 as const, label: 'Scope' },
    { number: 2 as const, label: 'Employees' },
  ]

  return (
    <ol className="flex items-center gap-3">
      {steps.map((step) => {
        const active = step.number === current
        const done = step.number < current
        return (
          <li key={step.number} className="flex items-center gap-2">
            <span
              className={
                active || done
                  ? 'flex size-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground'
                  : 'flex size-6 items-center justify-center rounded-full border border-border text-xs text-muted-foreground'
              }
            >
              {done ? <LuCheck className="size-3.5" aria-hidden /> : step.number}
            </span>
            <span className={active ? 'text-sm text-foreground' : 'text-sm text-muted-foreground'}>
              {step.label}
            </span>
            {step.number === 1 ? <span className="mx-1 h-px w-8 bg-border" /> : null}
          </li>
        )
      })}
    </ol>
  )
}

/**
 * Date inputs speak "YYYY-MM-DD" while the zod schema coerces to Date, so the
 * form holds whichever the last write produced. This normalises both.
 */
function toIso(value: Date | string | undefined): string {
  if (!value) return ''
  if (typeof value === 'string') return value.slice(0, 10)
  return value.toISOString().slice(0, 10)
}

function defaultName(): string {
  const now = new Date()
  const month = now.toLocaleString('en-IN', { month: 'long', timeZone: 'UTC' })
  return `${month} ${now.getUTCFullYear()} payroll`
}
