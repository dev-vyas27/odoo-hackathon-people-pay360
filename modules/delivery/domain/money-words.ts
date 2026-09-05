/**
 * "Ninety Thousand Three Hundred Sixty Rupees Only".
 *
 * A payslip is a financial document, and the amount in words is how a human
 * verifies the figures were not tampered with — it is on every Indian salary
 * slip for exactly that reason. Written against the INDIAN numbering system
 * (thousand · lakh · crore), not the western one, because `Intl` will happily
 * group digits the Indian way but has no spell-out for lakh or crore.
 *
 * Pure arithmetic on a number: no locale data, no dependency, testable with
 * literals.
 */

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

/** 0..99. The teens are irregular, which is why ONES runs to nineteen. */
function twoDigits(value: number): string {
  if (value < 20) return ONES[value]
  const tens = TENS[Math.floor(value / 10)]
  const ones = ONES[value % 10]
  return ones ? `${tens} ${ones}` : tens
}

/** 0..999. */
function threeDigits(value: number): string {
  const hundreds = Math.floor(value / 100)
  const rest = value % 100
  const parts: string[] = []
  if (hundreds) parts.push(`${ONES[hundreds]} Hundred`)
  if (rest) parts.push(twoDigits(rest))
  return parts.join(' ')
}

/**
 * The Indian grouping: crore, lakh, thousand, then the last three digits.
 *
 * 1,23,45,678 reads "One Crore Twenty Three Lakh Forty Five Thousand Six
 * Hundred Seventy Eight" — note the last group is THREE digits and every group
 * above it is two. That asymmetry is the whole reason this cannot be a simple
 * "chunk into threes" loop.
 */
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

/**
 * A rupee amount, spelled out, with paise as "and NN Paise".
 *
 * Rounds to two decimals first so 43240.005 and 43240.01 cannot spell
 * differently from the figure printed beside them.
 */
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
