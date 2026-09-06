


export { Money } from './domain/money'
export { Period, startOfDay } from './domain/period'
export { DomainError, type ErrorKind } from './domain/domain-error'
export { Ok, Err, isOk, unwrap, all, type Result } from './domain/result'
export type {
  DomainEvent,
  DomainEventType,
  EventOf,
  LeaveRequestApproved,
  LeaveRequestRefused,
  PayrunValidated,
  PayrunPaid,
  ContractActivated,
  EmployeeArchived,
} from './domain/domain-event'
export { InMemoryEventBus, type IEventBus, type EventHandler } from './application/event-bus'
export {
  type IRepository,
  type IReadRepository,
  type UseCase,
  type PageQuery,
  type Paged,
  normalizePageQuery,
  paged,
  DEFAULT_PAGE_LIMIT,
} from './application/repository'
export {
  type Actor,
  actorCan,
  authorize,
  authorizeOwned,
} from './application/actor'
export {
  ROLES,
  RESOURCES,
  ACTIONS,
  ROLE_PERMISSIONS,
  ROLE_LABELS,
  can,
  perm,
  scopeToSelf,
  type Role,
  type Resource,
  type Action,
  type Permission,
} from './contracts/permissions'
export {
  uuid,
  optionalUuid,
  nonEmpty,
  email,
  money,
  percentage,
  dateField,
  timeField,
  dateRangeRefinement,
  pageQuerySchema,
  type PageQueryInput,
} from './contracts/schema'



export {
  EMPLOYEE_TYPES,
  LEAVE_UNITS,
  LEAVE_STATUSES,
  SALARY_CATEGORIES,
  PAYSLIP_STATUSES,
  PAYRUN_STATUSES,
} from './contracts/dto'
export type {
  CurrentUser,
  ListEnvelope,
  SeriesPoint,
  EmployeeType,
  EmployeeSummary,
  EmployeeLookupPort,
  EmployeeStatsPort,
  StatsFilter,
  ContractSnapshot,
  ContractQueryPort,
  ScheduleSnapshot,
  ScheduleQueryPort,
  ContractAlert,
  ContractAlertsPort,
  AttendanceSummary,
  AttendanceStatsPort,
  LeaveUnit,
  LeaveStatus,
  LeaveBalanceView,
  LeaveStatsPort,
  EmailAttachment,
  EmailMessage,
  EmailResult,
  MailerPort,
  SalaryCategory,
  PayslipStatus,
  PayrunStatus,
  PayslipLineView,
  PayslipView,
  PayslipQueryPort,
  PayrollTotals,
  PayrollStatsPort,
} from './contracts/dto'

export { PORT_KEYS, type PortKey } from './contracts/port-keys'
export {
  container,
  resolve,
  providePort,
  getPort,
  portOr,
  type Container,
} from './container'



export {
  IST_OFFSET_MS,
  IST_LABEL,
  istDay,
  istTime,
  istStartOfDay,
  istEndOfDay,
  istNextMidnight,
  minutesBetween,
  formatDuration,
} from './domain/ist'
