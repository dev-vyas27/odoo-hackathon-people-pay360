



export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    
    readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

interface Envelope<T> {
  data?: T
  error?: { code: string; message: string; details?: Record<string, unknown> }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
    
    credentials: 'same-origin',
  })

  if (response.status === 204) return undefined as T

  const body = (await response.json().catch(() => ({}))) as Envelope<T>

  if (!response.ok) {
    const error = body.error
    throw new ApiError(
      response.status,
      error?.code ?? 'UNKNOWN',
      error?.message ?? response.statusText,
      error?.details,
    )
  }

  return body.data as T
}


export function toQueryString(params: Record<string, unknown> = {}): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    search.set(key, String(value))
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}
