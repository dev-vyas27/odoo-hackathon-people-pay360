'use client'



export interface ApiFieldErrors {
  [field: string]: string
}

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly fieldErrors?: ApiFieldErrors,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}


export async function apiRequest<T>(
  url: string,
  init?: Omit<RequestInit, 'body'> & { body?: unknown },
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    const error = payload?.error
    throw new ApiError(
      error?.code ?? 'REQUEST_FAILED',
      error?.message ?? `Request failed with status ${response.status}`,
      response.status,
      error?.details?.fieldErrors,
    )
  }

  return payload?.data as T
}

export const apiGet = <T>(url: string) => apiRequest<T>(url)
export const apiPost = <T>(url: string, body?: unknown) =>
  apiRequest<T>(url, { method: 'POST', body })
export const apiPatch = <T>(url: string, body: unknown) =>
  apiRequest<T>(url, { method: 'PATCH', body })
export const apiDelete = <T>(url: string) => apiRequest<T>(url, { method: 'DELETE' })
