'use client'

/**
 * ResourceTable — one generic List view for every model in the system.
 *
 * The spec needs List views for ~12 aggregates. Hand-writing twelve tables
 * (each with sorting, paging, search, empty and loading states) is roughly a
 * day of work and twelve places for bugs to hide. Instead each module supplies
 * a column definition and this renders it.
 *
 * Adding a new model to the app is then a config object, not a component.
 *
 * ── Sorting ──────────────────────────────────────────────────────────────────
 * This used to hand `state.sorting` to TanStack's `getSortedRowModel`, which
 * reorders whatever rows happen to be in `data` — i.e. only the current page.
 * That is wrong the moment a list has a second page: click "Start" ascending
 * on page 2 and you get page 2's rows sorted among themselves, not rows 21-40
 * of the truly-sorted set. Sorting has to happen in SQL, so this component
 * does no reordering of its own at all. A column becomes sortable by giving it
 * `meta: { sortKey: '<api sort param>' }`; clicking its header writes
 * `?sort=&order=` into the URL via `useSort()`, `useFilterParams` forwards
 * those to the API, and the repository's own allowlist decides what `sortKey`
 * is actually allowed to mean. Only date columns are given a `sortKey` — see
 * the column defs on each list screen.
 */
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table'
import { LuArrowDown, LuArrowUp, LuChevronsUpDown, LuInbox } from 'react-icons/lu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useSort } from './filter-bar'

/**
 * Module augmentation is TanStack's documented way to type `columnDef.meta` —
 * see https://tanstack.com/table/latest/docs/api/core/column-def#meta. Adding
 * `sortKey` here is what lets a column def write `meta: { sortKey: 'startsOn' }`
 * with autocomplete and a type error on a typo, everywhere in the app, from
 * this one declaration.
 */
declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- required to match TanStack's ColumnMeta<TData, TValue> signature for declaration merging
  interface ColumnMeta<TData, TValue> {
    /**
     * The `sort=` value this column's header writes when clicked. Only set
     * this on a DATE column — the whole point of scoping it here is that a
     * column with no `sortKey` renders as plain, unclickable text.
     */
    sortKey?: string
  }
}

export interface ResourceTableProps<T> {
  data: T[]
  columns: ColumnDef<T, unknown>[]
  isLoading?: boolean
  onRowClick?: (row: T) => void
  /** Shown when there are genuinely no records (not while loading). */
  emptyMessage?: string
  emptyAction?: React.ReactNode
}

export function ResourceTable<T>({
  data,
  columns,
  isLoading = false,
  onRowClick,
  emptyMessage = 'No records yet',
  emptyAction,
}: ResourceTableProps<T>) {
  const { sort, order, toggle } = useSort()

  // The React Compiler lint rule cannot memoize TanStack's returned functions.
  // That is expected and safe here: the table instance is recreated per render
  // by design, exactly as TanStack documents.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    // No getSortedRowModel: sorting is server-side (see the comment at the top
    // of this file), so the rows TanStack sees are rendered in the order the
    // API returned them, full stop.
  })

  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="divide-y divide-border">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-4 w-1/5" />
              <Skeleton className="h-4 w-1/6" />
              <Skeleton className="h-4 w-1/12 ml-auto" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!data.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card py-16 text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-accent">
          <LuInbox className="size-5 text-primary" aria-hidden />
        </span>
        <p className="mt-4 text-base text-foreground">{emptyMessage}</p>
        {emptyAction ? <div className="mt-5">{emptyAction}</div> : null}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id} className="bg-sunken hover:bg-sunken">
              {group.headers.map((header) => {
                const sortKey = header.column.columnDef.meta?.sortKey
                const active = sortKey !== undefined && sortKey === sort
                return (
                  <TableHead
                    key={header.id}
                    aria-sort={
                      sortKey === undefined
                        ? undefined
                        : active
                          ? order === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : 'none'
                    }
                    className={cn(
                      sortKey !== undefined &&
                        'cursor-pointer select-none transition-colors hover:text-primary',
                    )}
                    onClick={sortKey !== undefined ? () => toggle(sortKey) : undefined}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                      {sortKey !== undefined ? (
                        active && order === 'asc' ? (
                          <LuArrowUp className="size-3" aria-hidden />
                        ) : active && order === 'desc' ? (
                          <LuArrowDown className="size-3" aria-hidden />
                        ) : (
                          <LuChevronsUpDown className="size-3 opacity-40" aria-hidden />
                        )
                      ) : null}
                    </span>
                  </TableHead>
                )
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              onClick={onRowClick ? () => onRowClick(row.original) : undefined}
              className={cn(onRowClick && 'cursor-pointer')}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id} className="text-sm">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
