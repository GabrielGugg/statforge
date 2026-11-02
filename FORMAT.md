# Package format guide (version 1)

[Leia em português](FORMAT.pt-BR.md)

This guide is for anyone who wants to make a system, a homebrew, a theme or a table package for StatForge. The files in `examples/` show all of it working, in English (`examples/en/`) and in Portuguese (`examples/pt-BR/`).

To check a package without opening the app: `npm run validate -- my-package.json`.

## The four types

| Type | What for |
| --- | --- |
| `system` | The whole game: attributes, skills, items, sheet layout. A sheet uses exactly one. |
| `extension` | Homebrew, supplement or errata. Brings only the changes (patches) to a system. |
| `theme` | App colors (and font). |
| `table` | A list of links: system, extensions and theme. The GM sends one link and the player installs everything. |

Every package starts with:

```json
{
  "format": 1,
  "id": "my-system",
  "name": "My System",
  "version": "1.0.0",
  "author": "Your name",
  "license": "CC-BY-4.0",
  "language": "en",
  "type": "system",
  "description": "Optional."
}
```

`license` is optional and tells others how they may reuse your package (for example `CC-BY-4.0`, `MIT`, or `All rights reserved`). The StatForge Hub asks for it.

The `id` uses only letters, numbers, `-`, `_` and `.`. Do not change the `id` after publishing: sheets refer to the package by it. To release a new version, raise `version`.

## Language

The structure of the file (keys like `name`, `effects`, `type`) is always in English. The **content** (names, descriptions, labels, ids of your own fields) is in whatever language you want, and `language` says which one: `"en"`, `"pt-BR"`, `"es"` and so on.

A package with no text at all (a theme, for example) can use `"language": "*"`: it fits every language and shows in the Hub whatever language is picked.

A translation is a separate package with its own `id`, for example `fallout-2.2` and `fallout-2.2-pt`. The app shows each package's language as a badge, and highlights it when it differs from the interface language.

Formulas are code, so their functions and keywords (`floor`, `sum`, `and`...) are in English in every language. The ids you create (`STR`, `FOR`, `carga_max`) can be in any language.

## System package

### Attributes, skills, derived values, resources and counters

```json
"rolls": { "modifier": "floor((value - 10) / 2)", "default": "1d20" },
"progression": { "xp_per_level": "level * 1000" },
"attributes": [
  { "id": "STR", "name": "Strength", "abbr": "STR", "min": 1, "max": 20, "default": 10 }
],
"skills": [
  { "id": "athletics", "name": "Athletics", "attribute": "STR" }
],
"derived": [
  { "id": "ac", "name": "Armor Class", "formula": "10 + mod(DEX)" }
],
"resources": [
  { "id": "hp", "name": "Hit Points", "max": "8 + mod(CON)", "recovery": "Long rest: all." }
],
"counters": [
  { "id": "exhaustion", "name": "Exhaustion", "max": 6, "effects": [{ "type": "add", "target": "initiative", "value": "-2 * n" }] }
]
```

- **`rolls.modifier`**: how the modifier comes from the attribute value. In Fallout, `value - 5`; in D&D, `floor((value - 10) / 2)`. Without it, no modifier is shown.
- **Skill**: the default total is `points + mod(attribute)`. For another rule, use `"total": "points * 2 + mod(INT)"`.
- **Derived**: a computed number. `"if": "has('human')"` shows the value only when the condition holds. `"unit": "lb"` appears next to it.
- **Skills block**: the sheet shows points and totals with an **Edit** button; editing uses − / +, then **Apply** or **Cancel**. `"budget": "formula"` is how many points the skills should add up to (counting every point on the sheet, creation bonuses included); spending more or fewer shows a warning and Apply asks first.
- **Resource**: `"display": "toggles"` shows one checkbox per point instead of a number and a bar (karma caps, spell slots, uses per day). A higher maximum means more checkboxes. `"display": "card"` shows only the total, with no current value or bar (points spent and refilled every turn).
- **Resource**: has a current value (the player changes it) and a maximum (formula).
- **Counter**: goes from 0 to `max`. Its effects apply while it is above 0, with `n` = current level.
- **`progression.xp_per_level`**: total XP for the next level. When the sheet has it, the Level up button is highlighted. `max_level` hides the button at the top.
- **`progression.level_up`**: `{ "steps": [...], "summary": [...] }`, an assistant for leveling up with the same step types as character creation (see below). The steps run on the sheet one level higher, so formulas see the new `level`; they add to what the sheet has (a `pick` step hides what the character already has, unless `"repeat": true`; an `attributes` step counts points from the current values and cannot go below them). The summary shows what changes as "old → new". Without it, Level up just adds one level.

