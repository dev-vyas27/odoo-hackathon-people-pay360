/**
 * Client-safe surface of `analytics`. See `modules/identity/schemas.ts` for why
 * this exists: the index barrel reaches ports backed by the `pg` driver.
 */
export {
  dashboardFilterSchema,
  type DashboardFilterValues,
} from './interface/dashboard.schema'
export type { DashboardView } from './application/get-dashboard.use-case'
