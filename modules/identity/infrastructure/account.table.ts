


import type { Role } from '@/modules/shared'


export interface AccountRow {
  id: string
  email: string
  name: string
  role: Role
  is_active: boolean
  created_at: Date
  updated_at: Date
  


  password_hash?: string | null
  
  has_login?: boolean
}

export const ACCOUNTS_TABLE = 'employees'




export const ACCOUNT_SELECTION =
  '"id", "email", "name", "role", "is_active", "created_at", "updated_at", (password_hash IS NOT NULL) AS has_login'

export const ACCOUNT_COLUMNS = [
  'id',
  'email',
  'name',
  'role',
  'is_active',
  'created_at',
  'updated_at',
] as const
