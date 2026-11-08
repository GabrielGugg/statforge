# Changelog

Every change to StatForge. The current version is also shown in Settings.

## 1.16.1 — 2026-11-08

- Pop-ups no longer close when a text selection is dragged past their edge: they close on an outside click only when the press also started outside.
- When a pop-up opens with a suggested name (like "Encounter 1"), the text comes selected, so typing replaces it.

## 1.16.0 — 2026-11-07

- GM mode, new **Shield** tab: the GM's screen for the session, in pages (sub-tabs). Each page scrolls down (grid) or sideways (one row).
- Cards: free text, a note from the Notes tab, a roll table with Roll, the players' values (active party, the values chosen in Cards), a dice roller that keeps the last results, and the active encounter's turn order with Next turn.
- **Arrange**: drag (or ↑↓/←→), width like the sheet's blocks (3 to 12 of 12), height (auto, short, medium, tall), edit and remove. Everything is saved per table.
- The table's tabs are now Characters, Combat, Shield, Tables, Notes and Settings.

## 1.15.0 — 2026-11-07

- GM mode, new **Notes** tab: the GM's notebook for each table, the same one as the sheet's (title, text, fold, search with the matching lines highlighted). Only the GM sees it; it is saved in the table, on the GM's devices and Drive.

## 1.14.0 — 2026-11-07

- GM mode, new **Tables** tab: roll tables per table (loot, weather, random encounters…). Each has a die and rows written one per line ("1-4: Acid rain"); the editor warns about results no row covers.
- **Roll** shows the result and its row, and dice written in the row ("2d10 caps") come rolled. The rows can be opened to see the whole table, with the result highlighted.
- Export one table or all of them as .json, and import them in another table. Imported files are checked and shown as text only.

## 1.13.0 — 2026-11-07

- GM mode, new **Combat** tab: encounters with the table's sheets (shared and local) and creatures from a compendium (×3 becomes "Raider 1", "Raider 2", "Raider 3", each with its own HP).
- **Roll initiative** rolls for whoever the table's Settings say (everyone, NPCs only or nobody) and sorts the list; the others' results are typed in. Ties stay in the order you choose: drag the rows (▲▼ on touch screens).
- Round, current turn, **Next turn** and **Previous**; each row has HP (−/+), conditions from the system's list and a short note. Conditions already on a player's sheet come in when they join the fight.
- Clicking a name shows that sheet, read-only, beside the list.
- What changes in a fight stays in the encounter, on your devices and your Drive: the players' sheets are never written.
- New system field `combat` (`initiative`, `hp`, `conditions`). See "Combat (GM mode)" in FORMAT.md.
- Changes to the GM's tables reach Drive two seconds after the last click, instead of on each one.

## 1.12.0 — 2026-11-07

- New package type **compendium**: ready-made sheets (creatures, NPCs, enemies) for one system, with kind, tags and description. Their values are calculated by the system's rules, so an entry works like any sheet. See "Compendium" in FORMAT.md.
- GM mode: in a table, **From compendium** searches the installed compendiums of the table's system (by name, tag and kind) and turns an entry into a local sheet marked as NPC. Its description stays on the sheet, and items your packages do not have are reported.
- Packages and the Hub list compendiums on their own (Hub type filter, number of entries).

## 1.11.0 — 2026-11-07

- GM mode: **local sheets**. In a table, **New local sheet** creates a sheet of yours (an NPC, a creature, a spare character) with the table's system and the usual creation wizard; mark it as **NPC** if you like. It opens in the full sheet editor, with a bar to go back to the table.
- **Local copy** on a shared sheet's card takes a separate snapshot that you can edit. The player's sheet is only read, never changed.
- Local sheets show in the table with a "local" or "NPC" tag, join parties and count in team resources like shared sheets. They stay off the home list, cannot be shared and are deleted with their table.
- The table's sheet section is now called **Sheets**.

## 1.10.0 — 2026-11-07

