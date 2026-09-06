


import { z } from 'zod'
import { pageQuerySchema, type PageQuery } from '@/modules/shared'
import { errorResponse, parseQuery, respond } from '@/lib/http'
import { CreateSalaryStructureUseCase } from '../application/create-salary-structure.use-case'
import { UpdateSalaryStructureUseCase } from '../application/update-salary-structure.use-case'
import { ListSalaryStructuresUseCase } from '../application/list-salary-structures.use-case'
import { GetSalaryStructureDetailUseCase } from '../application/get-salary-structure-detail.use-case'
import { ArchiveSalaryStructureUseCase } from '../application/archive-salary-structure.use-case'
import {
  salaryRuleRepository,
  salaryStructureRepository,
  structureEmployeeCount,
} from '../composition'
import { salaryStructureFormSchema, toSalaryStructureData } from './schema'
import { parseJson, parseWith, requireSession } from './http'

const listQuerySchema = pageQuerySchema.extend({
  active: z.enum(['true', 'false']).optional(),
})

export async function listSalaryStructures(request: Request): Promise<Response> {
  const session = await requireSession()
  if (!session.ok) return errorResponse(session.error)

  const query = parseWith(listQuerySchema, parseQuery(request.url))
  if (!query.ok) return errorResponse(query.error)

  const { active, ...page } = query.value
  const pageQuery: PageQuery = {
    ...page,
    
    
    
    
    filters: active !== undefined ? { isActive: active === 'true' } : {},
  }

  const result = await new ListSalaryStructuresUseCase(
    salaryStructureRepository(),
    structureEmployeeCount(),
  ).execute({
    actor: session.value,
    query: pageQuery,
  })
  return respond(result)
}

export async function createSalaryStructure(request: Request): Promise<Response> {
  const session = await requireSession()
  if (!session.ok) return errorResponse(session.error)

  const body = await parseJson(request, salaryStructureFormSchema)
  if (!body.ok) return errorResponse(body.error)

  const result = await new CreateSalaryStructureUseCase(
    salaryStructureRepository(),
    salaryRuleRepository(),
  ).execute({ actor: session.value, data: toSalaryStructureData(body.value) })
  return respond(result, 201)
}

export async function getSalaryStructure(id: string): Promise<Response> {
  const session = await requireSession()
  if (!session.ok) return errorResponse(session.error)

  const result = await new GetSalaryStructureDetailUseCase(
    salaryStructureRepository(),
    salaryRuleRepository(),
    structureEmployeeCount(),
  ).execute({ actor: session.value, id })
  return respond(result)
}

export async function updateSalaryStructure(request: Request, id: string): Promise<Response> {
  const session = await requireSession()
  if (!session.ok) return errorResponse(session.error)

  const body = await parseJson(request, salaryStructureFormSchema)
  if (!body.ok) return errorResponse(body.error)

  const result = await new UpdateSalaryStructureUseCase(
    salaryStructureRepository(),
    salaryRuleRepository(),
  ).execute({ actor: session.value, id, data: toSalaryStructureData(body.value) })
  return respond(result)
}

export async function archiveSalaryStructure(id: string): Promise<Response> {
  const session = await requireSession()
  if (!session.ok) return errorResponse(session.error)

  const result = await new ArchiveSalaryStructureUseCase(salaryStructureRepository()).execute({
    actor: session.value,
    id,
  })
  return respond(result)
}
