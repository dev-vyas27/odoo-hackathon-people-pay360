


import fs from 'node:fs'
import path from 'node:path'
import PDFDocument from 'pdfkit'
import type {
  DocumentField,
  DocumentLine,
  PayslipDocument,
} from '../domain/payslip-document'
import type {
  DocumentRendererPort,
  RenderedDocument,
} from '../application/ports/document-renderer.port'



const COLOR = {
  accent: '#4F46E5',
  accentSoft: '#EEF0FE',
  accentLine: '#C7CBF7',
  ink: '#0F172A',
  body: '#334155',
  muted: '#64748B',
  faint: '#94A3B8',
  border: '#E2E8F0',
  rowAlt: '#F8FAFC',
  danger: '#DC2626',
  positive: '#047857',
  white: '#FFFFFF',
} as const

const PAGE = { width: 595.28, height: 841.89 } as const
const M = 44
const CONTENT = PAGE.width - M * 2
const FOOTER_TOP = PAGE.height - 78

const FONT = { regular: 'Body', medium: 'Heading' } as const


const BOTTOM_LIMIT = FOOTER_TOP - 16

const RUPEES = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function money(amount: number): string {
  return `Rs. ${RUPEES.format(Math.abs(amount))}`
}

function signedMoney(line: DocumentLine): string {
  return line.negative ? `- ${money(line.amount)}` : money(line.amount)
}



let brandFonts: { regular: Buffer; medium: Buffer } | null | undefined

function loadBrandFonts(): { regular: Buffer; medium: Buffer } | null {
  if (brandFonts !== undefined) return brandFonts

  try {
    const dir = path.join(process.cwd(), 'public', 'fonts')
    brandFonts = {
      regular: fs.readFileSync(path.join(dir, 'LTWave-Regular.otf')),
      medium: fs.readFileSync(path.join(dir, 'LTWave-Medium.otf')),
    }
  } catch {
    console.warn('[delivery] brand fonts unavailable, falling back to Helvetica')
    brandFonts = null
  }

  return brandFonts
}

type Doc = PDFKit.PDFDocument

export class PdfKitPayslipRenderer implements DocumentRendererPort {
  async render(document: PayslipDocument): Promise<RenderedDocument> {
    const doc = new PDFDocument({
      size: 'A4',
      
      
      margin: 0,
      bufferPages: true,
      info: {
        Title: `${document.title} — ${document.employeeName} — ${document.subtitle}`,
        Author: document.company.name,
        Subject: `Payslip for ${document.subtitle}`,
        Creator: 'PeoplePay360',
      },
    })

    const fonts = loadBrandFonts()
    if (fonts) {
      doc.registerFont(FONT.regular, fonts.regular)
      doc.registerFont(FONT.medium, fonts.medium)
    } else {
      doc.registerFont(FONT.regular, 'Helvetica')
      doc.registerFont(FONT.medium, 'Helvetica-Bold')
    }

    const chunks: Buffer[] = []
    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on('data', (chunk: Buffer) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)
    })

    let y = drawHeader(doc, document)
    y = drawPanels(doc, document, y)
    y = drawLineTable(doc, document, y)
    y = drawTotals(doc, document, y)
    drawWords(doc, document, y)
    drawFooters(doc, document)

    doc.end()
    const bytes = await done

    return { bytes, contentType: 'application/pdf' }
  }
}



function drawHeader(doc: Doc, document: PayslipDocument): number {
  const bandHeight = 132

  doc.rect(0, 0, PAGE.width, bandHeight).fill(COLOR.accentSoft)
  doc.rect(0, 0, PAGE.width, 5).fill(COLOR.accent)

  
  doc
    .font(FONT.medium)
    .fontSize(17)
    .fillColor(COLOR.ink)
    .text(document.company.name, M, 34, { width: CONTENT * 0.55 })

  let addressY = 58
  doc.font(FONT.regular).fontSize(8.5).fillColor(COLOR.muted)
  for (const line of document.company.addressLines) {
    doc.text(line, M, addressY, { width: CONTENT * 0.55 })
    addressY += 11
  }
  if (document.company.email) {
    doc.text(document.company.email, M, addressY, { width: CONTENT * 0.55 })
  }

  
  const rightWidth = CONTENT * 0.4
  const rightX = PAGE.width - M - rightWidth

  doc
    .font(FONT.medium)
    .fontSize(26)
    .fillColor(COLOR.accent)
    .text(document.title.toUpperCase(), rightX, 30, {
      width: rightWidth,
      align: 'right',
      characterSpacing: 1.5,
    })

  doc
    .font(FONT.regular)
    .fontSize(11)
    .fillColor(COLOR.body)
    .text(document.subtitle, rightX, 64, { width: rightWidth, align: 'right' })

  drawStatusPill(doc, document.statusLabel, rightX + rightWidth, 84)

  return bandHeight + 22
}


