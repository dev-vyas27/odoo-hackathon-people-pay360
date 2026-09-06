/**
 * Postgres repositories for the three Time Off aggregates.
 *
 * Each takes an `Executor` — either the pool (autocommit) or a transaction
 * client. That one parameter is what lets `approve-leave.use-case` run the
 * allocation deduction and the status change through the same connection, and
 * therefore the same transaction, without the use case knowing what a
 * connection is.
 *
 * Every value is bound as `$n`. The only interpolated strings are column lists
 * from `timeoff.tables.ts`, which are compile-time constants.
 */
import { pool } from '@/lib/db'
import type { QueryResultRow } from 'pg'
import {
  DomainError,
  Period,
  normalizePageQuery,
  paged,
  type PageQuery,
  type Paged,
} from '@/modules/shared'
import { Allocation, type AllocationProps } from '../domain/allocation'
import { LeaveRequest, type LeaveRequestProps } from '../domain/leave-request'
import { TimeOffType, type TimeOffTypeProps } from '../domain/time-off-type'
import type {
  AllocationRepositoryPort,
  LeaveRequestRepositoryPort,
  TimeOffTypeRepositoryPort,
} from '../application/ports/repositories.port'
import {
  ALLOCATION_COLUMNS,
  ALLOCATIONS_TABLE,
  REQUEST_COLUMNS,
  REQUESTS_TABLE,
  TIMEOFF_TYPE_COLUMNS,
  TIMEOFF_TYPES_TABLE,
  selection,
  toDateString,
  toUtcDate,
  type AllocationRow,
  type LeaveRequestRow,
  type TimeOffTypeRow,
} from './timeoff.tables'

/**
 * Both `Pool` and `PoolClient` satisfy this, which is the whole trick: the same
 * repository class works on a pooled connection (autocommit) or a transaction
 * client, and only the caller knows which.
 */
export interface Executor {
  query<T extends QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number | null }>
}

const TYPE_COLS = selection(TIMEOFF_TYPE_COLUMNS)
const ALLOC_COLS = selection(ALLOCATION_COLUMNS)
const REQ_COLS = selection(REQUEST_COLUMNS)

// ── mappers ──────────────────────────────────────────────────────────────────

function toType(row: TimeOffTypeRow): TimeOffType {
  return TimeOffType.from({
    id: row.id,
    name: row.name,
    code: row.code,
    unit: row.unit,
    requiresAllocation: row.requires_allocation,
    autoApprove: row.auto_approve,
    isPaid: row.is_paid,
    isActive: row.is_active,
  })
}

function toAllocation(row: AllocationRow): Allocation {
  return Allocation.from({
    id: row.id,
    employeeId: row.employee_id,
    timeOffTypeId: row.timeoff_type_id,
    unit: row.unit,
    allocated: Number(row.allocated),
    taken: Number(row.taken),
    validity: Period.of(toUtcDate(row.valid_from), toUtcDate(row.valid_to)),
    status: row.status,
    note: row.note,
  })
}

function toRequest(row: LeaveRequestRow): LeaveRequest {
  return LeaveRequest.from({
    id: row.id,
    employeeId: row.employee_id,
    timeOffTypeId: row.timeoff_type_id,
    period: Period.of(toUtcDate(row.starts_on), toUtcDate(row.ends_on)),
    unit: row.unit,
    duration: Number(row.duration),
    reason: row.reason,
    status: row.status,
    allocationId: row.allocation_id,
    decidedByEmployeeId: row.decided_by_employee_id,
    decidedAt: row.decided_at,
  })
}

/**
 * Postgres tells us WHICH constraint failed. Turning that into a DomainError
 * here means the API returns "That code is already in use" rather than a 500
 * with a driver message — and the check stays in the database, where a race
 * cannot slip past it.
 */
