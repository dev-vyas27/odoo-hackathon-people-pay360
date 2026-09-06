import { archiveSalaryRule, getSalaryRule, updateSalaryRule } from '@/modules/payroll-config/server'
import { handle } from '@/lib/http'


type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  return handle(() => getSalaryRule(id))
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
  return handle(() => updateSalaryRule(request, id))
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params
  return handle(() => archiveSalaryRule(id))
}
