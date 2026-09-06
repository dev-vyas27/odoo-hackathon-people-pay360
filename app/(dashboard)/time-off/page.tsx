/**
 * `/time-off` — Requests is the section's home.
 *
 * Spec B4: "Requests are accessed exclusively via Time Off > Requests in the
 * top navigation." The nav points at /time-off, so this is what makes that
 * sentence true.
 */
import { redirect } from 'next/navigation'

export default function TimeOffIndex() {
  redirect('/time-off/requests')
}