- GM mode: a table now opens in tabs. **Characters** has the invite link, team resources, parties and shared sheets; **Settings** has the table's name, how often shared sheets are checked, combat options and Delete table.
- The check interval is now set per table (it left the app's Settings). Tables that never set one keep using the value chosen before.
- New per-table setting **Roll initiative automatically for**: everyone, NPCs only (default) or nobody. Combat uses it in a later version.

## 1.9.1 — 2026-11-07

- Sheet: the bar under the name now holds **Level up**, **Share with the GM** and a **More ⋯** menu with Arrange, Packages, Export PDF, Export .json and Delete. While you arrange the blocks, **Done** shows on the bar.

## 1.9.0 — 2026-11-07

- Items with limited uses: an entity with `"uses": 3` shows one box per use on the sheet (inventory, lists and equipped items), ticked as uses are spent. When none are left it shows **Used up** and, if you have more than one, **Open another** takes one from the quantity and starts over.

## 1.8.1 — 2026-11-07

- Skills: `"attribute"` can be a list (e.g. `["STR", "CHA"]`); the skill uses the highest of those modifiers, and the sheet shows both ("Intimidation (STR/CHA)").

## 1.8.0 — 2026-11-06

- Requirements: choice lists (creation, level up and the sheet's **Add**) show everything; what the character does not qualify for is disabled and says which requirement is missing (e.g. "Requirement not met: Luck ≥ 8"). The **Ignore unmet requirements** box enables those. It replaces the old "Show N more with unmet requirements".
- When an entity has `requires`, that is the only rule: the suggestion field (`match_field`) no longer hides entities that meet the formula.
- Effects with a formula show in words: a pack can give `value_text` (e.g. "+ your level to Hit Points"); without it the app shows "Calculated bonus", and the formula is only in debug mode.
- New `limit` effect: a maximum for the target, applied after the other effects (e.g. a condition that caps Action Points at 6).
- An entity taken more than once shows each reminder once, and a reminder can depend on how many times it was taken (`if` with `qty`).
- Choice cards no longer repeat the reminder, which copied the description right above it.
- **Export PDF** on the sheet: opens the print window with every tab on a white page; choose "Save as PDF". The old **Export** is now **Export .json**.
- The sheet's **Add** window: the reason something cannot be added sits under its description, and the button no longer overflows.

## 1.7.1 — 2026-11-02

- Weapons: the magazine shows which ammo the weapon uses. When it takes more than one kind, a list next to it picks the one in use (with how many of each are in the inventory); **Reload** then uses that one, and switching puts the rounds still loaded back in the inventory.

## 1.7.0 — 2026-11-02

- When a newer version of StatForge is published, a notice appears at the top: **Update** downloads the new files and reloads the page (your sheets stay where they are); **Later** hides it until the app is opened again. The app checks a few seconds after opening, when you come back to the tab, and every 30 minutes.

## 1.6.1 — 2026-11-02

- GM mode: when a player updates a package, the shared sheet is sent again at once (and on the next app opening, for updates made before), so the GM sees the new version.
- GM mode: when players' sheets use a newer version of a package than the GM has, the table says so and **Update my packages** downloads the GM's own copies again (from the link they were installed from, or from the Hub). Sheets are always calculated with the GM's packages.
- Hub: the language filter now starts on **All languages**.
- New `"language": "*"` for packages with no text (themes, for example): they fit any language, show with any language filter in the Hub, and get an "any language" badge.

## 1.6.0 — 2026-11-02

- GM mode: **Cards** on a table chooses which values the sheet cards show (resources, attributes, skills, derived values, counters). **Default** goes back to the system's resources.
- GM mode: **Open sheet** opens the read-only sheet in a new tab, so the table stays open.
- Security review of sharing and GM mode:
  - Formulas only see their own functions and values: names such as `constructor` or `toString` can no longer reach JavaScript built-ins.
  - A sheet's own items (including a sheet shared with the GM) can no longer touch object prototypes when they join the rules.
  - In the GM's read-only view, the save and remove buttons of pop-ups are disabled too, and the packages dialog never opens.
  - Owner names and e-mails coming from Google are cleaned of hidden and right-to-left characters, and the tables copy kept in the GM's Drive is checked before use.
  - The page now has a Content Security Policy: scripts only from the site and Google's sign-in and file picker; no plugins or inline scripts.
- New SECURITY.md (en and pt-BR) explains how people are protected, and the README has a GM mode tutorial for GMs and players.

## 1.5.0 — 2026-11-02

**Parties and team resources** in GM mode.

- **New party** splits the sheets of a table into groups. Move a sheet with the party menu on its card, or drag the card into a party (desktop). A sheet is in at most one party; the rest show under "No party".
- One party is the **active party**: its team resources show at the top of the table. **Make active** switches it.
- **Team resources** are formulas over the characters of a party, calculated automatically and kept up to date as the sheets change. `members('AGI')` reads any value from each character (attributes, skills, any formula, with all their effects), and `sum`, `avg`, `min`, `max` and `count` combine them; `size` is the party size. Examples: team stealth `min(members('AGI'))`, morale `floor(avg(members('CAR'))) + size`. The formula is checked when it is saved, and a character where it fails counts as 0 with the reason in the chip's tooltip.
- System packages can bring ready-made team resources in `party.resources` (shown as "from the system"); the GM's own ones can be added, edited and deleted per table.
- All of this stays with the GM (device and private Drive file). Players do not see parties or team resources, and nothing is written to their files.

## 1.4.1 — 2026-11-02

- Fixed: the GM got "Google refused the request" when adding a shared sheet. Copies shared by 1.3.x were marked so that readers cannot download them, which also blocked the GM's app. New copies no longer have that mark, and the player's app removes it from older copies by itself the next time it opens with Google access (or stop sharing and share again).
- Errors from Google now show its short reason in brackets (for example `[cannotDownloadFile]`), and a temporary limit from Google is no longer taken as "access removed".
- Fixed: a stray "null" at the bottom of the GM mode screen.

## 1.4.0 — 2026-11-02

**GM mode** (the **GM** button at the top).

- Create tables (name and system). Each table has an **invite link** with the GM's e-mail, ready to copy and send to the group.
- **Add shared sheets** opens Google's own file picker: the GM picks the "StatForge - …" files players shared. Each file is read and checked before it joins the table (format, size up to 2 MB, no prototype tricks, hidden characters removed).
- The table shows a live card per sheet: name, player, level, resources and when it was last updated. It checks Google every 15 s (Settings › GM mode, 10 to 120 s, with a note on Google's usage limit) and only downloads a sheet when it changed.
- **Open sheet** shows the whole sheet **read-only**, calculated with the GM's own packages: every control is disabled, nothing is saved or sent, and it refreshes by itself while open. A warning shows when the player uses packages the GM lacks or has in another version.
- When a player stops sharing, the card shows "Access removed" and the copy kept on the GM's device is deleted.
- Tables are saved on the device and in a private file in the GM's hidden Drive folder, so another device of the GM gets them too. Players never see it.
- The GM side never writes to players' files: it only reads them (and Google would refuse anyway).

## 1.3.1 — 2026-11-02

- Fixed: sharing with a Gmail address written differently from the account (dots, capitals or "+tag", such as "Player.Example@gmail.com" for "playerexample@gmail.com") was taken as unexpected access and cancelled. Gmail treats them as the same account, and so does StatForge now.
- Sharing with your own e-mail is refused with a clear message (it gives no access at all), before anything is created in Drive.
- When Google does not grant the GM access, the message says so, and both errors list the permissions Google reported (roles only, no e-mails) to help find the cause.

## 1.3.0 — 2026-11-02

First step of the GM mode: **sharing a sheet with the GM, read-only**.

- The GM sends an invite link (`#/join?gm=…`). The player opens it, sees the GM's e-mail, picks a sheet and confirms. The same is reachable from **Share with GM** on the sheet, by pasting the link.
- StatForge keeps a copy of the sheet in the player's own Google Drive, updated a few seconds after each change, with a single **reader** permission for the GM's e-mail. Google itself refuses any change by the GM, and the player's app never reads the copy back.
- Safety checks: permissions are read back after sharing and the copy is deleted if anything else has access; updates pause if someone adds access in Drive; invite links are validated and shown only as text; shared copies are limited to 2 MB.
- **Stop sharing** deletes the copy, and the GM loses access at once. Deleting a shared sheet stops sharing first.
- Sharing asks Google for one more permission, `drive.file` (only files StatForge creates or the person picks), and only when someone shares. The Privacy Policy explains it.
- The GM side (adding shared sheets to a table, parties) comes in the next versions.

## 1.2.2 — 2026-10-31

- Character creation: conditions on effects are now written in words. "(if not has('x') and not has('y'))" becomes "(unless you have X or Y)", with the entities' names. Packs can give their own sentence with `if_text` (see FORMAT).
- Choice cards show reminders (`note` effects), which often carry the catch, highlighted and first. Identical bonuses on many skills become one line ("+2 on all skills"), and when there are more effects than fit, the card says how many are left (see Details).
- Long lists in a creation step now have a **Load more** button instead of hiding everything past the first 60.

## 1.2.1 — 2026-10-31

- Fixed: ranges written as text (such as "20 ft. cone" or "Cone de 6 m") showed the unit glued at the end ("20 ft. cone m"). Now each distance inside the text is converted to the unit chosen in Settings and the words stay.

## 1.2.0 — 2026-10-31

- **Google sync remembers your account**: Google no longer asks which account to use every time. The app keeps the account's email and the access token on this device only (never in the cloud or in backups), so reopening the app within the hour syncs by itself, and after that one tap reconnects the same account. Settings shows the connected account. Disconnecting deletes both. The Privacy Policy says so.
- **Check for updates automatically** (Settings › Hub, off by default): when you open the app, it looks in the Hub for new versions of the packages you have and offers to update them in a popup, without going to Packages › Hub. **Check now** does the same on demand.

## 1.1.1 — 2026-10-31

- **Privacy Policy and Terms of Service** (Portuguese and English), required by Google to publish the sign-in: `site/privacy.html` and `site/terms.html`, linked from Settings, in the sync section and in About.

## 1.1.0 — 2026-10-31

- **Item effects**: equipped items (and traits, perks and backgrounds) show what they do under their name, with the value already computed, for example "+50 to Carry Capacity" on a backpack. Reminders stay in Active effects.
- **Debug mode** (Settings › Appearance): every computed value gets, last in its tooltip, the formula, the same formula with the numbers it read, and each effect added on top with its source. On touch screens the **ƒ** button next to the value opens the same text.

## 1.0.0 — 2026-10-31

First official release.

- **Cloud sync with Google Drive**: in Settings, Connect Google Drive keeps sheets and packages in a hidden app folder of your own Drive. Changes upload a few seconds after you make them; opening the app on another device offers to sync with one tap. When both devices changed the same sheet, the most recent edit wins; deleted sheets stay deleted. Each device keeps its own settings.

## 0.2.9 — 2026-10-31

- **Requirements**: entities can have `requires` (a formula). Searches and pick steps (creation and level up) show "requirement not met" and do not let them be chosen.
- Collections can be `unique`: each entity is added once, or up to its `repeat`. Level up offers again what can still be repeated.

## 0.2.8 — 2026-10-31

- **Money**: a collection can be the character's money (`currency`), with as many coins as the system has and what each is worth. The new `money` block lists them with a ± box (type +50 or -20 and press Enter) and, with more than one coin, the total converted to the base coin (10 gold, 3 silver and 2 copper = 103.2 silver). Coins are inventory items, so their weight can count.
- The starting-equipment alternative can give items (`alternative.items`), such as coins.
- Fixed: notes blocks showed empty after reloading the sheet, even though the text was saved.

## 0.2.7 — 2026-10-31

- Resources can show only their total as a card (`"display": "card"`), for points spent and refilled every turn.

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
