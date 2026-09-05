/**
 * MongoAttendanceRepository — implements AttendanceRepositoryPort on top of
 * Mongoose. Returns DOMAIN Attendance objects, never Mongoose documents.
 *
 * Does not extend BaseMongoRepository: Attendance is never patched with a
 * partial bag of fields the way the generic template method assumes — it is
 * always saved as a whole aggregate produced by one of its own methods
 * (checkIn / recordCheckOut / correct). A dedicated, small repository is a
 * better fit than bending the shared template to a shape it wasn't for.
 */
import type { FilterQuery } from 'mongoose'
import type { Paged, PageQuery } from '@/modules/shared'
import { normalizePageQuery, paged } from '@/modules/shared'
import { Attendance } from '../domain/attendance'
import type { AttendanceStatus } from '../domain/exception'
import type { AttendanceFilter, AttendanceRepositoryPort } from '../application/ports/attendance-repository.port'
import { AttendanceModel, type AttendanceDoc } from './attendance.model'
import type { EmployeeDirectoryPort } from '../application/ports/employee-directory.port'

function toDomain(doc: AttendanceDoc): Attendance {
  return Attendance.reconstitute({
    id: String(doc._id),
    employeeId: doc.employeeId,
    checkIn: doc.checkIn,
    checkOut: doc.checkOut,
    breakMinutes: doc.breakMinutes,
    manual: doc.manual,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  })
}

export class MongoAttendanceRepository implements AttendanceRepositoryPort {
  constructor(private readonly directory: EmployeeDirectoryPort) {}

  async findById(id: string): Promise<Attendance | null> {
    const doc = await AttendanceModel.findById(id).lean<AttendanceDoc>().exec()
    return doc ? toDomain(doc) : null
  }

  async findOpenForEmployee(employeeId: string): Promise<Attendance | null> {
    const doc = await AttendanceModel.findOne({ employeeId, checkOut: null })
      .sort({ checkIn: -1 })
      .lean<AttendanceDoc>()
      .exec()
    return doc ? toDomain(doc) : null
  }

  async save(attendance: Attendance, status: AttendanceStatus): Promise<Attendance> {
    const props = attendance.toProps()
    const workedHoursResult = attendance.workedHours()
    const workedHours = workedHoursResult.ok ? workedHoursResult.value : null

    if (props.id) {
      const doc = await AttendanceModel.findByIdAndUpdate(
        props.id,
        {
          employeeId: props.employeeId,
          checkIn: props.checkIn,
          checkOut: props.checkOut,
          breakMinutes: props.breakMinutes,
          manual: props.manual,
          status,
          workedHours,
        },
        { new: true, runValidators: true },
      )
        .lean<AttendanceDoc>()
        .exec()
      if (!doc) throw new Error(`Attendance ${props.id} disappeared during update`)
      return toDomain(doc)
    }

    const departmentId = await this.directory.departmentIdFor(props.employeeId)
    const created = await AttendanceModel.create({
      employeeId: props.employeeId,
      departmentId,
      checkIn: props.checkIn,
      checkOut: props.checkOut,
      breakMinutes: props.breakMinutes,
      manual: props.manual,
      status,
      workedHours,
    })
    return toDomain(created.toObject() as AttendanceDoc)
  }

  async findMany(filter: AttendanceFilter, page: PageQuery): Promise<Paged<Attendance>> {
    const q = normalizePageQuery(page)
    const mongoFilter: FilterQuery<AttendanceDoc> = {}
    if (filter.employeeId) mongoFilter.employeeId = filter.employeeId
    if (filter.status) mongoFilter.status = filter.status
    if (filter.from || filter.to) {
      mongoFilter.checkIn = {}
      if (filter.from) mongoFilter.checkIn.$gte = filter.from
      if (filter.to) mongoFilter.checkIn.$lte = filter.to
    }

    const [docs, total] = await Promise.all([
      AttendanceModel.find(mongoFilter)
        .sort({ checkIn: -1 })
        .skip((q.page - 1) * q.limit)
        .limit(q.limit)
        .lean<AttendanceDoc[]>()
        .exec(),
      AttendanceModel.countDocuments(mongoFilter).exec(),
    ])

    return paged(docs.map(toDomain), total, q.page, q.limit)
  }

  async deleteById(id: string): Promise<boolean> {
    const res = await AttendanceModel.findByIdAndDelete(id).lean().exec()
    return res !== null
  }
}
