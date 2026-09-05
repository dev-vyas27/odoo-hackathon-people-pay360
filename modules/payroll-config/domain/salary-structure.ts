/**
 * SalaryStructure — AGGREGATE ROOT: an ordered collection of salary rules.
 *
 * The structure owns WHICH rules apply and IN WHAT ORDER. The order is the whole
 * game: HRA cannot be 40% of BASIC unless BASIC has already run, and NET cannot
 * subtract PF unless PF has. Sequence is stored per structure rather than only
 * on the rule, so the same PF rule can sit at a different point in two different
 * structures without either one being edited.
 */
import { DomainError } from '@/modules/shared'
import type { SalaryRule } from './salary-rule'
import { dependenciesOf } from './salary-rule'

export interface StructureRuleRef {
  readonly ruleId: string
  readonly sequence: number
}

export interface SalaryStructure {
  readonly id: string
  readonly name: string
  /** Stable identifier for the structure itself. `salary_structures.code`. */
  readonly code: string
  readonly rules: readonly StructureRuleRef[]
  readonly active: boolean
}

export interface SalaryStructureInput {
  id: string
  name: string
  code: string
  rules: StructureRuleRef[]
  active?: boolean
}

/** Uppercase identifier, e.g. STD_MONTHLY. Matches salary_structures_code_key. */
export const STRUCTURE_CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/

export function createSalaryStructure(input: SalaryStructureInput): SalaryStructure {
  const name = input.name.trim()
  if (!name) {
    throw DomainError.validation('STRUCTURE_NAME_REQUIRED', 'A salary structure needs a name.')
  }

  const code = input.code.trim().toUpperCase()
  if (!STRUCTURE_CODE_PATTERN.test(code)) {
    throw DomainError.validation(
      'STRUCTURE_CODE_INVALID',
      `"${input.code}" is not a valid structure code. Use uppercase letters, digits and underscores, for example STD_MONTHLY.`,
      { code: input.code },
    )
  }

  const seen = new Set<string>()
  for (const ref of input.rules) {
    if (seen.has(ref.ruleId)) {
      throw DomainError.validation(
        'STRUCTURE_DUPLICATE_RULE',
        'The same salary rule is included twice in this structure.',
        { ruleId: ref.ruleId },
      )
    }
    seen.add(ref.ruleId)

    if (!Number.isInteger(ref.sequence) || ref.sequence < 0) {
      throw DomainError.validation(
        'STRUCTURE_SEQUENCE_INVALID',
        'Each included rule needs a whole-number sequence of 0 or more.',
        { ruleId: ref.ruleId, sequence: ref.sequence },
      )
    }
  }

  return {
    id: input.id,
    name,
    code,
    rules: [...input.rules].sort((a, b) => a.sequence - b.sequence),
    active: input.active ?? true,
  }
}

/**
 * A structure with its rule references resolved to the actual rules, in
 * execution order. This is what the engine and the payslip factory consume.
 */
export interface ResolvedSalaryStructure {
  readonly id: string
  readonly name: string
  readonly active: boolean
  readonly rules: ReadonlyArray<{ rule: SalaryRule; sequence: number }>
}

/**
 * Join a structure to its rules, in sequence order.
 *
 * A reference pointing at a rule that no longer exists is an error rather than a
 * silent omission: a payslip missing its PF line because a rule was deleted last
 * week is a bug nobody notices until an audit.
 */
export function resolveStructure(
  structure: SalaryStructure,
  rulesById: ReadonlyMap<string, SalaryRule>,
): ResolvedSalaryStructure {
  const resolved = structure.rules.map((ref) => {
    const rule = rulesById.get(ref.ruleId)
    if (!rule) {
      throw DomainError.notFound(
        'STRUCTURE_RULE_MISSING',
        `Salary structure "${structure.name}" includes a rule that no longer exists.`,
        { structureId: structure.id, ruleId: ref.ruleId },
      )
    }
    return { rule, sequence: ref.sequence }
  })

  return {
    id: structure.id,
    name: structure.name,
    active: structure.active,
    rules: resolved.sort((a, b) => a.sequence - b.sequence),
  }
}

export interface StructureIssue {
  readonly ruleCode: string
  readonly code: string
  readonly message: string
}

/**
 * Static analysis of a resolved structure, for the config screen.
 *
 * Reports every ordering problem at once — duplicate codes, references to rules
 * that are not in this structure, and references to rules that run LATER — so
 * the user fixes them in the form instead of discovering them one at a time
 * during a payrun.
 */
export function inspectStructure(structure: ResolvedSalaryStructure): StructureIssue[] {
  const issues: StructureIssue[] = []
  const availableSoFar = new Set<string>()
  const codesInStructure = new Set(structure.rules.map((r) => r.rule.code))

  for (const { rule } of structure.rules) {
    if (availableSoFar.has(rule.code)) {
      issues.push({
        ruleCode: rule.code,
        code: 'DUPLICATE_RULE_CODE',
        message: `Two rules in this structure share the code "${rule.code}".`,
      })
    }

    for (const dependency of dependenciesOf(rule)) {
      if (!codesInStructure.has(dependency)) {
        issues.push({
          ruleCode: rule.code,
          code: 'MISSING_DEPENDENCY',
          message: `"${rule.code}" references "${dependency}", which is not part of this structure.`,
        })
      } else if (!availableSoFar.has(dependency)) {
        issues.push({
          ruleCode: rule.code,
          code: 'DEPENDENCY_RUNS_LATER',
          message: `"${rule.code}" references "${dependency}", which runs later in the sequence.`,
        })
      }
    }

    availableSoFar.add(rule.code)
  }

  return issues
}
