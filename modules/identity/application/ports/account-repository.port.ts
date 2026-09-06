/**
 * What identity needs from storage — nothing more.
 *
 * Note it is not `IRepository<Account>`: identity has three lookups and two
 * writes. A narrow port is a narrow test double.
 *
 * `create` takes an id, unlike most repositories: since 0010 an account is an
 * employee row, so granting a login usually means writing credentials onto a
 * person who already exists rather than inventing a new one.
 */
import type { PageQuery, Paged } from '@/modules/shared'
import type { Account, AccountProps } from '../../domain/account'

export interface AccountRepositoryPort {
  findByEmail(email: string): Promise<Account | null>
  findById(id: string): Promise<Account | null>
  findMany(query: PageQuery): Promise<Paged<Account>>
  /** Create the employee row AND its credentials in one go. */
  create(props: Omit<AccountProps, 'id'>): Promise<Account>
  update(id: string, props: Partial<Omit<AccountProps, 'id'>>): Promise<Account | null>
  /**
   * Clear `password_hash`, leaving the employee record intact.
   *
   * Its own method because `update` COALESCEs every column — passing
   * `passwordHash: null` there means "leave it alone", so there is no way to
   * express "set it to NULL" through that path. Rather than complicate the
   * common case with sentinels, revoking gets one honest statement.
   */
  revokeLogin(id: string): Promise<Account | null>
}
