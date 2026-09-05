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
import {
  useForm,
  type DefaultValues,
  type FieldValues,
  type Path,
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
  type?: 'text' | 'email' | 'password' | 'number' | 'date' | 'time' | 'textarea' | 'select' | 'checkbox'
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
  fields: FieldConfig<T>[]
  defaultValues?: DefaultValues<T>
  onSubmit: (values: T) => Promise<void> | void
  submitLabel?: string
  cancel?: React.ReactNode
  /** Rendered above the buttons — warnings, computed totals, related records. */
  children?: React.ReactNode
  className?: string
}

export function ResourceForm<T extends FieldValues>({
  schema,
  fields,
  defaultValues,
  onSubmit,
  submitLabel = 'Save',
  cancel,
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
   * Fields in declaration order, bucketed by section. One bucket keyed
   * `undefined` when nothing is sectioned, which renders as today's single grid
   * with no heading — that is what keeps this change invisible to every form
   * that has not opted in.
   */
  const sections = fields.reduce<Array<{ title?: string; items: FieldConfig<T>[] }>>(
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
        <FormItem className={cn(field.span === 2 && 'sm:col-span-2')}>
          {field.type !== 'checkbox' && <FormLabel>{field.label}</FormLabel>}
          <FormControl>
            {field.type === 'textarea' ? (
              <Textarea
                {...rhf}
                value={rhf.value ?? ''}
                placeholder={field.placeholder}
                disabled={field.disabled || isSubmitting}
                rows={4}
              />
            ) : field.type === 'select' ? (
              <Select
                onValueChange={rhf.onChange}
                value={rhf.value ? String(rhf.value) : undefined}
                disabled={field.disabled || isSubmitting}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={field.placeholder ?? 'Select...'} />
                </SelectTrigger>
                <SelectContent>
                  {field.options?.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : field.type === 'checkbox' ? (
              <label className="flex items-center gap-2.5 pt-1">
                <Checkbox
                  checked={Boolean(rhf.value)}
                  onCheckedChange={rhf.onChange}
                  disabled={field.disabled || isSubmitting}
                />
                <span className="text-sm text-foreground">{field.label}</span>
              </label>
            ) : (
              <Input
                {...rhf}
                type={field.type ?? 'text'}
                value={rhf.value ?? ''}
                placeholder={field.placeholder}
                disabled={field.disabled || isSubmitting}
                // Keep numbers as numbers so zod does not see "42".
                onChange={(e) =>
                  rhf.onChange(
                    field.type === 'number'
                      ? e.target.value === ''
                        ? undefined
                        : Number(e.target.value)
                      : e.target.value,
                  )
                }
              />
            )}
          </FormControl>
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
        className={cn('space-y-6', className)}
        noValidate
      >
        {sections.map((section, index) => (
          <div key={section.title ?? `__unsectioned-${index}`} className="space-y-4">
            {section.title ? (
              <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {section.title}
              </h2>
            ) : null}
            <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
              {section.items.map(renderField)}
            </div>
          </div>
        ))}

        {children}

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
    </Form>
  )
}
