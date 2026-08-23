const LOOPBACK_V4 = /^127(?:\.\d{1,3}){3}$/
const ENCODED_SEPARATOR = /%(?:2f|5c)/i
const ENCODED_PERCENT = /%25/i
const ENCODED_DOT = /%2e/i

function isLoopback(hostname: string): boolean {
  const host = hostname.toLowerCase()
  return host === 'localhost' || host === '[::1]' || LOOPBACK_V4.test(host)
}

export function normalizeBaseUrl(raw: string): URL {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new TypeError('baseUrl must be a valid URL')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new TypeError('baseUrl protocol must be http or https')
  if (url.username || url.password) throw new TypeError('baseUrl must not contain userinfo')
  if (url.search || url.hash) throw new TypeError('baseUrl must not contain query or fragment')
  if (!isLoopback(url.hostname)) throw new TypeError('baseUrl must use a loopback hostname')

  const rawPath = /^[a-z][a-z0-9+.-]*:\/\/[^/?#]*(?<path>[^?#]*)/i.exec(raw)?.groups?.path ?? ''
  if (ENCODED_PERCENT.test(rawPath) || ENCODED_DOT.test(rawPath) || ENCODED_SEPARATOR.test(rawPath)) {
    throw new TypeError('baseUrl path contains unsafe encoding')
  }
  const segments = rawPath.replace(/\\/g, '/').split('/')
  if (segments.some((segment) => segment === '.' || segment === '..')) throw new TypeError('baseUrl path traversal is not allowed')

  const pathname = url.pathname.replace(/\/{2,}/g, '/').replace(/\/$/, '')
  url.pathname = `${pathname || ''}/`
  return url
}

export function managementUrl(baseUrl: URL, endpoint: 'auth-files' | 'api-call'): URL {
  return new URL(`v0/management/${endpoint}`, baseUrl)
}
