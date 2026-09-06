/**
 * Delivery's composition root.
 *
 * Note what this module depends on and does not import: payslips come from Dev
 * C through `PORT_KEYS.payslipQuery`, employees from Dev B through
 * `PORT_KEYS.employeeLookup`. Both degrade to null objects, so the PDF route
 * typechecks and answers (with a 404) before either module is wired up.
 *
 * Company identity is read from the environment rather than a table because
 * there is no `companies` table — the product is single-tenant today, and
 * inventing one to hold four strings would be a migration nobody asked for.
 */
import {
  portOr,
  resolve,
  PORT_KEYS,
  type EmployeeLookupPort,
  type MailerPort,
  type PayslipQueryPort,
} from '@/modules/shared'
import { createMailer } from './infrastructure/nodemailer-mailer'
import type { CompanyIdentity } from './domain/payslip-document'
import type { DocumentRendererPort } from './application/ports/document-renderer.port'
import type { DocumentStoragePort } from './application/ports/document-storage.port'
import { PdfKitPayslipRenderer } from './infrastructure/pdfkit-renderer'
import { S3DocumentStorage } from './infrastructure/s3-storage'

/** Honest emptiness: "no payslip found", never a fabricated one. */
const NO_PAYSLIPS: PayslipQueryPort = {
  async findById() {
    return null
  },
  async findByPayrun() {
    return []
  },
}

const NO_EMPLOYEES: EmployeeLookupPort = {
  async findById() {
    return null
  },
  async findManyByIds() {
    return []
  },
  async findEligible() {
    return []
  },
}

export function payslipQuery(): PayslipQueryPort {
  return portOr(PORT_KEYS.payslipQuery, NO_PAYSLIPS)
}

export function employeeLookup(): EmployeeLookupPort {
  return portOr(PORT_KEYS.employeeLookup, NO_EMPLOYEES)
}

export function payslipRenderer(): DocumentRendererPort {
  return resolve('delivery.payslip-renderer', () => new PdfKitPayslipRenderer())
}

/**
 * Resolved through the registry rather than constructed, so a test can bind a
 * fake — and so the console mailer keeps working when SMTP is unset. Falls back
 * to a directly-built one for the case where `registerDelivery` has not run
 * (a script, a unit test).
 */
export function mailer(): MailerPort {
  return portOr(PORT_KEYS.mailer, resolve('delivery.mailer', createMailer))
}

export function documentStorage(): DocumentStoragePort {
  return resolve('delivery.document-storage', () => new S3DocumentStorage())
}

export function companyIdentity(): CompanyIdentity {
  const env = process.env
  const address = (env.COMPANY_ADDRESS ?? '').trim()

  return {
    name: (env.COMPANY_NAME ?? '').trim() || 'PeoplePay360',
    // One variable, newline-separated, so a three-line address does not need
    // three env vars.
    addressLines: address ? address.split(/\s*\\n\s*|\n/).filter(Boolean) : [],
    email: (env.COMPANY_EMAIL ?? '').trim() || null,
  }
}
