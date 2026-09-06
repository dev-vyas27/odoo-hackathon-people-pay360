

export interface StoredDocument {
  ok: boolean
  
  key: string
  bytes: number
  
  reason?: string
  
  skipped?: boolean
}

export interface DocumentStoragePort {
  
  readonly configured: boolean

  put(key: string, body: Uint8Array, contentType: string): Promise<StoredDocument>

  

  viewUrl(key: string): Promise<string | null>
}
