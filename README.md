# StatForge

[Leia em português](README.pt-BR.md)

Character sheets for **any tabletop RPG**. The app ships with no game: each system is a `.json` package you install from a file or a link. Homebrews, themes and "table packages" (one link that installs everything at once) work the same way.

- Runs in the browser, on phones and offline. Can be installed as an app (PWA).
- Interface in English and Brazilian Portuguese. Each package declares its own language.
- Your data stays in your browser. To use it on several devices, turn on Google Drive sync in Settings (it saves to a hidden app folder in your own Drive), or move a backup by hand.

## Useful links

| | |
| --- | --- |
| 🌐 **Open the app** | https://gabrielgugg.github.io/statforge/site/ |
| 📦 **StatForge Hub** (packages to install) | https://github.com/GabrielGugg/statforge-hub |
| 🧭 **Tutorial: using the app** | [How to use](#how-to-use) (below) |
| 🛠️ **Tutorial: make a system or homebrew** | [Builder](https://gabrielgugg.github.io/statforge-hub/builder/) / [Format guide](FORMAT.md) and the [examples](examples/) |
| 📤 **Tutorial: share a package in the Hub** | [Hub contributing guide](https://github.com/GabrielGugg/statforge-hub/blob/main/CONTRIBUTING.md) |
| 📝 **What changed in each version** | [Changelog](CHANGELOG.md) |
| 🐞 **Report a bug or ask for a feature** | [Issues](https://github.com/GabrielGugg/statforge/issues) |
| 🔒 **Privacy Policy and Terms** | [Privacy](https://gabrielgugg.github.io/statforge/site/privacy.html) · [Terms](https://gabrielgugg.github.io/statforge/site/terms.html) |

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
| `site/js/sync.js` | Google Drive sync (one file in the app's hidden folder; merging lives in `engine/merge.js`). If you host StatForge yourself, set your own OAuth client ID in Settings › Cloud sync › Advanced, or in `DEFAULT_CLIENT_ID`. |
| `site/js/ui/` | Screens. |
| `site/js/locales/` | Interface text, one file per language. `en.js` is the base; other languages fall back to it. |
| `site/js/packages.js`, `storage.js` | Package installation and storage (IndexedDB). |
| `examples/en/`, `examples/pt-BR/` | Example system, homebrew, theme and table. |
| `tests/` | Engine tests. |

To add an interface language, copy `site/js/locales/en.js`, translate it, and register it in `site/js/i18n.js`.

GitHub Pages publishes on every push to `main` (see `.github/workflows/deploy.yml`). In **Settings → Pages**, pick **GitHub Actions** as the source.

On every release, update `CHANGELOG.md`, `CHANGELOG.pt-BR.md` and `site/js/version.js`.

## Packages and the Hub

Game packages do not live in this repository. Find and share them in the [StatForge Hub](https://github.com/GabrielGugg/statforge-hub), which the app opens under **Packages › Browse the Hub**.

## License

MIT © GabrielGugg. See [LICENSE](LICENSE).
