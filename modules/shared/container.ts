


import { InMemoryEventBus, type IEventBus } from './application/event-bus'
import type { PortKey } from './contracts/port-keys'

export interface Container {
  eventBus: IEventBus
  


  registry: Map<string, unknown>
  
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


export function resolve<T>(key: string, factory: () => T): T {
  const c = container()
  if (!c.registry.has(key)) c.registry.set(key, factory())
  return c.registry.get(key) as T
}



export function providePort<T>(key: PortKey, factory: () => T): void {
  const c = container()
  if (!c.ports.has(key)) c.ports.set(key, factory)
}



export function getPort<T>(key: PortKey): T | null {
  const factory = container().ports.get(key) as (() => T) | undefined
  return factory ? factory() : null
}


export function portOr<T>(key: PortKey, fallback: T): T {
  return getPort<T>(key) ?? fallback
}
