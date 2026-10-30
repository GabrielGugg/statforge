# Changelog

Every change to StatForge. The current version is also shown in Settings.

## 0.1.4 — 2026-10-30

- **Character creation assistant.** A system package can describe its creation steps (`creation` in the format): choose race, class or background, buy attributes with points, pick skills, perks and traits, and write a backstory, with a live summary of the main values and a review at the end. Going back and changing a step is safe. You can still skip it and get a blank sheet.
- **Nicer fields**: inputs, selects and number boxes restyled; attributes show the modifier as a badge; survival counters fit on one line on phones; resource rows no longer cut the name.
- Fix: a stray "null" text above the "Create sheet" button (and in the sheet's package window).
- The example systems now include creation steps.

## 0.1.3 — 2026-10-30

- Game packages no longer live in the app repository: StatForge stays a pure engine, and every system (Fallout included) is installed like any other package.

## 0.1.2 — 2026-10-30

- Fix: wide blocks with tables (like Weapons) no longer push the page sideways on phones.

## 0.1.1 — 2026-10-30

- **New app icon** (anvil, flames and d20) in the header, the browser tab and when installing the app on a phone or computer.

## 0.1.0 — 2026-10-30

First release of StatForge, a universal character sheet written from scratch.

- **.json packages**: the app ships with no game. Each system, homebrew, theme or table is a package installed from a file or a link.
- **Languages**: the app is in English and Brazilian Portuguese (picker in Settings, automatic on first open). Each package declares its own `language`, shown as a badge on the Packages screen.
- **Table package**: the GM sends a single link and the app installs the system, extensions and theme. Also works with `?table=<link>` in the app address.
- **Extension order**: sortable list (drag or arrows). The lower one wins when two change the same thing, and the app shows the conflict. Warnings for `requires`, `conflicts` and `load_after`, plus a "Suggest order" button.
- **Patches**: add, replace, modify, remove and rename.
- **Rules engine**: safe formulas (no executable code) and the effects `add`, `set`, `grant`, `block`, advantage/disadvantage, immunity, resistance, vulnerability and note.
- **Sheet drawn by the package**: tabs and blocks for attributes, skills, derived values, resources, counters, active effects, item lists (equip, quantity, wear, rename), notes and a dice roller.
- **Sheets**: as many as you like per device, each with its own system and extensions. Export and import sheets.
- **Themes**: built-in light and dark (or automatic); more themes as packages.
- **Backup** of everything (packages, sheets and settings) and offline use.
- **Format guide** (`FORMAT.md`, also in Portuguese), example packages in English and Portuguese, and a command-line validator (`npm run validate`).
