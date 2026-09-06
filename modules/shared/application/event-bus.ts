

import type { DomainEvent, DomainEventType, EventOf } from '../domain/domain-event'

export type EventHandler<T extends DomainEventType> = (event: EventOf<T>) => Promise<void> | void

export interface IEventBus {
  publish(event: DomainEvent): Promise<void>
  subscribe<T extends DomainEventType>(type: T, handler: EventHandler<T>): () => void
}

type AnyHandler = (event: DomainEvent) => Promise<void> | void

export class InMemoryEventBus implements IEventBus {
  private handlers = new Map<DomainEventType, Set<AnyHandler>>()

  subscribe<T extends DomainEventType>(type: T, handler: EventHandler<T>): () => void {
    const set = this.handlers.get(type) ?? new Set<AnyHandler>()
    const erased = handler as unknown as AnyHandler
    set.add(erased)
    this.handlers.set(type, set)
    return () => set.delete(erased)
  }

  async publish(event: DomainEvent): Promise<void> {
    const set = this.handlers.get(event.type)
    if (!set?.size) return

    for (const handler of set) {
      try {
        await handler(event)
      } catch (reason) {
        
        console.error(`[event-bus] handler for "${event.type}" threw:`, reason)
      }
    }
  }
}
