

import Link from 'next/link'
import { LuLock } from 'react-icons/lu'
import { ROLE_LABELS } from '@/modules/shared'
import { getActor } from '@/lib/auth'
import { landingPathFor } from '@/components/layout/nav-items'
import { Button } from '@/components/ui/button'

export default async function ForbiddenPage() {
  const actor = await getActor()

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="max-w-md space-y-4 text-center">
        <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-destructive/10">
          <LuLock className="size-5 text-destructive" aria-hidden />
        </span>
        <h1 className="text-xl font-medium tracking-tight">Not available to your role</h1>
        <p className="text-sm text-muted-foreground">
          {actor
            ? `You are signed in as ${ROLE_LABELS[actor.role]}, which cannot open this section. Ask an administrator if you need access.`
            : 'Sign in to continue.'}
        </p>
        <Button asChild>
          <Link href={actor ? landingPathFor(actor.role) : '/login'}>
            {actor ? 'Back to your dashboard' : 'Go to sign in'}
          </Link>
        </Button>
      </div>
    </div>
  )
}
