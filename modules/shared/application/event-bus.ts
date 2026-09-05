/**
 * In-process event bus. One instance per server process (see container.ts).
 *
 * Handlers are awaited sequentially and a throwing handler is logged but never
 * allowed to fail the publisher: approving a leave request must not roll back
 * because a downstream listener has a bug.
 */
import type { DomainEvent, DomainEventType, EventOf } from '../domain/domain-event'

export type EventHandler<T extends DomainEventType> = (event: EventOf<T>) => Promise<void> | void

export interface IEventBus {
  publish(event: DomainEvent): Promise<void>
  subscribe<T extends DomainEventType>(type: T, handler: EventHandler<T>): () => void
}

/** Storage type: handlers are heterogeneous, so the map holds the erased form. */
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
        // A failing subscriber must not break the publisher's transaction.
        console.error(`[event-bus] handler for "${event.type}" threw:`, reason)
      }
    }
  }
}
