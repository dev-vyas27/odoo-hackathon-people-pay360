/**
 * Email every payslip in a pay run.
 *
 * For each payslip: render the PDF, archive it to object storage, and send it
 * to the employee as an attachment. Three things that could each fail
 * separately, so the result reports per employee rather than collapsing to one
 * boolean — "sent 23 of 25, these two have no email address" is actionable;
 * "failed" is not.
 *
 * ── Why it does not stop at the first failure ───────────────────────────────
 * A bounced address, a missing email or a storage hiccup must not withhold the
 * other twenty-four payslips. Every payslip is attempted; the failures are
 * listed.
 *
 * ── Why it refuses a draft pay run ──────────────────────────────────────────
 * A computed-but-unvalidated payslip can still change. Emailing one puts a
 * figure in somebody's inbox that the next recompute may contradict, and an
 * email cannot be recalled. Validation is the point at which the numbers become
 * final, so that is the gate.
 *
 * ── Why the archive is not fatal ────────────────────────────────────────────
 * Storage is optional by design (see DocumentStoragePort). With no bucket
 * configured the payslip is still generated and still emailed — it simply is
 * not archived. A missing bucket must never be why an employee does not get
 * paid their payslip.
 */
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

/** Statuses whose figures are final. Anything earlier can still change. */
const SENDABLE = new Set(['validated', 'paid'])

export interface SendPayrunPayslipsInput {
  actor: Actor
  payrunId: string
}

export interface PayslipDelivery {
  payslipId: string
  employeeName: string
  /** Null when the employee has no address on file. */
  email: string | null
  sent: boolean
  /** True when the PDF also reached object storage. */
  archived: boolean
  /** Why it did not go out. Absent on success. */
  reason?: string
}

export interface SendPayrunPayslipsOutput {
  sent: number
  failed: number
  /** One entry per payslip, in the order they were processed. */
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
    // Stronger than `payslip:read`: this sends mail to every employee in the
    // run, which is not something a reader should be able to trigger.
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

  /**
   * One payslip, end to end. Never throws: a failure here is one row in the
   * report, not the end of the run.
   */
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

      /**
       * Archived BEFORE sending, and deliberately not awaited into the failure
       * path: the copy in the bucket is the system of record, but a bucket that
       * is off or unreachable must not stop the email.
       */
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

/**
 * Plain text only. An HTML payslip email is a phishing lookalike waiting to
 * happen, and the actual document is attached — the body only has to say what
 * arrived and for which period.
 */
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
