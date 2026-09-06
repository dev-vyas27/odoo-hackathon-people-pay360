import type { DailySchedule } from '../../domain/exception'
import type { ScheduleLookupPort } from '../ports/schedule-lookup.port'


export class FakeScheduleLookup implements ScheduleLookupPort {
  constructor(private readonly schedule: DailySchedule | null = null) {}

  async scheduleForDay(): Promise<DailySchedule | null> {
    return this.schedule
  }
}
