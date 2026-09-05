/**
 * Composition root.
 *
 * The ONE place where interfaces are bound to concrete implementations. Nothing
 * else in the codebase calls `new PostgresSomethingRepository()`. That is what makes the
 * Dependency Inversion Principle real here: use cases name a port, this file
 * decides what satisfies it, and a test can decide differently.
 *
 * Lazily built and cached on globalThis so Next's dev hot-reload does not
 * rebuild the graph (and re-subscribe every event handler) on each edit.
 */
import { InMemoryEventBus, type IEventBus } from './application/event-bus'
import type { PortKey } from './contracts/port-keys'

export interface Container {
  eventBus: IEventBus
  /**
   * Modules register their own factories here as they are built.
   * Each owner adds their slice — see the per-developer plans in docs/plans/.
   */
  registry: Map<string, unknown>
  /** Cross-module ports, keyed by PORT_KEYS. See providePort/usePort below. */
  ports: Map<PortKey, unknown>
}

declare global {
  var __pp360_container: Container | undefined
}

function build(): Container {
  const eventBus = new InMemoryEventBus()
  return { eventBus, registry: new Map(), ports: new Map() }
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

/**
 * Publish an implementation of a cross-module port.
 *
 * Called from the providing module's own registration function, which
 * `lib/bootstrap.ts` invokes once per process. The provider decides what
 * satisfies the contract; the consumer never learns which module it was.
 *
 * The factory is lazy so registering a port does not open a database
 * connection at import time.
 */
export function providePort<T>(key: PortKey, factory: () => T): void {
  const c = container()
  if (!c.ports.has(key)) c.ports.set(key, factory)
}

/**
 * Consume a cross-module port.
 *
 * Returns `null` when nobody has provided it yet — which is the normal state
 * for the first half of the project. Callers are expected to degrade
 * gracefully (an empty list, a zero) rather than crash, so a half-integrated
 * app still renders. `portOr` makes that the default.
 *
 * Named `getPort` rather than `usePort`: a `use` prefix makes the React hooks
 * lint rule treat every call site as a hook and reject it inside a plain
 * function, which is where all of these are called from.
 */
export function getPort<T>(key: PortKey): T | null {
  const factory = container().ports.get(key) as (() => T) | undefined
  return factory ? factory() : null
}

/** `getPort` with an explicit null-object fallback. Prefer this in use cases. */
export function portOr<T>(key: PortKey, fallback: T): T {
  return getPort<T>(key) ?? fallback
}
