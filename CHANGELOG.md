# Changelog

Every change to StatForge. The current version is also shown in Settings.

## 0.1.9 — 2026-10-31

- **Skills editor**: skills are read-only until you tap **Edit**. Then each skill has − / +, the total updates as you go, and **Apply** saves (or **Cancel** drops the changes).
- A skills block can set a `budget`: the editor shows the points spent against it and warns when you spend more or fewer; Apply asks before saving an uneven total.

## 0.1.8 — 2026-10-31

- **Resources as toggles**: a resource with `"display": "toggles"` shows one checkbox per point (karma caps, spell slots, uses per day) instead of a number and a bar.
- **Immunities hide what cannot happen**: an `immunity` can name the conditions or counters it covers (`ref` or `tag`), and those are no longer offered in the sheet's add lists.
- Effects such as immunities and advantages now honor `"if"` too.
- **Granted entities show in their list** (for example, the trait that comes with a background), with the source's name, and leave with it.
- Creation assistant: a `pick` step can list only entities with a given `tag`.

## 0.1.7 — 2026-10-31

- **Back button** in the top bar: returns to where you were (for example, from Settings back to the open sheet).
- Removing something from a sheet (race, background, item…) asks first. Collections marked `quick_remove` (like conditions) skip the question.
- Fix: the wear counter now lines up with its column.

## 0.1.6 — 2026-10-30

- **Hub**: Packages › Browse the Hub lists the packages shared in the official [StatForge Hub](https://github.com/GabrielGugg/statforge-hub). Search, filter by type and language, install with one tap, and see when a package you have has a new version ("Update all"). The Hub address can be changed in Settings, so groups can run their own.
- Packages can declare a `license`.
- Author and license: GabrielGugg.

## 0.1.5 — 2026-10-30

- **Sheet as a dashboard.** Each tab is a grid; packages set each block's width. With **Arrange** you drag blocks (mouse or touch), change their width and hide what you do not use. The arrangement is saved for every sheet of that system and can be restored to the default.
- **Compact resource tiles** (hit points, stamina, spell slots…) that a package can place at the top.
- **Counters that only show when active**, with a menu to add one (e.g. survival levels). Their rule text folds away.
- **Starting equipment in the creation assistant**: a new `items` step adds the chosen background's kit to the sheet (with wear and worn armor), or an alternative such as starting money.
- Attributes fill the block evenly (all in one row when there is room, two balanced rows otherwise), with no empty space at the side.

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
