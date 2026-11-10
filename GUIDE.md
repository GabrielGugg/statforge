# StatForge guide

[Leia em português](GUIDE.pt-BR.md)

StatForge is a character sheet for any tabletop RPG. The app comes with no game: each system is a **package** you install. This guide shows everything you can do, from your first package to GM mode.

This guide is also in the app, in **Settings › Guide**.

## 1. First steps

1. Open the app: https://gabrielgugg.github.io/statforge/site/
2. Install a system. The first screen gives you three ways:
   - **Paste GM link**: did your GM send you a link? Paste it here. A table link installs the system, its extensions and the theme at once.
   - **Install file**: you got a `.json` file.
   - **Browse the Hub**: the official package collection. Search, filter and tap **Install**.
3. Tap **+ New sheet**, pick the system (and extensions, if any) and follow the character creation assistant.

Just looking around? Use **Try the example** on the first screen.

> The app works on phones and computers, and offline once it has been opened. On a phone, use the browser's "Add to Home Screen" to install it as an app.

## 2. Packages

Everything about a game comes in `.json` packages:

- **System**: the rules (attributes, skills, items, character creation).
- **Extension** (homebrew): changes or adds rules to a system.
- **Theme**: the app's colors and font.
- **Table**: one link that installs a system, its extensions and a theme together. The easiest way for a GM to set up the group.
- **Compendium**: ready-made sheets of creatures and NPCs, for GM mode.

**Packages** shows what you have, the extension order, and lets you update and remove. When a Hub package gets a new version, the app tells you. To have it check by itself when it opens, turn on **Check for updates automatically** in Settings.

## 3. The sheet

The sheet is split into tabs and blocks, laid out by the system. What you find on it:

- **Calculated values**: everything that depends on a formula (defense, load, skills) is worked out by itself, with the effects of race, traits, items and conditions.
- **Skills**: read-only until you tap **Edit**. Use − / +, then **Apply** (or **Cancel**).
- **Resources** (hit points and the like): you change the current value; the maximum comes from the formula.
- **Inventory**: every item in one place, as cards by category or as one searchable list. **+ Add item** searches every category. If the package does not have the item, make a **custom item**.
- **Equipped items**: equipped weapons and armor show as cards, with their numbers, wear, magazine and installed mods.
- **Ammo and magazines**: weapons with a magazine show the loaded rounds; **Reload** takes ammo from the inventory.
- **Limited uses**: items like kits show one box per use. When they run out, **Open another** takes a new one from the quantity.
- **Wear**: wear changes an item's numbers and can break it.
- **Properties with tips**: hover (or tap) a property to read its rule. When the rule depends on the kind of item, you see the right one for that item.
- **Automatic conditions**: when the system notices a condition (overloaded, for example), a small notice at the top offers to apply or remove it.
- **Notebook**: as many notes as you like, with search.
- **Level up**: the button lights up when you have enough XP and opens an assistant with the system's choices.

In the sheet's **More ⋯** menu:

- **Arrange**: drag, resize and hide blocks. The layout is saved per system.
- **Packages**: the extensions this sheet uses.
- **Export PDF**: opens printing with every tab; choose "Save as PDF".
- **Export .json**: the sheet as a file, to keep or move to another device (on the home screen, **Import sheet**).
- **Delete**.

> **Debug mode** (Settings › Appearance) shows on each value its formula and where every bonus came from. Handy for checking rules or making packages.

## 4. Your data

Sheets and packages stay in your browser. There is no StatForge server and no account.

- **Google Drive sync** (Settings): keeps everything in a hidden app folder in your own Drive. Changes go up a few seconds after you make them. On another device, one tap syncs.
- **Backup** (Settings › Backup): downloads a file with your sheets, packages and settings. **Restore backup** brings it back.
- **Backup reminder**: with sync off, the home screen reminds you when your last backup is more than 14 days old.
- **Browser storage**: some browsers clear the data of sites you rarely use (Safari after about 7 days). Settings › Backup says whether yours keeps it, with a button to ask.

