/**
 * Postgres implementation of ScheduleRepositoryPort.
 *
 * A working schedule is a parent row plus its day pattern in a child table.
 * Mongo stored the days as a nested array; relationally that is
 * `working_schedule_days` with a cascade, which means a write is several
 * statements and MUST be a transaction — a schedule that half-saved its days
 * would compute the wrong weekly hours, and payroll prorates against that.
 *
 * `weekly_hours` is always derived by the pure computeWeeklyHours service and
 * never accepted from a caller (spec A3).
 */
import { pool, query } from '@/lib/db'
import { normalizePageQuery, paged, type PageQuery, type Paged } from '@/modules/shared'
import { BaseSqlRepository } from '@/modules/shared/server'
import type { ScheduleRepositoryPort } from '../application/ports/schedule-repository.port'
import type { WorkingSchedule } from '../domain/working-schedule'
import { computeWeeklyHours, type ScheduleDayPattern } from '../domain/weekly-hours.service'
import {
  SCHEDULES_TABLE,
  SCHEDULE_COLUMNS,
  SCHEDULE_DAYS_TABLE,
  toClock,
  toSqlTime,
  type ScheduleDayRow,
  type ScheduleRow,
} from './employment.tables'

export class PostgresScheduleRepository
  extends BaseSqlRepository<WorkingSchedule, ScheduleRow>
  implements ScheduleRepositoryPort
{
  protected readonly table = SCHEDULES_TABLE
  protected readonly columns = SCHEDULE_COLUMNS
  protected readonly searchable = ['name']
  protected readonly defaultSort = 'name'

  /** Days are loaded separately; this yields the parent with an empty pattern. */
  protected toDomain(row: ScheduleRow): WorkingSchedule {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      days: [],
      weeklyHours: Number(row.weekly_hours),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  private static toDays(rows: ScheduleDayRow[]): ScheduleDayPattern[] {
    return rows.map((d) => ({
      day: d.day_of_week as ScheduleDayPattern['day'],
      start: toClock(d.starts_at),
      end: toClock(d.ends_at),
      breakMinutes: d.break_minutes,
    }))
  }

  async findById(id: string): Promise<WorkingSchedule | null> {
    const parent = await super.findById(id)
    if (!parent) return null
    const days = await query<ScheduleDayRow>(
      `SELECT * FROM "${SCHEDULE_DAYS_TABLE}" WHERE working_schedule_id = $1 ORDER BY day_of_week`,
      [id],
    )
    return { ...parent, days: PostgresScheduleRepository.toDays(days) }
  }

  /**
   * List with day patterns attached, in TWO queries rather than one per row.
   * The list view shows weekly hours, and a schedules list is small, so
   * fetching every day row for the page and grouping in memory is cheaper than
   * N round trips.
   */
  async findMany(pageQuery: PageQuery): Promise<Paged<WorkingSchedule>> {
    const page = await super.findMany(normalizePageQuery(pageQuery))
    if (page.items.length === 0) return page

    const ids = page.items.map((s) => s.id)
    const dayRows = await query<ScheduleDayRow>(
      `SELECT * FROM "${SCHEDULE_DAYS_TABLE}"
       WHERE working_schedule_id = ANY($1::uuid[]) ORDER BY day_of_week`,
      [ids],
    )

    const bySchedule = new Map<string, ScheduleDayRow[]>()
    for (const row of dayRows) {
      const list = bySchedule.get(row.working_schedule_id) ?? []
      list.push(row)
      bySchedule.set(row.working_schedule_id, list)
    }

    const items = page.items.map((s) => ({
      ...s,
      days: PostgresScheduleRepository.toDays(bySchedule.get(s.id) ?? []),
    }))
    return paged(items, page.total, page.page, page.limit)
  }

  async create(data: Partial<WorkingSchedule>): Promise<WorkingSchedule> {
    const days = (data.days ?? []) as ScheduleDayPattern[]
    const weeklyHours = computeWeeklyHours(days)

    const client = await pool().connect()
    try {
      await client.query('BEGIN')
      const { rows } = await client.query<ScheduleRow>(
        `INSERT INTO "${SCHEDULES_TABLE}" (name, type, weekly_hours)
         VALUES ($1, $2, $3) RETURNING ${this.selection}`,
        [data.name, data.type ?? null, weeklyHours],
      )
      const parent = rows[0]
      await this.replaceDays(client, parent.id, days)
      await client.query('COMMIT')
      return { ...this.toDomain(parent), days }
    } catch (reason) {
      await client.query('ROLLBACK')
      throw reason
    } finally {
      client.release()
    }
  }

  async update(id: string, data: Partial<WorkingSchedule>): Promise<WorkingSchedule | null> {
    const client = await pool().connect()
    try {
      await client.query('BEGIN')

      // Days are replaced wholesale when supplied; left alone when not.
      const days = data.days as ScheduleDayPattern[] | undefined
      const weeklyHours = days ? computeWeeklyHours(days) : undefined

      const { rows } = await client.query<ScheduleRow>(
        `UPDATE "${SCHEDULES_TABLE}"
            SET name = COALESCE($2, name),
                type = COALESCE($3, type),
                weekly_hours = COALESCE($4, weekly_hours)
          WHERE id = $1
          RETURNING ${this.selection}`,
        [id, data.name ?? null, data.type ?? null, weeklyHours ?? null],
      )
      if (rows.length === 0) {
        await client.query('ROLLBACK')
        return null
      }

      if (days) await this.replaceDays(client, id, days)
      await client.query('COMMIT')

      const parent = this.toDomain(rows[0])
      if (days) return { ...parent, days }

      const existing = await query<ScheduleDayRow>(
        `SELECT * FROM "${SCHEDULE_DAYS_TABLE}" WHERE working_schedule_id = $1 ORDER BY day_of_week`,
        [id],
      )
      return { ...parent, days: PostgresScheduleRepository.toDays(existing) }
    } catch (reason) {
      await client.query('ROLLBACK')
      throw reason
    } finally {
      client.release()
    }
  }

  /** Delete-then-insert: the day pattern is a set, not a list of editable rows. */
  private async replaceDays(
    client: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
    scheduleId: string,
    days: readonly ScheduleDayPattern[],
  ): Promise<void> {
    await client.query(`DELETE FROM "${SCHEDULE_DAYS_TABLE}" WHERE working_schedule_id = $1`, [
      scheduleId,
    ])
    for (const d of days) {
      await client.query(
        `INSERT INTO "${SCHEDULE_DAYS_TABLE}"
           (working_schedule_id, day_of_week, starts_at, ends_at, break_minutes)
         VALUES ($1, $2, $3, $4, $5)`,
        [scheduleId, d.day, toSqlTime(d.start), toSqlTime(d.end), d.breakMinutes],
      )
    }
  }
}
