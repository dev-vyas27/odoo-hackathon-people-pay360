/**
 * The password rule, in one place.
 *
 * Stated once and imported by the zod schema, so the set-password form, the
 * admin reset field and the API all enforce exactly the same thing. A policy
 * that lives in three regexes is a policy that will disagree with itself.
 *
 * The requirements, as asked for:
 *   at least 8 characters
 *   at least one capital letter
 *   at least one special character
 *
 * Deliberately NOT here: a maximum complexity score, forced rotation, or a
 * digit requirement nobody asked for. Every extra rule pushes people towards
 * `Password1!` and a sticky note.
 */

export const PASSWORD_MIN_LENGTH = 8
/** bcrypt silently truncates past 72 bytes, so anything longer is a false sense of security. */
export const PASSWORD_MAX_LENGTH = 72

/** Anything that is not a letter, a digit, or whitespace. */
const SPECIAL = /[^A-Za-z0-9\s]/
const UPPERCASE = /[A-Z]/

export interface PasswordProblem {
  code: 'too_short' | 'too_long' | 'no_uppercase' | 'no_special'
  message: string
}

/**
 * Every rule the password breaks, not just the first.
 *
 * Returning all of them means the form can show "needs a capital letter AND a
 * special character" in one pass, instead of making someone submit three times
 * to discover three rules.
 */
export function checkPassword(password: string): PasswordProblem[] {
  const problems: PasswordProblem[] = []

  if (password.length < PASSWORD_MIN_LENGTH) {
    problems.push({
      code: 'too_short',
      message: `Use at least ${PASSWORD_MIN_LENGTH} characters`,
    })
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    problems.push({
      code: 'too_long',
      message: `Keep it under ${PASSWORD_MAX_LENGTH} characters`,
    })
  }
  if (!UPPERCASE.test(password)) {
    problems.push({ code: 'no_uppercase', message: 'Include a capital letter' })
  }
  if (!SPECIAL.test(password)) {
    problems.push({
      code: 'no_special',
      message: 'Include a special character, for example ! ? @ or #',
    })
  }

  return problems
}

export function isPasswordAcceptable(password: string): boolean {
  return checkPassword(password).length === 0
}

/** One line for a zod message, which only gets to show a single string. */
export function describeProblems(problems: PasswordProblem[]): string {
  return problems.map((p) => p.message).join('. ')
}

/** Rendered as a checklist under the field, so the rules are visible up front. */
export const PASSWORD_RULES: Array<{ label: string; test: (password: string) => boolean }> = [
  {
    label: `At least ${PASSWORD_MIN_LENGTH} characters`,
    test: (p) => p.length >= PASSWORD_MIN_LENGTH,
  },
  { label: 'One capital letter', test: (p) => UPPERCASE.test(p) },
  { label: 'One special character', test: (p) => SPECIAL.test(p) },
]
