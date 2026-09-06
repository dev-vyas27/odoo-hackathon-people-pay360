/**
 * Postgres implementation of SetupTokenRepositoryPort.
 */
import { query, queryOne, transaction } from '@/lib/db'
import type {
  SetupToken,
  SetupTokenRepositoryPort,
} from '../application/ports/setup-token-repository.port'

const TABLE = 'password_setup_tokens'
const SELECTION = '"id", "account_id", "purpose", "expires_at", "used_at"'

interface TokenRow extends Record<string, unknown> {
  id: string
  account_id: string
  purpose: 'invite' | 'reset'
  expires_at: Date
  used_at: Date | null
}

const toDomain = (row: TokenRow): SetupToken => ({
  id: row.id,
  accountId: row.account_id,
  purpose: row.purpose,
  expiresAt: row.expires_at,
  usedAt: row.used_at,
})

export class PostgresSetupTokenRepository implements SetupTokenRepositoryPort {
  /**
   * Delete-then-insert in one transaction.
   *
   * Issuing a new invitation must kill the old one, or "resend the link"
   * quietly leaves the previous email working — and an admin who resent
   * because the first went to the wrong address has achieved nothing.
   */
  async issue(input: {
    accountId: string
    tokenHash: string
    purpose: 'invite' | 'reset'
    expiresAt: Date
  }): Promise<SetupToken> {
    return transaction(async (client) => {
      await client.query(`DELETE FROM "${TABLE}" WHERE account_id = $1 AND used_at IS NULL`, [
        input.accountId,
      ])

      const { rows } = await client.query<TokenRow>(
        `INSERT INTO "${TABLE}" (account_id, token_hash, purpose, expires_at)
         VALUES ($1, $2, $3, $4)
         RETURNING ${SELECTION}`,
        [input.accountId, input.tokenHash, input.purpose, input.expiresAt],
      )
      return toDomain(rows[0])
    })
  }

  async findByHash(tokenHash: string): Promise<SetupToken | null> {
    const row = await queryOne<TokenRow>(
      `SELECT ${SELECTION} FROM "${TABLE}" WHERE token_hash = $1`,
      [tokenHash],
    )
    return row ? toDomain(row) : null
  }

  /**
   * `AND used_at IS NULL` in the WHERE, not a read-then-write.
   *
   * Two tabs redeeming the same link at once would both pass a prior "is it
   * used?" check. Making the update itself conditional means the database
   * decides, and exactly one of them gets a row back.
   */
  async markUsed(id: string): Promise<boolean> {
    const rows = await query<{ id: string }>(
      `UPDATE "${TABLE}" SET used_at = now()
       WHERE id = $1 AND used_at IS NULL
       RETURNING id`,
      [id],
    )
    return rows.length > 0
  }
}
