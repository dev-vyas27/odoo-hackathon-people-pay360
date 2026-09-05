/**
 * Composition root.
 *
 * The ONE place where interfaces are bound to concrete implementations. Nothing
 * else in the codebase calls `new SomeMongoRepository()`. That is what makes the
 * Dependency Inversion Principle real here: use cases name a port, this file
 * decides what satisfies it, and a test can decide differently.
 *
 * Lazily built and cached on globalThis so Next's dev hot-reload does not
 * rebuild the graph (and re-subscribe every event handler) on each edit.
 */
import { InMemoryEventBus, type IEventBus } from './application/event-bus'

export interface Container {
  eventBus: IEventBus
  /**
   * Modules register their own factories here as they are built.
   * Each owner adds their slice — see the per-developer plans in docs/plans/.
   */
  registry: Map<string, unknown>
}

declare global {
  var __pp360_container: Container | undefined
}

function build(): Container {
  const eventBus = new InMemoryEventBus()
  return { eventBus, registry: new Map() }
}

export function container(): Container {
  if (!global.__pp360_container) {
    global.__pp360_container = build()
  }
  return global.__pp360_container
}

/** Typed accessor so modules avoid casting at every call site. */
export function resolve<T>(key: string, factory: () => T): T {
  const c = container()
  if (!c.registry.has(key)) c.registry.set(key, factory())
  return c.registry.get(key) as T
}
