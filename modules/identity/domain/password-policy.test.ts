


import { describe, expect, it } from 'vitest'
import { checkPassword, isPasswordAcceptable, PASSWORD_RULES } from './password-policy'

const codes = (password: string) => checkPassword(password).map((p) => p.code)

describe('checkPassword', () => {
  it('accepts a password meeting all three rules', () => {
    expect(isPasswordAcceptable('Str0ng!pass')).toBe(true)
    expect(checkPassword('Str0ng!pass')).toEqual([])
  })

  it('rejects one that is too short even when otherwise valid', () => {
    expect(codes('Ab!1')).toContain('too_short')
  })

  it('rejects one with no capital letter', () => {
    expect(codes('longenough!')).toEqual(['no_uppercase'])
  })

  it('rejects one with no special character', () => {
    expect(codes('LongEnough1')).toEqual(['no_special'])
  })

  it('reports every broken rule at once, not just the first', () => {
    
    
    expect(codes('pass')).toEqual(['too_short', 'no_uppercase', 'no_special'])
  })

  it('rejects anything past bcrypt‘s 72-byte truncation point', () => {
    expect(codes(`A!${'a'.repeat(80)}`)).toContain('too_long')
  })

  it('does not count whitespace as a special character', () => {
    
    
    expect(codes('Correct horse')).toEqual(['no_special'])
  })

  it('accepts a range of punctuation as special', () => {
    for (const char of ['!', '?', '@', '#', '-', '_', '£']) {
      expect(isPasswordAcceptable(`Password${char}`)).toBe(true)
    }
  })
})

describe('PASSWORD_RULES', () => {
  it('matches what checkPassword enforces', () => {
    
    
    const good = 'Str0ng!pass'
    expect(PASSWORD_RULES.every((rule) => rule.test(good))).toBe(true)
    expect(isPasswordAcceptable(good)).toBe(true)

    const bad = 'weak'
    expect(PASSWORD_RULES.every((rule) => rule.test(bad))).toBe(false)
    expect(isPasswordAcceptable(bad)).toBe(false)
  })
})
