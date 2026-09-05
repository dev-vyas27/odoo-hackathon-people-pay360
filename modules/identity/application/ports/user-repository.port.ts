/**
 * What identity needs from storage — nothing more.
 *
 * Note it is not `IRepository<User>`: identity has exactly two lookups and two
 * writes. A narrow port is a narrow test double.
 */
import type { PageQuery, Paged } from '@/modules/shared'
import type { User, UserProps } from '../../domain/user'

export interface UserRepositoryPort {
  findByEmail(email: string): Promise<User | null>
  findById(id: string): Promise<User | null>
  findMany(query: PageQuery): Promise<Paged<User>>
  create(props: Omit<UserProps, 'id'>): Promise<User>
  update(id: string, props: Partial<Omit<UserProps, 'id'>>): Promise<User | null>
}
