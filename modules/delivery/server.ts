/**
 * Server-side surface of "delivery".
 *
 * Use cases, the HTTP controller and the composition root — everything that
 * touches pdfkit, the AWS SDK or the incoming request. Imported by route
 * handlers and server components ONLY; a client component reaching for this
 * fails the build, which is exactly the guardrail we want.
 */

// --- Use cases --------------------------------------------------------------
export { GeneratePayslipPdfUseCase } from './application/generate-payslip-pdf.use-case'

// --- Ports ------------------------------------------------------------------
export type {
  DocumentRendererPort,
  RenderedDocument,
} from './application/ports/document-renderer.port'
export type {
  DocumentStoragePort,
  StoredDocument,
} from './application/ports/document-storage.port'

// --- HTTP (the app/api route file delegates to this) ------------------------
export { getPayslipPdf } from './interface/payslip-pdf.controller'

// --- Implementation selection ----------------------------------------------
export {
  companyIdentity,
  documentStorage,
  employeeLookup,
  payslipQuery,
  payslipRenderer,
} from './composition'
