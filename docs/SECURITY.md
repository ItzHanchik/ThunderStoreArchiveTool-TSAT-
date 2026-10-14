# Security model

TSAT is a local-first authoring tool, not an identity provider or game mod installer.

- Electron renderer: sandbox enabled, context isolation enabled, Node.js disabled, CSP with no remote scripts, no webviews, navigation and popup windows denied.
- IPC: fixed operations only; sender must be the application's main frame. No generic filesystem or command execution bridge.
- Archive saving: native save dialog and bounded ZIP bytes. Paths are checked before packaging; no archive extraction into arbitrary filesystem paths.
- Token storage: Electron safeStorage; Windows DPAPI. Linux basic_text fallback is rejected. No plaintext token persistence or token-returning API. The password field temporarily holds input in renderer memory until it is encrypted; this is not an OS hardware vault.
- Publishing: main process only, explicit confirmation, one upload at a time, HTTPS Thunderstore API, no credential forwarding to signed upload URLs, no redirects, limited storage host allowlist, timeouts, best-effort abort before submission. Signed URLs and server response bodies are not logged or returned as error details.
- Portable secrets do not become portable across Windows identities. Reconnect on a new machine. Deleting the local token does not revoke it upstream.
- Browser projects/settings are IndexedDB records; browser preview cannot save tokens. No analytics, external fonts, or automatic remote image loads.
- Do not assume the file exclusion list finds every secret. Review the package before publishing.

## Reporting

Do not disclose working tokens in a public issue. Revoke exposed tokens in Thunderstore first. For a vulnerability, use GitHub private vulnerability reporting if enabled; otherwise open a non-sensitive issue asking the maintainer for a private reporting channel.

## Verification limits

Local validation is not a replacement for Thunderstore server validation. Windows CI exercises the packaged executable, safeStorage encryption/decryption, import, ZIP export, and persisted RU/EN preferences. Installation/uninstallation, portable behavior, and live API publishing still require hands-on testing before considering this a stable release. API contract tests use mocked network responses and do not publish real packages.
