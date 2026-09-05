/**
 * Next runs `register()` once when the server starts, before any request is
 * handled. It is the right place to wire the container: doing it lazily from
 * the first request that happens to need a port means the first request pays
 * for it and a race between two concurrent first requests is possible.
 */
export async function register() {
  // Guarded so the edge runtime (which has no database) never evaluates the
  // Postgres adapters. This project's proxy runs on Node, but the guard is one
  // line and the failure without it is opaque.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { bootstrap } = await import('@/lib/bootstrap')
  bootstrap()
}
