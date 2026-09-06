/**
 * The product's mark: the badge from `public/icon.svg` and the wordmark beside
 * it.
 *
 * One component rather than an <Image> copied into four places, because the
 * signed-out screens are the only place the mark is ever set large and it has
 * to be identical in all of them — the sign-in card, the brand panel, and the
 * narrow column the password screens use.
 *
 * The badge is the SVG file itself, not a hand-copied inline path. Next serves
 * `.svg` unoptimised automatically, so this is one cached request that stays
 * crisp at any size, and the favicon and the sign-in mark cannot drift apart.
 */
import Image from 'next/image'
import { cn } from '@/lib/utils'

export function BrandBadge({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/icon.svg"
      alt=""
      aria-hidden
      width={size}
      height={size}
      priority
      className={cn('shrink-0', className)}
      style={{ width: size, height: size }}
    />
  )
}

export function BrandLockup({
  size = 32,
  className,
  /** On the plum panel the wordmark is set in white; `360` stays tinted. */
  inverted = false,
}: {
  size?: number
  className?: string
  inverted?: boolean
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <BrandBadge
        size={size}
        // A ring only when the badge sits on plum: its own ground is plum too,
        // and without an edge it dissolves into the panel behind it.
        className={inverted ? 'rounded-[28%] shadow-lg ring-1 ring-white/25' : 'rounded-[28%]'}
      />
      <span className={cn('text-lg font-medium', inverted && 'text-white')}>
        PeoplePay<span className={inverted ? 'text-primary-300' : 'text-primary'}>360</span>
      </span>
    </span>
  )
}
