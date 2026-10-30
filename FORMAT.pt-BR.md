# Guia do formato de pacotes (versão 1)

[Read in English](FORMAT.md)

Este guia é para quem quer criar um sistema, um homebrew, um tema ou um pacote de mesa para o StatForge. Os arquivos da pasta `examples/` mostram tudo isso funcionando, em inglês (`examples/en/`) e em português (`examples/pt-BR/`).

Para conferir um pacote sem abrir o app: `npm run validate -- meu-pacote.json`.

## Os quatro tipos

| Tipo | Para quê |
| --- | --- |
| `system` | O jogo inteiro: atributos, perícias, itens, layout da ficha. Uma ficha usa exatamente um. |
| `extension` | Homebrew, suplemento ou errata. Só traz as mudanças (patches) sobre um sistema. |
| `theme` | Cores (e fonte) do app. |
| `table` | Pacote de mesa: uma lista de links (sistema, extensões e tema). O Mestre manda um só link e o jogador instala tudo. |

Todo pacote começa com:

```json
{
  "format": 1,
  "id": "meu-sistema",
  "name": "Meu Sistema",
  "version": "1.0.0",
  "author": "Seu nome",
  "language": "pt-BR",
  "type": "system",
  "description": "Opcional."
}
```

O `id` usa só letras, números, `-`, `_` e `.`. Não troque o `id` depois de publicar: as fichas guardam o pacote por ele. Para lançar uma versão nova, aumente `version`.

## Idioma

A estrutura do arquivo (chaves como `name`, `effects`, `type`) é sempre em inglês. O **conteúdo** (nomes, descrições, rótulos, ids dos seus próprios campos) fica no idioma que você quiser, e `language` diz qual: `"pt-BR"`, `"en"`, `"es"` etc.

Uma tradução é um pacote separado, com `id` próprio, por exemplo `fallout-2.2` e `fallout-2.2-pt`. O app mostra o idioma de cada pacote numa etiqueta, destacada quando é diferente do idioma da interface.

Fórmulas são código, então as funções e palavras-chave delas (`floor`, `sum`, `and`...) ficam em inglês em qualquer idioma. Os ids que você cria (`FOR`, `carga_max`) podem estar em qualquer idioma.

## Pacote de sistema

### Atributos, perícias, valores calculados, recursos e contadores

```json
"rolls": { "modifier": "floor((value - 10) / 2)", "default": "1d20" },
"progression": { "xp_per_level": "level * 1000" },
"attributes": [
  { "id": "FOR", "name": "Força", "abbr": "FOR", "min": 1, "max": 20, "default": 10 }
],
"skills": [
  { "id": "atletismo", "name": "Atletismo", "attribute": "FOR" }
],
"derived": [
  { "id": "ca", "name": "Classe de Armadura", "formula": "10 + mod(DES)" }
],
"resources": [
  { "id": "pv", "name": "Pontos de Vida", "max": "8 + mod(CON)", "recovery": "Descanso longo: todos." }
],
"counters": [
  { "id": "exaustao", "name": "Exaustão", "max": 6, "effects": [{ "type": "add", "target": "iniciativa", "value": "-2 * n" }] }
]
```

- **`rolls.modifier`**: como o modificador sai do valor do atributo. No Fallout, `value - 5`; no D&D, `floor((value - 10) / 2)`. Sem isso, o modificador não aparece.
- **Perícia** (`skills`): o total padrão é `pontos + mod(atributo)`. Para outra regra, use `"total": "points * 2 + mod(INT)"`.
- **Valor calculado** (`derived`): um número calculado. `"if": "has('humano')"` mostra o valor só quando a condição vale. `"unit": "kg"` aparece ao lado.
- **Recurso** (`resources`): tem valor atual (o jogador mexe) e máximo (fórmula).
- **Contador** (`counters`): vai de 0 a `max`. Os efeitos dele valem enquanto for maior que 0, com `n` = nível atual.
- **`progression.xp_per_level`**: XP total para o próximo nível. O app mostra o aviso, mas o jogador sobe o nível na mão.

Use ids sem hífen nos atributos, perícias e valores, porque eles aparecem nas fórmulas (`carga_max`, e não `carga-max`).

### Coleções e entidades

Uma coleção (`collections`) é um tipo de coisa (armas, traços, condições). Entidades (`entities`) são os itens de cada coleção.

