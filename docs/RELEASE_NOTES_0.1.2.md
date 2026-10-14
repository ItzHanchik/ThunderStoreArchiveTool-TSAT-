# TSAT v0.1.2 — DigitalOcean upload hotfix

Fixes **“Unsupported upload storage: fra1.digitaloceanspaces.com”** when publishing a package from the desktop app.

Thunderstore can return presigned multipart URLs for DigitalOcean Spaces. Version 0.1.1 did not recognize that provider. This update accepts HTTPS regional endpoints (such as `fra1.digitaloceanspaces.com`) and virtual-hosted bucket endpoints (such as `bucket.fra1.digitaloceanspaces.com`).

## Security remains enforced

- HTTPS only; no plaintext HTTP, URL credentials, or nonstandard ports.
- No arbitrary hosts, hostname lookalikes, or DigitalOcean CDN upload endpoints.
- Presigned URLs are sent unchanged; the Thunderstore bearer token is never sent to storage.
- Redirects are blocked and all upload parts must cover the archive exactly.

## Downloads

- **TSAT-0.1.2-x64-nsis.exe** — Windows 10/11 x64 installer.
- **TSAT-0.1.2-x64-portable.exe** — standalone app.
- **SHA256SUMS.txt** — executable checksums.

**Upgrade from 0.1.1** to apply the fix; the app has no automatic updater. Export important projects as ZIP backups first. Portable users should retain their existing writable `TSAT-data` folder.

## Verification

113 unit/mocked API tests, including DigitalOcean multipart publication and security regression checks. Windows binaries are attached only after the packaged-app smoke workflow succeeds. Real authenticated Thunderstore publication is not performed by the tests and still needs author verification.

Unsigned early-access binaries; Windows SmartScreen may warn. No other authoring features changed in this hotfix.
