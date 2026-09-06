


import { DomainError } from '@/modules/shared'

export type FormulaNode =
  | { kind: 'number'; value: number }
  | { kind: 'code'; code: string }
  | { kind: 'unary'; operand: FormulaNode }
  | { kind: 'binary'; op: '+' | '-' | '*' | '/'; left: FormulaNode; right: FormulaNode }
  | { kind: 'call'; fn: 'min' | 'max'; args: FormulaNode[] }

type Token =
  | { type: 'number'; value: number }
  | { type: 'identifier'; value: string }
  | { type: 'operator'; value: '+' | '-' | '*' | '/' }
  | { type: 'paren'; value: '(' | ')' }
  | { type: 'comma' }

const FUNCTIONS = ['min', 'max'] as const
type FunctionName = (typeof FUNCTIONS)[number]

function isFunctionName(value: string): value is FunctionName {
  return (FUNCTIONS as readonly string[]).includes(value)
}

function badFormula(code: string, message: string, expression: string): DomainError {
  return DomainError.validation(code, message, { expression })
}

function tokenize(expression: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  while (i < expression.length) {
    const ch = expression[i]

    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i += 1
      continue
    }

    if (ch === '+' || ch === '-' || ch === '*' || ch === '/') {
      tokens.push({ type: 'operator', value: ch })
      i += 1
      continue
    }

    if (ch === '(' || ch === ')') {
      tokens.push({ type: 'paren', value: ch })
      i += 1
      continue
    }

    if (ch === ',') {
      tokens.push({ type: 'comma' })
      i += 1
      continue
    }

    if (ch >= '0' && ch <= '9') {
      let literal = ''
      let seenDot = false
      while (i < expression.length) {
        const c = expression[i]
        if (c >= '0' && c <= '9') {
          literal += c
        } else if (c === '.' && !seenDot) {
          seenDot = true
          literal += c
        } else {
          break
        }
        i += 1
      }
      tokens.push({ type: 'number', value: Number(literal) })
      continue
    }

    if (isIdentifierStart(ch)) {
      let name = ''
      while (i < expression.length && isIdentifierPart(expression[i])) {
        name += expression[i]
        i += 1
      }
      tokens.push({ type: 'identifier', value: name })
      continue
    }

    throw badFormula(
      'FORMULA_INVALID_CHARACTER',
      `"${ch}" is not allowed in a formula. Use rule codes, numbers, + - * / ( ) and min/max.`,
      expression,
    )
  }

  return tokens
}

function isIdentifierStart(ch: string): boolean {
  return (ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z') || ch === '_'
}

function isIdentifierPart(ch: string): boolean {
  return isIdentifierStart(ch) || (ch >= '0' && ch <= '9')
}



export function parseFormula(expression: string): FormulaNode {
  const tokens = tokenize(expression)
  let position = 0

  const peek = (): Token | undefined => tokens[position]

  function parseExpression(): FormulaNode {
    let left = parseTerm()
    for (;;) {
      const token = peek()
      if (token?.type !== 'operator' || (token.value !== '+' && token.value !== '-')) break
      position += 1
      left = { kind: 'binary', op: token.value, left, right: parseTerm() }
    }
    return left
  }

  function parseTerm(): FormulaNode {
    let left = parseUnary()
    for (;;) {
      const token = peek()
      if (token?.type !== 'operator' || (token.value !== '*' && token.value !== '/')) break
      position += 1
      left = { kind: 'binary', op: token.value, left, right: parseUnary() }
    }
    return left
  }

  function parseUnary(): FormulaNode {
    const token = peek()
    if (token?.type === 'operator' && token.value === '-') {
      position += 1
      return { kind: 'unary', operand: parseUnary() }
    }
    return parsePrimary()
  }

  function parsePrimary(): FormulaNode {
    const token = peek()

    if (!token) {
      throw badFormula('FORMULA_UNEXPECTED_END', 'The formula ends unexpectedly.', expression)
    }

    if (token.type === 'number') {
      position += 1
      return { kind: 'number', value: token.value }
    }

    if (token.type === 'identifier') {
      position += 1
      const lowered = token.value.toLowerCase()
      if (isFunctionName(lowered)) return parseCall(lowered)
      return { kind: 'code', code: token.value.toUpperCase() }
    }

    if (token.type === 'paren' && token.value === '(') {
      position += 1
      const inner = parseExpression()
      expectClosingParen()
      return inner
    }

    throw badFormula(
      'FORMULA_UNEXPECTED_TOKEN',
      'The formula has a misplaced operator or bracket.',
      expression,
    )
  }

  function parseCall(fn: FunctionName): FormulaNode {
    const open = peek()
    if (open?.type !== 'paren' || open.value !== '(') {
      throw badFormula('FORMULA_CALL_NEEDS_PARENS', `${fn}() needs its arguments in brackets.`, expression)
    }
    position += 1

    const args: FormulaNode[] = [parseExpression()]
    for (;;) {
      const token = peek()
      if (token?.type !== 'comma') break
      position += 1
      args.push(parseExpression())
    }
    expectClosingParen()

    if (args.length < 2) {
      throw badFormula('FORMULA_CALL_NEEDS_ARGS', `${fn}() needs at least two arguments.`, expression)
    }
    return { kind: 'call', fn, args }
  }

  function expectClosingParen(): void {
    const token = peek()
    if (token?.type !== 'paren' || token.value !== ')') {
      throw badFormula('FORMULA_UNBALANCED_PARENS', 'A bracket in the formula is never closed.', expression)
    }
    position += 1
  }

  if (!tokens.length) {
    throw badFormula('FORMULA_EMPTY', 'A formula rule needs an expression.', expression)
  }

  const ast = parseExpression()

  if (position !== tokens.length) {
    throw badFormula(
      'FORMULA_TRAILING_INPUT',
      'The formula has leftover text after a complete expression.',
      expression,
    )
  }

  return ast
}



export function referencedCodes(node: FormulaNode): string[] {
  const found = new Set<string>()

  const walk = (n: FormulaNode): void => {
    switch (n.kind) {
      case 'code':
        found.add(n.code)
        return
      case 'unary':
        walk(n.operand)
        return
      case 'binary':
        walk(n.left)
        walk(n.right)
        return
      case 'call':
        n.args.forEach(walk)
        return
      case 'number':
        return
    }
  }

  walk(node)
  return [...found]
}


export function evaluateFormula(node: FormulaNode, resolve: (code: string) => number): number {
  switch (node.kind) {
    case 'number':
      return node.value
    case 'code':
      return resolve(node.code)
    case 'unary':
      return -evaluateFormula(node.operand, resolve)
    case 'call': {
      const values = node.args.map((arg) => evaluateFormula(arg, resolve))
      return node.fn === 'min' ? Math.min(...values) : Math.max(...values)
    }
    case 'binary': {
      const left = evaluateFormula(node.left, resolve)
      const right = evaluateFormula(node.right, resolve)
      switch (node.op) {
        case '+':
          return left + right
        case '-':
          return left - right
        case '*':
          return left * right
        case '/':
          if (right === 0) {
            throw DomainError.rule('FORMULA_DIVIDE_BY_ZERO', 'The formula divides by zero.')
          }
          return left / right
      }
    }
  }
}