```json
"collections": {
  "armas": {
    "name": "Armas",
    "equippable": true,
    "quantity": true,
    "wear": { "max": 10 },
    "max": 20,
    "fields": {
      "dano": { "type": "dice", "label": "Dano" },
      "peso": { "type": "number", "label": "Peso", "unit": "kg" }
    }
  }
},
"entities": {
  "armas": [
    { "id": "adaga", "name": "Adaga", "dano": "1d4", "peso": 0.5, "description": "…", "tags": ["leve"], "effects": [] }
  ]
}
```

| Opção da coleção | Efeito |
| --- | --- |
| `equippable` | Os itens têm uma caixa "equipado", e os efeitos só valem quando ela está marcada. |
| `quantity` | Mostra a coluna de quantidade. Adicionar um item repetido soma 1. |
| `wear.max` | Mostra o desgaste (−/+) até esse máximo. |
| `max` | Quantos itens a ficha pode ter nessa coleção (ex.: 1 raça). |
| `fields` | Dados mostrados nos detalhes e nas colunas. Tipos: `text`, `number`, `dice`, `boolean`, `list`. |

Coleções sem `equippable` (traços, talentos, condições) valem sempre que estão na ficha.

### Efeitos

Qualquer entidade, atributo, perícia, valor calculado, recurso ou contador pode ter `effects`:

| Tipo | Campos | O que faz |
| --- | --- | --- |
| `add` | `target`, `value` | Soma o valor (fórmula) no alvo. |
| `set` | `target`, `value` | Troca o valor base do alvo. Se houver vários, vale o maior. Os `add` entram por cima (ex.: armadura define a CA e o escudo soma +2). |
| `grant` | `ref` (`colecao/id`) | A ficha passa a ter também essa entidade, enquanto a origem estiver ativa. |
| `block` | `collection` ou `tag` | Anula os efeitos das entidades dessa coleção ou com essa tag (ex.: robô não recebe efeito de químicos). |
| `advantage`, `disadvantage` | `target`, `text` | Aparece na lista de efeitos ativos (vantagem, desvantagem). |
| `immunity`, `resistance`, `vulnerability` | `text` | Aparece na lista de efeitos ativos (imunidade, resistência, vulnerabilidade). |
| `note` | `text` | Lembrete na ficha, para regras que o app não automatiza. |

Todo efeito aceita `"if": "fórmula"`; ele só vale quando a fórmula der verdadeiro. Dentro dos efeitos de uma entidade, `qty` e `wear` são a quantidade e o desgaste daquele item na ficha.

### Fórmulas

Operações: `+ - * / %`, comparações `< <= > >= == !=`, `and` (e), `or` (ou), `not` (não), parênteses, números, `'textos'`, `true` e `false`.

| Nome | O que dá |
| --- | --- |
| ids de atributos, perícias, valores calculados | O valor atual (com efeitos). |
| id de recurso | O máximo do recurso. |
| id de contador | O nível atual. |
| `level`, `xp` | Nível e XP da ficha. |
| `mod(x)` | O modificador de um valor, pela regra de `rolls.modifier`. |
| `floor` (piso), `ceil` (teto), `round` (arredondar), `abs`, `min`, `max` | Matemática. |
| `if(cond, a, b)` | `a` se a condição valer, senão `b`. |
| `has('id')` ou `has('colecao/id')` | A ficha tem essa entidade ativa (inclui as concedidas). |
| `owns('id')` | A ficha tem o item, ativo ou não. |
| `qty('id')` | Quantidade total desse item. |
| `count('colecao')` | Quantos itens a ficha tem na coleção. |
| `sum('colecao', 'campo')` | Soma do campo × quantidade de todos os itens da coleção. Com um terceiro argumento `true`, só os equipados. |
| `tag('nome')` | Alguma entidade ativa tem essa tag. |

Uma fórmula que se refere a si mesma (direta ou indiretamente) vira aviso na ficha, e o valor fica 0.

### Layout

```json
"layout": {
  "tabs": [
    { "id": "principal", "name": "Principal", "blocks": [
      { "block": "attributes" },
      { "block": "resources", "items": ["pv"] },
      { "block": "derived", "title": "Defesa", "items": ["ca"] },
      { "block": "list", "collection": "armas", "columns": ["dano", "peso"] },
      { "block": "notes", "id": "historia", "title": "História" },
      { "block": "roller", "shortcuts": ["1d20 + mod(FOR)"] }
    ] }
  ]
}
```