function translate(reason: unknown): never {
  const error = reason as { code?: string; constraint?: string; detail?: string }

  if (error?.code === '23505') {
    if (error.constraint === 'timeoff_types_code_key') {
      throw DomainError.conflict('TIME_OFF_CODE_TAKEN', 'Another leave type already uses that code')
    }
    throw DomainError.conflict('DUPLICATE', 'That record already exists')
  }

  if (error?.code === '23514' && error.constraint === 'allocations_taken_within_allocated') {
    throw DomainError.rule(
      'ALLOCATION_INSUFFICIENT',
      'That would consume more than the allocation holds',
    )
  }

  if (error?.code === '23503') {
    throw DomainError.validation(
      'REFERENCE_NOT_FOUND',
      'A referenced employee or leave type does not exist',
    )
  }

  if (error?.code === '23503' || error?.code === '23502') {
    throw DomainError.validation('INVALID_REFERENCE', 'A required field is missing or invalid')
  }

  throw reason
}

async function run<T extends QueryResultRow>(
  executor: Executor,
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  try {
    const result = await executor.query<T>(text, params)
    return result.rows
  } catch (reason) {
    return translate(reason)
  }
}

/** Sort columns arrive from a query string, so they are picked from a fixed set. */
function orderBy(q: PageQuery, allowed: Record<string, string>, fallback: string): string {
  const column = (q.sort && allowed[q.sort]) || fallback
  return `ORDER BY "${column}" ${q.order === 'asc' ? 'ASC' : 'DESC'}`
}

// ── time off types ───────────────────────────────────────────────────────────

export class PostgresTimeOffTypeRepository implements TimeOffTypeRepositoryPort {
  constructor(private readonly db: Executor = pool()) {}

  async findById(id: string): Promise<TimeOffType | null> {
    const rows = await run<TimeOffTypeRow>(
      this.db,
      `SELECT ${TYPE_COLS} FROM "${TIMEOFF_TYPES_TABLE}" WHERE id = $1`,
      [id],
    )
    return rows[0] ? toType(rows[0]) : null
  }

  async findAll(activeOnly = false): Promise<TimeOffType[]> {
    const rows = await run<TimeOffTypeRow>(
      this.db,
      `SELECT ${TYPE_COLS} FROM "${TIMEOFF_TYPES_TABLE}"
       ${activeOnly ? 'WHERE is_active = true' : ''}
       ORDER BY name ASC`,
    )
    return rows.map(toType)
  }

