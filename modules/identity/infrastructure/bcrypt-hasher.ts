/**
 * bcrypt adapter. The only file in the codebase that imports bcryptjs.
 *
 * Cost 10: roughly 60ms per hash on a laptop. High enough to be a real speed
 * bump for an attacker, low enough that seeding 25 users does not take a minute.
 */
import bcrypt from 'bcryptjs'
import type { PasswordHasherPort } from '../application/ports/password-hasher.port'

const COST = 10

export class BcryptHasher implements PasswordHasherPort {
  hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, COST)
  }

  compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash)
  }
}
