/**
 * DocumentRendererPort — "turn this layout description into bytes".
 *
 * The reason this interface exists at all: the use case below decides WHAT a
 * payslip says, and something in infrastructure/ decides how it LOOKS. Keeping
 * the two apart means the layout can be asserted in a unit test that never
 * generates a PDF, and replacing pdfkit later touches exactly one file.
 */
import type { PayslipDocument } from '../../domain/payslip-document'

export interface RenderedDocument {
  bytes: Uint8Array
  contentType: string
}

export interface DocumentRendererPort {
  render(document: PayslipDocument): Promise<RenderedDocument>
}
