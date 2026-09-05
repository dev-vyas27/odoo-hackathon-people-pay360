import { getPayslip } from '@/modules/payroll-processing/server'
import { handle } from '@/lib/http'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  return handle(() => getPayslip(id))
}
