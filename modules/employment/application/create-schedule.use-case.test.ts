import { describe, expect, it } from 'vitest'
import type { Actor, Paged } from '@/modules/shared'
import type { WorkingSchedule } from '../domain/working-schedule'
import type { ScheduleRepositoryPort } from './ports/schedule-repository.port'
import { CreateScheduleUseCase } from './create-schedule.use-case'

class FakeScheduleRepository implements ScheduleRepositoryPort {
  public created: Partial<WorkingSchedule>[] = []

  async findById(): Promise<WorkingSchedule | null> {
    return null
  }
  async findMany(): Promise<Paged<WorkingSchedule>> {
    return { items: [], total: 0, page: 1, limit: 20, pages: 1 }
  }
  async count(): Promise<number> {
    return 0
  }
  async create(data: Partial<WorkingSchedule>): Promise<WorkingSchedule> {
    this.created.push(data)
    return {
      id: 's1',
      name: data.name ?? '',
      days: data.days ?? [],
      weeklyHours: data.weeklyHours ?? 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  }
  async update(): Promise<WorkingSchedule | null> {
    return null
  }
  async delete(): Promise<boolean> {
    return false
  }
}

function hrManager(): Actor {
  return { userId: 'u1', employeeId: null, role: 'hr_manager', email: 'hr@pp360.dev', name: 'HR' }
}

describe('CreateScheduleUseCase', () => {
  it('computes weeklyHours from the day pattern rather than accepting it', async () => {
    const repo = new FakeScheduleRepository()
    const useCase = new CreateScheduleUseCase(repo)

    const result = await useCase.execute({
      actor: hrManager(),
      name: 'Standard 9-6',
      days: [
        { day: 1, start: '09:00', end: '18:00', breakMinutes: 60 },
        { day: 2, start: '09:00', end: '18:00', breakMinutes: 60 },
        { day: 3, start: '09:00', end: '18:00', breakMinutes: 60 },
        { day: 4, start: '09:00', end: '18:00', breakMinutes: 60 },
        { day: 5, start: '09:00', end: '18:00', breakMinutes: 60 },
      ],
    })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.weeklyHours).toBe(40)
    // The use case never took weeklyHours as input in the first place -- the
    // repository only ever receives the computed value.
    expect(repo.created[0]?.weeklyHours).toBe(40)
  })

  it('rejects when the actor is not authorized', async () => {
    const repo = new FakeScheduleRepository()
    const useCase = new CreateScheduleUseCase(repo)

    const result = await useCase.execute({
      actor: { userId: 'u2', employeeId: 'emp-9', role: 'employee', email: 'e@pp360.dev', name: 'Emp' },
      name: 'Standard',
      days: [],
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('forbidden')
  })
})
