import { createSalaryStructureRoute, listSalaryStructures } from '@/modules/payroll-config/server'
import { handle } from '@/lib/http'

export async function GET(request: Request) {
  return handle(() => listSalaryStructures(request))
}

export async function POST(request: Request) {
  return handle(() => createSalaryStructureRoute(request))
}
