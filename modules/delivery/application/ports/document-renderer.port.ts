


import type { PayslipDocument } from '../../domain/payslip-document'

export interface RenderedDocument {
  bytes: Uint8Array
  contentType: string
}

export interface DocumentRendererPort {
  render(document: PayslipDocument): Promise<RenderedDocument>
}