Use ids without hyphens for attributes, skills and values, because they appear in formulas (`load_max`, not `load-max`).

### Collections and entities

A collection is a kind of thing (weapons, traits, conditions). Entities are the items in each collection.

```json
"collections": {
  "weapons": {
    "name": "Weapons",
    "equippable": true,
    "quantity": true,
    "wear": { "max": 10 },
    "max": 20,
    "fields": {
      "damage": { "type": "dice", "label": "Damage" },
      "weight": { "type": "number", "label": "Weight", "unit": "lb" }
    }
  }
},
"entities": {
  "weapons": [
    { "id": "dagger", "name": "Dagger", "damage": "1d4", "weight": 1, "description": "…", "tags": ["light"], "effects": [] }
  ]
}
```

An entity may also have `requires`, a formula that must hold to add it (for example `"STR >= 5 and level >= 3"`): search and pick steps show it as "requirement not met" and do not let it be chosen. `repeat` says how many times it can be taken.

| Collection option | Effect |
| --- | --- |
| `equippable` | Items get an "equipped" box, and their effects only apply when it is ticked. |
| `quantity` | Shows the quantity column. Adding a repeated item adds 1. |
| `wear.max` | Shows wear (−/+) up to this maximum. |
| `max` | How many items the sheet can have in this collection (e.g. 1 class). |
| `unique` | Each entity can be added only once (perks, traits), or as many times as its `repeat` says. |
| `quick_remove` | Removing an item does not ask for confirmation (good for conditions). |
| `wear` | `{ "max": 10 }` gives items a wear counter. `"breaks": true`: at the maximum the item is broken and its effects stop. `"fields": { "df": "max(10, value - floor(wear / 2))" }` shows a field as it is after wear (`value` is the base, `wear` the levels). `"stats": [{ "label": "Attack", "value": "-wear" }]` adds numbers that only exist while worn. `"text"` explains the rule. Inside the item's own effects, `wear` is already the wear that counts; an entity with `"wear_ignore": 2` ignores its first 2 levels. |
| `mods` | Id of another collection whose items can be installed inside these (weapon mods). Only mods that are in the inventory can be installed; an entity's `magazine_bonus` adds to the magazine of the item it is installed in. |
| `custom` | Lets players create their own items in this collection ("Create custom item" in the Add dialog). `true` offers every field; a list (`["damage", "weight"]`) offers only those; `{ "fields": [...], "magazine": "ammo" }` also asks for a magazine capacity and which entities of that collection it accepts. Custom items live in the sheet, show in searches with a Custom badge, and can be edited or deleted from their details. |
| `currency` | Makes the collection the character's money: `{ "value": "value", "base": "sp" }` names the field with each coin's worth and the coin totals are shown in. A `money` block (`{ "block": "money", "collection": "coins" }`) lists the coins with their amount, a ± box (type +50 or -20 and press Enter) and the total converted to the base coin. Coins are inventory items with quantity, so a `weight` field counts in `sum()` like any item. |
| `fields` | Data shown in the details and columns. Types: `text`, `number`, `dice`, `boolean`, `list`. | `"links": "collection"` on a text field turns the terms that name entities of that collection (weapon properties…) into links with a tooltip. `range` is a distance shown in the unit the player picks in Settings (meters, feet or squares of 1.5 m / 5 ft): `"unit": "ft"` says the unit of the data, and with `"per": "PER"` a value like `"x10/x20"` means 10× and 20× that value. |

Collections without `equippable` (traits, perks, conditions) always apply while they are on the sheet.

Example with three coins, totals in silver (10 gold, 3 silver and 2 copper show as 103.2 sp):

```json
"collections": { "coins": { "name": "Money", "quantity": true, "currency": { "value": "value", "base": "sp" },
  "fields": { "value": { "type": "number", "label": "Worth (sp)" }, "weight": { "type": "number", "label": "Weight" } } } },
"entities": { "coins": [
  { "id": "gp", "name": "Gold pieces", "abbr": "gp", "value": 10, "weight": 0.02 },
  { "id": "sp", "name": "Silver pieces", "abbr": "sp", "value": 1, "weight": 0.02 },
  { "id": "cp", "name": "Copper pieces", "abbr": "cp", "value": 0.1, "weight": 0.02 }
] }
```

