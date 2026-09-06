


import { Ok, Period, pageQuerySchema, type PageQuery } from '@/modules/shared'
import { z } from 'zod'
import { errorResponse, parseQuery, respond } from '@/lib/http'
import { PAYRUN_STATUSES } from '../domain/payrun-state'
import { CreatePayrunUseCase } from '../application/create-payrun.use-case'
import { ComputePayrunUseCase } from '../application/compute-payrun.use-case'
import { ValidatePayrunUseCase } from '../application/validate-payrun.use-case'
import { MarkPayrunPaidUseCase } from '../application/mark-payrun-paid.use-case'
import { ListPayrunsUseCase } from '../application/list-payruns.use-case'
import { GetPayrunDetailUseCase } from '../application/get-payrun-detail.use-case'
import { ListEligibleEmployeesUseCase } from '../application/list-eligible-employees.use-case'
import {
  attendanceStats,
  contractQuery,
  employeeLookup,
  eventBus,
  payrunRepository,
  payslipRepository,
  scheduleQuery,
  structureQuery,
} from '../composition'
import { toView } from '../infrastructure/payslip-query.adapter'
import { createPayrunSchema, eligibleEmployeesQuerySchema } from './schema'
import { parseJson, parseWith, requireSession } from './http'
import { toPayrunView } from './views'

const listQuerySchema = pageQuerySchema.extend({
  status: z.enum(PAYRUN_STATUSES).optional(),
})

export async function listPayruns(request: Request): Promise<Response> {
  const session = await requireSession()
  if (!session.ok) return errorResponse(session.error)

  const query = parseWith(listQuerySchema, parseQuery(request.url))
  if (!query.ok) return errorResponse(query.error)

  const { status, ...page } = query.value
  const pageQuery: PageQuery = { ...page, filters: status ? { status } : {} }

  const result = await new ListPayrunsUseCase(payrunRepository()).execute({
    actor: session.value,
    query: pageQuery,
  })
  if (!result.ok) return errorResponse(result.error)

  return respond(
    Ok({ ...result.value, items: result.value.items.map(toPayrunView) }),
  )
}

export async function createPayrun(request: Request): Promise<Response> {
  const session = await requireSession()
  if (!session.ok) return errorResponse(session.error)

  const body = await parseJson(request, createPayrunSchema)
  if (!body.ok) return errorResponse(body.error)

  const result = await new CreatePayrunUseCase(
    payrunRepository(),
    structureQuery(),
    employeeLookup(),
  ).execute({
    actor: session.value,
    name: body.value.name,
    structureId: body.value.structureId,
    period: Period.of(body.value.periodStart, body.value.periodEnd),
    employeeIds: body.value.employeeIds,
  })
  if (!result.ok) return errorResponse(result.error)

  return respond(Ok(toPayrunView(result.value)), 201)
}

export async function getPayrun(id: string): Promise<Response> {
  const session = await requireSession()
  if (!session.ok) return errorResponse(session.error)

  const result = await new GetPayrunDetailUseCase(
    payrunRepository(),
    payslipRepository(),
    employeeLookup(),
    contractQuery(),
  ).execute({ actor: session.value, payrunId: id })
  if (!result.ok) return errorResponse(result.error)

  return respond(
    Ok({
      payrun: toPayrunView(result.value.payrun),
      payslips: result.value.payslips.map(toView),
      warnings: result.value.warnings,
    }),
  )
}

export async function computePayrun(id: string): Promise<Response> {
  const session = await requireSession()
  if (!session.ok) return errorResponse(session.error)

  const result = await new ComputePayrunUseCase(
    payrunRepository(),
    payslipRepository(),
    structureQuery(),
    employeeLookup(),
    contractQuery(),
    scheduleQuery(),
    attendanceStats(),
  ).execute({ actor: session.value, payrunId: id })
  if (!result.ok) return errorResponse(result.error)

  return respond(
    Ok({
      payrun: toPayrunView(result.value.payrun),
      payslips: result.value.payslips.map(toView),
      warnings: result.value.warnings,
      skipped: result.value.skipped,
    }),
  )
}

export async function validatePayrun(id: string): Promise<Response> {
  const session = await requireSession()
  if (!session.ok) return errorResponse(session.error)

  const result = await new ValidatePayrunUseCase(
    payrunRepository(),
    payslipRepository(),
    employeeLookup(),
    contractQuery(),
    eventBus(),
  ).execute({ actor: session.value, payrunId: id })
  if (!result.ok) return errorResponse(result.error)

  return respond(
    Ok({ payrun: toPayrunView(result.value.payrun), warnings: result.value.warnings }),
  )
}

export async function markPayrunPaid(id: string): Promise<Response> {
  const session = await requireSession()
  if (!session.ok) return errorResponse(session.error)

  const result = await new MarkPayrunPaidUseCase(
    payrunRepository(),
    payslipRepository(),
    eventBus(),
  ).execute({ actor: session.value, payrunId: id })
  if (!result.ok) return errorResponse(result.error)

  return respond(Ok(toPayrunView(result.value)))
}


export async function listEligibleEmployees(request: Request): Promise<Response> {
  const session = await requireSession()
  if (!session.ok) return errorResponse(session.error)

  const query = parseWith(eligibleEmployeesQuerySchema, parseQuery(request.url))
  if (!query.ok) return errorResponse(query.error)

  const result = await new ListEligibleEmployeesUseCase(employeeLookup(), contractQuery()).execute({
    actor: session.value,
    period: Period.of(query.value.periodStart, query.value.periodEnd),
    departmentId: query.value.departmentId,
    employeeType: query.value.employeeType,
  })
  if (!result.ok) return errorResponse(result.error)

  return respond(
    Ok(
      result.value.map((row) => ({
        id: row.employee.id,
        name: row.employee.name,
        email: row.employee.email,
        departmentName: row.employee.departmentName,
        jobPositionName: row.employee.jobPositionName,
        employeeType: row.employee.employeeType,
        hasBankAccount: Boolean(row.employee.bankAccount?.trim()),
        wage: row.contract?.wage ?? null,
        eligible: row.eligible,
        reason: row.reason,
        message: row.message,
      })),
    ),
  )
}
