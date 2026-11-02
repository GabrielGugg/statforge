# Security

[Leia em português](SECURITY.pt-BR.md)

StatForge is a static site: there is no StatForge server and no account. Everything stays in the browser, and the optional Google features use the person's own Google account directly.

## What protects people

**Packages and shared sheets are data, never code.** Packages, table links and sheets shared with a GM are JSON. Formulas run in StatForge's own small interpreter (numbers, comparisons and a fixed list of functions), never through `eval`. Text from outside is always shown as text, never as HTML. Shared sheets are checked before use: size up to 2 MB, depth limit, prototype keys (`__proto__`, `constructor`, `prototype`) dropped, hidden control and right-to-left characters removed from names and e-mails.

**Google access is the smallest that works.**

- Sync uses `drive.appdata`: a hidden folder only StatForge can see.
- Sharing with the GM uses `drive.file`: StatForge sees only the files it created, or the ones a person picked in Google's own picker. It cannot see anything else in the Drive.
- Sign-in tokens stay on the device and are never sent anywhere but Google.

**Sharing with the GM is read-only by design.**

- The player's app creates a separate copy in the player's Drive and gives exactly one e-mail the **reader** role. It never uses "anyone with the link" or "writer". The permissions are read back right after; anything unexpected deletes the copy.
- The player's app only writes to that copy and never reads it back, so nothing done to the copy can change the real sheet.
- Before each update, the permissions are checked again. If anyone else got access, updates stop and the player is warned. **Stop sharing** deletes the copy, which removes every access.
- The GM's app only reads (Google refuses writes from a reader anyway). It shows the sheet read-only, never saves it as a GM sheet, and deletes its local copy when the player stops sharing.
- Tables, parties and team resources stay on the GM's device and in the GM's hidden app folder. Players never see them, and players never see each other's sheets.

**The page limits what it can load.** A Content Security Policy allows scripts only from the site itself and Google's sign-in and file picker, and blocks plugins and inline scripts. Data, images and fonts may load over https because packages and themes can come from any link.

## Reporting a problem

If you find a security problem, please open an [issue](https://github.com/GabrielGugg/statforge/issues) without the exploit details and ask for a private contact, or use GitHub's "Report a vulnerability" in the Security tab if it is enabled.