### Effects

Any entity, attribute, skill, derived value, resource or counter can have `effects`:

| Type | Fields | What it does |
| --- | --- | --- |
| `add` | `target`, `value` | Adds the value (formula) to the target. |
| `set` | `target`, `value` | Replaces the target's base value. If there are several, the highest wins. `add` effects go on top (e.g. armor sets AC and a shield adds +2). |
| `grant` | `ref` (`collection/id`) | The sheet also has this entity, while the source is active. It shows in its collection's list with the source's name and leaves with it. |
| `block` | `collection` or `tag` | Cancels the effects of entities in that collection or with that tag (e.g. a robot gets no effect from chems). |
| `advantage`, `disadvantage` | `target`, `text` | Listed under active effects. |
| `immunity`, `resistance`, `vulnerability` | `text` | Listed under active effects. An `immunity` can also name what it covers with `ref` (`collection/id`, a counter id, or a list of them) and/or `tag`: those conditions and counters are no longer offered in the sheet's add lists (e.g. a robot is never offered Bleeding). |
| `note` | `text` | Reminder on the sheet, for rules the app does not automate. |

Every effect accepts `"if": "formula"`; it only applies when the formula is true. The app shows simple conditions in words (`not has('x')` becomes "unless you have X"); for anything else, give `"if_text"` with the sentence to show, in the pack's language. Inside an entity's effects, `qty` and `wear` are that item's values on the sheet.

### Formulas

Operators: `+ - * / %`, comparisons `< <= > >= == !=`, `and`, `or`, `not`, parentheses, numbers, `'text'`, `true` and `false`.

| Name | What it gives |
| --- | --- |
| ids of attributes, skills, derived values | The current value (with effects). |
| id of a resource | The resource's maximum. |
| id of a counter | The current level. |
| `level`, `xp` | From the sheet. |
| `mod(x)` | The modifier of a value, by the `rolls.modifier` rule. |
| `floor`, `ceil`, `round`, `abs`, `min`, `max` | Math. |
| `if(cond, a, b)` | `a` if the condition holds, otherwise `b`. |
| `has('id')` or `has('collection/id')` | The sheet has this entity active (granted ones included). |
| `owns('id')` | The sheet has the item, active or not. |
| `qty('id')` | Total quantity of that item. |
| `count('collection')` | How many items the sheet has in the collection. |
| `sum('collection', 'field')` | Sum of field × quantity for every item in the collection. With a third argument `true`, only equipped ones. |
| `tag('name')` | Some active entity has this tag. |
| `current('id')` | The current value of a resource (what is left, not the maximum). |
| `maxof('collection', 'field')` | The largest value of the field among the sheet's items in the collection. With a third argument `true`, only equipped ones. |

A formula that refers to itself (directly or indirectly) becomes a warning on the sheet, and its value is 0.

### Automatic conditions

`auto_conditions` lists conditions the app can notice by itself. When `when` becomes true, a small popup at the top of the sheet offers to add the entity (`ref`, as `collection/id`); when it stops being true while the entity is on the sheet, it offers to remove it. The popup has Apply and Dismiss buttons and goes away by itself after 10 seconds. A dismissed warning only comes back after the situation changes. An active `immunity` effect for the entity (for example a perk) stops the warning.

```json
"auto_conditions": [
  { "ref": "conditions/encumbered", "when": "load > load_max", "text": "Your load is above your capacity." },
  { "ref": "conditions/dying", "when": "current('hp') <= 0" }
]
```

### Team resources (GM mode)

`party.resources` gives the GM ready-made team resources, calculated over the characters of a party in GM mode. Each one has an `id`, a `name` and a `formula`. Only the GM sees them.

```json
"party": {
  "resources": [
    { "id": "team_stealth", "name": "Team stealth", "formula": "min(members('AGI'))" },
    { "id": "morale", "name": "Morale", "formula": "floor(avg(members('CAR'))) + size" }
  ]
}
```

