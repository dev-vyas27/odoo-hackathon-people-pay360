/**
 * Public surface of the "analytics" module.
 *
 * Everything other modules are allowed to use is re-exported HERE and nowhere
 * else. Internals under domain/, application/, infrastructure/ and interface/
 * are private and the ESLint boundary rule will reject imports that reach in.
 *
 * Owner: Dev A — see docs/plans/DEV-A-platform.md.
 *
 * Analytics is a pure CONSUMER: it registers no ports and owns no tables. It
 * reads five ports and composes them, which is why it can be built before the
 * modules that supply them exist.
 */
export { getDashboard } from './interface/dashboard.controller'
export type { DashboardView } from './application/get-dashboard.use-case'