function drawStatusPill(doc: Doc, label: string, rightEdge: number, y: number): void {
  const text = label.toUpperCase()
  doc.font(FONT.medium).fontSize(7.5)
  const width = doc.widthOfString(text, { characterSpacing: 0.8 }) + 20
  const x = rightEdge - width

  doc.roundedRect(x, y, width, 17, 8.5).fillAndStroke(COLOR.white, COLOR.accentLine)
  doc
    .fillColor(COLOR.accent)
    .text(text, x, y + 5.2, { width, align: 'center', characterSpacing: 0.8 })
}



function drawPanels(doc: Doc, document: PayslipDocument, top: number): number {
  const gap = 14
  const width = (CONTENT - gap) / 2
  const rows = Math.max(document.employeeFields.length, document.payrunFields.length)
  const height = 30 + rows * 19 + 8

  drawPanel(doc, 'Employee', document.employeeFields, M, top, width, height)
  drawPanel(doc, 'Pay details', document.payrunFields, M + width + gap, top, width, height)

  return top + height + 22
}

function drawPanel(
  doc: Doc,
  title: string,
  fields: DocumentField[],
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  doc.roundedRect(x, y, width, height, 6).fillAndStroke(COLOR.rowAlt, COLOR.border)

  doc
    .font(FONT.medium)
    .fontSize(7.5)
    .fillColor(COLOR.faint)
    .text(title.toUpperCase(), x + 14, y + 12, { characterSpacing: 1 })

  const labelWidth = width * 0.42
  const valueX = x + 14 + labelWidth
  const valueWidth = width - 28 - labelWidth

  let rowY = y + 32
  for (const field of fields) {
    doc
      .font(FONT.regular)
      .fontSize(8.5)
      .fillColor(COLOR.muted)
      .text(field.label, x + 14, rowY, { width: labelWidth, lineBreak: false })

    doc
      .font(FONT.medium)
      .fontSize(8.5)
      .fillColor(COLOR.ink)
      .text(field.value, valueX, rowY, {
        width: valueWidth,
        align: 'right',
        lineBreak: false,
        ellipsis: true,
      })

    rowY += 19
  }
}



const COL = {
  code: M + 14,
  codeWidth: 74,
  name: M + 96,
  amountWidth: 120,
} as const

const AMOUNT_X = M + CONTENT - 14 - COL.amountWidth

function drawTableHead(doc: Doc, y: number): number {
  doc.rect(M, y, CONTENT, 22).fillAndStroke(COLOR.accentSoft, COLOR.accentLine)

  doc.font(FONT.medium).fontSize(7).fillColor(COLOR.accent)
  doc.text('CODE', COL.code, y + 7.5, { characterSpacing: 0.9, lineBreak: false })
  doc.text('DESCRIPTION', COL.name, y + 7.5, { characterSpacing: 0.9, lineBreak: false })
  doc.text('AMOUNT', AMOUNT_X, y + 7.5, {
    width: COL.amountWidth,
    align: 'right',
    characterSpacing: 0.9,
    lineBreak: false,
  })

  return y + 22
}



function drawGroupRow(doc: Doc, label: string, y: number): number {
  doc.rect(M, y, CONTENT, 19).fill(COLOR.white)
  doc
    .font(FONT.medium)
    .fontSize(8)
    .fillColor(COLOR.faint)
    .text(label.toUpperCase(), COL.code, y + 6, { characterSpacing: 1.1, lineBreak: false })
  doc
    .moveTo(M, y + 19)
    .lineTo(M + CONTENT, y + 19)
    .lineWidth(0.5)
    .stroke(COLOR.border)
  return y + 19
}

function drawLineRow(doc: Doc, line: DocumentLine, y: number, striped: boolean): number {
  const height = 21

  if (striped) doc.rect(M, y, CONTENT, height).fill(COLOR.rowAlt)

  doc
    .font(FONT.regular)
    .fontSize(8)
    .fillColor(COLOR.faint)
    .text(line.code, COL.code, y + 6.5, { width: COL.codeWidth, lineBreak: false })

  doc
    .font(FONT.regular)
    .fontSize(9)
    .fillColor(COLOR.body)
    .text(line.name, COL.name, y + 6, {
      width: AMOUNT_X - COL.name - 12,
      lineBreak: false,
      ellipsis: true,
    })

  doc
    .font(FONT.medium)
    .fontSize(9)
    .fillColor(line.negative ? COLOR.danger : COLOR.ink)
    .text(signedMoney(line), AMOUNT_X, y + 6, {
      width: COL.amountWidth,
      align: 'right',
      lineBreak: false,
    })

  doc
    .moveTo(M, y + height)
    .lineTo(M + CONTENT, y + height)
    .lineWidth(0.5)
    .stroke(COLOR.border)

  return y + height
}

