/**
 * Actor — the authenticated caller, as the domain sees it.
 *
 * Deliberately NOT a Next.js session, a JWT, or a Mongoose user document. Use
 * cases receive this plain object, so they can be tested with a literal and
 * remain ignorant of how authentication happened.
 */
import type { Action, Resource, Role } from '../contracts/permissions'
import { can, scopeToSelf } from '../contracts/permissions'
import { DomainError } from '../domain/domain-error'
import type { Result } from '../domain/result'
import { Err, Ok } from '../domain/result'

export interface Actor {
  readonly userId: string
  readonly employeeId: string | null
  readonly role: Role
  readonly email: string
  readonly name: string
}

export function actorCan(actor: Actor, resource: Resource, action: Action): boolean {
  return can(actor.role, resource, action)
}

/** Guard for use cases: returns Err instead of throwing, so callers stay uniform. */
export function authorize(actor: Actor, resource: Resource, action: Action): Result<true> {
  if (!actorCan(actor, resource, action)) {
    return Err(
      DomainError.forbidden(
        'FORBIDDEN',
        `Role "${actor.role}" may not ${action} ${resource.replace(/_/g, ' ')}`,
        { resource, action, role: actor.role },
      ),
    )
  }
  return Ok(true)
}

/**
 * Row-level guard. An `employee` may read attendance — but only their own.
 * Pass the owning employee id of the record being touched.
 */
export function authorizeOwned(
  actor: Actor,
  resource: Resource,
  action: Action,
  ownerEmployeeId: string | null,
): Result<true> {
  const base = authorize(actor, resource, action)
  if (!base.ok) return base

  if (scopeToSelf(actor.role) && ownerEmployeeId !== actor.employeeId) {
    return Err(
      DomainError.forbidden('FORBIDDEN_NOT_OWNER', 'You may only access your own records', {
        resource,
        action,
      }),
    )
  }
  return Ok(true)
}
