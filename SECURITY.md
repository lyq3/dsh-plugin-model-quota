# Security Policy

## Supported versions

Security fixes are currently provided for the latest `0.1.x` release.

## Reporting

Please report suspected credential exposure, SSRF, authentication-boundary, or secret-wire issues privately to the repository owner before opening a public issue. Do not include live keys, tokens, account identifiers, or raw upstream responses in a public report.

## Security boundary

`dsh-plugin-model-quota` sends CLIProxyAPI Management API requests only from the DSH Host process. The browser must never receive the Management Key, OAuth tokens, raw auth indexes, authorization headers, or raw upstream response bodies.

The browser is limited to two fixed same-origin routes:

```text
GET  /api/model-quota
POST /api/model-quota/test-connection
```

Both reject query parameters and request bodies. Browser callers cannot select an upstream URL, method, header, provider, credential, or auth index.

## Secrets

The CLIProxyAPI Management Key is declared with DSH's `secret` schema role. It is write-only in the browser settings UI and is redacted from settings descriptions. Never put a real key in source code, fixtures, screenshots, logs, issue reports, package artifacts, or Git history.

## Remote CLIProxyAPI targets

Loopback HTTP is supported for local deployments. Non-loopback targets must use HTTPS and must not contain userinfo, query strings, fragments, path traversal, unsafe path encodings, or redirects.

Operators remain responsible for choosing a trusted target. Protect every externally reachable Management API with VPN, Access, reverse-proxy authentication, or an equivalent control. Do not configure an untrusted domain: the DSH Host sends the Management Key to the configured authority.

## DSH remote settings

DeepSeek Harness `0.1.0-rc.8` intentionally restricts settings and credential APIs to loopback same-origin browsers. This plugin does not bypass that restriction. Configure secrets from the DSH Host's loopback page; remote pages receive only sanitized quota DTOs.
