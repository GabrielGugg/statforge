# Changelog

Todas as mudanças do StatForge. A versão atual também aparece em Configurações.

## 1.0.0 — 31/10/2026

Primeira versão oficial.

- **Sincronização com o Google Drive**: em Configurações, Conectar Google Drive guarda fichas e pacotes numa pasta escondida do app no seu próprio Drive. As mudanças sobem alguns segundos depois de feitas; ao abrir o app em outro aparelho, um toque sincroniza. Se os dois aparelhos mudaram a mesma ficha, vale a edição mais recente; fichas excluídas continuam excluídas. Cada aparelho mantém as próprias configurações.

## 0.2.9 — 31/10/2026

- **Requisitos**: as entidades podem ter `requires` (uma fórmula). As buscas e os passos de escolha (criação e subir de nível) mostram "requisito não atendido" e não deixam escolher.
- Coleções podem ser `unique`: cada entidade entra uma vez, ou até o `repeat` dela. Subir de nível oferece de novo o que ainda pode ser repetido.

## 0.2.8 — 31/10/2026

- **Dinheiro**: uma coleção pode ser o dinheiro do personagem (`currency`), com quantas moedas o sistema tiver e o valor de cada uma. O novo bloco `money` lista as moedas com uma caixa ± (digite +50 ou -20 e Enter) e, com mais de uma moeda, o total convertido para a moeda base (10 de ouro, 3 de prata e 2 de cobre = 103,2 de prata). As moedas são itens do inventário, então o peso delas pode contar.
- A alternativa do equipamento inicial pode dar itens (`alternative.items`), como moedas.
- Corrigido: os blocos de anotações apareciam vazios ao reabrir a ficha, mesmo com o texto salvo.

## 0.2.7 — 31/10/2026

- Recursos podem mostrar só o total, em cartão (`"display": "card"`), para pontos gastos e recuperados todo turno.

## 0.2.6 — 31/10/2026

- **Subir de nível**: um botão Subir de nível no topo da ficha (destacado quando há XP suficiente) abre um assistente definido pelo pacote (`progression.level_up`), com os mesmos passos da criação: escolher talento ou atributo, distribuir pontos de perícia e assim por diante. O topo mostra o que muda (PV 15 → 20), e uma revisão lista tudo antes de confirmar. Recursos gastos mantêm a mesma diferença para o novo máximo. Pacotes sem isso só somam um nível.
- Novo passo `choice`: uma opção entre algumas, lida pelos passos seguintes no `if`.

## 0.2.5 — 31/10/2026

- **Itens personalizados**: a janela de Adicionar item tem "Criar item personalizado". Escolha a categoria e preencha os campos que o pacote permite para ela (`custom` na coleção); armas também podem ganhar pente com as munições que aceitam, e campos de propriedades têm um seletor. Os itens personalizados ficam salvos na ficha, funcionam como qualquer outro (carga, desgaste, equipar, mods) e podem ser editados ou excluídos nos detalhes.
- A busca de itens mostra primeiro os que têm a palavra no nome, depois os que só a têm na descrição.

## 0.2.4 — 31/10/2026

- **Aviso automático de condições**: os pacotes podem listar condições que o app percebe sozinho (`auto_conditions`). Um aviso discreto no topo da ficha oferece aplicar a condição, ou removê-la quando deixa de valer, e some depois de 10 segundos. Avisos dispensados ficam quietos até a situação mudar, e imunidades (como um talento) impedem o aviso.
- Novas funções de fórmula: `current('id')` para o valor atual de um recurso e `maxof('colecao', 'campo')` para o maior valor entre os itens da ficha.

## 0.2.3 — 31/10/2026

- **Desgaste com efeito**: as coleções podem dizer como o desgaste muda os números do item (`wear.fields`, por exemplo DF e TD da armadura caem), acrescentar penalidades que só existem com desgaste (`wear.stats`, por exemplo ataque −2) e quebrar o item no máximo (`wear.breaks`: os efeitos param e ele aparece como Quebrado). Os valores com desgaste aparecem nos cartões de equipados e nas listas, com o valor base na dica. `wear_ignore` faz itens robustos ignorarem os primeiros níveis.
- **Termos com dica**: um campo de texto com `links` transforma nomes de propriedades em links; passar o mouse mostra a descrição, e tocar abre.

## 0.2.2 — 31/10/2026

- **Adicionar item pesquisando**: no inventário, Adicionar item pesquisa em todas as categorias de uma vez (cada resultado mostra a categoria, e um filtro estreita a busca).
- **Detalhes dos itens no inventário**: o pacote escolhe quais campos aparecem nos cartões (`card_fields`) e na lista (`list_fields`), como a carga; o desgaste aparece como selo quando é maior que 0.

## 0.2.1 — 31/10/2026

- **Caderno de notas**: o novo bloco `notebook` guarda quantas notas você quiser, cada uma com título e texto, minimizada ou aberta. A busca acha palavras dentro de títulos e textos, sem ligar para acentos (por exemplo, "bunk" acha Bunker e Bunkitidini), e destaca o trecho; Abrir leva até a nota.
- Pacotes podem passar o texto de um bloco de notas antigo para o caderno (`import_notes`), então nada escrito antes se perde.

## 0.2.0 — 31/10/2026

- **Inventário num lugar só**: o novo bloco `inventory` reúne todos os itens, em cartões por categoria ou numa lista única com busca (a escolha fica salva). Itens e quantidades são editados ali.
- **Visão de equipados**: blocos de lista com `"view": "equipped"` mostram só o que está equipado, em cartões com os números e o desgaste do item.
- **Pente e recarga**: armas com `magazine` mostram balas no pente / capacidade, gastam disparos e recarregam com a munição compatível do inventário (perguntando qual quando há mais de uma; trocar devolve as balas do pente). Armas de carga gastam uma unidade para encher. É genérico, então arco e besta funcionam também.
- **Mods dentro das armas**: coleções com `mods` deixam instalar num item as modificações que estão no inventário; `magazine_bonus` aumenta o pente.
- **Unidade de distância** em Configurações (metros, pés ou quadrados); campos `range` são convertidos, inclusive alcances que multiplicam um atributo.
- Valores calculados com `editable_bonus` ganham um campo para modificador extra.

## 0.1.9 — 31/10/2026

- **Editor de perícias**: as perícias ficam só para leitura até você tocar em **Editar**. Aí cada perícia tem − / +, o total muda na hora, e **Aplicar** salva (ou **Cancelar** desfaz).
- O bloco de perícias pode ter um `budget`: o editor mostra os pontos gastos contra ele e avisa quando você gasta a mais ou a menos; o Aplicar pergunta antes de salvar um total diferente.

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