Blocos: `attributes`, `skills`, `derived`, `resources`, `counters`, `effects`, `list`, `notes` e `roller`. `items` filtra e ordena; `title` troca o título; `points_label` troca o nome da coluna "Pontos" do bloco `skills`. Sem `layout`, o app monta um automático.

Cada aba é uma grade de 12 colunas. `"w"` é a largura do bloco em colunas (3, 4, 6, 8 ou 12; padrão 6, e `"wide": true` vale 12). Em tablets e celulares as larguras diminuem na mesma proporção; blocos de largura 3 ficam dois lado a lado no celular. Dê um `"id"` a cada bloco: o jogador pode arrastar, redimensionar e ocultar blocos em "Organizar", e o id mantém o arranjo dele quando você atualiza o pacote.

- Um bloco `resources` com um item só vira um cartão compacto (atual/máximo grande, barra, −1 +1 e restaurar). Coloque alguns no topo com `"w": 3`.
- `"only_active": true` num bloco `counters` mostra só os contadores acima de 0, com um menu para adicionar os outros.
- `abbr` num recurso aparece grande no cartão.

### Criação de personagem

`creation` transforma "Nova ficha" num assistente passo a passo. Cada passo guarda as escolhas do jogador, e a ficha é refeita a partir delas, então voltar e mudar um passo anterior é seguro. A última tela é sempre uma revisão. O jogador pode pular o assistente e ganhar uma ficha em branco.

```json
"creation": {
  "summary": ["pv", "ca", "iniciativa"],
  "steps": [
    { "type": "pick", "collection": "classes", "title": "Classe", "min": 1, "max": 1, "description": "…" },
    { "type": "pick", "collection": "subclasses", "min": 0, "max": 1, "match_field": "classe" },
    { "type": "pick", "collection": "talentos", "min": "pontos_talento", "max": "pontos_talento", "if": "level >= 1" },
    { "type": "attributes", "points": 6 },
    { "type": "skills", "choose": 2, "bonus": 2, "from": { "collection": "antecedentes", "field": "pericias" } },
    { "type": "skills", "points": "2 + mod(INT)", "max_per_skill": 2 },
    { "type": "items", "from": "antecedentes", "note": "notas", "alternative": { "label": "Trocar por 100 moedas", "text": "100 moedas" } },
    { "type": "info", "text": "Lembre das habilidades da classe.", "show": "classes" },
    { "type": "notes", "items": [{ "id": "historia", "title": "História", "placeholder": "…" }] }
  ]
}
```

| Passo | O que faz |
| --- | --- |
| `pick` | Escolher entidades de `collection`, entre `min` e `max` (números ou fórmulas). Com `max: 1` é escolha única. `match_field` esconde entidades cujo campo cita algo que o personagem não tem (por nome ou id; por exemplo, uma variante com `"raca": "Humano"` só aparece para humanos); o jogador ainda pode mostrar todas. |
| `attributes` | Compra de pontos a partir do `default` de cada atributo, dentro de `min` e `max`. `points` é o orçamento; diminuir um atributo devolve pontos, a menos que `"decrease": false`. |
| `skills` | Com `choose` e `bonus`: escolher essa quantidade de perícias, cada uma ganha `bonus` pontos. `from` limita a lista às perícias citadas num campo da entidade escolhida (nomes ou ids separados por vírgula). Com `points`: gastar essa quantidade de pontos livremente, até `max_per_skill` em cada. |
| `items` | Equipamento inicial. Lê `starting_items` (ou o campo indicado em `field`) do que foi escolhido na coleção `from` e põe na ficha. `alternative: { label, text }` oferece outra opção no lugar (por exemplo, dinheiro para comprar), cujo texto vai para o bloco de notas `note`. |
| `info` | Mostra `text` e a descrição completa do que foi escolhido na coleção `show`. |
| `notes` | Caixas de texto que preenchem os blocos `notes` da ficha com o mesmo `id`. |

Todo passo aceita `title`, `description` e `if` (uma fórmula: o passo só aparece quando ela é verdadeira, por exemplo `"has('robo')"`). `summary` lista os valores mostrados no topo de cada passo (padrão: todos os recursos). Recursos, atributos e valores derivados podem ter `abbr`, usado ali.

