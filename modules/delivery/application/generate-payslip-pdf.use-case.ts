/**
 * Generate one payslip PDF.
 *
 * Three collaborators, all injected: the payslip read model (Dev C's port), the
 * employee lookup (Dev B's port) and a renderer. None of them is imported
 * directly, so this use case runs against null objects long before either team
 * has finished — which is the whole point of the port registry.
 *
 * Archiving to object storage is NOT done here. The PDF must reach the browser
 * whether or not a bucket is configured, so the caller streams the bytes first
 * and archives afterwards (see the controller's `after()` call).
 */
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

    /**
     * The same row-level rule the payslip screen enforces: an `employee` may
     * download their OWN payslip and nobody else's. Repeating it here is not
     * duplication — a PDF route that skipped it would be a way around the
     * screen's check, which is precisely the kind of hole an export endpoint
     * tends to open.
     */
    const owned = authorizeOwned(actor, 'payslip', 'read', payslip.employeeId)
    if (!owned.ok) return owned

    /**
     * Best-effort enrichment. Department, designation and bank account make the
     * document look like a real payslip, but a payslip with "—" in those fields
     * is still a valid payslip — so a missing employee record degrades the
     * layout rather than failing the download.
     */
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
