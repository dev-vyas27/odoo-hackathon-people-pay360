


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
