


import type { Action, Resource, Role } from '../contracts/permissions'
import { can, scopeToSelf } from '../contracts/permissions'
import { DomainError } from '../domain/domain-error'
import type { Result } from '../domain/result'
import { Err, Ok } from '../domain/result'



export interface Actor {
  readonly employeeId: string
  readonly role: Role
  readonly email: string
  readonly name: string
}

export function actorCan(actor: Actor, resource: Resource, action: Action): boolean {
  return can(actor.role, resource, action)
}


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
