# StatForge

[Leia em português](README.pt-BR.md)

Character sheets for **any tabletop RPG**. The app ships with no game: each system is a `.json` package you install from a file or a link. Homebrews, themes and "table packages" (one link that installs everything at once) work the same way.

- Runs in the browser, on phones and offline. Can be installed as an app (PWA).
- Interface in English and Brazilian Portuguese. Each package declares its own language.
- Your data stays only in your browser. Use the backup in Settings to switch devices.

## How to use

1. Open the app and go to **Packages**.
2. Install the system package (from a file or a link). If your GM sent you a table link, paste it: the app installs the system, the extensions and the theme.
3. On **Sheets**, create a new sheet by picking the system and the extensions.

Want to try it? On the first screen, use **Try the example**.

## Make a system or homebrew

Read the [format guide](FORMAT.md) and look at the files in [`examples/`](examples/). To check a package:

```
npm run validate -- my-package.json
```

## Development

There is no build step: plain HTML, CSS and JavaScript in `site/`.

```
npm test                       # engine tests (Node 20+)
python3 -m http.server 8000    # then open http://localhost:8000/site/
```

| Folder | Contents |
| --- | --- |
| `site/js/engine/` | Formulas, package validation and assembly, sheet calculation. Does not depend on the browser. |
| `site/js/ui/` | Screens. |
| `site/js/locales/` | Interface text, one file per language. `en.js` is the base; other languages fall back to it. |
| `site/js/packages.js`, `storage.js` | Package installation and storage (IndexedDB). |
| `examples/en/`, `examples/pt-BR/` | Example system, homebrew, theme and table. |
| `tests/` | Engine tests. |

To add an interface language, copy `site/js/locales/en.js`, translate it, and register it in `site/js/i18n.js`.

GitHub Pages publishes on every push to `main` (see `.github/workflows/deploy.yml`). In **Settings → Pages**, pick **GitHub Actions** as the source.

On every release, update `CHANGELOG.md`, `CHANGELOG.pt-BR.md` and `site/js/version.js`.

## License

MIT.