`starting_items` numa entidade é uma lista de `{ "ref": "colecao/id", "qty": 1, "wear": 0, "equipped": true, "name": "…", "if": "fórmula" }`, ou `{ "text": "…", "if": "…" }` para algo que não é entidade (vai para as notas). O `if` permite, por exemplo, que um antecedente dê kits diferentes por raça.

Uma extensão pode mudar o assistente com `{ "op": "modify", "target": "creation", "fields": { … } }`, substituí-lo ou desligá-lo com `"op": "remove"`.

## Extensão (homebrew)

```json
{
  "format": 1, "id": "minha-casa", "name": "Regras da casa", "version": "1.0.0", "language": "pt-BR",
  "type": "extension", "system": "meu-sistema",
  "requires": ["meu-sistema@>=1.0"],
  "conflicts": ["outro-homebrew"],
  "load_after": ["suplemento-armas"],
  "patches": [
    { "op": "modify", "target": "armas/adaga", "fields": { "dano": "1d6" } },
    { "op": "rename", "target": "tracos/robusto", "name": "Parrudo" },
    { "op": "remove", "target": "armas/arco-curto" },
    { "op": "replace", "target": "condicoes/caido", "entity": { "name": "Caído", "effects": [] } },
    { "op": "add", "collection": "condicoes", "entity": { "id": "nova", "name": "Nova" } }
  ]
}
```

- **`target`** é `colecao/id`. Também vale para `attributes/FOR`, `derived/ca`, `skills/…`, `resources/…`, `counters/…`, `collections/armas`, `layout` e `creation`.
- **`modify`** (ajustar) troca só os campos informados. Se mexer em `effects`, mande a lista inteira.
- **`rename`** (renomear) mantém o id, e as fichas antigas continuam achando o item.
- **`replace`** (substituir), **`remove`** (remover) e **`add`** (adicionar) fazem o que o nome diz.
- **Ordem**: as extensões são aplicadas na ordem da tela de Pacotes. Quando duas mexem no mesmo alvo, vale a de baixo, e o app avisa.
- **`requires`** (requer), **`conflicts`** (conflita) e **`load_after`** (carregar depois de) geram avisos na tela de Pacotes e na ficha. "Sugerir ordem" usa o `load_after`.

## Tema

```json
{
  "format": 1, "id": "meu-tema", "name": "Meu Tema", "version": "1.0.0", "language": "pt-BR", "type": "theme",
  "font": "Georgia, serif",
  "colors": { "--bg": "#101010", "--surface": "#1a1a1a", "--text": "#eeeeee", "--accent": "#ffcc00", "--accent-text": "#101010" }
}
```

Variáveis: `--bg` (fundo), `--surface` (cartões), `--surface-2`, `--text`, `--text-muted`, `--border`, `--accent` (destaque), `--accent-text`, `--danger`, `--warning` e `--ok`. Para ter as duas versões, use `"colors": { "light": {…}, "dark": {…} }`; o app troca conforme o aparelho. Um tema de uma só versão pode declarar `"scheme": "light"` (o padrão é escuro).

## Pacote de mesa

```json
{
  "format": 1, "id": "mesa-vault-texas", "name": "Vault Texas", "version": "1.0.0", "language": "pt-BR", "type": "table",
  "system": { "url": "https://…/fallout-2.2-pt.json" },
  "packages": [{ "url": "https://…/regras-da-casa.json" }],
  "theme": { "url": "https://…/tema-pipboy.json" }
}
```

Links relativos são resolvidos a partir do link da mesa. Se um pacote já estiver instalado e não tiver link, use `{ "id": "…" }`.

O Mestre pode mandar o link pronto: `https://<endereço-do-app>/site/?table=<link-da-mesa>`. Ao abrir, o app instala tudo.

**Onde hospedar:** o link precisa permitir acesso de outros sites (CORS). GitHub (link "raw" ou GitHub Pages) e Gist funcionam bem, e o app converte o link comum do GitHub para "raw" sozinho. Links do Google Drive e do Dropbox são convertidos para download direto, mas o Google Drive costuma bloquear esse acesso; se der erro, baixe o arquivo e use "Instalar arquivo".
