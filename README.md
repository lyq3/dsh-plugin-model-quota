# dsh-plugin-model-quota

A read-only DeepSeek Harness Web plugin that discovers accounts through the CLIProxyAPI Management API and displays Codex and Kimi subscription quotas below the conversation composer.

[简体中文](./README.zh-CN.md)

## Features

- Dynamically reads `GET /v0/management/auth-files`; accounts are never hard-coded.
- Queries Codex and Kimi through the fixed `POST /v0/management/api-call` endpoint.
- Renders a compact one-line status and expandable details in `conversation.composer.dock`.
- Polls every 60 seconds while visible and refreshes 3 seconds after a model turn becomes idle.
- Provides a DSH plugin settings card for the CLIProxyAPI base URL, write-only Management Key, and refresh timings.
- Keeps the Management Key in DSH's secret settings wire and out of browser responses.
- Includes English and Chinese UI with desktop and mobile layouts.

## Compatibility

- DeepSeek Harness `0.1.0-rc.8`
- CLIProxyAPI `v7.2.137`
- Node.js 22 or newer
- V1 providers: Codex and Kimi

## Installation

Install the package in the DSH Web profile and add it to the Cordis composition. The included `cordis.patch.yml` provides the default loader row.

Install from the GitHub source checkout:

```bash
git clone https://github.com/lyq3/dsh-plugin-model-quota.git
cd dsh-plugin-model-quota
pnpm install --frozen-lockfile
pnpm build
pnpm --dir ~/.dsh/profiles/web add "$PWD"
systemctl --user restart dsh-web.service
```

A local development checkout can be installed the same way after `pnpm install && pnpm build`, using `pnpm --dir ~/.dsh/profiles/web add /path/to/dsh-plugin-model-quota`.

Restart the existing DSH service that serves the page; do not start a replacement server.

## Configuration

Open the loopback DSH page on the host and navigate to:

```text
Settings → Plugins → Plugin configuration → Model Quota
```

Defaults:

| Setting | Default |
| --- | --- |
| CLIProxyAPI Base URL | `http://127.0.0.1:8317` |
| Refresh interval | `60` seconds |
| Post-turn refresh delay | `3` seconds |
| Request timeout | `10` seconds |

The Management Key is write-only. Its input remains blank after saving; the `Configured` badge indicates that a key is stored.

### Remote-browser limitation

DSH `0.1.0-rc.8` restricts `settings.describe`, `settings.mutate`, and credential APIs to loopback same-origin browsers. A DSH page opened through a public domain or LAN address may show:

```text
settings are unavailable in this browser
```

This is a DSH security boundary, not a plugin failure. Configure the plugin from the host's `127.0.0.1` page. After configuration, the read-only quota dock can still render on remote conversation pages.

## Network rules

- Loopback HTTP is allowed, for example `http://127.0.0.1:8317`.
- Non-loopback addresses must use HTTPS.
- Userinfo, query strings, fragments, path traversal, unsafe encodings, and redirects are rejected.
- Protect every remote CLIProxyAPI Management API with VPN, Access, reverse-proxy authentication, or an equivalent control, and configure only trusted targets.

## Browser security boundary

The browser can call only these fixed same-origin routes:

```text
GET  /api/model-quota
POST /api/model-quota/test-connection
```

It cannot choose an upstream URL, method, headers, provider, or auth index. Browser responses never contain:

- CLIProxyAPI Management Keys
- OAuth tokens
- Raw auth indexes
- Upstream Authorization headers
- Raw upstream response bodies

Stable opaque account IDs are generated on the host. Account labels and sanitized quota DTOs are returned for display.

## Development

```bash
pnpm install
pnpm verify
```

`pnpm verify` runs type checking, unit tests, Host and Client builds, lazy-CJS package verification, and a tarball dry run.

## Known limitations

- V1 parses Codex and Kimi only.
- The DSH New Session hero does not render `conversation.composer.dock`; open or create a session to see the quota line.
- Remote browsers cannot mutate DSH settings, as described above.
- The plugin does not manage accounts, retain history, run a database, or install a background daemon.

## Security reports

See [SECURITY.md](./SECURITY.md).

## License

MIT
