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
  "language": "en",
  "type": "system",
  "description": "Optional."
}
```

The `id` uses only letters, numbers, `-`, `_` and `.`. Do not change the `id` after publishing: sheets refer to the package by it. To release a new version, raise `version`.

## Language

The structure of the file (keys like `name`, `effects`, `type`) is always in English. The **content** (names, descriptions, labels, ids of your own fields) is in whatever language you want, and `language` says which one: `"en"`, `"pt-BR"`, `"es"` and so on.

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
- **Resource**: has a current value (the player changes it) and a maximum (formula).
- **Counter**: goes from 0 to `max`. Its effects apply while it is above 0, with `n` = current level.
- **`progression.xp_per_level`**: total XP for the next level. The app shows a notice, but the player levels up by hand.

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

| Collection option | Effect |
| --- | --- |
| `equippable` | Items get an "equipped" box, and their effects only apply when it is ticked. |
| `quantity` | Shows the quantity column. Adding a repeated item adds 1. |
| `wear.max` | Shows wear (−/+) up to this maximum. |
| `max` | How many items the sheet can have in this collection (e.g. 1 class). |
| `fields` | Data shown in the details and columns. Types: `text`, `number`, `dice`, `boolean`, `list`. |

Collections without `equippable` (traits, perks, conditions) always apply while they are on the sheet.

### Effects

Any entity, attribute, skill, derived value, resource or counter can have `effects`:

| Type | Fields | What it does |
| --- | --- | --- |
| `add` | `target`, `value` | Adds the value (formula) to the target. |
| `set` | `target`, `value` | Replaces the target's base value. If there are several, the highest wins. `add` effects go on top (e.g. armor sets AC and a shield adds +2). |
| `grant` | `ref` (`collection/id`) | The sheet also has this entity, while the source is active. |
| `block` | `collection` or `tag` | Cancels the effects of entities in that collection or with that tag (e.g. a robot gets no effect from chems). |
| `advantage`, `disadvantage` | `target`, `text` | Listed under active effects. |
| `immunity`, `resistance`, `vulnerability` | `text` | Listed under active effects. |
| `note` | `text` | Reminder on the sheet, for rules the app does not automate. |

Every effect accepts `"if": "formula"`; it only applies when the formula is true. Inside an entity's effects, `qty` and `wear` are that item's values on the sheet.

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

A formula that refers to itself (directly or indirectly) becomes a warning on the sheet, and its value is 0.

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

Blocks: `attributes`, `skills`, `derived`, `resources`, `counters`, `effects`, `list`, `notes` and `roller`. `items` filters and orders; `title` changes the title; `points_label` renames the "Points" column of `skills`. Without `layout`, the app builds an automatic one.

Each tab is a 12-column grid. `"w"` is the block's width in columns (3, 4, 6, 8 or 12; default 6, and `"wide": true` is 12). On tablets and phones the widths shrink in proportion; blocks of width 3 sit two side by side on a phone. Give each block an `"id"`: the player can drag, resize and hide blocks with "Arrange", and the id keeps their arrangement when you update the package.

- A `resources` block with a single item becomes a compact tile (big current/max, bar, −1 +1 and restore). Put a few of them at the top with `"w": 3`.
- `"only_active": true` on a `counters` block shows only the counters above 0, with a menu to add the others.
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
| `pick` | Choose entities from `collection`, between `min` and `max` (numbers or formulas). With `max: 1` it is a single choice. `match_field` hides entities whose field names something the character does not have (by name or id; e.g. a variant with `"race": "Elf"` only shows for elves); the player can still show them all. |
| `attributes` | Point-buy from each attribute's `default`, inside `min` and `max`. `points` is the budget; lowering an attribute gives points back unless `"decrease": false`. |
| `skills` | With `choose` and `bonus`: pick that many skills, each gets `bonus` points. `from` limits the list to the skills named in a field of the chosen entity (comma-separated names or ids). With `points`: spend that many points freely, up to `max_per_skill` each. |
| `items` | Starting equipment. Reads `starting_items` (or the field named in `field`) from what was picked in collection `from` and adds it to the sheet. `alternative: { label, text }` offers another option instead (e.g. gold to buy gear), whose text goes to the notes block `note`. |
| `info` | Shows `text`, plus the full description of what was picked in the `show` collection. |
| `notes` | Text boxes that fill the sheet's `notes` blocks with the same `id`. |

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
  "format": 1, "id": "my-theme", "name": "My Theme", "version": "1.0.0", "language": "en", "type": "theme",
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
