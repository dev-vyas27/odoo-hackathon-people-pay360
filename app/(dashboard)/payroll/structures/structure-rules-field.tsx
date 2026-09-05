'use client'

/**
 * The part of the structure form that manages WHICH rules are included and IN
 * WHAT ORDER.
 *
 * Sequence is edited as a number rather than by dragging: it is the value the
 * engine actually sorts on, so showing it makes the execution order legible
 * instead of implied. Rules are listed in sequence order as you type, and the
 * panel warns about references that resolve to a rule running later — the same
 * analysis the API runs, surfaced while the user can still fix it.
 */
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import { LuPlus, LuTrash2, LuTriangleAlert } from 'react-icons/lu'
import {
  SALARY_CATEGORY_LABELS,
  type SalaryCategory,
  type SalaryStructureFormValues,
} from '@/modules/payroll-config'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FormMessage } from '@/components/ui/form'

export interface AvailableRule {
  id: string
  name: string
  code: string
  category: string
  sequence: number
  /** Codes this rule reads. Drives the ordering warnings below. */
  dependencies: string[]
}

export function StructureRulesField({ available }: { available: AvailableRule[] }) {
  const form = useFormContext<SalaryStructureFormValues>()
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'rules' })
  const rows = useWatch({ control: form.control, name: 'rules' }) ?? []

  const byId = new Map(available.map((rule) => [rule.id, rule]))
  const chosenIds = new Set(rows.map((row) => row?.ruleId).filter(Boolean))
  const unchosen = available.filter((rule) => !chosenIds.has(rule.id))

  const issues = findOrderingIssues(rows, byId)

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-foreground">Included rules</p>
          <p className="text-sm text-muted-foreground">
            Rules run in ascending sequence. A rule may only reference rules that ran before it.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!unchosen.length}
          onClick={() =>
            append({
              ruleId: unchosen[0]?.id ?? '',
              sequence: nextSequence(rows, unchosen[0]?.sequence),
            })
          }
        >
          <LuPlus className="size-4" aria-hidden />
          Add rule
        </Button>
      </div>

      {fields.length ? (
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="grid grid-cols-[5rem_1fr_auto] items-center gap-3 border-b border-border bg-muted/40 px-4 py-2.5 text-xs uppercase tracking-wide text-muted-foreground">
            <span>Sequence</span>
            <span>Salary rule</span>
            <span className="sr-only">Remove</span>
          </div>

          {orderIndexesBySequence(rows).map((index) => {
            const field = fields[index]
            if (!field) return null
            const selected = byId.get(rows[index]?.ruleId ?? '')

            return (
              <div
                key={field.id}
                className="grid grid-cols-[5rem_1fr_auto] items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
              >
                <Input
                  type="number"
                  min={0}
                  className="tabular-nums"
                  {...form.register(`rules.${index}.sequence`, { valueAsNumber: true })}
                />

                <div className="min-w-0">
                  <Select
                    value={rows[index]?.ruleId || undefined}
                    onValueChange={(value) => form.setValue(`rules.${index}.ruleId`, value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose a rule" />
                    </SelectTrigger>
                    <SelectContent>
                      {available
                        .filter((rule) => rule.id === rows[index]?.ruleId || !chosenIds.has(rule.id))
                        .map((rule) => (
                          <SelectItem key={rule.id} value={rule.id}>
                            {rule.code} — {rule.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {selected ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {SALARY_CATEGORY_LABELS[selected.category as SalaryCategory] ??
                        selected.category}
                      {selected.dependencies.length
                        ? ` · reads ${selected.dependencies.join(', ')}`
                        : ''}
                    </p>
                  ) : null}
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove rule"
                  onClick={() => remove(index)}
                >
                  <LuTrash2 className="size-4" aria-hidden />
                </Button>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          No rules included yet. A structure with no rules produces empty payslips.
        </div>
      )}

      {/* The array-level zod message ("needs at least one salary rule") lands here. */}
      <FormMessage>{form.formState.errors.rules?.message}</FormMessage>

      {issues.length ? (
        <ul className="space-y-2">
          {issues.map((issue) => (
            <li
              key={issue}
              className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm"
            >
              <LuTriangleAlert className="mt-0.5 size-4 shrink-0 text-warning-foreground" aria-hidden />
              {issue}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

/** Row indexes in the order the engine will execute them. */
function orderIndexesBySequence(rows: Array<{ sequence?: number } | undefined>): number[] {
  return rows
    .map((row, index) => ({ index, sequence: row?.sequence ?? 0 }))
    .sort((a, b) => a.sequence - b.sequence)
    .map((entry) => entry.index)
}

function nextSequence(rows: Array<{ sequence?: number } | undefined>, fallback = 10): number {
  const highest = rows.reduce((max, row) => Math.max(max, row?.sequence ?? 0), 0)
  return highest ? highest + 10 : fallback
}

/**
 * The same three problems the API reports, computed live: a reference to a rule
 * that is not in the structure, one that runs later, and two rules sharing a code.
 */
function findOrderingIssues(
  rows: Array<{ ruleId?: string; sequence?: number } | undefined>,
  byId: Map<string, AvailableRule>,
): string[] {
  const ordered = orderIndexesBySequence(rows)
    .map((index) => byId.get(rows[index]?.ruleId ?? ''))
    .filter((rule): rule is AvailableRule => Boolean(rule))

  const codesInStructure = new Set(ordered.map((rule) => rule.code))
  const seen = new Set<string>()
  const issues: string[] = []

  for (const rule of ordered) {
    if (seen.has(rule.code)) {
      issues.push(`Two rules in this structure share the code "${rule.code}".`)
    }

    for (const dependency of rule.dependencies) {
      if (!codesInStructure.has(dependency)) {
        issues.push(`"${rule.code}" references "${dependency}", which is not in this structure.`)
      } else if (!seen.has(dependency)) {
        issues.push(`"${rule.code}" references "${dependency}", which runs later in the sequence.`)
      }
    }

    seen.add(rule.code)
  }

  return issues
}
