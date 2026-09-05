'use client'

/**
 * A sparkline-style area chart for the monthly trend, drawn as one SVG path.
 *
 * `preserveAspectRatio="none"` with a viewBox lets it stretch to any container
 * width without recalculating anything on resize — no ResizeObserver, no
 * measurement pass, no layout thrash. The cost is that stroke width scales too,
 * which `vectorEffect="non-scaling-stroke"` cancels out.
 *
 * The baseline is always zero rather than the minimum value. Starting the axis
 * at the minimum is the classic way to make a 2% change look like a cliff, and
 * this is a chart about money.
 */
import type { SeriesPoint } from '@/modules/shared'
import { cn } from '@/lib/utils'

export interface LineChartProps {
  data: SeriesPoint[]
  format?: (value: number) => string
  emptyMessage?: string
  className?: string
}

const WIDTH = 100
const HEIGHT = 32

export function LineChart({
  data,
  format = (v) => v.toLocaleString(),
  emptyMessage = 'No history yet',
  className,
}: LineChartProps) {
  if (data.length < 2) {
    return (
      <p className={cn('py-10 text-center text-sm text-muted-foreground', className)}>
        {emptyMessage}
      </p>
    )
  }

  const max = Math.max(...data.map((p) => p.value), 1)
  const step = WIDTH / (data.length - 1)

  const points = data.map((point, index) => ({
    x: index * step,
    y: HEIGHT - (point.value / max) * HEIGHT,
    point,
  }))

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  // Close the path down to the baseline to fill the area underneath.
  const area = `${line} L ${WIDTH} ${HEIGHT} L 0 ${HEIGHT} Z`

  const latest = data[data.length - 1]

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="h-32 w-full"
        role="img"
        aria-label={`Monthly trend, latest ${latest.label}: ${format(latest.value)}`}
      >
        <path d={area} fill="var(--color-chart-1)" fillOpacity="0.12" />
        <path
          d={line}
          fill="none"
          stroke="var(--color-chart-1)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {points.map((p) => (
          <circle
            key={p.point.label}
            cx={p.x}
            cy={p.y}
            r="1.5"
            fill="var(--color-chart-1)"
            vectorEffect="non-scaling-stroke"
          >
            <title>{`${p.point.label}: ${format(p.point.value)}`}</title>
          </circle>
        ))}
      </svg>

      {/* Month labels under the line. Every other one on narrow screens, so
          twelve months do not collapse into an unreadable smear. */}
      <ol className="mt-2 flex justify-between text-[0.65rem] text-muted-foreground">
        {data.map((point, index) => (
          <li
            key={point.label}
            className={cn(index % 2 === 1 && 'hidden sm:block')}
            aria-hidden
          >
            {point.label}
          </li>
        ))}
      </ol>
    </div>
  )
}
