# TSAT v0.1.1 — Bugfix & usability update

An early-access patch focused on publishing, English-first onboarding, and everyday authoring.

## Fixes

- **Publishing:** accept Backblaze B2 S3-compatible multipart upload endpoints alongside the existing storage allowlist. HTTPS, redirect blocking, credential separation, and full archive coverage checks remain enforced. Unknown storage errors show only the hostname, never the signed URL.
- **English first:** English is now the default for fresh workspaces, native dialogs, and the repository README. Russian is still available. Saved preferences and author-written documents are not overwritten.
- **Project deletion:** visible trash buttons on project cards and a Delete project action inside the editor, with confirmation. Deleting an open project returns to the library. Exported ZIPs, history, and published packages are unaffected.
- **Interface:** language switches now update page titles correctly; validation actions open the relevant editor section; progress uses the actual check count; nested dialogs no longer sit behind the sidebar on narrow screens. Autosave no longer shows an older operation's “saved” state while newer changes are pending.

## Authoring improvements

- **README & CHANGELOG assistant:** answer questions about the mod, installation, support, and release changes; preview the documents and explicitly choose what to replace. Empty sections are omitted, older releases are preserved, and the last replacement can be restored while the editor stays open. Generation is local and offline, not an AI service.
- **Icon studio:** customize an existing icon or start from a letter. PNG/JPG/WebP input, image zoom/position/rotation/opacity, dark overlay, gradient/solid backgrounds, palettes, text/fonts/shadow, and configurable borders. Editable source/settings persist locally; the package receives a standard 256 × 256 PNG.
- Improved card typography, text contrast, responsive dialogs, button sizes, and actual mod icons in the project library.

## Downloads

- **TSAT-0.1.1-x64-nsis.exe** — Windows 10/11 x64 installer.
- **TSAT-0.1.1-x64-portable.exe** — standalone executable; keep its writable `TSAT-data` folder next to it.
- **SHA256SUMS.txt** — checksums for both executables.

Back up projects as ZIPs before upgrading. Installed builds use `%APPDATA%/TSAT`; portable builds use `TSAT-data` next to the executable. Encrypted tokens remain bound to the Windows user/device.

## Verification and limitations

The release workflow builds both Windows executables and runs the packaged-app smoke suite before attaching binaries. The suite covers isolation, file import and ZIP export, Windows DPAPI, persistence, RU/EN switching, document generation/undo, icon editing, and deletion. Unit tests cover packaging, storage migration, Markdown generation, and mocked publishing/security contracts; browser smoke checks also exercise mobile dialogs.

**Direct API publishing remains experimental and desktop-only.** A live authenticated upload needs verification with a real team and a new package version; tests do not publish real mods. The browser edition exports ZIPs for manual website upload. After a final-submission connection failure, check Thunderstore before retrying.

**Unsigned early-access binaries:** SmartScreen may warn about an unknown publisher. Manual installer/uninstaller testing is still recommended. No automatic updater or cloud sync.

[Full changelog](https://github.com/ItzHanchik/ThunderStoreArchiveTool-TSAT-/blob/v0.1.1/CHANGELOG.md) · [English guide](https://github.com/ItzHanchik/ThunderStoreArchiveTool-TSAT-/blob/v0.1.1/README.md) · [Русский](https://github.com/ItzHanchik/ThunderStoreArchiveTool-TSAT-/blob/v0.1.1/docs/README.ru.md)
