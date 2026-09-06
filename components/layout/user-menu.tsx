'use client'



import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LuChevronDown, LuLogOut, LuShieldCheck } from 'react-icons/lu'
import { ROLE_LABELS, can, type CurrentUser } from '@/modules/shared'
import { apiFetch } from '@/lib/api-client'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function UserMenu({ user }: { user: CurrentUser }) {
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)

  const signOut = async () => {
    setSigningOut(true)
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' })
    } finally {
      router.push('/login')
      router.refresh()
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 pl-1.5">
          <span className="flex size-6 items-center justify-center rounded-full bg-primary/12 text-[0.65rem] text-primary">
            {initials(user.name)}
          </span>
          <span className="hidden max-w-[10rem] truncate sm:inline">{user.name}</span>
          <LuChevronDown className="size-3 opacity-60" aria-hidden />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="space-y-0.5">
          <p className="truncate text-sm">{user.name}</p>
          <p className="truncate text-xs font-normal text-muted-foreground">{user.email}</p>
          <p className="text-xs font-normal text-primary">{ROLE_LABELS[user.role]}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {can(user.role, 'user', 'read') ? (
          <DropdownMenuItem asChild>
            <Link href="/admin/users">
              <LuShieldCheck aria-hidden />
              User administration
            </Link>
          </DropdownMenuItem>
        ) : null}

        <DropdownMenuItem onSelect={signOut} disabled={signingOut}>
          <LuLogOut aria-hidden />
          {signingOut ? 'Signing out...' : 'Sign out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
