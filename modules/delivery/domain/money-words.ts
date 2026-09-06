



const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
] as const

const TENS = [
  '',
  '',
  'Twenty',
  'Thirty',
  'Forty',
  'Fifty',
  'Sixty',
  'Seventy',
  'Eighty',
  'Ninety',
] as const


function twoDigits(value: number): string {
  if (value < 20) return ONES[value]
  const tens = TENS[Math.floor(value / 10)]
  const ones = ONES[value % 10]
  return ones ? `${tens} ${ones}` : tens
}


function threeDigits(value: number): string {
  const hundreds = Math.floor(value / 100)
  const rest = value % 100
  const parts: string[] = []
  if (hundreds) parts.push(`${ONES[hundreds]} Hundred`)
  if (rest) parts.push(twoDigits(rest))
  return parts.join(' ')
}



function integerInWords(value: number): string {
  if (value === 0) return 'Zero'

  const crore = Math.floor(value / 10_000_000)
  const lakh = Math.floor((value % 10_000_000) / 100_000)
  const thousand = Math.floor((value % 100_000) / 1_000)
  const rest = value % 1_000

  const parts: string[] = []
  if (crore) parts.push(`${integerInWords(crore)} Crore`)
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`)
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`)
  if (rest) parts.push(threeDigits(rest))

  return parts.join(' ')
}



export function amountInWords(amount: number): string {
  if (!Number.isFinite(amount)) return ''

  const negative = amount < 0
  const total = Math.round(Math.abs(amount) * 100)
  const rupees = Math.floor(total / 100)
  const paise = total % 100

  const words = [integerInWords(rupees), 'Rupees']
  if (paise) words.push('and', twoDigits(paise), 'Paise')
  words.push('Only')

  return `${negative ? 'Minus ' : ''}${words.join(' ')}`
}
