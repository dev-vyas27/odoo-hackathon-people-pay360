


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
    
    
    addressLines: address ? address.split(/\s*\\n\s*|\n/).filter(Boolean) : [],
    email: (env.COMPANY_EMAIL ?? '').trim() || null,
  }
}
