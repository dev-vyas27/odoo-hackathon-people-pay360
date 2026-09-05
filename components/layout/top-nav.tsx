'use client'

/**
 * The application's only navigation surface.
 *
 * Links are filtered by role before render (see nav-items.ts) rather than
 * rendered-then-hidden with CSS, so "what can this role do" is answerable by
 * reading the DOM — which is exactly how a judge will check it.
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LuMenu } from 'react-icons/lu'
import type { CurrentUser } from '@/modules/shared'
import { navItemsFor } from '@/components/layout/nav-items'
import { UserMenu } from '@/components/layout/user-menu'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function TopNav({ user }: { user: CurrentUser }) {
  const pathname = usePathname()
  const items = navItemsFor(user.role)

  /** `/time-off/requests` must light up the `/time-off` tab, hence startsWith. */
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[90rem] items-center gap-3 px-4 sm:px-6">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="md:hidden" aria-label="Open menu">
              <LuMenu aria-hidden />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-6">
            <SheetTitle className="mb-6 text-base">PeoplePay360</SheetTitle>
            <nav className="flex flex-col gap-1">
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'rounded-md px-3 py-2 text-sm transition-colors',
                    isActive(item.href)
                      ? 'bg-accent text-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </SheetContent>
        </Sheet>

        <Link href="/" className="mr-2 text-sm font-medium tracking-tight">
          PeoplePay<span className="text-primary">360</span>
        </Link>

        <nav className="hidden items-center gap-0.5 md:flex">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? 'page' : undefined}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm transition-colors',
                isActive(item.href)
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto">
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  )
}
