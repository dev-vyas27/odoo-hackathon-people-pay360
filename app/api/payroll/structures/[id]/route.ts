import {
  archiveSalaryStructure,
  getSalaryStructure,
  updateSalaryStructure,
} from '@/modules/payroll-config/server'
import { handle } from '@/lib/http'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  return handle(() => getSalaryStructure(id))
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
  return handle(() => updateSalaryStructure(request, id))
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params
  return handle(() => archiveSalaryStructure(id))
}