function drawLineTable(doc: Doc, document: PayslipDocument, top: number): number {
  let y = drawTableHead(doc, top)
  let striped = false

  const groups: Array<{ label: string; lines: DocumentLine[] }> = [
    { label: 'Earnings', lines: document.earnings },
    { label: 'Deductions', lines: document.deductions },
  ]

  for (const group of groups) {
    if (!group.lines.length) continue

    y = ensureSpace(doc, y, 19 + 21)
    if (y === top) y = drawTableHead(doc, y)
    y = drawGroupRow(doc, group.label, y)

    for (const line of group.lines) {
      const before = y
      y = ensureSpace(doc, y, 21)
      
      if (y !== before) y = drawTableHead(doc, y)
      y = drawLineRow(doc, line, y, striped)
      striped = !striped
    }
  }

  
  doc
    .rect(M, top, CONTENT, y - top)
    .lineWidth(0.75)
    .stroke(COLOR.border)

  return y + 20
}


function ensureSpace(doc: Doc, y: number, needed: number): number {
  if (y + needed <= BOTTOM_LIMIT) return y
  doc.addPage()
  doc.rect(0, 0, PAGE.width, 4).fill(COLOR.accent)
  return M + 12
}



function drawTotals(doc: Doc, document: PayslipDocument, top: number): number {
  const rows: Array<{ label: string; value: number; negative?: boolean }> = [
    { label: 'Basic', value: document.totals.basic },
    { label: 'Allowances', value: document.totals.allowances },
    { label: 'Gross earnings', value: document.totals.gross },
    { label: 'Total deductions', value: document.totals.deductions, negative: true },
  ]

  const boxWidth = 250
  const boxX = M + CONTENT - boxWidth
  const boxHeight = rows.length * 19 + 16

  let y = ensureSpace(doc, top, boxHeight + 56)

  doc.roundedRect(boxX, y, boxWidth, boxHeight, 6).fillAndStroke(COLOR.rowAlt, COLOR.border)

  let rowY = y + 12
  for (const row of rows) {
    doc
      .font(FONT.regular)
      .fontSize(9)
      .fillColor(COLOR.muted)
      .text(row.label, boxX + 14, rowY, { lineBreak: false })

    doc
      .font(FONT.medium)
      .fontSize(9)
      .fillColor(row.negative ? COLOR.danger : COLOR.ink)
      .text(`${row.negative ? '- ' : ''}${money(row.value)}`, boxX + 14, rowY, {
        width: boxWidth - 28,
        align: 'right',
        lineBreak: false,
      })

    rowY += 19
  }

  y += boxHeight + 10

  
  const netHeight = 46
  doc.roundedRect(boxX, y, boxWidth, netHeight, 6).fillAndStroke(COLOR.accentSoft, COLOR.accent)

  doc
    .font(FONT.medium)
    .fontSize(8)
    .fillColor(COLOR.accent)
    .text('NET PAY', boxX + 14, y + 10, { characterSpacing: 1.2, lineBreak: false })

  doc
    .font(FONT.medium)
    .fontSize(19)
    .fillColor(COLOR.ink)
    .text(money(document.totals.net), boxX + 14, y + 20, {
      width: boxWidth - 28,
      align: 'right',
      lineBreak: false,
    })

  return y + netHeight + 18
}



function drawWords(doc: Doc, document: PayslipDocument, top: number): void {
  const y = ensureSpace(doc, top, 46)

  doc
    .font(FONT.regular)
    .fontSize(7.5)
    .fillColor(COLOR.faint)
    .text('NET PAY IN WORDS', M, y, { characterSpacing: 1, lineBreak: false })

  doc
    .font(FONT.medium)
    .fontSize(10)
    .fillColor(COLOR.positive)
    .text(document.netInWords, M, y + 13, { width: CONTENT })
}



function drawFooters(doc: Doc, document: PayslipDocument): void {
  const range = doc.bufferedPageRange()

  for (let index = 0; index < range.count; index += 1) {
    doc.switchToPage(range.start + index)

    doc
      .moveTo(M, FOOTER_TOP)
      .lineTo(M + CONTENT, FOOTER_TOP)
      .lineWidth(0.5)
      .stroke(COLOR.border)

    doc
      .font(FONT.regular)
      .fontSize(7.5)
      .fillColor(COLOR.faint)
      .text(document.footerNote, M, FOOTER_TOP + 10, { width: CONTENT * 0.68 })

    doc.text(document.generatedLabel, M + CONTENT * 0.7, FOOTER_TOP + 10, {
      width: CONTENT * 0.3,
      align: 'right',
      lineBreak: false,
    })

    doc.text(`Page ${index + 1} of ${range.count}`, M + CONTENT * 0.7, FOOTER_TOP + 21, {
      width: CONTENT * 0.3,
      align: 'right',
      lineBreak: false,
    })
  }
}
