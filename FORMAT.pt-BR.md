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

Blocos: `attributes`, `skills`, `derived`, `resources`, `counters`, `effects`, `list`, `notes` e `roller`. `items` filtra e ordena; `title` troca o título; `"wide": true` ocupa a linha toda; `points_label` troca o nome da coluna "Pontos" do bloco `skills`. Sem `layout`, o app monta um automático.

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

- **`target`** é `colecao/id`. Também vale para `attributes/FOR`, `derived/ca`, `skills/…`, `resources/…`, `counters/…`, `collections/armas` e `layout`.
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
