# Changelog

## 0.1.1 — 2026-10-14

Bugfix and usability update.

### Fixed
- Support Backblaze B2 S3-compatible multipart upload endpoints without disabling HTTPS, host allowlisting, part coverage, or redirect protection.
- Report unsupported storage hosts without exposing presigned URL credentials; send explicit part Content-Length alongside Content-MD5.
- Use English by default in fresh workspaces, native dialogs, and repository documentation. Preserve existing language preferences and user text.
- Resolve navigation/page titles at render time so switching languages updates every page.
- Expose project deletion on cards and inside the editor, with confirmation and correct navigation after deleting the active project.
- Calculate validation progress from the actual check count and make error actions open the relevant editor tab.
- Prevent stale autosave completions from displaying a misleading saved state.

### Improved
- Four-step local README / CHANGELOG assistant with preview, selected-document confirmation, current-version replacement, older-release preservation, and last-replacement undo.
- Non-destructive icon studio: raster import, scale, position, rotation, opacity, overlay, gradient palettes, text/fonts/shadow, and borders. Persist editable designs; export standard 256 × 256 PNG.
- Show actual project icons in library cards; improve text contrast, control sizes, responsive dialogs, and editor actions.
- Expanded security, storage-migration, Markdown generation, browser, and packaged-Windows smoke coverage.

### Known limitations
- Direct publishing is desktop-only and experimental. Real authenticated publication and manual Windows install/uninstall still require author verification.
- Windows executables are unsigned; back up local projects before upgrading.

## 0.1.0 — 2026-10-14

First early-access implementation.

- Local project workspace and starter templates for Thunderstore authors.
- Manifest v1, README/changelog editor, safe Markdown preview, dependencies.
- Folder/file import, path validation, PNG dimensions, asynchronous ZIP export.
- Light/dark themes, custom accent/background, snow/rain, compact density.
- Electron sandbox, limited IPC, native save dialog, encrypted service-account token.
- Experimental multipart API publication with explicit native confirmation.
- Windows NSIS/portable targets and CI workflows; binaries not yet Windows-tested.
- Read-only online catalog, communities, token verification, metadata-only drafts.
- RU/EN UI and native dialog localization with persisted preferences.
- BONEWORKS community preset, separate from BONELAB.
- Detailed English-only README/CHANGELOG templates and confirmed template replacement.
- 61 automated packaging and mocked API tests.
