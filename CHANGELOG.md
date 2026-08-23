# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2026-08-22

### Added

- Dynamic CLIProxyAPI auth-file discovery with deterministic opaque account IDs.
- Read-only Codex and Kimi quota adapters for CLIProxyAPI `v7.2.137`.
- Compact DSH composer quota line with expandable account and reset details.
- Visible-page polling, manual refresh, and post-turn refresh scheduling.
- DSH plugin settings card with a write-only Management Key and connection test.
- Chinese and English locales with responsive desktop and mobile styles.
- Fixed same-origin Host routes, response size limits, timeouts, redirect rejection, generation-aware caching, and in-flight request coalescing.
- Unit, integration-style, package-shape, security, and tarball verification.
- English and Chinese installation, configuration, security, and remote-browser limitation documentation.

### Fixed

- Implemented the DSH `HostObservable` contract required by slot-injected hooks.
- Isolated caller abort signals from the shared Host refresh lifecycle.
- Moved polling startup into the Cordis effect lifecycle.
- Queued a final refresh when settings change during an in-flight request.
- Parsed current Kimi usage responses whose numeric quota fields are strings and whose rolling windows use `detail.remaining`.
- Corrected the initial write-only secret configured state.
- Hid unlabeled Codex `additional_rate_limits` instead of presenting internal counters as user-facing quota windows.

### Security

- Management Keys, OAuth tokens, raw auth indexes, authorization headers, and upstream response bodies remain Host-only.
- Non-loopback CLIProxyAPI URLs require HTTPS; unsafe URL forms and redirects are rejected.
- Browser routes reject caller-supplied proxy parameters and request bodies.
