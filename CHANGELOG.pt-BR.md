# Changelog

Todas as mudanças do StatForge. A versão atual também aparece em Configurações.

## 0.1.8 — 31/10/2026

- **Recursos em caixinhas**: um recurso com `"display": "toggles"` mostra uma caixinha por ponto (tampas de karma, espaços de magia, usos por dia) em vez de número e barra.
- **Imunidades escondem o que não pode acontecer**: uma `immunity` pode dizer quais condições ou contadores cobre (`ref` ou `tag`), e eles deixam de aparecer nas listas de adicionar da ficha.
- Efeitos como imunidades e vantagens agora também respeitam `"if"`.
- **Entidades concedidas aparecem na lista** (por exemplo, o traço que vem com o antecedente), com o nome da origem, e saem junto com ela.
- Assistente de criação: um passo `pick` pode listar só entidades com uma `tag`.

## 0.1.7 — 31/10/2026

- **Botão voltar** na barra do topo: volta para onde você estava (por exemplo, de Configurações para a ficha aberta).
- Remover algo da ficha (raça, antecedente, item…) pede confirmação antes. Coleções marcadas com `quick_remove` (como condições) não perguntam.
- Correção: o contador de desgaste agora fica alinhado com a coluna.

## 0.1.6 — 30/10/2026

- **Hub**: Pacotes › Explorar o Hub lista os pacotes compartilhados no [StatForge Hub](https://github.com/GabrielGugg/statforge-hub) oficial. Busque, filtre por tipo e idioma, instale com um toque e veja quando um pacote que você tem ganhou versão nova ("Atualizar todos"). O endereço do Hub pode ser trocado em Configurações, então grupos podem ter o próprio.
- Pacotes podem declarar `license`.
- Autor e licença: GabrielGugg.

## 0.1.5 — 30/10/2026

- **Ficha em painel.** Cada aba é uma grade, e o pacote define a largura de cada bloco. Em **Organizar** você arrasta os blocos (mouse ou toque), muda a largura e oculta o que não usa. O arranjo vale para todas as fichas daquele sistema e pode voltar ao padrão.
- **Cartões compactos de recursos** (vida, estamina, espaços de magia…), que o pacote pode pôr no topo.
- **Contadores que só aparecem quando ativos**, com um menu para adicionar (por exemplo, níveis de sobrevivência). O texto da regra fica recolhido.
- **Equipamento inicial no assistente de criação**: o novo passo `items` põe na ficha o kit do antecedente escolhido (com desgaste e armadura vestida), ou uma alternativa, como dinheiro inicial.
- Os atributos preenchem o bloco por igual (todos numa linha quando cabe, senão duas linhas equilibradas), sem espaço vazio do lado.

## 0.1.4 — 30/10/2026

- **Assistente de criação de personagem.** Um pacote de sistema pode descrever seus passos de criação (`creation` no formato): escolher raça, classe ou antecedente, comprar atributos com pontos, escolher perícias, talentos e traços e escrever a história, com um resumo ao vivo dos valores principais e uma revisão no final. Voltar e mudar um passo é seguro. Ainda dá para pular e criar a ficha em branco.
- **Campos mais bonitos**: caixas de texto, seletores e números com visual novo; os atributos mostram o modificador num selo; os contadores de sobrevivência cabem numa linha no celular; os recursos não cortam mais o nome.
- Correção: um texto "null" perdido acima do botão "Criar ficha" (e na janela de pacotes da ficha).
- Os sistemas de exemplo agora têm passos de criação.

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
