import { createPayrunRoute, listPayruns } from '@/modules/payroll-processing/server'
import { handle } from '@/lib/http'

export async function GET(request: Request) {
  return handle(() => listPayruns(request))
}


export async function POST(request: Request) {
  return handle(() => createPayrunRoute(request))
}