> **Only restore backups you made yourself.** The app checks the file, skips anything invalid, and never takes your Google sign-in or shares from a backup. Still, someone else's file can bring sheets and packages you did not want.

## 5. Sharing your sheet with the GM

1. The GM sends an **invite link**. Open it, pick your sheet and check the GM's e-mail.
2. Tap **Share sheet**. Google may ask to let StatForge create files in your Drive (only the files it creates).
3. Done: the GM sees your sheet live, read-only. The copy updates by itself a few seconds after each change.

On the sheet, **Shared with GM ✓** shows who can see it. **Stop sharing** deletes the copy and removes access at once. The GM can never change your sheet.

## 6. GM mode

Tap **GM** at the top. Each **table** has a system and opens in tabs.

### Characters

- **Invite link**: send it to the group. It carries your e-mail, which players see before sharing.
- **Add shared sheets**: pick, in Google's picker, the "StatForge - …" files your players shared. Each sheet becomes a card that updates by itself.
- **Cards** picks the values shown on the cards. **Open sheet** shows the whole sheet, read-only.
- **New local sheet**: a sheet of yours (an NPC, a creature, a spare character), edited in the full editor. **Local copy** takes an editable snapshot of a shared sheet.
- **From compendium**: turns an entry of an installed compendium into a local NPC sheet.
- **New party** splits the sheets into groups. The **active party** shows its **team resources** at the top: formulas over the characters, like `floor(avg(members('stealth')))`.

### Combat

- **New encounter** and **Add**: the table's sheets and creatures from a compendium (×3 becomes "Raider 1, 2 and 3").
- **Roll initiative** rolls for whoever the table says and sorts the list. Ties follow the table's rule: manual (drag), players before NPCs, or a formula of yours.
- **Next turn** and **Previous** run rounds and turns.
- Click a value to change it: a number replaces it, `-N` takes off, `+N` adds. Damage follows the system's order, and the pop-up shows what will change before applying.
- Clicking a name shows the sheet next to the list, without leaving the fight.

### Shield

Your screen for the session, in pages. Cards with free text, notes, roll tables, the players' values, a dice roller and the turn order. **Arrange** changes size and position.

### Tables

Roll tables (loot, weather, encounters). One line per result, like `1-4: Acid rain`. **Roll** shows the line rolled, with its dice already rolled. They can be exported and imported.

### Notes

The GM's notebook, with search. Only you see it.

### Table settings

The name, how often shared sheets are checked, who initiative is rolled for, the tie rule, and **Delete table**.

> Everything of the GM's stays on their device and in their hidden app folder in Drive. Players never see the table or each other's sheets.

## 7. Making packages

- **Package builder**, no code needed: https://gabrielgugg.github.io/statforge-hub/builder/
- **Format guide**, for those who prefer the `.json`: [FORMAT.md](https://github.com/GabrielGugg/statforge/blob/main/FORMAT.md)
- **Share it in the Hub**: [how to send a package](https://github.com/GabrielGugg/statforge-hub/blob/main/CONTRIBUTING.md)

## 8. Common problems

- **"System not installed"**: the sheet uses a package you do not have. Install it in Packages.
- **The sheet is not on my other device**: turn on sync on both, or move a backup.
- **The GM cannot see my sheet**: check that the invite's e-mail is right and that the sheet shows **Shared with GM ✓**.
- **"A new version of StatForge is available"**: tap **Update**. Your sheets stay where they are.
- **Found a bug?** Open an [issue](https://github.com/GabrielGugg/statforge/issues).

Privacy: [Privacy Policy](https://gabrielgugg.github.io/statforge/site/privacy.html) · Security: [SECURITY.md](https://github.com/GabrielGugg/statforge/blob/main/SECURITY.md)
