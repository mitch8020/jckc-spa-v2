import { describe, expect, it } from 'vitest'
import { resolveApiBaseUrl } from './api-url'

describe('resolveApiBaseUrl', () => {
  it('uses localhost for loopback API calls when the frontend is on localhost', () => {
    expect(resolveApiBaseUrl('http://127.0.0.1:3001', 'localhost')).toBe(
      'http://localhost:3001',
    )
  })

  it('uses 127.0.0.1 for loopback API calls when the frontend is on 127.0.0.1', () => {
    expect(resolveApiBaseUrl('http://localhost:3001', '127.0.0.1')).toBe(
      'http://127.0.0.1:3001',
    )
  })

  it('leaves non-loopback API hosts unchanged', () => {
    expect(resolveApiBaseUrl('https://api.example.test', 'localhost')).toBe(
      'https://api.example.test',
    )
  })

  it('leaves loopback API hosts unchanged for non-loopback frontend hosts', () => {
    expect(resolveApiBaseUrl('http://127.0.0.1:3001', 'app.example.test')).toBe(
      'http://127.0.0.1:3001',
    )
  })

  it('uses same-origin requests when no API URL is configured', () => {
    expect(resolveApiBaseUrl(undefined, 'app.example.test')).toBe('')
    expect(resolveApiBaseUrl('', 'app.example.test')).toBe('')
  })
})