  async findMany(pageQuery: PageQuery): Promise<Paged<TimeOffType>> {
    const q = normalizePageQuery(pageQuery)
    const conditions: string[] = []
    const values: unknown[] = []

    const isActive = q.filters?.isActive
    if (isActive === 'true' || isActive === 'false') {
      values.push(isActive === 'true')
      conditions.push(`is_active = $${values.length}`)
    }
    if (q.search) {
      values.push(`%${q.search}%`)
      conditions.push(`(name ILIKE $${values.length} OR code ILIKE $${values.length})`)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const sort = orderBy(q, { name: 'name', code: 'code', createdAt: 'created_at' }, 'name')

    const [rows, totals] = await Promise.all([
      run<TimeOffTypeRow>(
        this.db,
        `SELECT ${TYPE_COLS} FROM "${TIMEOFF_TYPES_TABLE}" ${where} ${sort}
         LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, q.limit, (q.page - 1) * q.limit],
      ),
      run<{ count: number }>(
        this.db,
        `SELECT COUNT(*)::int AS count FROM "${TIMEOFF_TYPES_TABLE}" ${where}`,
        values,
      ),
    ])

    return paged(rows.map(toType), totals[0]?.count ?? 0, q.page, q.limit)
  }

  async create(props: Omit<TimeOffTypeProps, 'id'>): Promise<TimeOffType> {
    const rows = await run<TimeOffTypeRow>(
      this.db,
      `INSERT INTO "${TIMEOFF_TYPES_TABLE}"
         (name, code, unit, requires_allocation, auto_approve, is_paid, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING ${TYPE_COLS}`,
      [
        props.name,
        props.code,
        props.unit,
        props.requiresAllocation,
        props.autoApprove,
        props.isPaid,
        props.isActive,
      ],
    )
    return toType(rows[0])
  }

  async update(
    id: string,
    props: Partial<Omit<TimeOffTypeProps, 'id'>>,
  ): Promise<TimeOffType | null> {
    // COALESCE keeps this one fixed statement usable for any partial update,
    // which means no dynamically built identifier list.
    const rows = await run<TimeOffTypeRow>(
      this.db,
      `UPDATE "${TIMEOFF_TYPES_TABLE}" SET
         name                = COALESCE($2, name),
         code                = COALESCE($3, code),
         unit                = COALESCE($4, unit),
         requires_allocation = COALESCE($5, requires_allocation),
         auto_approve        = COALESCE($6, auto_approve),
         is_paid             = COALESCE($7, is_paid),
         is_active           = COALESCE($8, is_active)
       WHERE id = $1
       RETURNING ${TYPE_COLS}`,
      [
        id,
        props.name ?? null,
        props.code ?? null,
        props.unit ?? null,
        props.requiresAllocation ?? null,
        props.autoApprove ?? null,
        props.isPaid ?? null,
        props.isActive ?? null,
      ],
    )
    return rows[0] ? toType(rows[0]) : null
  }

  async delete(id: string): Promise<boolean> {
    // The FK from allocations and requests is ON DELETE RESTRICT, so this
    // throws rather than orphaning history. Deactivating is the usual answer.
    const rows = await run<{ id: string }>(
      this.db,
      `DELETE FROM "${TIMEOFF_TYPES_TABLE}" WHERE id = $1 RETURNING id`,
      [id],
    )
    return rows.length > 0
  }
}

// ── allocations ──────────────────────────────────────────────────────────────

export class PostgresAllocationRepository implements AllocationRepositoryPort {
  constructor(private readonly db: Executor = pool()) {}

  async findById(id: string): Promise<Allocation | null> {
    const rows = await run<AllocationRow>(
      this.db,
      `SELECT ${ALLOC_COLS} FROM "${ALLOCATIONS_TABLE}" WHERE id = $1`,
      [id],
    )
    return rows[0] ? toAllocation(rows[0]) : null
  }

  /**
   * `FOR UPDATE` locks the row for the rest of the transaction.
   *
   * Without it, two approvals for the same employee could both read
   * `taken = 0`, both decide there is room, and both write. The CHECK constraint
   * would catch the worst case, but the correct fix is to serialise the
   * read-modify-write, which is exactly what this does.
   */
  async findByIdForUpdate(id: string): Promise<Allocation | null> {
    const rows = await run<AllocationRow>(
      this.db,
      `SELECT ${ALLOC_COLS} FROM "${ALLOCATIONS_TABLE}" WHERE id = $1 FOR UPDATE`,
      [id],
    )
    return rows[0] ? toAllocation(rows[0]) : null
  }

  async findForEmployee(employeeId: string, timeOffTypeId?: string): Promise<Allocation[]> {
    const rows = await run<AllocationRow>(
      this.db,
      `SELECT ${ALLOC_COLS} FROM "${ALLOCATIONS_TABLE}"
       WHERE employee_id = $1 AND ($2::uuid IS NULL OR timeoff_type_id = $2)
       ORDER BY valid_to ASC`,
      [employeeId, timeOffTypeId ?? null],
    )
    return rows.map(toAllocation)
  }

  async findMany(pageQuery: PageQuery): Promise<Paged<Allocation>> {
    const q = normalizePageQuery(pageQuery)
    const conditions: string[] = []
    const values: unknown[] = []

    for (const [key, column] of [
      ['employeeId', 'employee_id'],
      ['timeOffTypeId', 'timeoff_type_id'],
      ['status', 'status'],
    ] as const) {
      const value = q.filters?.[key]
      if (typeof value === 'string' && value !== '') {
        values.push(value)
        conditions.push(`${column} = $${values.length}`)
      }
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const sort = orderBy(
      q,
      { validFrom: 'valid_from', validTo: 'valid_to', allocated: 'allocated', createdAt: 'created_at' },
      'created_at',
    )

    const [rows, totals] = await Promise.all([
      run<AllocationRow>(
        this.db,
        `SELECT ${ALLOC_COLS} FROM "${ALLOCATIONS_TABLE}" ${where} ${sort}
         LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, q.limit, (q.page - 1) * q.limit],
      ),
      run<{ count: number }>(
        this.db,
        `SELECT COUNT(*)::int AS count FROM "${ALLOCATIONS_TABLE}" ${where}`,
        values,
      ),
    ])

    return paged(rows.map(toAllocation), totals[0]?.count ?? 0, q.page, q.limit)
  }

  async create(props: Omit<AllocationProps, 'id'>): Promise<Allocation> {
    const rows = await run<AllocationRow>(
      this.db,
      `INSERT INTO "${ALLOCATIONS_TABLE}"
         (employee_id, timeoff_type_id, unit, allocated, taken, valid_from, valid_to, status, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING ${ALLOC_COLS}`,
      [
        props.employeeId,
        props.timeOffTypeId,
        props.unit,
        props.allocated,
        props.taken,
        toDateString(props.validity.start),
        toDateString(props.validity.end),
        props.status,
        props.note ?? null,
      ],
    )
    return toAllocation(rows[0])
  }

  /** Persists a mutated aggregate. Takes the whole thing, not a patch. */
  async save(allocation: Allocation): Promise<Allocation> {
    const props = allocation.toProps()
    const rows = await run<AllocationRow>(
      this.db,
      `UPDATE "${ALLOCATIONS_TABLE}" SET
         unit = $2, allocated = $3, taken = $4,
         valid_from = $5, valid_to = $6, status = $7, note = $8
       WHERE id = $1
       RETURNING ${ALLOC_COLS}`,
      [
        props.id,
        props.unit,
        props.allocated,
        props.taken,
        toDateString(props.validity.start),
        toDateString(props.validity.end),
        props.status,
        props.note ?? null,
      ],
    )
    if (!rows[0]) {
      throw DomainError.notFound('ALLOCATION_NOT_FOUND', 'That allocation no longer exists')
    }
    return toAllocation(rows[0])
  }

  async delete(id: string): Promise<boolean> {
    const rows = await run<{ id: string }>(
      this.db,
      `DELETE FROM "${ALLOCATIONS_TABLE}" WHERE id = $1 RETURNING id`,
      [id],
    )
    return rows.length > 0
  }
}

// ── leave requests ───────────────────────────────────────────────────────────

export class PostgresLeaveRequestRepository implements LeaveRequestRepositoryPort {
  constructor(private readonly db: Executor = pool()) {}

