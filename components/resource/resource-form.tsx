"use client";



import { useEffect } from "react";
import {
  useForm,
  useWatch,
  type DefaultValues,
  type FieldValues,
  type Path,
  type PathValue,
  type Resolver,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ZodType } from "zod";
import { LuLoaderCircle } from "react-icons/lu";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface SelectOption {
  label: string;
  value: string;
}



export interface FieldConfig<T extends FieldValues> {
  name: Path<T>;
  label: string;
  type?:
    | "text"
    | "email"
    | "password"
    | "number"
    | "date"
    | "datetime-local"
    | "time"
    | "textarea"
    | "select"
    | "checkbox";
  placeholder?: string;
  description?: string;
  options?: SelectOption[];
  disabled?: boolean;
  
  span?: 1 | 2;
  


  section?: string;
}

export interface ResourceFormProps<T extends FieldValues> {
  schema: ZodType<T>;
  


  fields: FieldConfig<T>[] | ((values: T) => FieldConfig<T>[]);
  defaultValues?: DefaultValues<T>;
  onSubmit: (values: T) => Promise<void> | void;
  submitLabel?: string;
  cancel?: React.ReactNode;
  


  


  readOnly?: boolean;
  


  surface?: boolean;
  


  submitFullWidth?: boolean;
  derive?: (values: T) => Partial<T> | null;
  
  children?: React.ReactNode;
  className?: string;
}



function toInputValue(
  type: FieldConfig<FieldValues>["type"],
  value: unknown,
): string {
  if (value === null || value === undefined || value === "") return "";
  if (type !== "date" && type !== "datetime-local") return String(value);

  const iso = value instanceof Date ? value.toISOString() : String(value);
  
  const width = type === "date" ? 10 : 16;
  return iso.length >= width ? iso.slice(0, width) : "";
}



function fromInputValue(
  type: FieldConfig<FieldValues>["type"],
  raw: string,
): string | undefined {
  if (raw === "") return undefined;
  if (type === "datetime-local") return `${raw}:00.000Z`;
  return raw;
}

