'use client'

/**
 * ResourceForm — the ONE form component every module uses.
 *
 * Project rule: every input field in this app is driven by react-hook-form and
 * validated by zod. No exceptions, no ad-hoc useState forms. This component is
 * how that rule stays cheap to follow — you pass a zod schema and a field list,
 * you get validation, error messages, dirty tracking and submit handling.
 *
 * The same schema should be reused by the module's route handler so the client
 * and the server validate against one definition rather than two that drift.
 */
import { useEffect } from 'react'
import {
  useForm,
  useWatch,
  type DefaultValues,
  type FieldValues,
  type Path,
  type PathValue,
  type Resolver,
} from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { ZodType } from 'zod'
import { LuLoaderCircle } from 'react-icons/lu'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

export interface SelectOption {
  label: string
  value: string
}

/**
 * A field description. `name` is constrained to the schema's keys, so renaming a
 * field in the schema surfaces as a type error here rather than a silently dead
 * input at runtime.
 */
export interface FieldConfig<T extends FieldValues> {
  name: Path<T>
  label: string
  type?:
    | 'text'
    | 'email'
    | 'password'
    | 'number'
    | 'date'
    | 'datetime-local'
    | 'time'
    | 'textarea'
    | 'select'
    | 'checkbox'
  placeholder?: string
  description?: string
  options?: SelectOption[]
  disabled?: boolean
  /** Grid span out of 2 columns. Long fields want 2. */
  span?: 1 | 2
  /**
   * Optional heading this field belongs under.
   *
   * Nine inputs in one undifferentiated grid is a wall: the reader has to
   * discover for themselves that four of them are about where someone sits in
   * the organisation and two are about paying them. Grouping states it.
   *
   * Entirely opt-in — a form that names no sections renders exactly as before,
   * so every existing form is untouched. Fields are grouped in the order the
   * sections first appear, not alphabetically, because the order IS the
   * reading order.
   */
  section?: string
}

export interface ResourceFormProps<T extends FieldValues> {
  schema: ZodType<T>
  /**
   * A fixed list, or a function of the CURRENT values when one field's choices
   * depend on another's — a part-time employee should not be offered a 40-hour
   * schedule. Passing a function re-derives the list on every change.
   */
  fields: FieldConfig<T>[] | ((values: T) => FieldConfig<T>[])
  defaultValues?: DefaultValues<T>
  onSubmit: (values: T) => Promise<void> | void
  submitLabel?: string
  cancel?: React.ReactNode
  /**
   * Values that FOLLOW from other values, applied whenever the form changes.
   *
   * Return a patch of what should be true given the current values, or null for
   * "nothing to correct". Only keys whose value actually differs are written, so
   * this cannot loop, and a field the user has already set correctly is left
   * alone rather than being re-set on every keystroke.
   *
   * Use it for consequences, never for validation — a rule that can REJECT
   * belongs in the zod schema where the server enforces it too.
   */
  /**
   * Render as a record rather than an editor: every field disabled and no
   * submit button.
   *
   * For a role that may READ a thing but not change it. Without this such a
   * user got a fully editable form and a Save button that answered 403 — the
   * same "offered an action that cannot work" problem as an ungated create
   * button, just one click further in. The server refuses regardless; this is
   * about not asking someone to fill in a form that will be rejected.
   */
  readOnly?: boolean
  /**
   * Render on a card with a seated action bar.
   *
   * On by default, because every other block in the dashboard is a card and a
   * bare form floating on the page ground is the one surface that looks
   * unfinished. Turned off for the sign-in screens, where the column is already
   * a white sheet and a second frame inside it is a frame too many.
   */
  surface?: boolean
  derive?: (values: T) => Partial<T> | null
  /** Rendered above the buttons — warnings, computed totals, related records. */
  children?: React.ReactNode
  className?: string
}