In these formulas `members('x')` gives the value of `x` in each character (any formula of the system works, evaluated with that character's effects), `sum`, `avg`, `min` and `max` combine the list, `count` counts the values that are not 0, and `size` is how many characters are in the party. Other names can only be used inside `members(...)`.

### Layout

```json
"layout": {
  "tabs": [
    { "id": "main", "name": "Main", "blocks": [
      { "block": "attributes" },
      { "block": "resources", "items": ["hp"] },
      { "block": "derived", "title": "Defense", "items": ["ac"] },
      { "block": "list", "collection": "weapons", "columns": ["damage", "weight"] },
      { "block": "notes", "id": "backstory", "title": "Backstory" },
      { "block": "roller", "shortcuts": ["1d20 + mod(STR)"] }
    ] }
  ]
}
```

Blocks: `attributes`, `skills`, `derived`, `resources`, `counters`, `effects`, `list`, `notes`, `money` and `roller`. `items` filters and orders; `title` changes the title; `points_label` renames the "Points" column of `skills`. Without `layout`, the app builds an automatic one.

Each tab is a 12-column grid. `"w"` is the block's width in columns (3, 4, 6, 8 or 12; default 6, and `"wide": true` is 12). On tablets and phones the widths shrink in proportion; blocks of width 3 sit two side by side on a phone. Give each block an `"id"`: the player can drag, resize and hide blocks with "Arrange", and the id keeps their arrangement when you update the package.

- A `resources` block with a single item becomes a compact tile (big current/max, bar, −1 +1 and restore). Put a few of them at the top with `"w": 3`.
- `"only_active": true` on a `counters` block shows only the counters above 0, with a menu to add the others.
- `"view": "equipped"` on a `list` block shows only the equipped items, as cards with their `columns`, wear, magazine and mods; items are added and counted in the inventory. `"hide_empty": true` hides the block when nothing is equipped.
- A `notebook` block is a set of notes the player creates ("New note"), each with a title and text, folded or open, with a search that finds words inside titles and texts (ignoring accents) and highlights them. `"import_notes": ["id"]` moves the text of older `notes` blocks into it once (`import_titles` names them).
- An `inventory` block (`"collections": [...]`) holds every item: the player switches between cards by category and one searchable list, and **Add item** searches every category at once. `"card_fields"` and `"list_fields"` choose the item fields each view shows (a list, or `{ "collection": [...], "*": [...] }`); wear shows as a badge when it is above 0.
- **Magazine**: an entity with `"magazine": { "capacity": 12, "ammo": ["ammo/9mm"], "charge": false, "per_shot": 1 }` shows rounds loaded / capacity with a Reload button that takes rounds from those inventory items (with `charge`, one unit, like an energy cell, fills it). Works for bows, crossbows and guns alike. The card names the ammo in use; with more than one entry in `ammo`, a list picks it, and Reload uses that one.
- A derived value with `"editable_bonus": true` gets a small field for an extra modifier the player types (e.g. carrying capacity from a house rule).
- `abbr` on a resource is shown big on its tile.

### Character creation

`creation` turns "New sheet" into a step-by-step assistant. Each step records the player's choices, and the sheet is rebuilt from them, so going back and changing an earlier step is safe. The last screen is always a review. The player can skip the assistant and get a blank sheet.

```json
"creation": {
  "summary": ["hp", "ac", "initiative"],
  "steps": [
    { "type": "pick", "collection": "classes", "title": "Class", "min": 1, "max": 1, "description": "…" },
    { "type": "pick", "collection": "subclasses", "min": 0, "max": 1, "match_field": "class" },
    { "type": "pick", "collection": "feats", "min": "feat_points", "max": "feat_points", "if": "level >= 1" },
    { "type": "attributes", "points": 6 },
    { "type": "skills", "choose": 2, "bonus": 2, "from": { "collection": "backgrounds", "field": "skills" } },
    { "type": "skills", "points": "2 + mod(INT)", "max_per_skill": 2 },
    { "type": "items", "from": "backgrounds", "note": "notes", "alternative": { "label": "Take 100 gold instead", "text": "100 gold" } },
    { "type": "info", "text": "Remember your class features.", "show": "classes" },
    { "type": "notes", "items": [{ "id": "backstory", "title": "Backstory", "placeholder": "…" }] }
  ]
}
```

| Step | What it does |
| --- | --- |
| `pick` | Choose entities from `collection`, between `min` and `max` (numbers or formulas). With `max: 1` it is a single choice. `match_field` hides entities whose field names something the character does not have (by name or id; e.g. a variant with `"race": "Elf"` only shows for elves); the player can still show them all. `tag` lists only entities with that tag (e.g. only the spells of one school). |
| `attributes` | Point-buy from each attribute's `default`, inside `min` and `max`. `points` is the budget; lowering an attribute gives points back unless `"decrease": false`. |
| `skills` | With `choose` and `bonus`: pick that many skills, each gets `bonus` points. `from` limits the list to the skills named in a field of the chosen entity (comma-separated names or ids). With `points`: spend that many points freely, up to `max_per_skill` each. |
| `items` | Starting equipment. Reads `starting_items` (or the field named in `field`) from what was picked in collection `from` and adds it to the sheet. `alternative: { label, text }` offers another option instead (e.g. gold to buy gear), whose text goes to the notes block `note`; `items: [{ "ref": "coins/gp", "qty": 100 }]` gives items instead. |
| `info` | Shows `text`, plus the full description of what was picked in the `show` collection. |
| `notes` | Text boxes that fill the sheet's `notes` blocks with the same `id`. |
| `choice` | One option out of a few: `"id": "use", "options": [{ "label": "A perk", "text": "…" }, { "label": "+1 attribute" }]`. Later steps read the answer by the id in their `if` (`"use == 2"`; 1 is the first option). |

Every step accepts `title`, `description` and `if` (a formula: the step only appears when it is true, for example `"has('robot')"`). `summary` lists the values shown at the top of every step (default: all resources). Resources, attributes and derived values may have an `abbr`, used there.

`starting_items` on an entity is a list of `{ "ref": "collection/id", "qty": 1, "wear": 0, "equipped": true, "name": "…", "if": "formula" }`, or `{ "text": "…", "if": "…" }` for something with no entity (it goes to the notes). `if` lets one background give different kits per race, for example.

An extension can change the assistant with `{ "op": "modify", "target": "creation", "fields": { … } }`, replace it, or turn it off with `"op": "remove"`.

## Extension (homebrew)

```json
{
  "format": 1, "id": "my-house-rules", "name": "House rules", "version": "1.0.0", "language": "en",
  "type": "extension", "system": "my-system",
  "requires": ["my-system@>=1.0"],
  "conflicts": ["other-homebrew"],
  "load_after": ["weapons-supplement"],
  "patches": [
    { "op": "modify", "target": "weapons/dagger", "fields": { "damage": "1d6" } },
    { "op": "rename", "target": "traits/tough", "name": "Sturdy" },
    { "op": "remove", "target": "weapons/shortbow" },
    { "op": "replace", "target": "conditions/prone", "entity": { "name": "Prone", "effects": [] } },
    { "op": "add", "collection": "conditions", "entity": { "id": "new", "name": "New" } }
  ]
}
```

- **`target`** is `collection/id`. It also works for `attributes/STR`, `derived/ac`, `skills/…`, `resources/…`, `counters/…`, `collections/weapons`, `layout` and `creation`.
- **`modify`** changes only the given fields. If it touches `effects`, send the whole list.
- **`rename`** keeps the id, so older sheets still find the item.
- **Order**: extensions apply in the order of the Packages screen. When two touch the same target, the lower one wins, and the app warns.
- **`requires`**, **`conflicts`** and **`load_after`** show warnings on the Packages screen and on the sheet. "Suggest order" uses `load_after`.

## Theme

```json
{
  "format": 1, "id": "my-theme", "name": "My Theme", "version": "1.0.0", "language": "*", "type": "theme",
  "font": "Georgia, serif",
  "colors": { "--bg": "#101010", "--surface": "#1a1a1a", "--text": "#eeeeee", "--accent": "#ffcc00", "--accent-text": "#101010" }
}
```

Variables: `--bg`, `--surface`, `--surface-2`, `--text`, `--text-muted`, `--border`, `--accent`, `--accent-text`, `--danger`, `--warning` and `--ok`. To have both versions, use `"colors": { "light": {…}, "dark": {…} }`; the app switches with the device. A single-version theme can declare `"scheme": "light"` (the default is dark).

## Table package

```json
{
  "format": 1, "id": "table-vault-texas", "name": "Vault Texas", "version": "1.0.0", "language": "en", "type": "table",
  "system": { "url": "https://…/fallout-2.2.json" },
  "packages": [{ "url": "https://…/house-rules.json" }],
  "theme": { "url": "https://…/theme-pipboy.json" }
}
```

Relative links are resolved from the table's link. If a package is already installed and has no link, use `{ "id": "…" }`.

The GM can send a ready link: `https://<app-address>/site/?table=<table-link>`. When opened, the app installs everything.

**Where to host:** the link must allow access from other sites (CORS). GitHub ("raw" link or GitHub Pages) and Gist work well, and the app turns a regular GitHub link into "raw" by itself. Google Drive and Dropbox links are converted to direct downloads, but Google Drive often blocks this access; if it fails, download the file and use "Install file".
