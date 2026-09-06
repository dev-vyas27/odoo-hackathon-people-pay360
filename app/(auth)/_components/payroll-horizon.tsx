





const FAR = [
  30, 52, 38, 64, 24, 46, 72, 34, 56, 28, 60, 42, 50, 32, 68, 40, 48, 26, 58, 36, 54, 44, 62, 30,
  66, 38, 44, 56, 34, 50, 42, 58,
]


const NEAR = [
  18, 32, 24, 42, 14, 28, 38, 20, 46, 16, 30, 22, 40, 26, 34, 19, 44, 23, 36, 29, 25, 39, 21, 33,
  27, 43, 17, 35, 31, 45, 20, 37,
]



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
      {}
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
