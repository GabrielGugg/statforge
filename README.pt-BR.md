# StatForge

[Read in English](README.md)

Ficha de personagem para **qualquer sistema de RPG**. O app não vem com nenhum jogo: cada sistema é um pacote `.json` que você instala por arquivo ou por link. Homebrews, temas e "pacotes de mesa" (um link que instala tudo de uma vez) funcionam do mesmo jeito.

- Funciona no navegador, no celular e offline. Pode ser instalado como app (PWA).
- Interface em inglês e português do Brasil. Cada pacote declara o próprio idioma.
- Seus dados ficam no seu navegador. Para usar em vários aparelhos, ligue a sincronização com o Google Drive em Configurações (ela salva numa pasta escondida do app no seu próprio Drive), ou leve um backup na mão. Com a sincronização desligada, o app lembra de baixar um backup quando o último tem mais de 14 dias.

## Links úteis

| | |
| --- | --- |
| 🌐 **Abrir o app** | https://gabrielgugg.github.io/statforge/site/ |
| 📦 **StatForge Hub** (pacotes para instalar) | https://github.com/GabrielGugg/statforge-hub |
| 🧭 **Tutorial: usar o app** | [Como usar](#como-usar) (abaixo) |
| 🎲 **Tutorial: Modo Mestre** | [Modo Mestre](#modo-mestre-ver-as-fichas-dos-jogadores) (abaixo) |
| 🛠️ **Tutorial: criar um sistema ou homebrew** | [Construtor](https://gabrielgugg.github.io/statforge-hub/builder/) / [Guia do formato](FORMAT.pt-BR.md) e os [exemplos](examples/) |
| 📤 **Tutorial: compartilhar um pacote no Hub** | [Guia de contribuição do Hub](https://github.com/GabrielGugg/statforge-hub/blob/main/CONTRIBUTING.pt-BR.md) |
| 📝 **O que mudou em cada versão** | [Changelog](CHANGELOG.pt-BR.md) |
| 🐞 **Relatar um bug ou pedir uma função** | [Issues](https://github.com/GabrielGugg/statforge/issues) |
| 🔒 **Política de Privacidade e Termos** | [Privacidade](https://gabrielgugg.github.io/statforge/site/privacy.html) · [Termos](https://gabrielgugg.github.io/statforge/site/terms.html) |

## Como usar

1. Abra o app e vá em **Pacotes**.
2. Instale o pacote do sistema (por arquivo ou link). Se o seu Mestre mandou um link de mesa, cole ele: o app instala o sistema, as extensões e o tema.
3. Em **Fichas**, crie uma ficha nova escolhendo o sistema e as extensões.

Quer testar? Na primeira tela, use **Testar com o exemplo**.

## Modo Mestre: ver as fichas dos jogadores

O mestre vê a ficha de cada jogador ao vivo, só leitura, divide o grupo em parties e recebe valores da equipe (furtividade da equipe, moral…) calculados sozinhos. Não existe servidor do StatForge: as fichas passam pelo Google Drive de cada pessoa.

**Mestre**

1. Toque em **Mestre** no topo, dê um nome para a mesa, escolha o sistema e toque em **Criar mesa**.
2. Entre com o Google e **copie o link de convite**. Mande para o grupo (Discord, WhatsApp…). Ele leva o seu e-mail, que os jogadores veem antes de compartilhar.
3. Quando um jogador compartilha, o Google te manda um e-mail. Toque em **Adicionar fichas compartilhadas** e escolha os arquivos "StatForge - …" no seletor do próprio Google.
4. Cada ficha vira um cartão que se atualiza sozinho (a cada 15 s por padrão; Configurações › Modo Mestre). **Abrir ficha** abre a ficha só leitura em outra guia. **Cartões** escolhe os valores que aparecem nos cartões.
5. **Nova party** cria um grupo. Mova uma ficha pelo menu do cartão ou arrastando. A **party ativa** mostra os recursos da equipe no topo.
6. **Novo recurso** cria um valor da equipe a partir de uma fórmula sobre os personagens da party, por exemplo `floor(avg(members('furtividade')))`. Veja [Recursos da equipe](FORMAT.pt-BR.md#recursos-da-equipe-modo-mestre).

**Jogador**

1. Abra o link de convite, escolha a sua ficha e confira o e-mail do mestre. Toque em **Compartilhar ficha**. O Google pode pedir para deixar o StatForge criar arquivos no seu Drive (só os arquivos que ele cria).
2. Pronto: a cópia se atualiza alguns segundos depois de cada mudança. O botão **Compartilhada com o mestre ✓** na ficha mostra quem pode ver, e **Parar de compartilhar** apaga a cópia, o que tira o acesso do mestre.

**O que mantém todo mundo seguro**

- O mestre só lê. O próprio Google recusa qualquer mudança vinda do mestre, e o app do mestre nunca tenta.
- A cópia do jogador é um arquivo separado: o app só escreve nela e nunca lê de volta, então nada feito nela muda a ficha de verdade.
- A cópia é compartilhada com um único e-mail, como leitor. Se outra pessoa ganhar acesso (mexendo no Drive, por exemplo), as atualizações param e o jogador é avisado.
- Parties e recursos da equipe ficam só com o mestre. Os jogadores nunca veem a mesa nem as fichas uns dos outros.
- Mais em [SECURITY.pt-BR.md](SECURITY.pt-BR.md).

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
| `site/js/sync.js` | Sincronização com o Google Drive (um arquivo na pasta escondida do app; a mescla fica em `engine/merge.js`). Quem hospedar o StatForge por conta própria põe o seu ID de cliente OAuth em Configurações › Sincronização na nuvem › Avançado, ou em `DEFAULT_CLIENT_ID`. |
| `site/js/ui/` | Telas. |
| `site/js/locales/` | Textos da interface, um arquivo por idioma. `en.js` é a base; os outros idiomas caem nele quando falta algo. |
| `site/js/packages.js`, `storage.js` | Instalação de pacotes e armazenamento (IndexedDB). |
| `examples/en/`, `examples/pt-BR/` | Sistema, homebrew, tema e mesa de exemplo. |
| `tests/` | Testes do motor. |

Para adicionar um idioma à interface, copie `site/js/locales/en.js`, traduza e registre em `site/js/i18n.js`.

O GitHub Pages publica a cada push na `main` (veja `.github/workflows/deploy.yml`). Em **Settings → Pages**, escolha **GitHub Actions** como fonte.

A cada versão nova, atualize o `CHANGELOG.md`, o `CHANGELOG.pt-BR.md` e o `site/js/version.js`.

## Pacotes e o Hub

Os pacotes de jogo não ficam neste repositório. Encontre e compartilhe no [StatForge Hub](https://github.com/GabrielGugg/statforge-hub), que o app abre em **Pacotes › Explorar o Hub**.

## Licença

MIT © GabrielGugg. Veja [LICENSE](LICENSE).
