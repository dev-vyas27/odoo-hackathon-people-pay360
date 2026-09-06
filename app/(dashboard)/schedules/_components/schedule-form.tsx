'use client'

import { useForm, useFieldArray, useWatch, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { LuLoaderCircle, LuPlus, LuTrash2 } from 'react-icons/lu'
import {
  computeWeeklyHours,
  createScheduleSchema,
  SCHEDULE_TYPE_LABELS,
  SCHEDULE_TYPES,
  type CreateScheduleBody,
  type ScheduleType,
} from '@/modules/employment/schemas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { WEEKDAY_OPTIONS } from '../../_components/options'

const SCHEDULE_TYPE_OPTIONS = SCHEDULE_TYPES.map((value) => ({
  value,
  label: SCHEDULE_TYPE_LABELS[value],
}))

export function ScheduleForm({
  defaultValues,
  submitLabel,
  onSubmit,
  cancel,
}: {
  defaultValues: CreateScheduleBody
  submitLabel: string
  onSubmit: (values: CreateScheduleBody) => Promise<void>
  cancel?: React.ReactNode
}) {
  const form = useForm<CreateScheduleBody>({
    
    
    resolver: zodResolver(createScheduleSchema as never) as Resolver<CreateScheduleBody>,
    defaultValues,
    mode: 'onTouched',
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'days' })
  
  
  const days = useWatch({ control: form.control, name: 'days' })
  const type = useWatch({ control: form.control, name: 'type' })
  const { isSubmitting } = form.formState

  
  const weeklyHours = computeWeeklyHours(
    (days ?? []).filter((d) => d?.start && d?.end) as CreateScheduleBody['days'],
  )

  return (
    <form
      onSubmit={form.handleSubmit(async (values) => onSubmit(values))}
      className="space-y-6"
      noValidate
    >
      <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="schedule-name">Name</Label>
          <Input id="schedule-name" placeholder="Standard 40h" {...form.register('name')} />
          {form.formState.errors.name && (
            <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="schedule-type">Type</Label>
          <Select
            value={type ?? undefined}
            onValueChange={(value) => form.setValue('type', value as ScheduleType, { shouldDirty: true, shouldValidate: true })}
          >
            <SelectTrigger id="schedule-type" className="w-full">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {SCHEDULE_TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.formState.errors.type && (
            <p className="text-sm text-destructive">{form.formState.errors.type.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Weekly hours</Label>
          <div className="flex h-9 items-center rounded-md border border-border bg-muted/40 px-3">
            <span className="tabular text-sm font-medium">{weeklyHours.toFixed(2)} h</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Calculated from the pattern below — not editable.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Weekly pattern</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ day: 1, start: '09:00', end: '17:00', breakMinutes: 60 })}
          >
            <LuPlus aria-hidden />
            Add day
          </Button>
        </div>

        {fields.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-10 text-center">
            <p className="text-sm text-muted-foreground">
              No working days yet. Add at least one.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="grid grid-cols-2 items-end gap-3 rounded-2xl border border-border p-3 sm:grid-cols-[1.4fr_1fr_1fr_1fr_auto]"
              >
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Day</Label>
                  <Select
                    value={String(days?.[index]?.day ?? 1)}
                    onValueChange={(v) =>
                      form.setValue(
                        `days.${index}.day`,
                        Number(v) as CreateScheduleBody['days'][number]['day'],
                        { shouldDirty: true },
                      )
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WEEKDAY_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Start</Label>
                  <Input type="time" {...form.register(`days.${index}.start`)} />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">End</Label>
                  <Input type="time" {...form.register(`days.${index}.end`)} />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Break (min)</Label>
                  <Input
                    type="number"
                    min={0}
                    {...form.register(`days.${index}.breakMinutes`, { valueAsNumber: true })}
                  />
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove this day"
                  onClick={() => remove(index)}
                >
                  <LuTrash2 className="size-4" aria-hidden />
                </Button>
              </div>
            ))}
          </div>
        )}

        {form.formState.errors.days && (
          <p className="text-sm text-destructive">
            {form.formState.errors.days.message ?? 'Check the working days above'}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 border-t border-border pt-5">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <LuLoaderCircle className="size-4 animate-spin" aria-hidden />
              Saving...
            </>
          ) : (
            submitLabel
          )}
        </Button>
        {cancel}
      </div>
    </form>
  )
}
