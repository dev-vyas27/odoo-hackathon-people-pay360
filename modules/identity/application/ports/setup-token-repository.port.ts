



export interface SetupToken {
  id: string
  accountId: string
  purpose: 'invite' | 'reset'
  expiresAt: Date
  usedAt: Date | null
}

export interface SetupTokenRepositoryPort {
  


  issue(input: {
    accountId: string
    tokenHash: string
    purpose: 'invite' | 'reset'
    expiresAt: Date
  }): Promise<SetupToken>

  
  findByHash(tokenHash: string): Promise<SetupToken | null>

  
  markUsed(id: string): Promise<boolean>
}
