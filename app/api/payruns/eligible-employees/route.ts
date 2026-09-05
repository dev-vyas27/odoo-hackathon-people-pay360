import { listEligibleEmployees } from '@/modules/payroll-processing/server'
import { handle } from '@/lib/http'

/**
 * Wizard step 2. A GET on purpose: asking who is eligible must not create a
 * payrun, and a GET cannot be mistaken for a write by anyone reading the code.
 */
export async function GET(request: Request) {
  return handle(() => listEligibleEmployees(request))
}
