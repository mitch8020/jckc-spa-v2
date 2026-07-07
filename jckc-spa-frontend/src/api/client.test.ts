// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

async function loadClient() {
  vi.resetModules()
  vi.stubEnv('VITE_API_URL', 'http://api.test')
  return import('./client')
}

describe('api client', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('sends credentialed GET requests and parses JSON responses', async () => {
    const { get } = await loadClient()
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    )

    await expect(get('/api/health')).resolves.toEqual({ ok: true })

    expect(fetchMock).toHaveBeenCalledWith('http://api.test/api/health', {
      method: 'GET',
      credentials: 'include',
      headers: undefined,
      body: undefined,
    })
  })

  it('JSON-encodes mutation bodies and returns undefined for empty success bodies', async () => {
    const { post, patch } = await loadClient()
    fetchMock
      .mockResolvedValueOnce(new Response('', { status: 200 }))
      .mockResolvedValueOnce(new Response('', { status: 200 }))

    await expect(post('/api/students', { name: 'Ada' })).resolves.toBeUndefined()
    await expect(patch('/api/students/1', { name: 'Ada' })).resolves.toBeUndefined()

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'http://api.test/api/students', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Ada' }),
    })
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://api.test/api/students/1',
      {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Ada' }),
      },
    )
  })

  it('returns undefined for 204 DELETE responses', async () => {
    const { del } = await loadClient()
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }))

    await expect(del('/api/students/1')).resolves.toBeUndefined()

    expect(fetchMock).toHaveBeenCalledWith('http://api.test/api/students/1', {
      method: 'DELETE',
      credentials: 'include',
      headers: undefined,
      body: undefined,
    })
  })

  it('flattens array and string API error messages', async () => {
    const { ApiError, get } = await loadClient()
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: ['first', 'second'] }), {
        status: 400,
        statusText: 'Bad Request',
      }),
    )
    await expect(get('/api/bad')).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      message: 'first\nsecond',
    })

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Nope' }), {
        status: 404,
        statusText: 'Not Found',
      }),
    )
    const missingRequest = get('/api/missing')
    await expect(missingRequest).rejects.toBeInstanceOf(ApiError)
    await expect(missingRequest).rejects.toMatchObject({
      status: 404,
      message: 'Nope',
    })
  })

  it('keeps the fallback message for non-JSON and empty API error bodies', async () => {
    const { get } = await loadClient()
    fetchMock.mockResolvedValueOnce(
      new Response('plain failure', {
        status: 500,
        statusText: 'Server exploded',
      }),
    )
    await expect(get('/api/plain-error')).rejects.toMatchObject({
      status: 500,
      message: 'Server exploded',
    })

    fetchMock.mockResolvedValueOnce(new Response('', { status: 500 }))
    await expect(get('/api/empty-error')).rejects.toMatchObject({
      status: 500,
      message: 'Request failed with status 500',
    })

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Bad Request' }), {
        status: 400,
        statusText: 'Bad Request',
      }),
    )
    await expect(get('/api/no-message')).rejects.toMatchObject({
      status: 400,
      message: 'Bad Request',
    })

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: '' }), {
        status: 422,
        statusText: 'Unprocessable Entity',
      }),
    )
    await expect(get('/api/blank-message')).rejects.toMatchObject({
      status: 422,
      message: 'Unprocessable Entity',
    })
  })

  it('downloads binary responses through a temporary anchor', async () => {
    const { downloadFile } = await loadClient()
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined)
    const remove = vi
      .spyOn(HTMLAnchorElement.prototype, 'remove')
      .mockImplementation(() => undefined)
    const createObjectURL = vi.fn().mockReturnValue('blob:report')
    const revokeObjectURL = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectURL,
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectURL,
    })
    fetchMock.mockResolvedValue(new Response(new Blob(['pdf']), { status: 200 }))

    await expect(
      downloadFile('/api/reports/sign-in-sheet', 'sign-in-sheet.pdf'),
    ).resolves.toBeUndefined()

    const anchor = document.querySelector('a')
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(anchor?.href).toBe('blob:report')
    expect(anchor?.download).toBe('sign-in-sheet.pdf')
    expect(click).toHaveBeenCalledTimes(1)
    expect(remove).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:report')
  })

  it('raises ApiError for failed downloads', async () => {
    const { downloadFile } = await loadClient()
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Forbidden' }), { status: 403 }),
    )

    await expect(downloadFile('/api/reports/sign-in-sheet', 'x.pdf')).rejects.toMatchObject({
      status: 403,
      message: 'Forbidden',
    })
  })
})
