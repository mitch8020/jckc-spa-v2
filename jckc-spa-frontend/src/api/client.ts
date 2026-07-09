import { getApiBaseUrl } from '#/lib/api-url'

const BASE_URL = getApiBaseUrl()

/**
 * Error thrown for any non-2xx API response. `message` is flattened from
 * Nest's error body (`{ statusCode, message, error }` — message may be a
 * string array for validation failures).
 */
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function toApiError(res: Response): Promise<ApiError> {
  let message = res.statusText || `Request failed with status ${res.status}`
  try {
    const body: unknown = await res.json()
    if (body && typeof body === 'object' && 'message' in body) {
      const raw = body.message
      if (Array.isArray(raw)) message = raw.join('\n')
      else if (typeof raw === 'string' && raw.length > 0) message = raw
    }
  } catch {
    // non-JSON error body — keep the fallback message
  }
  return new ApiError(res.status, message)
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (!['GET', 'HEAD'].includes(method)) {
    headers['X-Requested-With'] = 'XMLHttpRequest'
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    credentials: 'include',
    headers: Object.keys(headers).length > 0 ? headers : undefined,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (!res.ok) throw await toApiError(res)

  if (res.status === 204) return undefined as T
  const text = await res.text()
  if (!text) return undefined as T
  return JSON.parse(text) as T
}

export function get<T>(path: string): Promise<T> {
  return request<T>('GET', path)
}

export function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>('POST', path, body)
}

export function patch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>('PATCH', path, body)
}

export function del<T = void>(path: string): Promise<T> {
  return request<T>('DELETE', path)
}

/**
 * Fetches a binary response (e.g. a generated PDF) with credentials and
 * triggers a browser download with the given filename.
 */
export async function downloadFile(
  path: string,
  filename: string,
): Promise<void> {
  const res = await fetch(`${BASE_URL}${path}`, { credentials: 'include' })
  if (!res.ok) throw await toApiError(res)

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
