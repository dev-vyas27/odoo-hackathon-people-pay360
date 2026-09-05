/**
 * The demo-seed feature flag. One function, consulted by both the endpoint and
 * the login screen, so the button cannot be visible while the route is off (or
 * — far worse — the route live while the button is hidden).
 *
 * `DEMO_SEED_ENABLED=true` turns on:
 *   - the "Load demo data" panel on /login
 *   - POST /api/demo/seed, which is UNAUTHENTICATED by necessity: it exists to
 *     create the accounts you would need in order to authenticate
 *
 * That combination is a public endpoint that writes to your database. It is
 * appropriate for a hackathon cluster and for nothing else.
 *
 * Three deliberate choices:
 *
 *   1. It is opt-IN. An unset variable is off. Getting this backwards means a
 *      deploy that forgot to set it ships wide open.
 *   2. Only the exact string 'true' counts. "1", "yes" and "TRUE" are all off,
 *      so a typo fails closed rather than silently enabling it.
 *   3. It is NOT a NEXT_PUBLIC_ variable. The login page is a server component
 *      and reads it directly; keeping it server-side means the flag's value is
 *      never baked into a client bundle where it could be flipped.
 */
export function isDemoSeedEnabled(): boolean {
  return process.env.DEMO_SEED_ENABLED === 'true'
}
