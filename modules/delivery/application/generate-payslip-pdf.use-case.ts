


import {
  authorize,
  authorizeOwned,
  DomainError,
  Err,
  Ok,
  type Actor,
  type EmployeeLookupPort,
  type Result,
  type UseCase,
} from '@/modules/shared'
import {
  buildPayslipDocument,
  type CompanyIdentity,
  type PayslipDocument,
} from '../domain/payslip-document'
import type { PayslipQueryPort } from './ports/payslip-query.port'
import type { DocumentRendererPort } from './ports/document-renderer.port'

export interface GeneratePayslipPdfInput {
  actor: Actor
  payslipId: string
}

export interface GeneratePayslipPdfOutput {
  document: PayslipDocument
  bytes: Uint8Array
  contentType: string
}

export class GeneratePayslipPdfUseCase
  implements UseCase<GeneratePayslipPdfInput, GeneratePayslipPdfOutput>
{
  constructor(
    private readonly payslips: PayslipQueryPort,
    private readonly employees: EmployeeLookupPort,
    private readonly renderer: DocumentRendererPort,
    private readonly company: CompanyIdentity,
  ) {}

  async execute({
    actor,
    payslipId,
  }: GeneratePayslipPdfInput): Promise<Result<GeneratePayslipPdfOutput>> {
    const allowed = authorize(actor, 'payslip', 'read')
    if (!allowed.ok) return allowed

    const payslip = await this.payslips.findById(payslipId)
    if (!payslip) {
      return Err(DomainError.notFound('PAYSLIP_NOT_FOUND', 'That payslip no longer exists.'))
    }

    


    const owned = authorizeOwned(actor, 'payslip', 'read', payslip.employeeId)
    if (!owned.ok) return owned

    


    const employee = await this.employees.findById(payslip.employeeId).catch(() => null)

    const document = buildPayslipDocument({
      payslip,
      employee,
      company: this.company,
      generatedAt: new Date(),
    })

    const rendered = await this.renderer.render(document)

    return Ok({ document, bytes: rendered.bytes, contentType: rendered.contentType })
  }
}
