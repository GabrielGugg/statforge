# Changelog

Todas as mudanças do StatForge. A versão atual também aparece em Configurações.

## 0.1.3 — 30/10/2026

- Os pacotes de jogo saem do repositório do app: o StatForge fica só com o motor, e todo sistema (inclusive o Fallout) é instalado como qualquer outro pacote.

## 0.1.2 — 30/10/2026

- Correção: blocos largos com tabela (como Armas) não empurram mais a página para o lado no celular.

## 0.1.1 — 30/10/2026

- **Novo ícone do app** (bigorna, chamas e d20) no cabeçalho, na aba do navegador e ao instalar o app no celular ou no computador.

## 0.1.0 — 30/10/2026

Primeira versão do StatForge, uma ficha universal escrita do zero.

- **Pacotes .json**: o app não vem com nenhum jogo. Cada sistema, homebrew, tema ou mesa é um pacote instalado por arquivo ou por link.
- **Idiomas**: o app está em inglês e português do Brasil (seletor em Configurações, automático na primeira vez). Cada pacote declara o próprio `language`, mostrado como etiqueta na tela de Pacotes.
- **Pacote de mesa**: o Mestre manda um link só, e o app instala sistema, extensões e tema. Também funciona com `?table=<link>` no endereço do app.
- **Ordem das extensões**: lista ordenável (arrastar ou setas). A de baixo vence quando duas mexem na mesma coisa, e o app mostra o conflito. Avisos de `requires`, `conflicts` e `load_after`, e botão "Sugerir ordem".
- **Patches**: add, replace, modify, remove e rename.
- **Motor de regras**: fórmulas seguras (sem código executável) e efeitos `add`, `set`, `grant`, `block`, vantagem/desvantagem, imunidade, resistência, vulnerabilidade e nota.
- **Ficha desenhada pelo pacote**: abas e blocos de atributos, perícias, valores calculados, recursos, contadores, efeitos ativos, listas de itens (equipar, quantidade, desgaste, renomear), notas e rolador de dados.
- **Fichas**: várias por aparelho, cada uma com seu sistema e suas extensões. Exportar e importar ficha.
- **Temas**: claro e escuro de fábrica (ou automático); outros temas como pacotes.
- **Backup** completo (pacotes, fichas e configurações) e funcionamento offline.
- **Guia do formato** (`FORMAT.md` e `FORMAT.pt-BR.md`), pacotes de exemplo em inglês e português, e validador pela linha de comando (`npm run validate`).
