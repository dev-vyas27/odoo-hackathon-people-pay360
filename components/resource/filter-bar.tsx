'use client'

/**
 * FilterBar — search + selects that live in the URL, not in component state.
 *
 * Putting filter state in `searchParams` buys three things for free: the back
 * button works, a filtered view is a shareable link (which is exactly what
 * SmartButton relies on), and a refresh does not silently reset what the user
 * is looking at. Local `useState` gives none of that.
 *
 * Reading the values back is `useFilterParams()` below, so a list screen never
 * parses the query string itself.
 */
import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { LuSearch, LuX } from 'react-icons/lu'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

export interface FilterOption {
  label: string
  value: string
}

export interface FilterDefinition {
  /** Query-string key. Becomes `filters.<name>` on the server. */
  name: string
  label: string
  options: FilterOption[]
}

export interface FilterBarProps {
  filters?: FilterDefinition[]
  searchPlaceholder?: string
  showSearch?: boolean
  /** Rendered on the right — usually a "New" button. */
  actions?: React.ReactNode
  className?: string
}

/** The sentinel Radix needs, because SelectItem forbids an empty string value. */
const ALL = '__all__'

export function FilterBar({
  filters = [],
  searchPlaceholder = 'Search...',
  showSearch = true,
  actions,
  className,
}: FilterBarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const [search, setSearch] = useState(params.get('search') ?? '')

  const apply = useCallback(
    (updates: Record<string, string | undefined>) => {
      const next = new URLSearchParams(params.toString())
      for (const [key, value] of Object.entries(updates)) {
        if (!value || value === ALL) next.delete(key)
        else next.set(key, value)
      }
      // Any filter change invalidates the current page number.
      next.delete('page')
      router.replace(`${pathname}?${next.toString()}`, { scroll: false })
    },
    [params, pathname, router],
  )

  /**
   * Debounce the search box. Without it every keystroke is a round trip, and
   * with a `router.replace` per character the URL history also thrashes.
   */
  useEffect(() => {
    if (!showSearch) return
    const current = params.get('search') ?? ''
    if (search === current) return
    const timer = setTimeout(() => apply({ search: search || undefined }), 300)
    return () => clearTimeout(timer)
  }, [search, params, apply, showSearch])

  const hasActiveFilters =
    (showSearch && Boolean(params.get('search'))) ||
    filters.some((f) => Boolean(params.get(f.name)))

  return (
    <div className={cn('flex flex-wrap items-center gap-3 pb-5', className)}>
      {showSearch ? (
        <div className="relative min-w-[14rem] flex-1 max-w-sm">
          <LuSearch
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-9"
            aria-label="Search"
          />
        </div>
      ) : null}

      {filters.map((filter) => (
        <Select
          key={filter.name}
          value={params.get(filter.name) ?? ALL}
          onValueChange={(value) => apply({ [filter.name]: value })}
        >
          <SelectTrigger className="w-[11rem]" aria-label={filter.label}>
            <SelectValue placeholder={filter.label} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All {filter.label.toLowerCase()}</SelectItem>
            {filter.options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}

      {hasActiveFilters ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSearch('')
            apply(Object.fromEntries([['search', undefined], ...filters.map((f) => [f.name, undefined] as const)]))
          }}
        >
          <LuX aria-hidden />
          Clear
        </Button>
      ) : null}

      {actions ? <div className="ml-auto flex items-center gap-2">{actions}</div> : null}
    </div>
  )
}

/**
 * Read the current filter state, ready to hand straight to `useResourceList`.
 *
 * `names` is the whitelist of filter keys this screen understands, so an
 * unrelated query param (say `?tab=history`) is not sent to the API as a filter
 * on a column that does not exist.
 */
export function useFilterParams(names: string[] = []): Record<string, string | number> {
  const params = useSearchParams()
  const result: Record<string, string | number> = {}

  const search = params.get('search')
  if (search) result.search = search

  const page = Number(params.get('page'))
  if (Number.isFinite(page) && page > 1) result.page = page

  for (const name of names) {
    const value = params.get(name)
    if (value) result[name] = value
  }

  return result
}
