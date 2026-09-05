/**
 * PayslipQueryPort — CONSUMED from payroll-processing (Dev C).
 *
 * Delivery never imports payroll-processing. It codes against this type, which
 * lives in the shared kernel where both sides can see it, and resolves the real
 * implementation at run time through `PORT_KEYS.payslipQuery`. That is why this
 * module typechecks, renders and tests without payroll being wired up at all.
 *
 * Amounts are MAJOR units, already rounded by the provider, so the PDF cannot
 * disagree with the screen.
 */
export type { PayslipLineView, PayslipView, PayslipQueryPort } from '@/modules/shared'
