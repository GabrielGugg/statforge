# StatForge

[Read in English](README.md)

Ficha de personagem para **qualquer sistema de RPG**. O app não vem com nenhum jogo: cada sistema é um pacote `.json` que você instala por arquivo ou por link. Homebrews, temas e "pacotes de mesa" (um link que instala tudo de uma vez) funcionam do mesmo jeito.

- Funciona no navegador, no celular e offline. Pode ser instalado como app (PWA).
- Interface em inglês e português do Brasil. Cada pacote declara o próprio idioma.
- Seus dados ficam só no seu navegador. Use o backup em Configurações para trocar de aparelho.

## Como usar

1. Abra o app e vá em **Pacotes**.
2. Instale o pacote do sistema (por arquivo ou link). Se o seu Mestre mandou um link de mesa, cole ele: o app instala o sistema, as extensões e o tema.
3. Em **Fichas**, crie uma ficha nova escolhendo o sistema e as extensões.

Quer testar? Na primeira tela, use **Testar com o exemplo**.

## Criar um sistema ou homebrew

Leia o [guia do formato](FORMAT.pt-BR.md) e veja os arquivos em [`examples/`](examples/). Para conferir um pacote:

```
npm run validate -- meu-pacote.json
```

## Desenvolvimento

O app não tem etapa de build: é HTML, CSS e JavaScript puros em `site/`.

```
npm test                       # testes do motor (Node 20+)
python3 -m http.server 8000    # e abra http://localhost:8000/site/
```

| Pasta | O que tem |
| --- | --- |
| `site/js/engine/` | Fórmulas, validação e montagem de pacotes, cálculo da ficha. Não depende do navegador. |
| `site/js/ui/` | Telas. |
| `site/js/locales/` | Textos da interface, um arquivo por idioma. `en.js` é a base; os outros idiomas caem nele quando falta algo. |
| `site/js/packages.js`, `storage.js` | Instalação de pacotes e armazenamento (IndexedDB). |
| `examples/en/`, `examples/pt-BR/` | Sistema, homebrew, tema e mesa de exemplo. |
| `packages/` | Pacotes publicados (Fallout TTRPG 2.2), servidos pelo GitHub Pages em `/packages/`. |
| `tools/fallout/` | Remonta o pacote do Fallout a partir das notas do Obsidian (veja abaixo). |
| `tests/` | Testes do motor e dos pacotes. |

Para remontar o pacote do Fallout depois de mexer nas notas:

```
python3 tools/fallout/extrair_regras.py "<pasta Regras>"
python3 tools/fallout/montar_pacote.py dados/fallout packages/fallout-2.2
```

Para adicionar um idioma à interface, copie `site/js/locales/en.js`, traduza e registre em `site/js/i18n.js`.

O GitHub Pages publica a cada push na `main` (veja `.github/workflows/deploy.yml`). Em **Settings → Pages**, escolha **GitHub Actions** como fonte.

A cada versão nova, atualize o `CHANGELOG.md`, o `CHANGELOG.pt-BR.md` e o `site/js/version.js`.

## Licença

MIT.
