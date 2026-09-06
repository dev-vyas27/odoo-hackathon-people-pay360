/**
 * The five categories a salary rule may belong to.
 *
 * The list itself lives in the shared kernel (`contracts/dto.ts`) because the
 * dashboard and the PDF renderer both group payslip lines by it, and the
 * database enforces the same five values in a CHECK constraint on both
 * `salary_rules.category` and `payslip_lines.category`. Re-exported here so the
 * rest of this module has one obvious place to import it from; the LABELS are
 * ours, because only the payroll screens render them.
 */
import { SALARY_CATEGORIES, type SalaryCategory } from '@/modules/shared'

export { SALARY_CATEGORIES, type SalaryCategory }

export const SALARY_CATEGORY_LABELS: Record<SalaryCategory, string> = {
  basic: 'Basic',
  allowance: 'Allowance',
  gross: 'Gross',
  deduction: 'Deduction',
  net: 'Net',
}

export function isSalaryCategory(value: string): value is SalaryCategory {
  return (SALARY_CATEGORIES as readonly string[]).includes(value)
}
