# Changelog

Every change to StatForge. The current version is also shown in Settings.

## 0.2.6 — 2026-10-31

- **Level up**: a Level up button in the sheet header (highlighted when there is enough XP) opens an assistant defined by the package (`progression.level_up`), with the same steps as character creation: choose a perk or an attribute, spend skill points and so on. The top shows what changes (PV 15 → 20), and a review lists everything before confirming. Spent resources keep their gap to the new maximum. Packages without it just add one level.
- New `choice` step: one option out of a few, read by later steps in their `if`.

## 0.2.5 — 2026-10-31

- **Custom items**: the Add item dialog has "Create custom item". Pick the category and fill in the fields the package allows for it (`custom` in the collection); weapons can also get a magazine with the ammo they take, and property-like fields have a picker. Custom items are saved in the sheet, work like any other item (weight, wear, equipping, mods) and can be edited or deleted from their details.
- Item search shows items whose name matches before those found only in descriptions.

## 0.2.4 — 2026-10-31

- **Automatic condition warnings**: packages can list conditions the app notices by itself (`auto_conditions`). A subtle popup at the top of the sheet offers to apply the condition, or to remove it when it no longer holds, and disappears after 10 seconds. Dismissed warnings stay quiet until the situation changes, and immunities (such as a perk) stop them.
- New formula functions: `current('id')` for a resource's current value and `maxof('collection', 'field')` for the largest value among the sheet's items.

## 0.2.3 — 2026-10-31

- **Wear has effects**: collections can say how wear changes an item's numbers (`wear.fields`, e.g. armor DF and TD drop), add penalties that only exist while worn (`wear.stats`, e.g. attack −2), and break the item at the maximum (`wear.breaks`: its effects stop and it shows as Broken). Worn values show in the equipped cards and lists, with the base value in the tooltip. `wear_ignore` lets sturdy items ignore the first levels.
- **Terms with tooltips**: a text field with `links` turns property names into links; hover shows the description and a tap opens it.

## 0.2.2 — 2026-10-31

- **Add item by searching**: in the inventory, Add item searches every category at once (each result shows its category, and a filter narrows it down).
- **Item details in the inventory**: packages choose which item fields show in cards (`card_fields`) and in the list (`list_fields`), such as weight; wear shows as a badge when above 0.

## 0.2.1 — 2026-10-31

- **Notebook**: a new `notebook` block holds as many notes as you want, each with a title and text, folded or open. Search finds words inside titles and texts, ignoring accents (for example "bunk" finds Bunker and Bunkitidini), and highlights them; Open jumps to the note.
- Packages can move the text of an old notes block into the notebook (`import_notes`), so nothing written before is lost.

## 0.2.0 — 2026-10-31

- **Inventory in one place**: a new `inventory` block holds every item, shown as cards by category or as one searchable list (the choice is remembered). Items and quantities are edited there.
- **Equipped views**: list blocks with `"view": "equipped"` show only what is equipped, as cards with the item's numbers and wear.
- **Magazines and reloading**: weapons with a `magazine` show rounds loaded / capacity, spend shots, and reload from the matching ammo in the inventory (choosing which ammo when there are several; switching returns the loaded rounds). Charge weapons spend one unit to fill. Generic, so bows and crossbows work too.
- **Mods inside weapons**: collections with `mods` let you install mods that are in the inventory into an item; `magazine_bonus` raises its capacity.
- **Distance unit** in Settings (meters, feet or squares); `range` fields are converted, including ranges that multiply an attribute.
- Derived values with `editable_bonus` get a field for an extra modifier.

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