  async findById(id: string): Promise<LeaveRequest | null> {
    const rows = await run<LeaveRequestRow>(
      this.db,
      `SELECT ${REQ_COLS} FROM "${REQUESTS_TABLE}" WHERE id = $1`,
      [id],
    )
    return rows[0] ? toRequest(rows[0]) : null
  }

  async findByIdForUpdate(id: string): Promise<LeaveRequest | null> {
    const rows = await run<LeaveRequestRow>(
      this.db,
      `SELECT ${REQ_COLS} FROM "${REQUESTS_TABLE}" WHERE id = $1 FOR UPDATE`,
      [id],
    )
    return rows[0] ? toRequest(rows[0]) : null
  }

  async findForEmployee(employeeId: string, timeOffTypeId?: string): Promise<LeaveRequest[]> {
    const rows = await run<LeaveRequestRow>(
      this.db,
      `SELECT ${REQ_COLS} FROM "${REQUESTS_TABLE}"
       WHERE employee_id = $1 AND ($2::uuid IS NULL OR timeoff_type_id = $2)
       ORDER BY starts_on DESC`,
      [employeeId, timeOffTypeId ?? null],
    )
    return rows.map(toRequest)
  }

  /** Approved leave intersecting a period — the dashboard's leave figure. */
  async findApprovedInPeriod(period: Period, employeeIds?: string[]): Promise<LeaveRequest[]> {
    const rows = await run<LeaveRequestRow>(
      this.db,
      `SELECT ${REQ_COLS} FROM "${REQUESTS_TABLE}"
       WHERE status = 'approved'
         AND starts_on <= $2 AND ends_on >= $1
         AND ($3::uuid[] IS NULL OR employee_id = ANY($3))
       ORDER BY starts_on ASC`,
      [toDateString(period.start), toDateString(period.end), employeeIds ?? null],
    )
    return rows.map(toRequest)
  }

