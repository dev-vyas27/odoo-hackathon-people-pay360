


import { LEAVE_UNITS } from '@/modules/shared'
import { ALLOCATION_STATUSES } from '@/modules/timeoff/schemas'

const humanize = (value: string) =>
  value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

export const ALLOCATION_STATUS_OPTIONS = ALLOCATION_STATUSES.map((status) => ({
  value: status,
  label: humanize(status),
}))

export const UNIT_OPTIONS = LEAVE_UNITS.map((unit) => ({
  value: unit,
  label: unit === 'day' ? 'Days' : 'Hours',
}))
