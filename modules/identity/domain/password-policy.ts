



export const PASSWORD_MIN_LENGTH = 8

export const PASSWORD_MAX_LENGTH = 72


const SPECIAL = /[^A-Za-z0-9\s]/
const UPPERCASE = /[A-Z]/

export interface PasswordProblem {
  code: 'too_short' | 'too_long' | 'no_uppercase' | 'no_special'
  message: string
}



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


export function describeProblems(problems: PasswordProblem[]): string {
  return problems.map((p) => p.message).join('. ')
}


export const PASSWORD_RULES: Array<{ label: string; test: (password: string) => boolean }> = [
  {
    label: `At least ${PASSWORD_MIN_LENGTH} characters`,
    test: (p) => p.length >= PASSWORD_MIN_LENGTH,
  },
  { label: 'One capital letter', test: (p) => UPPERCASE.test(p) },
  { label: 'One special character', test: (p) => SPECIAL.test(p) },
]
