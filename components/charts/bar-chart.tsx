'use client'

/**
 * A horizontal bar chart, in about 60 lines of SVG.
 *
 * No charting library. Two reasons: recharts and friends are ~90KB of client
 * JavaScript for two charts, and every one of them wants its own colour system
 * that then disagrees with `globals.css`. Bars are rectangles.
 *
 * Horizontal rather than vertical because the labels are department names —
 * vertical bars would need rotated text, which is harder to read and harder to
 * get right at every viewport width.
 */
import type { SeriesPoint } from '@/modules/shared'
import { cn } from '@/lib/utils'

export interface BarChartProps {
  data: SeriesPoint[]
  /** Formats the value for the label at the end of each bar. */
  format?: (value: number) => string
  emptyMessage?: string
  className?: string
}

/** The five chart hues from globals.css. Do not introduce new ones. */
const SERIES_COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
]

export function BarChart({
  data,
  format = (v) => v.toLocaleString(),
  emptyMessage = 'No data for this period',
  className,
}: BarChartProps) {
  if (data.length === 0) {
    return (
      <p className={cn('py-10 text-center text-sm text-muted-foreground', className)}>
        {emptyMessage}
      </p>
    )
  }

  // Scale to the largest bar, never to zero — a single-value chart would
  // otherwise divide by zero and render nothing.
  const max = Math.max(...data.map((point) => point.value), 1)

  return (
    <ul className={cn('space-y-3', className)}>
      {data.map((point, index) => {
        const share = (point.value / max) * 100
        return (
          <li key={point.label} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-4 text-sm">
              <span className="truncate">{point.label}</span>
              <span className="tabular shrink-0 text-muted-foreground">
                {format(point.value)}
              </span>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={`${point.label}: ${format(point.value)}`}
            >
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{
                  width: `${Math.max(share, 1.5)}%`,
                  backgroundColor: SERIES_COLORS[index % SERIES_COLORS.length],
                }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
