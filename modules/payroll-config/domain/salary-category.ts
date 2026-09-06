


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