/**
 * A form value as the DOM input for `type` expects to receive it.
 *
 * `<input type="date">` accepts ONLY `YYYY-MM-DD`; hand it a Date object and it
 * silently renders blank. Every screen holding a Date in `defaultValues` was
 * therefore showing an empty date box with the real value still in form state —
 * a contract's start date, an attendance check-in. Bridging here rather than in
 * each caller means no form has to remember.
 *
 * Everything is read and written in UTC, matching the app's formatters
 * (`timeZone: 'UTC'`) and `worked_on`. Rendering local time would shift the day
 * across midnight for anyone east or west of Greenwich.
 */
function toInputValue(type: FieldConfig<FieldValues>['type'], value: unknown): string {
  if (value === null || value === undefined || value === '') return ''
  if (type !== 'date' && type !== 'datetime-local') return String(value)

  const iso = value instanceof Date ? value.toISOString() : String(value)
  // `YYYY-MM-DD` is 10 characters, `YYYY-MM-DDTHH:mm` is 16.
  const width = type === 'date' ? 10 : 16
  return iso.length >= width ? iso.slice(0, width) : ''
}

/**
 * The inverse: what the input gives back, anchored to UTC.
 *
 * A `datetime-local` value carries no zone, so `new Date('2026-08-26T09:00')`
 * is parsed as LOCAL time — which would shift a stored check-in by the reader's
 * offset every time somebody opened and saved the form. Appending `Z` pins it
 * to the zone the value was displayed in.
 */
function fromInputValue(type: FieldConfig<FieldValues>['type'], raw: string): string | undefined {
  if (raw === '') return undefined
  if (type === 'datetime-local') return `${raw}:00.000Z`
  return raw
}

