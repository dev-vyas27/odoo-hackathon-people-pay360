'use client'



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
  
  name: string
  label: string
  options: FilterOption[]
}

export interface FilterBarProps {
  filters?: FilterDefinition[]
  searchPlaceholder?: string
  showSearch?: boolean
  
  actions?: React.ReactNode
  className?: string
}


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
      
      next.delete('page')
      router.replace(`${pathname}?${next.toString()}`, { scroll: false })
    },
    [params, pathname, router],
  )

  


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



export function useFilterParams(names: string[] = []): Record<string, string | number> {
  const params = useSearchParams()
  const result: Record<string, string | number> = {}

  const search = params.get('search')
  if (search) result.search = search

  const page = Number(params.get('page'))
  if (Number.isFinite(page) && page > 1) result.page = page

  const sort = params.get('sort')
  if (sort) result.sort = sort

  const order = params.get('order')
  if (order === 'asc' || order === 'desc') result.order = order

  for (const name of names) {
    const value = params.get(name)
    if (value) result[name] = value
  }

  return result
}



export function useSort(): {
  sort: string | null
  order: 'asc' | 'desc'
  toggle: (column: string) => void
} {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const sort = params.get('sort')
  const order = params.get('order') === 'asc' ? 'asc' : 'desc'

  const toggle = useCallback(
    (column: string) => {
      const next = new URLSearchParams(params.toString())
      if (sort !== column) {
        next.set('sort', column)
        next.set('order', 'asc')
      } else if (order === 'asc') {
        next.set('order', 'desc')
      } else {
        next.delete('sort')
        next.delete('order')
      }
      
      next.delete('page')
      router.replace(`${pathname}?${next.toString()}`, { scroll: false })
    },
    [params, pathname, router, sort, order],
  )

  return { sort, order, toggle }
}
