

import { sendPayrunPayslips } from '@/modules/delivery'
import { handle } from '@/lib/http'

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await context.params
    return sendPayrunPayslips(id)
  })
}
