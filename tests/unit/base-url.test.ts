import { describe, expect, it } from 'vitest'
import { managementUrl, normalizeBaseUrl } from '../../src/quota/base-url.ts'

describe('normalizeBaseUrl', () => {
  it.each([
    ['http://127.0.0.1:8317', 'http://127.0.0.1:8317/'],
    ['http://127.42.0.9:8317/prefix', 'http://127.42.0.9:8317/prefix/'],
    ['http://localhost:8317', 'http://localhost:8317/'],
    ['http://[::1]:8317', 'http://[::1]:8317/'],
    ['https://Example.COM/proxy//', 'https://example.com/proxy/'],
    ['https://192.168.1.10/proxy', 'https://192.168.1.10/proxy/'],
  ])('accepts and normalizes %s', (input, expected) => {
    expect(normalizeBaseUrl(input).href).toBe(expected)
  })

  it.each([
    'http://example.com',
    'http://192.168.1.10',
    'ftp://localhost/file',
    'https://user:pass@example.com',
    'https://example.com/?x=1',
    'https://example.com/#fragment',
    'https://example.com/a/../b',
    'https://example.com/a/%2e%2e/b',
    'https://example.com/a/%252e%252e/b',
    'https://example.com/a/%2f/b',
  ])('rejects unsafe URL %s', (input) => {
    expect(() => normalizeBaseUrl(input)).toThrow()
  })

  it('resolves only fixed relative management paths beneath a prefix', () => {
    expect(managementUrl(normalizeBaseUrl('https://example.com/proxy'), 'auth-files').href)
      .toBe('https://example.com/proxy/v0/management/auth-files')
  })
})
