'use client'

/**
 * Light / Dark / System, as a menu rather than a two-state switch.
 *
 * A switch can only say "light or dark", which loses the option most people
 * actually want: follow the machine. Three explicit choices also make the
 * current one legible — with a switch you cannot tell whether you are on dark
 * because you chose it or because it is night.
 *
 * The trigger icon shows the RESOLVED theme (what you are looking at); the tick
 * inside shows the CHOICE (what you asked for). Those differ under "System",
 * which is the whole point of showing both.
 */
import { LuCheck, LuMonitor, LuMoon, LuSun } from 'react-icons/lu'
import type { IconType } from 'react-icons'
import { THEMES, type Theme } from '@/lib/theme'
import { useTheme } from '@/components/theme/theme-provider'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const OPTION: Record<Theme, { label: string; hint: string; icon: IconType }> = {
  light: { label: 'Light', hint: 'Always light', icon: LuSun },
  dark: { label: 'Dark', hint: 'Always dark', icon: LuMoon },
  system: { label: 'System', hint: 'Follow this device', icon: LuMonitor },
}

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, resolvedTheme, setTheme, mounted } = useTheme()

  /**
   * Before mount the server and the client disagree about the theme by
   * definition, so the trigger renders a neutral icon at the same size. Not
   * rendering at all would make the header jump when it appeared.
   */
  const TriggerIcon = !mounted ? LuMonitor : resolvedTheme === 'dark' ? LuMoon : LuSun

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className={cn('text-muted-foreground hover:text-foreground', className)}
          aria-label={mounted ? `Theme: ${OPTION[theme].label}` : 'Theme'}
        >
          <TriggerIcon aria-hidden />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {THEMES.map((option) => {
          const { label, hint, icon: Icon } = OPTION[option]
          const active = mounted && theme === option
          return (
            <DropdownMenuItem
              key={option}
              onSelect={() => setTheme(option)}
              className="gap-2.5"
              aria-current={active ? 'true' : undefined}
            >
              <Icon aria-hidden className={active ? 'text-primary' : undefined} />
              <span className="flex-1">
                <span className="block">{label}</span>
                <span className="block text-xs text-muted-foreground">{hint}</span>
              </span>
              {active ? <LuCheck className="size-4 text-primary" aria-hidden /> : null}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
