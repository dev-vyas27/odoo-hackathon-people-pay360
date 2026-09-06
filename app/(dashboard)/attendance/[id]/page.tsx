/**
 * Server shell for the attendance record.
 *
 * The actor lives on the server, so the permission decision is made here and
 * handed down as a plain boolean — the same shape the dashboard layout uses to
 * give TopNav its user. Doing it this way means the client bundle never needs a
 * "who am I" round trip before it can render.
 */
import { getActor } from '@/lib/auth'
import { can } from '@/modules/shared'
import { AttendanceDetail } from '../_components/attendance-detail'

export default async function AttendanceDetailPage({ params }: PageProps<'/attendance/[id]'>) {
  // Next 16: params is a promise.
  const { id } = await params
  const actor = await getActor()

  return <AttendanceDetail id={id} canCorrect={actor ? can(actor.role, 'attendance', 'update') : false} />
}
