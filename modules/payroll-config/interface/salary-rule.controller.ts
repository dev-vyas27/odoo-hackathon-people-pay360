/**
 * HTTP for salary rules.
 *
 * Each function is: authenticate, parse with the shared zod schema, run one use
 * case, respond. Business rules live in the use cases — if logic starts
 * appearing here, it is in the wrong file.
 */
import { z } from 'zod'
import { pageQuerySchema, type PageQuery } from '@/modules/shared'
import { errorResponse, parseQuery, respond } from '@/lib/http'
import { SALARY_CATEGORIES } from '../domain/salary-category'
import { CreateSalaryRuleUseCase } from '../application/create-salary-rule.use-case'
import { UpdateSalaryRuleUseCase } from '../application/update-salary-rule.use-case'
import { ListSalaryRulesUseCase } from '../application/list-salary-rules.use-case'
import { GetSalaryRuleUseCase } from '../application/get-salary-rule.use-case'
import { ArchiveSalaryRuleUseCase } from '../application/archive-salary-rule.use-case'
import { salaryRuleRepository, salaryStructureRepository } from '../composition'
import { salaryRuleFormSchema, toSalaryRuleData } from './schema'
import { parseJson, parseWith, requireSession } from './http'

const listQuerySchema = pageQuerySchema.extend({
  category: z.enum(SALARY_CATEGORIES).optional(),
  active: z.enum(['true', 'false']).optional(),
})

export async function listSalaryRules(request: Request): Promise<Response> {
  const session = await requireSession()
  if (!session.ok) return errorResponse(session.error)

  const query = parseWith(listQuerySchema, parseQuery(request.url))
  if (!query.ok) return errorResponse(query.error)

  const { category, active, ...page } = query.value
  const pageQuery: PageQuery = {
    ...page,
    filters: {
      ...(category ? { category } : {}),
      // Same fix as salary-structure.controller.ts: the column is `is_active`,
      // so the filter key must be `isActive` for `toColumnName` to find it.
      ...(active !== undefined ? { isActive: active === 'true' } : {}),
    },
  }

  const result = await new ListSalaryRulesUseCase(salaryRuleRepository()).execute({
    actor: session.value,
    query: pageQuery,
  })
  return respond(result)
}

export async function createSalaryRule(request: Request): Promise<Response> {
  const session = await requireSession()
  if (!session.ok) return errorResponse(session.error)

  const body = await parseJson(request, salaryRuleFormSchema)
  if (!body.ok) return errorResponse(body.error)

  const result = await new CreateSalaryRuleUseCase(salaryRuleRepository()).execute({
    actor: session.value,
    data: toSalaryRuleData(body.value),
  })
  return respond(result, 201)
}

export async function getSalaryRule(id: string): Promise<Response> {
  const session = await requireSession()
  if (!session.ok) return errorResponse(session.error)

  const result = await new GetSalaryRuleUseCase(salaryRuleRepository()).execute({
    actor: session.value,
    id,
  })
  return respond(result)
}

export async function updateSalaryRule(request: Request, id: string): Promise<Response> {
  const session = await requireSession()
  if (!session.ok) return errorResponse(session.error)

  const body = await parseJson(request, salaryRuleFormSchema)
  if (!body.ok) return errorResponse(body.error)

  const result = await new UpdateSalaryRuleUseCase(salaryRuleRepository()).execute({
    actor: session.value,
    id,
    data: toSalaryRuleData(body.value),
  })
  return respond(result)
}

export async function archiveSalaryRule(id: string): Promise<Response> {
  const session = await requireSession()
  if (!session.ok) return errorResponse(session.error)

  const result = await new ArchiveSalaryRuleUseCase(
    salaryRuleRepository(),
    salaryStructureRepository(),
  ).execute({ actor: session.value, id })
  return respond(result)
}
