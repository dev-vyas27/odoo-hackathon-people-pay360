/**
 * The shared kernel. The ONE module every other module may depend on.
 *
 * Keep this small and stable: anything added here becomes coupling for all ten
 * modules. If only two modules need it, it belongs in a port, not in here.
 */
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
  objectId,
  optionalObjectId,
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

/**
 * Persistence base class. Lives in shared/infrastructure but is published here
 * because every module's repositories extend it - without this export they would
 * have to reach into shared's internals, which the boundary rule forbids.
 */
export { BaseMongoRepository } from './infrastructure/mongo-repository'
