# TSAT 0.1.0 — First public preview

## Скачать / Download

- **TSAT-0.1.0-x64-nsis.exe** — Windows installer with destination selection and shortcut.
- **TSAT-0.1.0-x64-portable.exe** — portable Windows build; stores data in `TSAT-data` next to the EXE.
- **SHA256SUMS.txt** — SHA-256 checksums for both executables.

Windows 10/11 x64. **Unsigned early-access builds:** SmartScreen may warn about an unknown publisher. Download only from this repository and check the published hashes.

## Что нового

- Рабочая библиотека проектов, импорт папок, зависимости, локальная проверка и сборка ZIP для Thunderstore.
- Полный переключатель **Русский / English**: интерфейс, подсказки, проверки и системные диалоги. Выбор сохраняется на устройстве.
- **BONEWORKS** добавлен отдельно от BONELAB, с идентификатором сообщества `boneworks`.
- Подробный **английский README-шаблон**: обзор, возможности, требования, установка, настройки, совместимость, устранение проблем, поддержка, credits и лицензия. README/CHANGELOG всегда создаются на английском независимо от языка приложения. Пользовательские тексты не переводятся.
- Кнопка вставки шаблона в существующий проект с подтверждением замены документа.
- Светлая/тёмная темы, цвет акцента, свой фон, снег и дождь.
- Онлайн-каталог Thunderstore в EXE и создание новых черновиков из метаданных пакетов.
- Отдельный токен команды с Windows DPAPI; без выдуманного OAuth, перехвата cookies или ввода пароля в TSAT.

## What's included

A local-first mod authoring workspace with manifest/Markdown editing, dependency management, folder import, validated ZIP export, RU/EN UI, English-only package templates, BONEWORKS support, themes/background effects, and installer/portable builds.

## Verification and limitations

- 61 automated tests cover packaging, localization, templates, and mocked API contracts.
- Windows CI launches the packaged EXE and checks renderer isolation, file import, ZIP contents, encrypted token storage/decryption, persisted preferences, language switching, and the BONEWORKS preset.
- Browser smoke checks cover RU/EN, English templates, user-content preservation, persistence, and mobile layout.
- **Live Thunderstore authentication and publication have not been verified with a real account.** API publishing is experimental and requires explicit confirmation. Manual ZIP upload remains available.
- No code-signing certificate or automatic updater. Install/uninstall and portable behavior still warrant hands-on testing on your machine.
- Local limit: 200 MB / 2,000 files per project. Projects are held in local storage; export backups regularly.
- Starter projects are templates, not playable mods. Metadata import does not download DLLs, the original icon, or README.
- TSAT is not affiliated with Thunderstore and does not install mods into games.
