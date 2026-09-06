import { listEligibleEmployees } from '@/modules/payroll-processing/server'
import { handle } from '@/lib/http'



export async function GET(request: Request) {
  return handle(() => listEligibleEmployees(request))
}
