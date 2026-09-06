'use client'

import { useRouter } from 'next/navigation'
import { useFormContext, useWatch } from 'react-hook-form'
import toast from 'react-hot-toast'
import Link from 'next/link'
import {
  COMPUTATION_TYPE_LABELS,
  COMPUTATION_TYPES,
  SALARY_CATEGORIES,
  SALARY_CATEGORY_LABELS,
  salaryRuleFormSchema,
  type SalaryRuleFormValues,
} from '@/modules/payroll-config'
import { ResourceForm, type FieldConfig } from '@/components/resource/resource-form'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ApiError, apiPatch, apiPost } from '../_lib/api'

const fields: FieldConfig<SalaryRuleFormValues>[] = [
  { name: 'name', label: 'Name', placeholder: 'House Rent Allowance' },
  {
    name: 'code',
    label: 'Code',
    placeholder: 'HRA',
    description: 'Uppercase. Other rules reference this rule by its code.',
  },
  {
    name: 'category',
    label: 'Category',
    type: 'select',
    options: SALARY_CATEGORIES.map((c) => ({ value: c, label: SALARY_CATEGORY_LABELS[c] })),
    description: 'Drives which section of the payslip breakdown this line appears in.',
  },
  {
    name: 'sequence',
    label: 'Sequence',
    type: 'number',
    description: 'Rules run in ascending order and may only reference earlier ones.',
  },
  {
    name: 'computationType',
    label: 'Computation',
    type: 'select',
    options: COMPUTATION_TYPES.map((t) => ({ value: t, label: COMPUTATION_TYPE_LABELS[t] })),
    span: 2,
  },
  { name: 'active', label: 'Active', type: 'checkbox', span: 2 },
]

export const emptyRule: SalaryRuleFormValues = {
  name: '',
  code: '',
  category: 'allowance',
  sequence: 10,
  computationType: 'fixed',
  amount: undefined,
  percent: undefined,
  ofCode: undefined,
  expression: undefined,
  active: true,
}

export function RuleForm({
  rule,
  ruleId,
  availableCodes,
  readOnly = false,
}: {
  rule: SalaryRuleFormValues
  
  ruleId?: string
  
  availableCodes: string[]
  
  readOnly?: boolean
}) {
  const router = useRouter()

  async function submit(values: SalaryRuleFormValues) {
    try {
      if (ruleId) {
        await apiPatch(`/api/payroll/rules/${ruleId}`, values)
        toast.success(`Saved "${values.name}"`)
      } else {
        await apiPost('/api/payroll/rules', values)
        toast.success(`Created "${values.name}"`)
      }
      router.push('/payroll/rules')
      router.refresh()
    } catch (reason) {
      
      
      toast.error(reason instanceof ApiError ? reason.message : 'Could not save this rule')
    }
  }

  return (
    <ResourceForm
      readOnly={readOnly}
      schema={salaryRuleFormSchema}
      fields={fields}
      defaultValues={rule as never}
      onSubmit={submit}
      submitLabel={ruleId ? 'Save rule' : 'Create rule'}
      cancel={
        <Button asChild type="button" variant="ghost">
          <Link href="/payroll/rules">Cancel</Link>
        </Button>
      }
    >
      <ComputationFields availableCodes={availableCodes} />
    </ResourceForm>
  )
}

function ComputationFields({ availableCodes }: { availableCodes: string[] }) {
  const form = useFormContext<SalaryRuleFormValues>()
  const type = useWatch({ control: form.control, name: 'computationType' })

  return (
    <div className="rounded-2xl border border-border bg-muted/25 p-5">
      <p className="mb-4 text-xs uppercase tracking-wide text-muted-foreground">
        {COMPUTATION_TYPE_LABELS[type] ?? 'Computation'}
      </p>

      <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
        {type === 'fixed' ? (
          <>
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      step="0.01"
                      value={field.value ?? ''}
                      onChange={(e) =>
                        field.onChange(e.target.value === '' ? undefined : Number(e.target.value))
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        ) : null}

        {type === 'percentage' ? (
          <>
            <FormField
              control={form.control}
              name="percent"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Percentage</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      step="0.01"
                      value={field.value ?? ''}
                      onChange={(e) =>
                        field.onChange(e.target.value === '' ? undefined : Number(e.target.value))
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="ofCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Of rule code</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      list="rule-codes"
                      placeholder="BASIC"
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    />
                  </FormControl>
                  <datalist id="rule-codes">
                    {availableCodes.map((code) => (
                      <option key={code} value={code} />
                    ))}
                  </datalist>
                  <FormDescription>
                    Must be a rule that runs earlier in the structure.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        ) : null}

        {type === 'formula' ? (
          <FormField
            control={form.control}
            name="expression"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>Formula</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="GROSS - PF - TAX"
                    className="font-mono"
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                  />
                </FormControl>
                <FormDescription>
                  Rule codes, numbers, + - * / ( ) and min/max. For example{' '}
                  <span className="font-mono">max(GROSS - 30000, 0) * 0.1</span>.
                  Use <span className="font-mono">WAGE * WORKED_RATIO</span> for contract wage
                  proration.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}
      </div>
    </div>
  )
}
