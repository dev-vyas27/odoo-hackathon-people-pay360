'use client'

/**
 * use-resource — TanStack Query bound to the project's REST convention.
 *
 * Every module exposes `/api/<resource>` with the same envelope, so the data
 * layer for a new screen is one line:
 *
 *   const { data, isLoading } = useResourceList<EmployeeView>('employees', filters)
 *
 * Cache invalidation is the part people get wrong by hand. Every mutation here
 * invalidates the whole `['resource', name]` subtree, so creating a leave
 * request refreshes the list, the detail and the balance widget without any
 * screen having to remember to.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ApiError, apiFetch, toQueryString } from '@/lib/api-client'

/** Matches `Paged<T>` from the shared kernel — the shape every list returns. */
export interface PagedResult<T> {
  items: T[]
  total: number
  page: number
  limit: number
  pages: number
}

export type ResourceParams = Record<string, string | number | boolean | undefined>

export const resourceKeys = {
  all: (resource: string) => ['resource', resource] as const,
  list: (resource: string, params?: ResourceParams) =>
    ['resource', resource, 'list', params ?? {}] as const,
  detail: (resource: string, id: string) => ['resource', resource, 'detail', id] as const,
}

const EMPTY_PAGE: PagedResult<never> = { items: [], total: 0, page: 1, limit: 20, pages: 1 }

/** GET /api/<resource>?<params> */
export function useResourceList<T>(
  resource: string,
  params?: ResourceParams,
  options?: Partial<UseQueryOptions<PagedResult<T>, ApiError>>,
) {
  const query = useQuery<PagedResult<T>, ApiError>({
    queryKey: resourceKeys.list(resource, params),
    queryFn: () => apiFetch<PagedResult<T>>(`/api/${resource}${toQueryString(params)}`),
    // Paging feels broken without this: the table blanks between pages otherwise.
    placeholderData: (previous) => previous,
    ...options,
  })

  return { ...query, page: query.data ?? (EMPTY_PAGE as PagedResult<T>) }
}

/** GET /api/<resource>/<id>. Disabled until an id exists, so "new" forms work. */
export function useResourceItem<T>(
  resource: string,
  id: string | null | undefined,
  options?: Partial<UseQueryOptions<T, ApiError>>,
) {
  return useQuery<T, ApiError>({
    queryKey: resourceKeys.detail(resource, id ?? ''),
    queryFn: () => apiFetch<T>(`/api/${resource}/${id}`),
    enabled: Boolean(id),
    ...options,
  })
}

/**
 * Shared mutation plumbing: invalidate, toast, surface the server's message.
 *
 * `onError` shows the API's own wording ("Insufficient balance: 3 days
 * remaining") rather than a generic failure, which is most of the perceived
 * quality of the app for zero extra effort per screen.
 */
function useResourceMutation<TInput, TResult>(
  resource: string,
  mutationFn: (input: TInput) => Promise<TResult>,
  successMessage: string,
  options?: Partial<UseMutationOptions<TResult, ApiError, TInput>>,
) {
  const client = useQueryClient()

  return useMutation<TResult, ApiError, TInput>({
    mutationFn,
    ...options,
    // Rest-forwarded so the callback arity stays whatever TanStack currently
    // passes; the wrapper has no business knowing.
    onSuccess: (...args) => {
      void client.invalidateQueries({ queryKey: resourceKeys.all(resource) })
      if (successMessage) toast.success(successMessage)
      options?.onSuccess?.(...args)
    },
    onError: (...args) => {
      toast.error(args[0].message)
      options?.onError?.(...args)
    },
  })
}

/** POST /api/<resource> */
export function useCreateResource<T, TInput = unknown>(
  resource: string,
  options?: { successMessage?: string } & Partial<UseMutationOptions<T, ApiError, TInput>>,
) {
  const { successMessage = 'Created', ...rest } = options ?? {}
  return useResourceMutation<TInput, T>(
    resource,
    (input) => apiFetch<T>(`/api/${resource}`, { method: 'POST', body: JSON.stringify(input) }),
    successMessage,
    rest,
  )
}

/** PATCH /api/<resource>/<id> */
export function useUpdateResource<T, TInput = unknown>(
  resource: string,
  options?: { successMessage?: string } & Partial<
    UseMutationOptions<T, ApiError, { id: string; values: TInput }>
  >,
) {
  const { successMessage = 'Saved', ...rest } = options ?? {}
  return useResourceMutation<{ id: string; values: TInput }, T>(
    resource,
    ({ id, values }) =>
      apiFetch<T>(`/api/${resource}/${id}`, { method: 'PATCH', body: JSON.stringify(values) }),
    successMessage,
    rest,
  )
}

/** DELETE /api/<resource>/<id> */
export function useDeleteResource(
  resource: string,
  options?: { successMessage?: string } & Partial<UseMutationOptions<void, ApiError, string>>,
) {
  const { successMessage = 'Deleted', ...rest } = options ?? {}
  return useResourceMutation<string, void>(
    resource,
    (id) => apiFetch<void>(`/api/${resource}/${id}`, { method: 'DELETE' }),
    successMessage,
    rest,
  )
}

/**
 * POST /api/<resource>/<id>/<action> — the verbs that are not CRUD.
 *
 * Approve, refuse, compute, validate, mark-paid and send all follow this shape.
 * Modelling them as sub-resources rather than `PATCH { status }` keeps the
 * business rule ("approving deducts the allocation") in one use case instead of
 * being inferred from a status field the client happened to set.
 */
export function useResourceAction<T = unknown, TBody = unknown>(
  resource: string,
  action: string,
  options?: { successMessage?: string } & Partial<
    UseMutationOptions<T, ApiError, { id: string; body?: TBody }>
  >,
) {
  const { successMessage = 'Done', ...rest } = options ?? {}
  return useResourceMutation<{ id: string; body?: TBody }, T>(
    resource,
    ({ id, body }) =>
      apiFetch<T>(`/api/${resource}/${id}/${action}`, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      }),
    successMessage,
    rest,
  )
}
