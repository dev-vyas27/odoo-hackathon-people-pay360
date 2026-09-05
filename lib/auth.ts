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

export interface TokenPayload {
  sub: string
  employeeId: string | null
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
    userId: payload.sub,
    employeeId: payload.employeeId,
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

export async function setAuthCookie(token: string): Promise<void> {
  const store = await cookies()
  store.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  })
}

export async function clearAuthCookie(): Promise<void> {
  const store = await cookies()
  store.delete(AUTH_COOKIE)
}