export function ResourceForm<T extends FieldValues>({
  schema,
  fields,
  defaultValues,
  onSubmit,
  submitLabel = 'Save',
  cancel,
  readOnly = false,
  surface = true,
  derive,
  children,
  className,
}: ResourceFormProps<T>) {
  const form = useForm<T>({
    /**
     * zod v4 and react-hook-form v7 disagree about the variance of the schema's
     * input vs output type, so the generic cannot be inferred through
     * zodResolver. The cast is confined to this single line: every public prop
     * above (fields, defaultValues, onSubmit) stays fully typed against T, so
     * callers get real type safety and only the wiring is loosened.
     */
    resolver: zodResolver(schema as never) as Resolver<T>,
    defaultValues,
    // Validate on blur so users are not shouted at mid-keystroke, then keep it
    // live once a field has already errored.
    mode: 'onTouched',
  })

  const { isSubmitting } = form.formState

  /**
   * `useWatch`, not `form.watch()`: the latter subscribes outside React's render
   * cycle and the React Compiler cannot memoise around it.
   */
  const values = useWatch({ control: form.control }) as T
  const fieldList = typeof fields === 'function' ? fields(values) : fields

  useEffect(() => {
    if (!derive) return
    const patch = derive(values)
    if (!patch) return
    for (const [name, next] of Object.entries(patch)) {
      const path = name as Path<T>
      // The guard is what makes this safe to run on every render: setValue only
      // fires when something genuinely changed, so it cannot feed itself.
      if (form.getValues(path) !== next) {
        form.setValue(path, next as PathValue<T, Path<T>>, {
          shouldDirty: true,
          shouldValidate: true,
        })
      }
    }
  }, [derive, values, form])

  /**
   * Fields in declaration order, bucketed by section. One bucket keyed
   * `undefined` when nothing is sectioned, which renders as today's single grid
   * with no heading — that is what keeps this change invisible to every form
   * that has not opted in.
   */
  const sections = fieldList.reduce<Array<{ title?: string; items: FieldConfig<T>[] }>>(
    (acc, field) => {
      const last = acc[acc.length - 1]
      if (last && last.title === field.section) last.items.push(field)
      else acc.push({ title: field.section, items: [field] })
      return acc
    },
    [],
  )

  const renderField = (field: FieldConfig<T>) => (
    <FormField
      key={field.name}
      control={form.control}
      name={field.name}
      render={({ field: rhf }) => (
        <FormItem className={cn('self-start', field.span === 2 && 'sm:col-span-2')}>
          {field.type === 'checkbox' ? (
            <FormLabel className="invisible">{field.label}</FormLabel>
          ) : (
            <FormLabel>{field.label}</FormLabel>
          )}
          {/**
           * The select is handled before the shared FormControl, and FormControl
           * wraps its TRIGGER instead.
           *
           * FormControl passes the field's id down with a Slot, and a Slot needs
           * a DOM element to land on. `<Select>` is a Radix context provider,
           * not an element, so the id went nowhere: every trigger rendered with
           * no id, the label's htmlFor pointed at nothing, and the control had
           * no accessible name — a screen reader announced "button, Full Time"
           * without saying which field. Wrapping the trigger fixes the
           * association, and is what makes `getByRole('combobox', { name })`
           * find these at all.
           */}
          {field.type === 'select' ? (
            <Select
              onValueChange={rhf.onChange}
              value={rhf.value ? String(rhf.value) : undefined}
              disabled={readOnly || field.disabled || isSubmitting}
            >
              <FormControl>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={field.placeholder ?? 'Select...'} />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {field.options?.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
          <FormControl>
            {field.type === 'textarea' ? (
              <Textarea
                {...rhf}
                value={rhf.value ?? ''}
                placeholder={field.placeholder}
                disabled={readOnly || field.disabled || isSubmitting}
                rows={4}
              />
            ) : field.type === 'checkbox' ? (
              <label className="flex h-9 items-center gap-2.5">
                <Checkbox
                  checked={Boolean(rhf.value)}
                  onCheckedChange={rhf.onChange}
                  disabled={readOnly || field.disabled || isSubmitting}
                />
                <span className="text-sm text-foreground">{field.label}</span>
              </label>
            ) : (
              <Input
                {...rhf}
                type={field.type ?? 'text'}
                value={toInputValue(field.type, rhf.value)}
                placeholder={field.placeholder}
                disabled={readOnly || field.disabled || isSubmitting}
                onChange={(e) => {
                  const raw = e.target.value
                  if (field.type === 'number') {
                    // Keep numbers as numbers so zod does not see "42".
                    rhf.onChange(raw === '' ? undefined : Number(raw))
                    return
                  }
                  rhf.onChange(
                    field.type === 'date' || field.type === 'datetime-local'
                      ? fromInputValue(field.type, raw)
                      : raw,
                  )
                }}
              />
            )}
          </FormControl>
          )}
          {field.description ? (
            <FormDescription>{field.description}</FormDescription>
          ) : null}
          <FormMessage />
        </FormItem>
      )}
    />
  )

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(async (values) => {
          await onSubmit(values)
        })}
        className={cn(
          surface ? 'overflow-hidden rounded-2xl border border-border bg-card shadow-sm' : 'space-y-6',
          className,
        )}
        noValidate
      >
        <div className={cn(surface ? 'space-y-8 p-6 sm:p-8' : 'space-y-6')}>
          {sections.map((section, index) => (
            <div key={section.title ?? `__unsectioned-${index}`} className="space-y-4">
              {section.title ? <h2 className="eyebrow">{section.title}</h2> : null}
              <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
                {section.items.map(renderField)}
              </div>
            </div>
          ))}

          {children}
        </div>

        <div
          className={cn(
            'flex items-center gap-3',
            surface
              ? 'border-t border-border bg-sunken px-6 py-4 sm:px-8'
              : 'pt-1',
          )}
        >
          {/* No submit at all when read-only — a disabled Save still invites a
              click and still says "you should be able to do this". */}
          {readOnly ? null : (
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
          )}
          {cancel}
        </div>
      </form>
    </Form>
  )
}
