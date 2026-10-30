#!/usr/bin/env python3
"""Converte as notas .md do Obsidian (regras traduzidas do Fallout TTRPG 2.1)
nos JSON de dados/fallout/ que o app carrega.

Uso:
    python scripts/fallout/extrair_regras.py "<pasta com as notas .md>"

Pode ser rodado de novo sempre que a tradução no Obsidian mudar: os JSON são
regenerados por inteiro. Nenhum texto é inventado aqui; o script só recorta
as notas pelos títulos e tabelas.
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
SAIDA = RAIZ / 'dados' / 'fallout'

ATRIBUTOS = {
    'Força': 'FOR', 'Percepção': 'PER', 'Resistência': 'RES', 'Carisma': 'CAR',
    'Inteligência': 'INT', 'Agilidade': 'AGI', 'Sorte': 'SOR',
}
PERICIAS = {
    'Barganha': 'barganha', 'Sabotagem': 'sabotagem', 'Criação': 'criacao',
    'Energia': 'energia', 'Explosivos': 'explosivos', 'Disparo': 'disparo',
    'Intimidação': 'intimidacao', 'Medicina': 'medicina', 'Corpo a Corpo': 'corpo_a_corpo',
    'Ciência': 'ciencia', 'Furtividade': 'furtividade', 'Persuasão': 'persuasao',
    'Sobrevivência': 'sobrevivencia', 'Pugilismo': 'pugilismo',
}
RACAS = {
    'Humano': 'humano', 'Necrótico': 'necrotico', 'Sintético Gen 2': 'sintetico',
    'Sintético': 'sintetico', 'Robô': 'robo', 'Super Mutante': 'super_mutante',
    'Supermutante': 'super_mutante',
}


def slug(texto):
    """Identificador estável: minúsculas, sem acento, palavras unidas por _."""
    t = unicodedata.normalize('NFKD', texto).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '_', t.lower()).strip('_')


def limpar(texto):
    """Tira a sintaxe do Obsidian (links, imagens) e deixa Markdown simples."""
    texto = re.sub(r'!\[\[[^\]]*\]\]', '', texto)
    texto = re.sub(r'\[\[[^\]|]*\\?\|([^\]]*)\]\]', r'\1', texto)
    texto = re.sub(r'\[\[[^\]#]*#([^\]]*)\]\]', r'\1', texto)
    texto = re.sub(r'\[\[([^\]]*)\]\]', r'\1', texto)
    texto = re.sub(r'\n{3,}', '\n\n', texto)
    return texto.strip()


def ler(pasta, nome):
    """Lê uma nota sem o frontmatter YAML."""
    texto = (pasta / nome).read_text(encoding='utf-8')
    if texto.startswith('---'):
        texto = texto.split('---', 2)[2]
    return texto.split('\n---\n')[0] if '\nAnterior:' in texto else texto


def secoes(texto, nivel):
    """Divide o texto pelos títulos do nível dado. Devolve [(titulo, corpo)]."""
    marca = '#' * nivel + ' '
    partes, atual, corpo = [], None, []
    for linha in texto.split('\n'):
        if linha.startswith(marca):
            if atual is not None:
                partes.append((atual, '\n'.join(corpo)))
            atual, corpo = linha[len(marca):].strip(), []
        elif atual is not None:
            corpo.append(linha)
    if atual is not None:
        partes.append((atual, '\n'.join(corpo)))
    return partes


def tracos_em_negrito(corpo):
    """Parágrafos no formato ***Nome.*** texto -> [{nome, texto}]."""
    itens = []
    for m in re.finditer(r'^\*\*\*(.+?)\*\*\*\s*(.*)$', corpo, re.M):
        nome = m.group(1).strip().rstrip('.!').strip()
        itens.append({'nome': nome, 'texto': limpar(m.group(2))})
    return itens


def intro(corpo):
    """Texto antes do primeiro traço em negrito, sem citações de abertura."""
    antes = re.split(r'^\*\*\*', corpo, maxsplit=1, flags=re.M)[0]
    linhas = [l for l in antes.split('\n') if not l.startswith('>')]
    return limpar('\n'.join(linhas))


def tabela(linhas):
    """Tabela Markdown -> lista de dicionários (cabeçalho como chave)."""
    cab = [c.strip() for c in linhas[0].strip('|').split('|')]
    rows = []
    for l in linhas[2:]:
        cels = [limpar(c.strip()) for c in re.split(r'(?<!\\)\|', l.strip().strip('|'))]
        rows.append({cab[i] if cab.count(cab[i]) == 1 else f'{cab[i]} {i}': (cels[i] if i < len(cels) else '')
                     for i in range(len(cab))})
    return rows


def tabelas(corpo):
    """Todas as tabelas de um trecho, na ordem."""
    resultado, bloco = [], []
    for l in corpo.split('\n') + ['']:
        if l.startswith('|'):
            bloco.append(l)
        elif bloco:
            resultado.append(tabela(bloco))
            bloco = []
    return resultado


# ---------------------------------------------------------------- Raças
def extrair_racas(pasta):
    texto = ler(pasta, 'Raças.md')
    racas = []
    for titulo, corpo in secoes(texto, 2):
        if titulo not in RACAS:
            continue
        subs = secoes(corpo, 3)
        base = corpo.split('\n### ')[0]
        raca = {
            'id': RACAS[titulo], 'nome': titulo, 'descricao': intro(base),
            'tracos': tracos_em_negrito(base), 'variantes': [], 'subtipos': [],
        }
        for st, sc in subs:
            if st.startswith('Traços de'):
                raca['variantes'] = tracos_em_negrito(sc)
            else:
                raca['subtipos'].append({
                    'id': slug(st), 'nome': st, 'descricao': intro(sc), 'tracos': tracos_em_negrito(sc),
                })
        racas.append(raca)
    return racas


# ---------------------------------------------------------------- Traços
def extrair_tracos(pasta):
    texto = ler(pasta, 'Traços.md')
    saida = {'ermo_selvagem': '', 'personagem': [], 'antecedente': []}
    for titulo, corpo in secoes(texto, 2):
        if titulo == 'Ermo Selvagem':
            saida['ermo_selvagem'] = limpar(corpo)
            continue
        grupo = {'Traços de Personagem': 'personagem', 'Traços de Antecedente': 'antecedente'}.get(titulo)
        if not grupo:
            continue
        for nome, sc in secoes(corpo, 3):
            req = re.search(r'^\*(?:Pré-r|R)equisito:\s*(.+?)\.?\*\s*$', sc, re.M)
            ermo = re.search(r'^\*\*Ermo Selvagem:\*\*\s*(.+)$', sc, re.M)
            corpo_txt = re.sub(r'^\*(?:Pré-r|R)equisito:.*$', '', sc, flags=re.M)
            corpo_txt = re.sub(r'^\*\*Ermo Selvagem:\*\*.*$', '', corpo_txt, flags=re.M)
            saida[grupo].append({
                'id': slug(nome), 'nome': nome,
                'requisito': limpar(req.group(1)) if req else '',
                'requisitos': requisitos(req.group(1)) if req else {},
                'texto': limpar(corpo_txt), 'ermo_selvagem': limpar(ermo.group(1)) if ermo else '',
            })
    return saida


def requisitos(texto):
    """Interpreta 'Força 5', 'Humano, Resistência 8', 'Robô ou Sintético, nível 10'.
    O que não for reconhecido vai para 'especial' (conferido pelo jogador)."""
    r = {}
    texto = limpar(texto).rstrip('.')
    for nome, chave in ATRIBUTOS.items():
        m = re.search(nome + r'\s+(\d+)(\s+ou menos)?', texto)
        if m:
            r.setdefault('maximo' if m.group(2) else 'atributos', {})[chave] = int(m.group(1))
    m = re.search(r'[Nn]ível\s+(\d+)', texto)
    if m:
        r['nivel'] = int(m.group(1))
    racas = [rid for nome, rid in RACAS.items() if re.search(r'\b' + nome + r'\b', texto)]
    if racas:
        r['racas'] = sorted(set(racas))
    if not r:
        r['especial'] = texto
    return r


# ---------------------------------------------------------------- Talentos
def extrair_talentos(pasta):
    texto = ler(pasta, 'Talentos.md')
    talentos = []
    for grupo, corpo in secoes(texto, 2):
        if not grupo.startswith('Talentos'):
            continue
        nivel_item = 4 if grupo == 'Talentos de Raça' else 3
        for nome, sc in secoes(corpo, nivel_item):
            req = re.search(r'^\*Requisito:\s*(.+?)\.?\*\s*$', sc, re.M)
            corpo_txt = re.sub(r'^\*Requisito:.*$', '', sc, flags=re.M)
            corpo_txt = corpo_txt.split('\n### ')[0]
            talentos.append({
                'id': slug(nome), 'nome': nome, 'grupo': grupo.replace('Talentos ', '').replace('de ', '').strip(),
                'requisito': limpar(req.group(1)) if req else '',
                'requisitos': requisitos(req.group(1)) if req else {},
                'texto': limpar(corpo_txt),
            })
    return talentos


# ---------------------------------------------------------------- Antecedentes
def extrair_antecedentes(pasta):
    texto = ler(pasta, 'Antecedentes.md')
    resumo = {}
    for titulo, corpo in secoes(texto, 2):
        if titulo.startswith('Resumo'):
            for row in tabelas(corpo)[0]:
                resumo[row['Antecedente']] = row
    lista = []
    for titulo, corpo in secoes(texto, 2):
        if titulo not in resumo:
            continue
        row = resumo[titulo]
        pericias = [PERICIAS[p.strip()] for p in row['Perícias (+2)'].split(',') if p.strip() in PERICIAS]
        partes = corpo.split('***Equipamento Inicial.***')
        desc = re.sub(r'^\*\*(Perícias|Traço):\*\*.*$', '', partes[0], flags=re.M)
        equip, nota = [], ''
        if len(partes) > 1:
            atual = None
            for l in partes[1].strip().split('\n'):
                m = re.match(r'^\*\*(.+)\*\*\s*$', l.strip())
                if m:
                    atual = {'rotulo': m.group(1), 'racas': [rid for n, rid in RACAS.items() if n in m.group(1)], 'itens': ''}
                    equip.append(atual)
                elif l.strip() and atual is not None:
                    atual['itens'] = (atual['itens'] + ' ' + limpar(l)).strip()
                elif l.strip():
                    nota = (nota + ' ' + limpar(l)).strip()
            for e in equip:
                e['racas'] = sorted(set(e['racas']))
        lista.append({
            'id': slug(titulo), 'nome': titulo, 'pericias': pericias,
            'traco': limpar(row['Traço']).replace('\\', '') if row['Traço'] != '—' else '',
            'descricao': limpar(desc), 'equipamento': equip, 'nota_equipamento': nota,
        })
    return lista


# ---------------------------------------------------------------- Itens
def extrair_itens(pasta):
    """Cada linha de tabela com coluna Nome/Tipo de Armadura vira um item, com a
    categoria (##) e a subcategoria (###) de onde veio."""
    texto = ler(pasta, 'Itens e Custo.md')
    descricoes = _descricoes_de_itens(texto)
    itens = []
    for cat, corpo in secoes(texto, 2):
        blocos = [('', corpo.split('\n### ')[0])] + secoes(corpo, 3)
        for sub, sc in blocos:
            for t in tabelas(sc):
                for row in _desdobrar_pares(t):
                    nome = (row.get('Nome') or row.get('Tipo de Armadura') or row.get('Melhoria')
                            or row.get('Modificação') or row.get('Tipo de Munição (Custo)') or row.get('Tipo de Seringa'))
                    if not nome:
                        continue
                    campos = {k: v for k, v in row.items() if v not in ('Nome', 'Tipo de Armadura') and k not in ('Nome', 'Tipo de Armadura')}
                    item = {'id': slug(f'{sub or cat}-{nome}'), 'nome': nome, 'categoria': cat,
                            'subcategoria': sub, 'campos': campos}
                    desc = descricoes.get(slug(nome))
                    if desc:
                        item['descricao'] = desc
                    itens.append(item)
    return itens


def _descricoes_de_itens(texto):
    """Parágrafos ***Nome.*** das notas de itens, por slug do nome. "Bolsa,
    Mochila" também responde por "Mochila". Nomes que se repetem com textos
    diferentes (regras gerais) ficam de fora."""
    vistos = {}
    for t in tracos_em_negrito(texto):
        nomes = [t['nome']]
        if ',' in t['nome']:
            nomes.append(t['nome'].split(',', 1)[1].strip())
        for n in nomes:
            k = slug(n)
            if k in vistos and vistos[k] != t['texto']:
                vistos[k] = None
            else:
                vistos[k] = t['texto']
    return {k: v for k, v in vistos.items() if v}


def _desdobrar_pares(linhas):
    """Tabelas de munição vêm em pares de colunas (Tipo | Custo | Tipo | Custo):
    cada par vira uma linha própria com Nome e Custo."""
    saida = []
    for row in linhas:
        chaves = list(row)
        if chaves[:1] == ['Tipo 0'] and len(chaves) == 4:
            for i in (0, 2):
                nome, custo = row[chaves[i]], row[chaves[i + 1]]
                if nome:
                    saida.append({'Nome': nome, 'Custo': custo})
        else:
            saida.append(row)
    return saida


def extrair_propriedades(pasta):
    """Glossário das propriedades de itens (Superestimulante, Duas Mãos...):
    parágrafos ***Nome.*** das seções cujo título tem "Propriedades"."""
    texto = ler(pasta, 'Itens e Custo.md')
    glossario = {}
    for nivel in (2, 3):
        for titulo, corpo in secoes(texto, nivel):
            if 'Propriedades' not in titulo:
                continue
            trecho = corpo.split('\n## ')[0].split('\n### ')[0] if nivel == 2 else corpo.split('\n## ')[0]
            for t in tracos_em_negrito(trecho):
                nome = re.sub(r'\s*\(.*?\)$', '', t['nome']).strip()
                nome = re.sub(r':.*$', '', nome).strip()
                glossario.setdefault(nome, {'nome': t['nome'], 'texto': t['texto'], 'secao': titulo})
    return list(glossario.values())


# ---------------------------------------------------------------- Perícias
def extrair_pericias(pasta):
    """Descrição de cada perícia: os parágrafos ***Nome (perícia).*** de
    Atributos e Perícias (e os parágrafos soltos logo depois), com o atributo
    (##) em que aparecem. A mesma perícia pode aparecer em mais de um atributo."""
    texto = ler(pasta, 'Atributos e Perícias.md')
    saida = {pid: {'id': pid, 'nome': nome, 'textos': []} for nome, pid in PERICIAS.items()}
    atributo, atual = None, None
    for par in re.split(r'\n\s*\n', texto):
        par = par.strip()
        if par.startswith('## '):
            atributo, atual = par[3:].strip(), None
            continue
        if par.startswith('#') or par.startswith('>') or par.startswith('|'):
            atual = None
            continue
        m = re.match(r'^\*\*\*(.+?) \(perícia\)\.\*\*\*\s*(.*)$', par, re.S)
        if m and m.group(1).strip() in PERICIAS:
            pid = PERICIAS[m.group(1).strip()]
            corpo = limpar(m.group(2))
            if any(t['texto'] == corpo for t in saida[pid]['textos']):
                atual = None
                continue
            atual = {'atributo': atributo, 'texto': corpo}
            saida[pid]['textos'].append(atual)
        elif par.startswith('***'):
            atual = None
        elif atual is not None:
            atual['texto'] += '\n\n' + limpar(par)
    return list(saida.values())


# ---------------------------------------------------------------- Condições
def extrair_condicoes(pasta):
    texto = ler(pasta, 'Combate.md')
    for titulo, corpo in secoes(texto, 2):
        if titulo == 'Condições':
            return [{'id': slug(n), 'nome': n, 'texto': limpar(c)} for n, c in secoes(corpo, 3)]
    return []


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)
    pasta = Path(sys.argv[1])
    SAIDA.mkdir(parents=True, exist_ok=True)
    arquivos = {
        'racas.json': extrair_racas(pasta),
        'tracos.json': extrair_tracos(pasta),
        'talentos.json': extrair_talentos(pasta),
        'antecedentes.json': extrair_antecedentes(pasta),
        'itens.json': extrair_itens(pasta),
        'condicoes.json': extrair_condicoes(pasta),
        'propriedades.json': extrair_propriedades(pasta),
        'pericias.json': extrair_pericias(pasta),
    }
    for nome, dados in arquivos.items():
        (SAIDA / nome).write_text(json.dumps(dados, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
        print(f'{nome}: {len(dados)}')


if __name__ == '__main__':
    main()
