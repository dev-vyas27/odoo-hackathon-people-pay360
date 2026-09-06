import { createSalaryRuleRoute, listSalaryRules } from '@/modules/payroll-config/server'
import { handle } from '@/lib/http'

export async function GET(request: Request) {
  return handle(() => listSalaryRules(request))
}

export async function POST(request: Request) {
  return handle(() => createSalaryRuleRoute(request))
}
