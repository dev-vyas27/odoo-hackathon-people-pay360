import { afterEach, describe, expect, it } from 'vitest'
import { secureCookieEnabled } from './auth'



const originalSecure = process.env.COOKIE_SECURE
const originalNodeEnv = process.env.NODE_ENV

function setEnv(key: 'COOKIE_SECURE' | 'NODE_ENV', value: string | undefined) {
  if (value === undefined) delete (process.env as Record<string, string | undefined>)[key]
  else (process.env as Record<string, string | undefined>)[key] = value
}

afterEach(() => {
  setEnv('COOKIE_SECURE', originalSecure)
  setEnv('NODE_ENV', originalNodeEnv)
})

describe('secureCookieEnabled', () => {
  it('defaults to secure in production when nothing is configured', () => {
    setEnv('COOKIE_SECURE', undefined)
    setEnv('NODE_ENV', 'production')
    expect(
      secureCookieEnabled(),
      'forgetting the variable in a real deployment must not downgrade anyone',
    ).toBe(true)
  })

  it('defaults to open in development', () => {
    setEnv('COOKIE_SECURE', undefined)
    setEnv('NODE_ENV', 'development')
    expect(secureCookieEnabled()).toBe(false)
  })

  it('honours an explicit opt-out, which is how a local HTTP demo signs in', () => {
    setEnv('COOKIE_SECURE', 'false')
    setEnv('NODE_ENV', 'production')
    expect(secureCookieEnabled()).toBe(false)
  })

  it('honours an explicit opt-in even outside production', () => {
    setEnv('COOKIE_SECURE', 'true')
    setEnv('NODE_ENV', 'development')
    expect(secureCookieEnabled()).toBe(true)
  })

  it('treats any other value as unset rather than as truthy', () => {
    setEnv('COOKIE_SECURE', 'yes')
    setEnv('NODE_ENV', 'production')
    expect(secureCookieEnabled(), '"yes" is not "true" — fall back to the safe default').toBe(true)

    setEnv('NODE_ENV', 'development')
    expect(secureCookieEnabled()).toBe(false)
  })
})
