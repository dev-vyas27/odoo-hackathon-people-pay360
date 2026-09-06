

import { getActor } from '@/lib/auth'
import { can } from '@/modules/shared'
import { AttendanceDetail } from '../_components/attendance-detail'

export default async function AttendanceDetailPage({ params }: PageProps<'/attendance/[id]'>) {
  
  const { id } = await params
  const actor = await getActor()

  return <AttendanceDetail id={id} canCorrect={actor ? can(actor.role, 'attendance', 'update') : false} />
}
