


import type { PageQuery, Paged } from '@/modules/shared'
import type { Account, AccountProps } from '../../domain/account'

export interface AccountRepositoryPort {
  findByEmail(email: string): Promise<Account | null>
  findById(id: string): Promise<Account | null>
  findMany(query: PageQuery): Promise<Paged<Account>>
  
  create(props: Omit<AccountProps, 'id'>): Promise<Account>
  update(id: string, props: Partial<Omit<AccountProps, 'id'>>): Promise<Account | null>
  


  revokeLogin(id: string): Promise<Account | null>
}
