/**
 * The ONE definition of what a valid salary rule / structure looks like.
 *
 * Imported by both the `ResourceForm` on the screen and the route handler that
 * receives its submission, so the client and the server cannot drift into
 * disagreeing about what is acceptable.
 *
 * The rule form is deliberately FLAT (computationType + the parameters beside
 * it) rather than a nested discriminated union, because that is the shape a
 * config-driven form renders. `toSalaryRuleData` folds it back into the nested
 * domain shape at the boundary, which is the only place that translation lives.
 */
import { z } from 'zod'
import { nonEmpty, uuid } from '@/modules/shared'
import { SALARY_CATEGORIES } from '../domain/salary-category'
import { COMPUTATION_TYPES } from '../domain/computation/computation.strategy'
import type { ComputationConfig } from '../domain/computation/computation.strategy'
import { RULE_CODE_PATTERN, type SalaryRuleInput } from '../domain/salary-rule'
import { STRUCTURE_CODE_PATTERN, type SalaryStructureInput } from '../domain/salary-structure'

export const salaryRuleBaseSchema = z.object({
  name: nonEmpty('Name'),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(RULE_CODE_PATTERN, 'Use uppercase letters, digits and underscores, e.g. BASIC or HRA'),
  category: z.enum(SALARY_CATEGORIES),
  sequence: z
    .number({ message: 'Enter a sequence' })
    .int('Sequence must be a whole number')
    .min(0, 'Sequence cannot be negative'),
  computationType: z.enum(COMPUTATION_TYPES),
  amount: z.number().nonnegative('Amount cannot be negative').optional(),
  percent: z.number().min(0, 'Cannot be below 0%').max(100, 'Cannot exceed 100%').optional(),
  ofCode: z.string().trim().toUpperCase().optional(),
  expression: z.string().trim().optional(),
  active: z.boolean(),
})

/**
 * Each computation type needs different parameters. Attaching the check to the
 * object (not the field) lets the error land on the field the user must fix.
 */
export const salaryRuleFormSchema = salaryRuleBaseSchema.superRefine((values, ctx) => {
  if (values.computationType === 'fixed' && values.amount === undefined) {
    ctx.addIssue({ code: 'custom', path: ['amount'], message: 'Enter an amount' })
  }

  if (values.computationType === 'percentage') {
    if (values.percent === undefined) {
      ctx.addIssue({ code: 'custom', path: ['percent'], message: 'Enter a percentage' })
    }
    if (!values.ofCode) {
      ctx.addIssue({ code: 'custom', path: ['ofCode'], message: 'Choose the rule this is a percentage of' })
    } else if (!RULE_CODE_PATTERN.test(values.ofCode)) {
      ctx.addIssue({ code: 'custom', path: ['ofCode'], message: 'Not a valid rule code' })
    } else if (values.ofCode === values.code) {
      ctx.addIssue({ code: 'custom', path: ['ofCode'], message: 'A rule cannot be a percentage of itself' })
    }
  }

  if (values.computationType === 'formula' && !values.expression) {
    ctx.addIssue({ code: 'custom', path: ['expression'], message: 'Enter a formula, e.g. GROSS - PF' })
  }
})

export type SalaryRuleFormValues = z.infer<typeof salaryRuleFormSchema>

/** Flat form values -> the nested shape the domain factory expects. */
export function toSalaryRuleData(values: SalaryRuleFormValues): Omit<SalaryRuleInput, 'id'> {
  return {
    name: values.name,
    code: values.code,
    category: values.category,
    sequence: values.sequence,
    computation: toComputationConfig(values),
    active: values.active,
  }
}

function toComputationConfig(values: SalaryRuleFormValues): ComputationConfig {
  switch (values.computationType) {
    case 'percentage':
      return { type: 'percentage', percent: values.percent ?? 0, ofCode: values.ofCode ?? '' }
    case 'formula':
      return { type: 'formula', expression: values.expression ?? '' }
    case 'fixed':
      return { type: 'fixed', amount: values.amount ?? 0 }
  }
}

/** Domain shape -> flat form values, for the edit screen. */
export function toSalaryRuleFormValues(rule: {
  name: string
  code: string
  category: string
  sequence: number
  computation: ComputationConfig
  active: boolean
}): SalaryRuleFormValues {
  const c = rule.computation
  return {
    name: rule.name,
    code: rule.code,
    category: rule.category as SalaryRuleFormValues['category'],
    sequence: rule.sequence,
    computationType: c.type,
    amount: c.type === 'fixed' ? c.amount : undefined,
    percent: c.type === 'percentage' ? c.percent : undefined,
    ofCode: c.type === 'percentage' ? c.ofCode : undefined,
    expression: c.type === 'formula' ? c.expression : undefined,
    active: rule.active,
  }
}

export const salaryStructureFormSchema = z.object({
  name: nonEmpty('Name'),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(STRUCTURE_CODE_PATTERN, 'Use uppercase letters, digits and underscores, e.g. STD_MONTHLY'),
  active: z.boolean(),
  rules: z
    .array(
      z.object({
        ruleId: uuid,
        sequence: z
          .number({ message: 'Enter a sequence' })
          .int('Sequence must be a whole number')
          .min(0, 'Sequence cannot be negative'),
      }),
    )
    .min(1, 'A structure needs at least one salary rule'),
})

export type SalaryStructureFormValues = z.infer<typeof salaryStructureFormSchema>

export function toSalaryStructureData(
  values: SalaryStructureFormValues,
): Omit<SalaryStructureInput, 'id'> {
  return {
    name: values.name,
    code: values.code,
    rules: values.rules,
    active: values.active,
  }
}
