'use client'

/**
 * Pagination — writes `?page=` so it composes with FilterBar.
 *
 * Renders nothing when there is only one page. A pager under a three-row table
 * is visual noise that makes an app feel like a scaffold.
 */
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { LuChevronLeft, LuChevronRight } from 'react-icons/lu'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface PaginationProps {
  page: number
  pages: number
  total: number
  limit: number
  className?: string
}

export function Pagination({ page, pages, total, limit, className }: PaginationProps) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  if (pages <= 1) return null

  const goTo = (next: number) => {
    const query = new URLSearchParams(params.toString())
    if (next <= 1) query.delete('page')
    else query.set('page', String(next))
    router.replace(`${pathname}?${query.toString()}`, { scroll: false })
  }

  const first = (page - 1) * limit + 1
  const last = Math.min(page * limit, total)

  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3 pt-4', className)}>
      <p className="text-sm text-muted-foreground">
        <span className="tabular">
          {first}–{last}
        </span>{' '}
        of <span className="tabular">{total}</span>
      </p>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => goTo(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <LuChevronLeft aria-hidden />
          Previous
        </Button>
        <span className="tabular px-1 text-sm text-muted-foreground">
          {page} / {pages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => goTo(page + 1)}
          disabled={page >= pages}
          aria-label="Next page"
        >
          Next
          <LuChevronRight aria-hidden />
        </Button>
      </div>
    </div>
  )
}
