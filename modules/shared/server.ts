/**
 * Server-only half of the shared kernel.
 *
 * `modules/shared/index.ts` is imported by CLIENT components — the permissions
 * table drives which nav links render — so anything reachable from that barrel
 * ends up in the browser bundle. Exporting the persistence base class from
 * there pulled `lib/db.ts` and the whole `pg` driver into the client build,
 * which fails with "Module not found: Can't resolve 'dns'".
 *
 * Server-side building blocks therefore live behind this second entry point.
 * Repositories import from '@/modules/shared/server'; components import from
 * '@/modules/shared'. The split IS the boundary and the production build
 * enforces it — a client component that reaches here fails to compile.
 *
 * Deliberately no `import 'server-only'`: that package throws when resolved
 * outside a bundler, which would break `npm run seed` and the smoke scripts,
 * both of which legitimately run this code in plain Node.
 */
export { BaseSqlRepository, type SqlValue } from './infrastructure/sql-repository'
