import { resolve } from '@/modules/shared/container'
import type { Actor } from '@/modules/shared'
import {
  CreateJobPositionUseCase,
  DeleteJobPositionUseCase,
  GetJobPositionUseCase,
  ListJobPositionsUseCase,
  UpdateJobPositionUseCase,
} from '../application/job-position-use-cases'
import { PostgresJobPositionRepository } from '../infrastructure/postgres-job-position.repository'
import { createJobPositionSchema, jobPositionQuerySchema, updateJobPositionSchema } from './job-position.schema'
import { parseWith } from './parse'

async function repository(): Promise<PostgresJobPositionRepository> {
  return resolve('people.jobPositionRepository', () => new PostgresJobPositionRepository())
}

export async function createJobPosition(actor: Actor, rawBody: unknown) {
  const body = parseWith(createJobPositionSchema, rawBody)
  if (!body.ok) return body
  const repo = await repository()
  return new CreateJobPositionUseCase(repo).execute({ actor, ...body.value })
}

export async function updateJobPosition(actor: Actor, id: string, rawPatch: unknown) {
  const patch = parseWith(updateJobPositionSchema, rawPatch)
  if (!patch.ok) return patch
  const repo = await repository()
  return new UpdateJobPositionUseCase(repo).execute({ actor, id, patch: patch.value })
}

export async function listJobPositions(actor: Actor, rawQuery: Record<string, string>) {
  const query = parseWith(jobPositionQuerySchema, rawQuery)
  if (!query.ok) return query
  const repo = await repository()
  return new ListJobPositionsUseCase(repo).execute({ actor, query: query.value })
}

export async function getJobPosition(actor: Actor, id: string) {
  const repo = await repository()
  return new GetJobPositionUseCase(repo).execute({ actor, id })
}

export async function deleteJobPosition(actor: Actor, id: string) {
  const repo = await repository()
  return new DeleteJobPositionUseCase(repo).execute({ actor, id })
}
