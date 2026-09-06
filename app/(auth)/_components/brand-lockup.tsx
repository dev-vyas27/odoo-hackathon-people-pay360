


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
        
        
        className={inverted ? 'rounded-[28%] shadow-lg ring-1 ring-white/25' : 'rounded-[28%]'}
      />
      <span className={cn('text-lg font-medium', inverted && 'text-white')}>
        PeoplePay<span className={inverted ? 'text-primary-300' : 'text-primary'}>360</span>
      </span>
    </span>
  )
}