  async countByStatus(status: string): Promise<number> {
    const rows = await run<{ count: number }>(
      this.db,
      `SELECT COUNT(*)::int AS count FROM "${REQUESTS_TABLE}" WHERE status = $1`,
      [status],
    )
    return rows[0]?.count ?? 0
  }

  async findMany(pageQuery: PageQuery): Promise<Paged<LeaveRequest>> {
    const q = normalizePageQuery(pageQuery)
    const conditions: string[] = []
    const values: unknown[] = []

    for (const [key, column] of [
      ['employeeId', 'employee_id'],
      ['timeOffTypeId', 'timeoff_type_id'],
      ['status', 'status'],
    ] as const) {
      const value = q.filters?.[key]
      if (typeof value === 'string' && value !== '') {
        values.push(value)
        conditions.push(`${column} = $${values.length}`)
      }
    }

    // ?from= / ?to= narrow the list to requests overlapping a window.
    const from = q.filters?.from
    if (typeof from === 'string' && from !== '') {
      values.push(from)
      conditions.push(`ends_on >= $${values.length}::date`)
    }
    const to = q.filters?.to
    if (typeof to === 'string' && to !== '') {
      values.push(to)
      conditions.push(`starts_on <= $${values.length}::date`)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const sort = orderBy(
      q,
      { startsOn: 'starts_on', endsOn: 'ends_on', duration: 'duration', status: 'status', createdAt: 'created_at' },
      'starts_on',
    )

    const [rows, totals] = await Promise.all([
      run<LeaveRequestRow>(
        this.db,
        `SELECT ${REQ_COLS} FROM "${REQUESTS_TABLE}" ${where} ${sort}
         LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, q.limit, (q.page - 1) * q.limit],
      ),
      run<{ count: number }>(
        this.db,
        `SELECT COUNT(*)::int AS count FROM "${REQUESTS_TABLE}" ${where}`,
        values,
      ),
    ])

    return paged(rows.map(toRequest), totals[0]?.count ?? 0, q.page, q.limit)
  }

  async create(props: Omit<LeaveRequestProps, 'id'>): Promise<LeaveRequest> {
    const rows = await run<LeaveRequestRow>(
      this.db,
      `INSERT INTO "${REQUESTS_TABLE}"
         (employee_id, timeoff_type_id, starts_on, ends_on, unit, duration, reason, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING ${REQ_COLS}`,
      [
        props.employeeId,
        props.timeOffTypeId,
        toDateString(props.period.start),
        toDateString(props.period.end),
        props.unit,
        props.duration,
        props.reason ?? null,
        props.status,
      ],
    )
    return toRequest(rows[0])
  }

  async save(request: LeaveRequest): Promise<LeaveRequest> {
    const props = request.toProps()
    const rows = await run<LeaveRequestRow>(
      this.db,
      `UPDATE "${REQUESTS_TABLE}" SET
         timeoff_type_id = $2, starts_on = $3, ends_on = $4, unit = $5,
         duration = $6, reason = $7, status = $8, allocation_id = $9,
         decided_by_employee_id = $10, decided_at = $11
       WHERE id = $1
       RETURNING ${REQ_COLS}`,
      [
        props.id,
        props.timeOffTypeId,
        toDateString(props.period.start),
        toDateString(props.period.end),
        props.unit,
        props.duration,
        props.reason ?? null,
        props.status,
        props.allocationId ?? null,
        props.decidedByEmployeeId ?? null,
        props.decidedAt ?? null,
      ],
    )
    if (!rows[0]) {
      throw DomainError.notFound('LEAVE_NOT_FOUND', 'That leave request no longer exists')
    }
    return toRequest(rows[0])
  }

  async delete(id: string): Promise<boolean> {
    const rows = await run<{ id: string }>(
      this.db,
      `DELETE FROM "${REQUESTS_TABLE}" WHERE id = $1 RETURNING id`,
      [id],
    )
    return rows.length > 0
  }
}
