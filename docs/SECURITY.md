# Security model

TSAT is a local-first authoring tool, not an identity provider or game mod installer.

- Electron renderer: sandbox enabled, context isolation enabled, Node.js disabled, CSP with no remote scripts, no webviews, navigation and popup windows denied.
- IPC: fixed operations only; sender must be the application's main frame. No generic filesystem or command execution bridge.
- Archive saving: native save dialog and bounded ZIP bytes. Paths are checked before packaging; no archive extraction into arbitrary filesystem paths.
- Token storage: Electron safeStorage; Windows DPAPI. Linux basic_text fallback is rejected. No plaintext token persistence or token-returning API. The password field temporarily holds input in renderer memory until it is encrypted; this is not an OS hardware vault.
- Publishing: main process only, explicit confirmation, one upload at a time, HTTPS Thunderstore API, no credential forwarding to signed upload URLs, no redirects, limited storage host allowlist (AWS S3, Cloudflare R2, Thunderstore subdomains, Backblaze B2 S3 endpoints, and DigitalOcean Spaces regional/bucket endpoints; no DigitalOcean CDN endpoints), part coverage validation, timeouts, best-effort abort before submission. Signed URLs and server response bodies are not logged or returned as error details.
- Portable secrets do not become portable across Windows identities. Reconnect on a new machine. Deleting the local token does not revoke it upstream.
- Browser projects/settings are IndexedDB records; browser preview cannot save tokens. No analytics, external fonts, or automatic remote image loads.
- Do not assume the file exclusion list finds every secret. Review the package before publishing.

## Local authoring tools

The document assistant is deterministic and offline; it does not send answers to an AI service. Applying generated text requires confirmation and preserves older changelog entries. Markdown is rendered without executing HTML.

Icon sources are restricted to PNG/JPEG/WebP (10 MB, at most 40 megapixels after decode) and downscaled to 1024 pixels per side before local persistence. The editable source/design stays in IndexedDB, not the exported package. Archives contain a flattened 256 × 256 PNG. Browsers still decode images in memory: do not load untrusted decompression-bomb images.

Project deletion removes local workspace data only; it does not remove exported archives, revoke tokens, or unpublish packages.

## Reporting

Do not disclose working tokens in a public issue. Revoke exposed tokens in Thunderstore first. For a vulnerability, use GitHub private vulnerability reporting if enabled; otherwise open a non-sensitive issue asking the maintainer for a private reporting channel.

## Verification limits

Local validation is not a replacement for Thunderstore server validation. Windows CI exercises the packaged executable, safeStorage encryption/decryption, import, ZIP export, and persisted RU/EN preferences. Installation/uninstallation, portable behavior, and live API publishing still require hands-on testing before considering this a stable release. API contract tests use mocked network responses and do not publish real packages.
