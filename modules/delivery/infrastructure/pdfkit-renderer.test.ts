/**
 * Smoke tests for the renderer.
 *
 * The LAYOUT is asserted against `PayslipDocument` in the domain test, which
 * needs no PDF at all. What can only be checked here is that pdfkit actually
 * produces a file: that the brand fonts load, that a normal payslip stays on
 * one page, and that a structure with sixty rules paginates instead of writing
 * over the footer.
 */
import { describe, expect, it } from 'vitest'
import { buildPayslipDocument, type PayslipDocumentInput } from '../domain/payslip-document'
import { PdfKitPayslipRenderer } from './pdfkit-renderer'

function documentWith(lineCount: number) {
  const lines: Array<PayslipDocumentInput['payslip']['lines'][number]> = [
    { code: 'BASIC', name: 'Basic Salary', category: 'basic', sequence: 10, amount: 78000 },
  ]
  for (let i = 0; i < lineCount; i += 1) {
    lines.push({
      code: `ALW${i}`,
      name: `Allowance number ${i}`,
      category: 'allowance',
      sequence: 20 + i,
      amount: 1000,
    })
  }

  return buildPayslipDocument({
    payslip: {
      id: 'payslip-1',
      payrunId: 'payrun-1',
      payrunName: 'August 2026 — Monthly',
      employeeId: 'employee-1',
      employeeName: 'Rahul Verma',
      structureName: 'Regular Salary',
      periodStart: new Date('2026-08-01T00:00:00Z'),
      periodEnd: new Date('2026-08-31T00:00:00Z'),
      workedDays: 22,
      status: 'paid',
      basic: 78000,
      gross: 78000 + lineCount * 1000,
      deductions: 0,
      net: 78000 + lineCount * 1000,
      lines,
    },
    employee: null,
    company: { name: 'PeoplePay360', addressLines: ['Ahmedabad'], email: null },
    generatedAt: new Date('2026-09-05T00:00:00Z'),
  })
}

/** `/Type /Page` appears once per page; `/Pages` must not be miscounted. */
function pageCount(bytes: Uint8Array): number {
  const text = Buffer.from(bytes).toString('latin1')
  return (text.match(/\/Type\s*\/Page[^s]/g) ?? []).length
}

describe('PdfKitPayslipRenderer', () => {
  it('produces a real PDF on A4', async () => {
    const rendered = await new PdfKitPayslipRenderer().render(documentWith(2))

    expect(rendered.contentType).toBe('application/pdf')
    expect(Buffer.from(rendered.bytes).toString('latin1', 0, 5)).toBe('%PDF-')
    expect(Buffer.from(rendered.bytes).toString('latin1')).toContain('/MediaBox [0 0 595.28 841.89]')
  })

  it('embeds the brand face rather than falling back to Helvetica', async () => {
    const rendered = await new PdfKitPayslipRenderer().render(documentWith(2))
    expect(Buffer.from(rendered.bytes).toString('latin1')).toContain('LTWave')
  })

  it('keeps an ordinary payslip on a single page', async () => {
    const rendered = await new PdfKitPayslipRenderer().render(documentWith(3))
    expect(pageCount(rendered.bytes)).toBe(1)
  })

  it('paginates a structure with far more rules than fit', async () => {
    const rendered = await new PdfKitPayslipRenderer().render(documentWith(60))
    expect(pageCount(rendered.bytes)).toBeGreaterThan(1)
  })
})
