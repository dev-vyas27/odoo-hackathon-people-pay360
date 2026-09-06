/**
 * Token issuing/verification + reading the current Actor from cookies.
 *
 * Kept in lib/ rather than modules/identity because it touches next/headers.
 * modules/identity stays framework-free; this file is the adapter.
 */
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import type { Actor, Role } from '@/modules/shared'

const SECRET = process.env.JWT_SECRET
export const AUTH_COOKIE = 'pp360_token'
const MAX_AGE_SECONDS = 60 * 60 * 12 // one hackathon shift

/**
 * `sub` is the employee id — the only identity there is since 0010 folded
 * `users` into `employees`. Tokens issued before that migration carried a
 * separate user id in `sub`, so they no longer resolve to anybody; they are
 * rejected as unauthenticated, which is the correct outcome for a credential
 * that names a row that has ceased to exist.
 */
export interface TokenPayload {
  sub: string
  role: Role
  email: string
  name: string
}

function secret(): string {
  if (!SECRET) throw new Error('JWT_SECRET is not set. See .env.example.')
  return SECRET
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, secret(), { expiresIn: MAX_AGE_SECONDS })
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, secret()) as TokenPayload
  } catch {
    return null
  }
}

export function toActor(payload: TokenPayload): Actor {
  return {
    employeeId: payload.sub,
    role: payload.role,
    email: payload.email,
    name: payload.name,
  }
}

/**
 * Next 16: cookies() is async. Awaiting is mandatory, not stylistic.
 * Returns null when unauthenticated — callers decide whether that is fatal.
 */
export async function getActor(): Promise<Actor | null> {
  const store = await cookies()
  const token = store.get(AUTH_COOKIE)?.value
  if (!token) return null
  const payload = verifyToken(token)
  return payload ? toActor(payload) : null
}

/** For route handlers and server components that cannot proceed anonymously. */
export async function requireActor(): Promise<Actor> {
  const actor = await getActor()
  if (!actor) throw new Error('UNAUTHENTICATED')
  return actor
}

/**
 * Should the session cookie carry `Secure`?
 *
 * Configuration only. No request header feeds this decision, deliberately.
 *
 * The problem being solved: `NODE_ENV === 'production'` alone means a
 * production build served over plain HTTP — `npm run build && npm start` on a
 * laptop, which is how a demo usually gets shown — issues a `Secure` cookie the
 * browser then refuses to store. Login returns 200 and the app bounces straight
 * back to /login with no error anywhere, because nothing actually failed.
 *
 * The tempting fix is to read `x-forwarded-proto`. Do not. Plenty of proxies
 * APPEND to a client-supplied value instead of replacing it, so the leftmost
 * entry is whatever the caller sent: a request carrying `x-forwarded-proto:
 * http` arrives as `http,https` and downgrades the victim's own session cookie
 * off TLS. `origin` and `referer` are worse still — freely set by the caller
 * and no evidence of transport security whatever.
 *
 * So the transport is stated at deploy time rather than inferred per request:
 *
 *   COOKIE_SECURE=true    always set Secure (any TLS deployment)
 *   COOKIE_SECURE=false   never set it (a local HTTP demo, opting out knowingly)
 *   unset                 secure in production, open in development
 *
 * The default is the safe one, so forgetting the variable in a real deployment
 * cannot silently downgrade anybody.
 *
 * Named `secureCookieEnabled` rather than `useSecureCookie` for the same reason
 * `container.ts` has `getPort` and not `usePort`: a `use` prefix makes the React
 * hooks lint rule treat every call site as a hook and reject it.
 */
export function secureCookieEnabled(): boolean {
  const explicit = process.env.COOKIE_SECURE
  if (explicit === 'true') return true
  if (explicit === 'false') return false
  return process.env.NODE_ENV === 'production'
}

export async function setAuthCookie(token: string): Promise<void> {
  const store = await cookies()
  store.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: secureCookieEnabled(),
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  })
}

export async function clearAuthCookie(): Promise<void> {
  const store = await cookies()
  store.delete(AUTH_COOKIE)
}
