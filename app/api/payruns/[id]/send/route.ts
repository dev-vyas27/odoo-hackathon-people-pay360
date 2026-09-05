/**
 * POST /api/payruns/[id]/send — email every payslip in the run.
 *
 * Delivery's, not payroll's: generating the PDF, archiving it and sending the
 * mail all belong to `modules/delivery`, which reaches payroll through
 * `PayslipQueryPort` rather than importing it.
 */
import { sendPayrunPayslips } from '@/modules/delivery'
import { handle } from '@/lib/http'

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await context.params
    return sendPayrunPayslips(id)
  })
}
