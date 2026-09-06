'use client'



import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
  type UseQueryOptions,
} from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ApiError, apiFetch, toQueryString } from '@/lib/api-client'


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


export function useResourceList<T>(
  resource: string,
  params?: ResourceParams,
  options?: Partial<UseQueryOptions<PagedResult<T>, ApiError>>,
) {
  const query = useQuery<PagedResult<T>, ApiError>({
    queryKey: resourceKeys.list(resource, params),
    queryFn: () => apiFetch<PagedResult<T>>(`/api/${resource}${toQueryString(params)}`),
    
    placeholderData: (previous) => previous,
    ...options,
  })

  return { ...query, page: query.data ?? (EMPTY_PAGE as PagedResult<T>) }
}


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
