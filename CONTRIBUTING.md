# Contributing

Thank you for helping improve `dsh-plugin-model-quota`.

## Development setup

```bash
pnpm install --frozen-lockfile
pnpm verify
```

The project targets DeepSeek Harness `0.1.0-rc.8`, Node.js 22+, and CLIProxyAPI `v7.2.137`.

## Pull requests

- Keep changes focused and avoid unrelated refactors.
- Add or update tests for every behavior change.
- Run `pnpm verify` before opening a pull request.
- Preserve the Host/browser security boundary: credentials, raw auth indexes, authorization headers, and upstream response bodies must remain Host-only.
- Use fictional fixtures only. Never submit real accounts, quota observations, keys, tokens, private URLs, screenshots, or local configuration.

## Security reports

Do not open a public issue for suspected credential exposure, SSRF, or authentication-boundary problems. Follow [SECURITY.md](./SECURITY.md).
