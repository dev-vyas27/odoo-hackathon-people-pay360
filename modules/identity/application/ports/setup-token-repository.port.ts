/**
 * Storage for password-setup links.
 *
 * The port deals in HASHES, never in tokens. The plaintext token exists in
 * exactly two places — the email, and the URL the user clicks — and it is the
 * use case's job to hash before it gets here. Keeping that in the signature
 * means nobody can accidentally persist the real thing.
 */

export interface SetupToken {
  id: string
  accountId: string
  purpose: 'invite' | 'reset'
  expiresAt: Date
  usedAt: Date | null
}

export interface SetupTokenRepositoryPort {
  /**
   * Issue a link. Implementations MUST invalidate any outstanding token for
   * this account first: two live links means revoking one achieves nothing.
   */
  issue(input: {
    accountId: string
    tokenHash: string
    purpose: 'invite' | 'reset'
    expiresAt: Date
  }): Promise<SetupToken>

  /** Look up by hash. Returns spent and expired tokens too — the use case decides. */
  findByHash(tokenHash: string): Promise<SetupToken | null>

  /** Mark redeemed. Returns false when it had already been used. */
  markUsed(id: string): Promise<boolean>
}
