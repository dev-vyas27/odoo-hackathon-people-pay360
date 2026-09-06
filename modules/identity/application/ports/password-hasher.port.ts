/**
 * Hashing behind a port so the login use case can be unit-tested in
 * microseconds. bcrypt is deliberately slow — that is its job — and a test
 * suite that pays 300ms per case stops being run.
 */
export interface PasswordHasherPort {
  hash(plain: string): Promise<string>
  compare(plain: string, hash: string): Promise<boolean>
}
