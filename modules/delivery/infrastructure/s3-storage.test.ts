import { afterEach, describe, expect, it } from 'vitest'
import { isPayslipKey } from './s3-storage'

/**
 * The key guard is the one piece of this adapter that can be tested without an
 * AWS account, and it is also the piece that matters most: it is what stops a
 * caller coaxing a signed URL for an object that is none of their business.
 * Modelled on `isValidDocumentKey` in the transit-ops reference.
 */
describe('isPayslipKey', () => {
  const run = '72756e00-0000-4000-8000-000000000001'
  const slip = '70736c00-0000-4000-8000-000000000009'

  it('accepts the key the domain actually generates', () => {
    expect(isPayslipKey(`payslips/${run}/${slip}.pdf`)).toBe(true)
  })

  it('rejects a traversal attempt', () => {
    expect(isPayslipKey(`payslips/${run}/../../../etc/passwd`)).toBe(false)
    expect(isPayslipKey(`payslips/../${run}/${slip}.pdf`)).toBe(false)
  })

  it('rejects another prefix', () => {
    expect(isPayslipKey(`contracts/${run}/${slip}.pdf`)).toBe(false)
    expect(isPayslipKey(`${run}/${slip}.pdf`)).toBe(false)
  })

  it('rejects a wildcard or an empty segment', () => {
    expect(isPayslipKey('payslips/')).toBe(false)
    expect(isPayslipKey('payslips/*/*.pdf')).toBe(false)
    expect(isPayslipKey(`payslips//${slip}.pdf`)).toBe(false)
  })

  it('rejects a non-pdf extension', () => {
    expect(isPayslipKey(`payslips/${run}/${slip}.exe`)).toBe(false)
    expect(isPayslipKey(`payslips/${run}/${slip}`)).toBe(false)
  })

  it('rejects non-strings', () => {
    expect(isPayslipKey(null)).toBe(false)
    expect(isPayslipKey(undefined)).toBe(false)
    expect(isPayslipKey(42)).toBe(false)
  })
})

/**
 * Half-configured must be loud. The whole point of keeping archiving opt-in is
 * that "off" is a legitimate state — which only works if "on but broken" cannot
 * be mistaken for it.
 */
describe('S3 configuration', () => {
  const saved = { ...process.env }

  afterEach(() => {
    for (const key of ['AWS_S3_BUCKET', 'AWS_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY']) {
      if (saved[key] === undefined) delete process.env[key]
      else process.env[key] = saved[key]
    }
  })

  const construct = async () => {
    // Imported fresh so the constructor re-reads the environment.
    const { S3DocumentStorage } = await import('./s3-storage')
    return new S3DocumentStorage()
  }

  it('is simply off when the bucket is empty', async () => {
    process.env.AWS_S3_BUCKET = ''
    const storage = await construct()
    expect(storage.configured).toBe(false)
  })

  it('skips rather than fails when off', async () => {
    process.env.AWS_S3_BUCKET = ''
    const storage = await construct()
    const result = await storage.put('payslips/a/b.pdf', new Uint8Array([1]), 'application/pdf')
    expect(result.skipped).toBe(true)
    expect(result.ok).toBe(false)
  })

  it('returns no view url when off', async () => {
    process.env.AWS_S3_BUCKET = ''
    const storage = await construct()
    await expect(storage.viewUrl('payslips/a/b.pdf')).resolves.toBeNull()
  })

  it('throws when a bucket is set without a region', async () => {
    process.env.AWS_S3_BUCKET = 'peoplepay-payslips'
    process.env.AWS_REGION = ''
    await expect(construct()).rejects.toThrow(/AWS_REGION/)
  })

  it('throws when only one half of the credential pair is set', async () => {
    process.env.AWS_S3_BUCKET = 'peoplepay-payslips'
    process.env.AWS_REGION = 'ap-south-1'
    process.env.AWS_ACCESS_KEY_ID = 'AKIAEXAMPLE'
    process.env.AWS_SECRET_ACCESS_KEY = ''
    await expect(construct()).rejects.toThrow(/BOTH/)
  })

  it('accepts a bucket and region with no keys — the instance-role case', async () => {
    process.env.AWS_S3_BUCKET = 'peoplepay-payslips'
    process.env.AWS_REGION = 'ap-south-1'
    process.env.AWS_ACCESS_KEY_ID = ''
    process.env.AWS_SECRET_ACCESS_KEY = ''
    const storage = await construct()
    expect(storage.configured).toBe(true)
  })
})
