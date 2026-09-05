/**
 * PayslipQueryPort — the read model of a computed payslip.
 *
 * PUBLISHED BY: payroll-processing (Dev C)
 * CONSUMED BY:  delivery (Dev A) for PDF generation and bulk email
 *
 * The shapes themselves live in the shared kernel's `contracts/dto.ts`, because
 * a contract that crosses a module boundary belongs where both sides can see it
 * — Delivery codes against the type without importing anything of ours, and
 * resolves the implementation through `PORT_KEYS.payslipQuery`.
 *
 * Re-exported here so this module has one obvious place to import its own
 * published surface from.
 *
 * Amounts are MAJOR units (rupees), already rounded — the same values the
 * payslip screen shows, so a printed PDF can never disagree with the screen.
 *
 * CHANGING THESE SHAPES BREAKS DELIVERY. They are edited in dto.ts, announced
 * first.
 */
export type {
  PayslipLineView,
  PayslipView,
  PayslipQueryPort,
} from '@/modules/shared'
