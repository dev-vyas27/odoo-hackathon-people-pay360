/**
 * HTTP for a single payslip.
 */
import { Ok } from '@/modules/shared'
import { errorResponse, respond } from '@/lib/http'
import { GetPayslipDetailUseCase } from '../application/get-payslip-detail.use-case'
import { payslipRepository } from '../composition'
import { toView } from '../infrastructure/payslip-query.adapter'
import { requireSession } from './http'

export async function getPayslip(id: string): Promise<Response> {
  const session = await requireSession()
  if (!session.ok) return errorResponse(session.error)

  const result = await new GetPayslipDetailUseCase(payslipRepository()).execute({
    actor: session.value,
    payslipId: id,
  })
  if (!result.ok) return errorResponse(result.error)

  return respond(Ok(toView(result.value)))
}
