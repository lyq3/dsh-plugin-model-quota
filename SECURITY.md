# Security Policy

## Supported versions

Security fixes are currently provided for the latest `0.1.x` release.

## Reporting

Use GitHub's **Security → Report a vulnerability** form to report suspected credential exposure, SSRF, authentication-boundary, or secret-wire issues privately. Do not include live keys, tokens, account identifiers, or raw upstream responses in a public issue.

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

## CLIProxyAPI target policy

`0.1.x` accepts loopback authorities only: `localhost`, `127.0.0.0/8`, and `[::1]`. Loopback HTTP and HTTPS are supported. Non-loopback targets are rejected so the DSH Host cannot disclose the Management Key through SSRF, DNS rebinding, metadata endpoints, or a misconfigured remote authority.

When CLIProxyAPI runs on another machine, expose it to the DSH Host through an authenticated reverse proxy, VPN tunnel, or SSH tunnel whose local listener is bound to loopback. The configured URL must not contain userinfo, query strings, fragments, path traversal, unsafe path encodings, or redirects.

## DSH remote settings

DeepSeek Harness `0.1.0-rc.8` intentionally restricts settings and credential APIs to loopback same-origin browsers. This plugin does not bypass that restriction. Configure secrets from the DSH Host's loopback page; remote pages receive only sanitized quota DTOs.
