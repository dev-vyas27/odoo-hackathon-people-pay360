import { getPayslipPdf } from '@/modules/delivery/server'
import { handle } from '@/lib/http'

type Params = { params: Promise<{ id: string }> }



export const runtime = 'nodejs'

export async function GET(request: Request, { params }: Params) {
  const { id } = await params
  return handle(() => getPayslipPdf(id, request))
}
