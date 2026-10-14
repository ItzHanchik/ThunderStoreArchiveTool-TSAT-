/** Package-facing content is deliberately English, regardless of UI locale. */
export function modReadme(name: string, game: string): string {
  return `# ${name.replaceAll("_", " ")}

> A mod for **${game}**. Replace this line with a clear, one-sentence summary of what your mod does.

## Overview

Describe the problem this mod solves and how it changes the game. Keep the first paragraph useful to someone who has never seen your project.

## Features

- **Feature one** — explain the benefit to the player.
- **Feature two** — describe another important capability.
- **Easy configuration** — document the options your mod actually supports, or remove this item.

## Requirements

- A compatible version of **${game}**.
- The mod loader required by your project (specify its name and supported version).
- All dependencies listed on this package's Thunderstore page.

> Replace the requirements above with tested versions. Do not claim compatibility you have not verified.

## Installation

### With a mod manager (recommended)

1. Open a mod manager that supports ${game} and Thunderstore.
2. Select the game and the profile you want to use.
3. Install this package and its dependencies.
4. Launch the game through that profile.

### Manual installation

1. Back up your existing configuration and save files when applicable.
2. Install the required mod loader and dependencies.
3. Copy the mod files into the loader-specific folders described here.
4. Launch the game and check the loader log for errors.

> Author: replace step 3 with the exact folder paths for your mod. Different games and loaders use different layouts.

## Configuration & Usage

Explain how to use the mod after installation. If it creates a configuration file, document its exact location and when the file is generated.

| Setting | Default | Description |
| --- | --- | --- |
| Replace with a real setting | Default value | What it changes |

Remove this table if the mod has no configurable settings.

## Compatibility

- **Tested game version:** add the version you tested.
- **Tested loader version:** add the version you tested.
- **Multiplayer:** state whether the host, every player, or only the local player needs the mod. If untested, say so.
- **Known conflicts:** list incompatible mods, or state that compatibility testing is still in progress.

## Troubleshooting

1. Check that the game, loader, and required dependencies match the supported versions.
2. Reproduce the issue in a clean mod-manager profile.
3. Check the loader log and include the relevant error when reporting a problem.

## Support & Bug Reports

Add your issue tracker or support link here. When reporting a bug, include:

- Game version, mod version, and mod-loader version.
- Steps to reproduce the issue and what you expected to happen.
- Relevant logs and a list of other installed mods.

**Never share passwords, API tokens, private configuration, or personal information in logs.**

## Credits

Credit contributors, libraries, tools, and third-party assets. Link to their licenses where appropriate.

## License

Specify the license for your code and assets. Do not assume that third-party content uses the same license as your mod.

## Changelog

See **CHANGELOG.md** for release notes.
`;
}
export function modChangelog(version = "1.0.0"): string {
  return `# Changelog\n\n## ${version}\n\n### Added\n\n- Initial release. Replace this line with the features included in this version.\n\n### Known Issues\n\n- Document known limitations, or remove this section after testing.\n`;
}
