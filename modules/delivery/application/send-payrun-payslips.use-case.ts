


import {
  authorize,
  DomainError,
  Err,
  Ok,
  type Actor,
  type EmployeeLookupPort,
  type MailerPort,
  type PayslipView,
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
import type { DocumentStoragePort } from './ports/document-storage.port'


const SENDABLE = new Set(['validated', 'paid'])

export interface SendPayrunPayslipsInput {
  actor: Actor
  payrunId: string
}

export interface PayslipDelivery {
  payslipId: string
  employeeName: string
  
  email: string | null
  sent: boolean
  
  archived: boolean
  
  reason?: string
}

export interface SendPayrunPayslipsOutput {
  sent: number
  failed: number
  
  deliveries: PayslipDelivery[]
}

export class SendPayrunPayslipsUseCase
  implements UseCase<SendPayrunPayslipsInput, SendPayrunPayslipsOutput>
{
  constructor(
    private readonly payslips: PayslipQueryPort,
    private readonly employees: EmployeeLookupPort,
    private readonly renderer: DocumentRendererPort,
    private readonly storage: DocumentStoragePort,
    private readonly mailer: MailerPort,
    private readonly company: CompanyIdentity,
  ) {}

  async execute({
    actor,
    payrunId,
  }: SendPayrunPayslipsInput): Promise<Result<SendPayrunPayslipsOutput>> {
    
    
    const allowed = authorize(actor, 'payslip', 'update')
    if (!allowed.ok) return allowed

    const payslips = await this.payslips.findByPayrun(payrunId)
    if (payslips.length === 0) {
      return Err(
        DomainError.rule(
          'PAYRUN_HAS_NO_PAYSLIPS',
          'Compute this pay run before sending payslips.',
        ),
      )
    }

    const unfinalised = payslips.filter((p) => !SENDABLE.has(p.status))
    if (unfinalised.length > 0) {
      return Err(
        DomainError.rule(
          'PAYRUN_NOT_VALIDATED',
          'Validate this pay run before sending payslips — the figures can still change.',
          { pending: unfinalised.length },
        ),
      )
    }

    const deliveries: PayslipDelivery[] = []
    for (const payslip of payslips) {
      deliveries.push(await this.deliver(payslip))
    }

    return Ok({
      sent: deliveries.filter((d) => d.sent).length,
      failed: deliveries.filter((d) => !d.sent).length,
      deliveries,
    })
  }

  


  private async deliver(payslip: PayslipView): Promise<PayslipDelivery> {
    const base: PayslipDelivery = {
      payslipId: payslip.id,
      employeeName: payslip.employeeName,
      email: null,
      sent: false,
      archived: false,
    }

    try {
      const employee = await this.employees.findById(payslip.employeeId)
      const email = (employee?.email ?? payslip.employeeEmail ?? '').trim()
      if (!email) {
        return { ...base, reason: 'No email address on file for this employee.' }
      }

      const document = buildPayslipDocument({
        payslip,
        employee,
        company: this.company,
        generatedAt: new Date(),
      })
      const { bytes, contentType } = await this.renderer.render(document)

      


      let archived = false
      if (this.storage.configured) {
        const stored = await this.storage.put(document.storageKey, bytes, contentType)
        archived = stored.ok
        if (!stored.ok && !stored.skipped) {
          console.error(`[delivery] archive failed for ${stored.key}: ${stored.reason}`)
        }
      }

      const result = await this.mailer.send({
        to: email,
        subject: `Your payslip — ${payslip.payrunName}`,
        text: bodyFor(document, payslip),
        attachments: [{ filename: document.fileName, content: bytes, contentType }],
      })

      return {
        ...base,
        email,
        archived,
        sent: result.sent,
        ...(result.sent ? {} : { reason: result.error ?? 'The mail server rejected it.' }),
      }
    } catch (reason) {
      return {
        ...base,
        reason: reason instanceof Error ? reason.message : 'Could not prepare this payslip.',
      }
    }
  }
}



function bodyFor(document: PayslipDocument, payslip: PayslipView): string {
  return [
    `Hello ${payslip.employeeName},`,
    '',
    `Your payslip for ${payslip.payrunName} is attached as ${document.fileName}.`,
    '',
    `  Period    ${document.subtitle}`,
    `  Net pay   ${payslip.net.toFixed(2)}`,
    `            (${document.netInWords})`,
    '',
    'If anything looks wrong, reply to this email and speak to HR before the next pay run.',
    '',
    document.company.name,
  ].join('\n')
}
