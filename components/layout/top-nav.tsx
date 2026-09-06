'use client'



import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LuMenu } from 'react-icons/lu'
import type { CurrentUser } from '@/modules/shared'
import { navItemsFor } from '@/components/layout/nav-items'
import { UserMenu } from '@/components/layout/user-menu'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('text-base font-medium tracking-tight text-foreground', className)}>
      PeoplePay<span className="text-primary">360</span>
    </span>
  )
}

export function TopNav({ user }: { user: CurrentUser }) {
  const pathname = usePathname()
  const items = navItemsFor(user.role)

  
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  const pill = (active: boolean) =>
    cn(
      'rounded-xl px-3.5 py-1.5 text-sm transition-colors',
      active
        ? 'bg-accent font-medium text-primary'
        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
    )

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[90rem] items-center gap-2 px-4 sm:px-6">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="md:hidden" aria-label="Open menu">
              <LuMenu aria-hidden />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-6">
            <SheetTitle className="mb-6">
              <Wordmark />
            </SheetTitle>
            <nav className="flex flex-col gap-1">
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                  className={cn(
                    'rounded-md px-3 py-2 text-sm transition-colors',
                    isActive(item.href)
                      ? 'bg-accent font-medium text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </SheetContent>
        </Sheet>

        <Link href="/" className="shrink-0 rounded-md px-1 py-1">
          <Wordmark />
        </Link>

        {
}
        <span className="mx-2 hidden h-6 w-px bg-border md:block" aria-hidden />

        <nav className="hidden items-center gap-1 md:flex">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? 'page' : undefined}
              className={pill(isActive(item.href))}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  )
}
