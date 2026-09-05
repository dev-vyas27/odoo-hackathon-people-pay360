/**
 * GET /api/payslips/[id]/pdf
 *
 * Streams the PDF, then archives it. The order matters: the employee's download
 * must not wait on S3, must not fail because of S3, and must work with no
 * bucket configured at all. `after()` runs the upload once the response has
 * been flushed, so a slow or broken bucket costs the user nothing.
 *
 * `?download=1` forces a save dialog; without it the browser previews the PDF
 * inline, which is what the "Print PDF" button on the payslip screen wants.
 */
import { after } from 'next/server'
import { errorResponse, respond } from '@/lib/http'
import { getActor, requireActor } from '@/lib/auth'
import { DomainError } from '@/modules/shared'
import { SendPayrunPayslipsUseCase } from '../application/send-payrun-payslips.use-case'
import { GeneratePayslipPdfUseCase } from '../application/generate-payslip-pdf.use-case'
import {
  companyIdentity,
  documentStorage,
  employeeLookup,
  mailer,
  payslipQuery,
  payslipRenderer,
} from '../composition'

export async function getPayslipPdf(id: string, request: Request): Promise<Response> {
  const actor = await getActor()
  if (!actor) {
    return errorResponse(DomainError.unauthorized('UNAUTHENTICATED', 'Sign in to continue.'))
  }

  const result = await new GeneratePayslipPdfUseCase(
    payslipQuery(),
    employeeLookup(),
    payslipRenderer(),
    companyIdentity(),
  ).execute({ actor, payslipId: id })

  if (!result.ok) return errorResponse(result.error)

  const { document, bytes, contentType } = result.value

  const storage = documentStorage()
  if (storage.configured) {
    after(async () => {
      const stored = await storage.put(document.storageKey, bytes, contentType)
      if (stored.ok) {
        console.info(`[delivery] archived ${stored.key} (${stored.bytes} bytes)`)
      } else {
        // Logged, never surfaced: the payslip already reached the browser.
        console.error(`[delivery] archive failed for ${stored.key}: ${stored.reason}`)
      }
    })
  }

  const inline = new URL(request.url).searchParams.get('download') !== '1'

  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(bytes.byteLength),
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${document.fileName}"`,
      // A payslip is one person's salary. It must never sit in a shared cache.
      'Cache-Control': 'private, no-store',
    },
  })
}

/**
 * POST /api/payruns/[id]/send — email every payslip in the run.
 *
 * Returns a per-employee report rather than a bare 200: "sent 23 of 25, two
 * have no email address" is something an HR user can act on, and a bulk action
 * that only says "done" hides exactly the cases that need chasing.
 */
export async function sendPayrunPayslips(payrunId: string): Promise<Response> {
  const actor = await requireActor()

  const result = await new SendPayrunPayslipsUseCase(
    payslipQuery(),
    employeeLookup(),
    payslipRenderer(),
    documentStorage(),
    mailer(),
    companyIdentity(),
  ).execute({ actor, payrunId })

  return respond(result)
}
