import { describe, expect, it } from 'vitest'
import type { Actor } from '@/modules/shared'
import { CheckInUseCase } from './check-in.use-case'
import { ListAttendanceUseCase } from './list-attendance.use-case'
import { InMemoryAttendanceRepository } from './test-support/in-memory-attendance.repository'
import { FakeScheduleLookup } from './test-support/fake-schedule-lookup'

function employeeActor(employeeId: string): Actor {
  return { userId: 'u1', employeeId, role: 'employee', email: 'e@x.com', name: 'Employee' }
}

function hrActor(): Actor {
  return { userId: 'u2', employeeId: null, role: 'hr_manager', email: 'hr@x.com', name: 'HR' }
}

async function seed(repo: InMemoryAttendanceRepository) {
  const useCase = new CheckInUseCase(repo, new FakeScheduleLookup())
  await useCase.execute({ actor: hrActor(), employeeId: 'emp-1', checkIn: new Date('2026-03-10T09:00:00Z') })
  await useCase.execute({ actor: hrActor(), employeeId: 'emp-2', checkIn: new Date('2026-03-10T09:00:00Z') })
}

describe('ListAttendanceUseCase', () => {
  it('lets hr see every employee', async () => {
    const repo = new InMemoryAttendanceRepository()
    await seed(repo)

    const useCase = new ListAttendanceUseCase(repo)
    const result = await useCase.execute({ actor: hrActor(), filter: {}, page: {} })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.total).toBe(2)
  })

  it('forces an employee actor to only ever see their own rows', async () => {
    const repo = new InMemoryAttendanceRepository()
    await seed(repo)

    const useCase = new ListAttendanceUseCase(repo)
    // Even trying to ask for someone else's employeeId is overridden.
    const result = await useCase.execute({
      actor: employeeActor('emp-1'),
      filter: { employeeId: 'emp-2' },
      page: {},
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.total).toBe(1)
      expect(result.value.items[0]?.employeeId).toBe('emp-1')
    }
  })
})
