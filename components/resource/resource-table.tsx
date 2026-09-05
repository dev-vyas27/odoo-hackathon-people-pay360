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
 */
import { useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
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
  const [sorting, setSorting] = useState<SortingState>([])

  // The React Compiler lint rule cannot memoize TanStack's returned functions.
  // That is expected and safe here: the table instance is recreated per render
  // by design, exactly as TanStack documents.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border overflow-hidden">
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
      <div className="rounded-lg border border-dashed border-border py-16 text-center">
        <LuInbox className="mx-auto size-8 text-muted-foreground/60" aria-hidden />
        <p className="mt-3 text-sm text-muted-foreground">{emptyMessage}</p>
        {emptyAction ? <div className="mt-4">{emptyAction}</div> : null}
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border overflow-x-auto">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id} className="bg-muted/40 hover:bg-muted/40">
              {group.headers.map((header) => {
                const sortable = header.column.getCanSort()
                const dir = header.column.getIsSorted()
                return (
                  <TableHead
                    key={header.id}
                    className={cn(
                      'text-xs uppercase tracking-wide text-muted-foreground',
                      sortable && 'cursor-pointer select-none',
                    )}
                    onClick={sortable ? header.column.getToggleSortingHandler() : undefined}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                      {sortable ? (
                        dir === 'asc' ? (
                          <LuArrowUp className="size-3" aria-hidden />
                        ) : dir === 'desc' ? (
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