export function ResourceForm<T extends FieldValues>({
  schema,
  fields,
  defaultValues,
  onSubmit,
  submitLabel = "Save",
  cancel,
  readOnly = false,
  surface = true,
  submitFullWidth = false,
  derive,
  children,
  className,
}: ResourceFormProps<T>) {
  const form = useForm<T>({
    


    resolver: zodResolver(schema as never) as Resolver<T>,
    defaultValues,
    
    
    mode: "onTouched",
  });

  const { isSubmitting } = form.formState;

  


  const values = useWatch({ control: form.control }) as T;
  const fieldList = typeof fields === "function" ? fields(values) : fields;

  useEffect(() => {
    if (!derive) return;
    const patch = derive(values);
    if (!patch) return;
    for (const [name, next] of Object.entries(patch)) {
      const path = name as Path<T>;
      
      
      if (form.getValues(path) !== next) {
        form.setValue(path, next as PathValue<T, Path<T>>, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
    }
  }, [derive, values, form]);

  


  const sections = fieldList.reduce<
    Array<{ title?: string; items: FieldConfig<T>[] }>
  >((acc, field) => {
    const last = acc[acc.length - 1];
    if (last && last.title === field.section) last.items.push(field);
    else acc.push({ title: field.section, items: [field] });
    return acc;
  }, []);

  const renderField = (field: FieldConfig<T>) => (
    <FormField
      key={field.name}
      control={form.control}
      name={field.name}
      render={({ field: rhf }) => (
        <FormItem
          className={cn("self-start", field.span === 2 && "sm:col-span-2")}
        >
          {field.type === "checkbox" ? (
            <>
              <FormControl>
                <div className="flex items-center py-1">
                  <label className="flex items-center gap-2.5 ml-auto cursor-pointer">
                    <Checkbox
                      checked={Boolean(rhf.value)}
                      onCheckedChange={rhf.onChange}
                      disabled={readOnly || field.disabled || isSubmitting}
                    />
                    <span className="text-sm font-medium text-foreground">
                      {field.label}
                    </span>
                  </label>
                </div>
              </FormControl>
              {field.description ? (
                <FormDescription>{field.description}</FormDescription>
              ) : null}
              <FormMessage />
            </>
          ) : (
            <>
              <FormLabel>{field.label}</FormLabel>
              {

}
              {field.type === "select" ? (
                <Select
                  onValueChange={rhf.onChange}
                  value={rhf.value ? String(rhf.value) : undefined}
                  disabled={readOnly || field.disabled || isSubmitting}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={field.placeholder ?? "Select..."} />
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
                  {field.type === "textarea" ? (
                    <Textarea
                      {...rhf}
                      value={rhf.value ?? ""}
                      placeholder={field.placeholder}
                      disabled={readOnly || field.disabled || isSubmitting}
                      rows={4}
                    />
                  ) : (
                    <Input
                      {...rhf}
                      type={field.type ?? "text"}
                      value={toInputValue(field.type, rhf.value)}
                      placeholder={field.placeholder}
                      disabled={readOnly || field.disabled || isSubmitting}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (field.type === "number") {
                          
                          rhf.onChange(raw === "" ? undefined : Number(raw));
                          return;
                        }
                        rhf.onChange(
                          field.type === "date" || field.type === "datetime-local"
                            ? fromInputValue(field.type, raw)
                            : raw,
                        );
                      }}
                    />
                  )}
                </FormControl>
              )}
              {field.description ? (
                <FormDescription>{field.description}</FormDescription>
              ) : null}
              <FormMessage />
            </>
          )}
        </FormItem>
      )}
    />
  );

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(async (values) => {
          await onSubmit(values);
        })}
        className={cn(
          surface
            ? "overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
            : "space-y-6",
          className,
        )}
        noValidate
      >
        <div className={cn(surface ? "space-y-8 p-6 sm:p-8" : "space-y-6")}>
          {sections.map((section, index) => {
            const isSingleCheckboxSection =
              Boolean(section.title) &&
              section.items.length === 1 &&
              section.items[0].type === "checkbox";

            if (isSingleCheckboxSection) {
              const field = section.items[0];
              return (
                <div
                  key={section.title ?? `__unsectioned-${index}`}
                  className="space-y-2"
                >
                  <div className="flex items-center gap-4">
                    <h2 className="eyebrow">{section.title}</h2>
                    <FormField
                      key={field.name}
                      control={form.control}
                      name={field.name}
                      render={({ field: rhf }) => (
                        <FormControl>
                          <label className="flex items-center gap-2.5 cursor-pointer">
                            <Checkbox
                              checked={Boolean(rhf.value)}
                              onCheckedChange={rhf.onChange}
                              disabled={
                                readOnly || field.disabled || isSubmitting
                              }
                            />
                            <span className="text-sm font-medium text-foreground">
                              {field.label}
                            </span>
                          </label>
                        </FormControl>
                      )}
                    />
                  </div>
                  {field.description ? (
                    <FormDescription>{field.description}</FormDescription>
                  ) : null}
                </div>
              );
            }

            return (
              <div
                key={section.title ?? `__unsectioned-${index}`}
                className="space-y-4"
              >
                {section.title ? (
                  <h2 className="eyebrow">{section.title}</h2>
                ) : null}
                <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
                  {section.items.map(renderField)}
                </div>
              </div>
            );
          })}

          {children}
        </div>

        <div
          className={cn(
            "flex items-center gap-3",
            submitFullWidth && "flex-col items-stretch",
            surface
              ? "border-t border-border bg-sunken px-6 py-4 sm:px-8"
              : "pt-1",
          )}
        >
          {
}
          {readOnly ? null : (
            <Button
              type="submit"
              disabled={isSubmitting}
              className={cn(submitFullWidth && "w-full")}
            >
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
  );
}
