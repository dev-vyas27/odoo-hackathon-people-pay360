/**
 * The ambient backdrop behind the signed-out screens.
 *
 * A skyline of bars drifting slowly to the left — the dashboard's own "salary
 * cost by department" chart, abstracted into a landscape. It is the product's
 * existing visual vocabulary rather than decoration borrowed from somewhere
 * else, which is the whole reason it is bars and not drifting orbs.
 *
 * ── Why this is drawn, not filmed ──────────────────────────────────────────
 *
 * A looping background video would be a megabyte or two, would decode on every
 * page load, would band on a flat plum field at any sane bitrate, and could not
 * follow the theme. This is a few hundred bytes of markup animated with two
 * transforms, so it is crisp at any viewport, reads the palette from the same
 * tokens as everything else, and stops dead for anyone who has asked for
 * reduced motion.
 *
 * ── Depth ─────────────────────────────────────────────────────────────────
 *
 * Two layers at different speeds, opacities and heights. Parallax is what keeps
 * a flat pan from reading as a slideshow: the near row overtakes the far one,
 * so the eye reads distance rather than a picture sliding past.
 *
 * Only the near row breathes. Animating both would double the composited nodes
 * for a difference nobody can see behind a card.
 *
 * Heights are a fixed table, never random — a random height would differ
 * between the server render and the client's, which React reports as a
 * hydration mismatch.
 */

/**
 * Far ridge: taller, slower.
 *
 * Thirty-two bars, not fourteen. At fourteen they were 100px wide and read as
 * buildings — a city skyline behind a payroll app, which is a picture of the
 * wrong thing. Narrow bars read as a chart, which is the point.
 */
const FAR = [
  30, 52, 38, 64, 24, 46, 72, 34, 56, 28, 60, 42, 50, 32, 68, 40, 48, 26, 58, 36, 54, 44, 62, 30,
  66, 38, 44, 56, 34, 50, 42, 58,
]

/** Near ridge: shorter, quicker, and the only one that breathes. */
const NEAR = [
  18, 32, 24, 42, 14, 28, 38, 20, 46, 16, 30, 22, 40, 26, 34, 19, 44, 23, 36, 29, 25, 39, 21, 33,
  27, 43, 17, 35, 31, 45, 20, 37,
]

/**
 * Two bars in the near ridge are green: a payrun reaching `paid`.
 *
 * The one saturated colour in the whole composition, and the only part of it
 * that means something — everything after sign-in uses that same green for the
 * same thing.
 */
const PAID = new Set([9, 22])

function Ridge({
  heights,
  paid,
  className,
  style,
  breathe = false,
}: {
  heights: number[]
  paid?: Set<number>
  className?: string
  style?: React.CSSProperties
  breathe?: boolean
}) {
  return (
    <div className={`flex h-full w-[200%] items-end gap-[0.45%] ${className ?? ''}`} style={style}>
      {/* Rendered twice so translating by exactly -50% loops seamlessly. */}
      {[0, 1].map((pass) =>
        heights.map((height, index) => (
          <div
            key={`${pass}-${index}`}
            className={`flex-1 rounded-t-sm ${
              paid?.has(index) ? 'bg-success/45' : 'bg-primary-300 dark:bg-primary-800'
            }`}
            style={{
              height: `${height}%`,
              transformOrigin: 'bottom',
              ...(breathe
                ? {
                    animation: `horizon-breathe ${7 + (index % 5)}s ease-in-out infinite`,
                    animationDelay: `${index * 0.37}s`,
                  }
                : undefined),
            }}
          />
        )),
      )}
    </div>
  )
}

export function PayrollHorizon() {
  return (
    <div
      aria-hidden
      /**
       * Masked so the bars dissolve upward into the page rather than ending on
       * a hard line, and pinned behind everything. `pointer-events-none` keeps
       * it out of the way of the form on top of it.
       */
      className="pointer-events-none absolute inset-x-0 bottom-0 h-[34vh] min-h-44 overflow-hidden [mask-image:linear-gradient(to_top,black_20%,transparent_95%)]"
    >
      <Ridge
        heights={FAR}
        className="absolute inset-x-0 bottom-0 h-full opacity-30"
        style={{ animation: 'horizon-drift 90s linear infinite' }}
      />
      <Ridge
        heights={NEAR}
        paid={PAID}
        breathe
        className="absolute inset-x-0 bottom-0 h-[58%] opacity-50"
        style={{ animation: 'horizon-drift 55s linear infinite' }}
      />
    </div>
  )
}
