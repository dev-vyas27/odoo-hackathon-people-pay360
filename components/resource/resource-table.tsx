'use client'



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



declare module '@tanstack/react-table' {
  
  interface ColumnMeta<TData, TValue> {
    


    sortKey?: string
  }
}

export interface ResourceTableProps<T> {
  data: T[]
  columns: ColumnDef<T, unknown>[]
  isLoading?: boolean
  onRowClick?: (row: T) => void
  
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

  
  
  
  
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    
    
    
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
