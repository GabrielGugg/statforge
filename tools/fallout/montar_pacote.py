"""Builds the StatForge package "Fallout TTRPG 2.2 (pt-BR)" from the data
extracted from GabrielGugg's Obsidian notes (dados/fallout/*.json, made by the v0.5
extractor). Usage: python build_fallout.py <dados/fallout dir> <output dir>"""
import json, re, sys
from pathlib import Path

SRC, OUT = Path(sys.argv[1]), Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)
load = lambda n: json.load(open(SRC / f'{n}.json', encoding='utf-8'))


def clean(s):
    s = re.sub(r'\*{1,3}([^*\n]+?)\*{1,3}', r'\1', str(s or ''))
    return re.sub(r'\n{3,}', '\n\n', s).strip()


def num(s):
    m = re.search(r'\d+(?:,\d+)?', str(s or '').replace('.', ''))
    return float(m.group(0).replace(',', '.')) if m else None


def tidy(n):
    return int(n) if n is not None and float(n).is_integer() else n


def carga_e_forca(campos):
    txt = next((v for k, v in campos.items() if k.startswith('Carga')), '')
    m = re.search(r'Carga\s*(\d+(?:[.,]\d+)?)', txt)
    carga = float(m.group(1).replace(',', '.')) if m else num(txt)
    f = re.search(r'FOR\s*(\d+)', txt)
    return tidy(carga), (int(f.group(1)) if f else None)


ATR = [('FOR', 'Força', 'S'), ('PER', 'Percepção', 'P'), ('RES', 'Resistência', 'E'), ('CAR', 'Carisma', 'C'),
       ('INT', 'Inteligência', 'I'), ('AGI', 'Agilidade', 'A'), ('SOR', 'Sorte', 'L')]
PER = [('barganha', 'Barganha', ['CAR']), ('ciencia', 'Ciência', ['INT']), ('corpo_a_corpo', 'Corpo a Corpo', ['FOR']),
       ('criacao', 'Criação', ['INT']), ('disparo', 'Disparo', ['AGI']), ('energia', 'Energia', ['PER']),
       ('explosivos', 'Explosivos', ['PER']), ('furtividade', 'Furtividade', ['AGI']), ('intimidacao', 'Intimidação', ['FOR', 'CAR']),
       ('medicina', 'Medicina', ['PER', 'INT']), ('persuasao', 'Persuasão', ['CAR']), ('pugilismo', 'Pugilismo', ['FOR']),
       ('sabotagem', 'Sabotagem', ['PER', 'INT']), ('sobrevivencia', 'Sobrevivência', ['RES'])]
SKILL_IDS = [p[0] for p in PER]
ADD = lambda target, value, **kw: {'type': 'add', 'target': target, 'value': str(value), **kw}
NOTE = lambda text: {'type': 'note', 'text': text}
DIS = lambda target, text: {'type': 'disadvantage', 'target': target, 'text': text}
ADV = lambda target, text: {'type': 'advantage', 'target': target, 'text': text}

pericias_txt = {p['id']: p for p in load('pericias')}
skills = []
for pid, nome, attrs in PER:
    txt = '\n\n'.join(f"{t['atributo']}: {clean(t['texto'])}" if len(pericias_txt[pid]['textos']) > 1 else clean(t['texto'])
                      for t in pericias_txt[pid]['textos'])
    if len(attrs) > 1:
        txt = f"Atributo padrão: {dict((a[0], a[1]) for a in ATR)[attrs[0]]}. Também pode usar {', '.join(dict((a[0], a[1]) for a in ATR)[x] for x in attrs[1:])} quando o Mestre permitir (ajuste os pontos para compensar).\n\n" + txt
    skills.append({'id': pid, 'name': nome, 'attribute': attrs[0], 'description': txt,
                   'total': f"points + mod({attrs[0]}) + floor(mod(SOR) / 2) - penalidade_d20"})

LOAD_COLS = ['armas', 'armaduras', 'armadura_potente', 'explosivos', 'municao', 'quimicos', 'medicina', 'comida', 'equipamentos', 'revistas', 'itens_unicos']
carga_formula = ' + '.join(f"sum('{c}', 'carga')" for c in LOAD_COLS) + " - sum('armaduras', 'carga', true) / 2"

derived = [
    {'id': 'df', 'name': 'Defesa (DF)', 'formula': '10', 'description': 'Sem armadura, 10. A armadura vestida define a DF; o desgaste tira metade dos níveis (arredondado para baixo), sem ficar abaixo de 10.'},
    {'id': 'td', 'name': 'Tolerância a Dano (TD)', 'formula': '0', 'description': 'Vem da armadura vestida e das melhorias. O desgaste tira metade dos níveis (arredondado para baixo).'},
    {'id': 'iniciativa', 'name': 'Iniciativa', 'formula': '10 + mod(PER)'},
    {'id': 'sentidos', 'name': 'Sentidos Passivos', 'formula': '12 + mod(PER)'},
    {'id': 'fator_cura', 'name': 'Fator de Cura', 'formula': 'floor((level + RES) / 2)', 'description': '6 horas de descanso restauram PV iguais ao Fator de Cura.'},
    {'id': 'lr', 'name': 'Limiar de Radiação (LR)', 'formula': '12 - mod(RES)', 'if': "has('humano')"},
    {'id': 'falhas_morte', 'name': 'Suspiros Finais falhos para morrer', 'formula': "if(has('humano'), 4, 3)"},
    {'id': 'penalidade_d20', 'name': 'Redutor nos d20 (exceto Sorte)', 'formula': 'fome + desidratacao + fadiga + exaustao + radiacao + hipotermia + superaquecimento',
     'description': 'Cada nível de fome, desidratação, fadiga, exaustão, radiação, hipotermia e superaquecimento reduz em 1 as rolagens de d20 (exceto testes de Sorte). Já está descontado das perícias.'},
    {'id': 'carga', 'name': 'Carga atual', 'formula': carga_formula, 'description': 'Soma a carga de tudo no inventário; a armadura vestida conta pela metade. Itens de vestir (mochila, trajes) usam a carga cheia: ajuste pelo nome se quiser.'},
    {'id': 'carga_max', 'name': 'Capacidade de Carga', 'formula': 'FOR * 10'},
    {'id': 'pontos_talento', 'name': 'Pontos de Talento (total)', 'formula': 'level - (level >= 5) - (level >= 9) - (level >= 13) - (level >= 17) - (level >= 19)',
     'description': 'Um por nível, menos nos níveis 5, 9, 13, 17 e 19. Cada ponto compra um talento ou +1 em um atributo.'},
    {'id': 'pericia_por_concessao', 'name': 'Pontos de Perícia por concessão', 'formula': 'if(INT <= 4, 3, if(INT == 5, 4, 5))'},
    {'id': 'pontos_pericia', 'name': 'Pontos de Perícia (total)', 'formula': '((level >= 5) + (level >= 9) + (level >= 13) + (level >= 17) + (level >= 21) + (level >= 25) + (level >= 29)) * pericia_por_concessao',
     'description': 'Ganhos nos níveis 5, 9, 13, 17, 21, 25 e 29.'},
]
evol = lambda a: f"10 + 5 * (ceil(level / 2) - 1) + mod({a}) * ceil(level / 2)"
resources = [
    {'id': 'pv', 'name': 'Pontos de Vida', 'max': evol('RES'), 'recovery': '6 horas de descanso: PV iguais ao Fator de Cura.'},
    {'id': 'pe', 'name': 'Pontos de Estamina', 'max': evol('AGI'), 'recovery': '1 hora de descanso: metade; dormir confortavelmente: todos.'},
    {'id': 'pa', 'name': 'Pontos de Ação', 'max': 'min(15, 10 + mod(AGI))'},
    {'id': 'karma', 'name': 'Tampas de Karma', 'max': '1 + (SOR >= 10)', 'recovery': 'Renovam a cada sessão.'},
]

conds = {c['id']: c for c in load('condicoes')}
def ctext(cid): return clean(conds[cid]['texto']) if cid in conds else ''
counters = [
    {'id': 'fome', 'name': 'Fome', 'max': 10, 'description': ctext('fome') or 'Chegar a 10 mata.'},
    {'id': 'desidratacao', 'name': 'Desidratação', 'max': 10, 'description': ctext('desidratacao')},
    {'id': 'fadiga', 'name': 'Fadiga', 'max': 9, 'description': ctext('fadiga')},
    {'id': 'exaustao', 'name': 'Exaustão', 'max': 10, 'description': ctext('exaustao')},
    {'id': 'radiacao', 'name': 'Radiação', 'max': 10, 'description': ctext('radiacao_ou_rads')},
    {'id': 'hipotermia', 'name': 'Hipotermia', 'max': 10, 'description': ctext('hipotermia'), 'effects': [ADD('pa', '-floor(n / 2)')]},
    {'id': 'superaquecimento', 'name': 'Superaquecimento', 'max': 10, 'description': ctext('superaquecimento'), 'effects': [ADD('pa', '-floor(n / 2)')]},
    {'id': 'sangramento', 'name': 'Sangramento', 'max': 10, 'description': ctext('sangramento')},
    {'id': 'curto_circuito', 'name': 'Curto-Circuito', 'max': 10, 'description': ctext('curto_circuito'), 'effects': [ADD('pa', '-n'), NOTE('Curto-Circuito: 1d12 de dano de eletricidade por nível no início do turno.')]},
]

# ---------------------------------------------------------------- races
racas, variantes, subtipos = [], [], []
RACE_FX = {
    'humano': [],
    'necrotico': [{'type': 'immunity', 'text': 'Radiação (não ganha níveis de radiação)'}],
    'sintetico': [{'type': 'block', 'collection': 'quimicos'}, {'type': 'block', 'collection': 'comida'}, {'type': 'block', 'tag': 'stimpak'},
                  {'type': 'immunity', 'text': 'Radiação e veneno'}],
    'robo': [{'type': 'block', 'collection': 'quimicos'}, {'type': 'block', 'collection': 'comida'}, {'type': 'block', 'collection': 'medicina'},
             {'type': 'immunity', 'text': 'Radiação e veneno'}],
    'super_mutante': [ADD('FOR', 1), ADD('carga_max', 40), {'type': 'immunity', 'text': 'Radiação'}],
}
VAR_FX = {
    'Engenhoso': [ADD('karma', 1)],
    'Imaculado': [DIS('radiacao', 'Testes de Radiação e de Vício')],
    'Muitas Estradas Percorridas': [ADD('pontos_talento', 1)] + [ADD(s, 2) for s in SKILL_IDS],
    'Ossos Velhos': [{'type': 'immunity', 'text': 'Veneno'}],
    'Corpo Frágil': [{'type': 'vulnerability', 'text': 'Eletricidade'}],
    'Algoritmos de Inteligência Artificial': [ADD('pericia_por_concessao', 1)],
    'Cepa Defeituosa': [ADD('FOR', 1), ADD('RES', 2), ADD('INT', -2), NOTE('Cepa Defeituosa: Inteligência no máximo 3.')],
}
for r in load('racas'):
    traits = '\n\n'.join(f"{t['nome']}. {clean(t['texto'])}" for t in r['tracos'])
    desc = clean(r['descricao']) + ('\n\nTRAÇOS DA RAÇA\n\n' + traits if traits else '')
    racas.append({'id': r['id'], 'name': r['nome'], 'description': desc, 'effects': RACE_FX.get(r['id'], [])})
    for v in r['variantes']:
        vid = re.sub(r'[^a-z0-9]+', '_', v['nome'].lower().encode('ascii', 'ignore').decode()).strip('_')
        variantes.append({'id': vid or f"{r['id']}_var", 'name': v['nome'], 'raca': r['nome'], 'description': clean(v['texto']),
                          'tags': [r['id']], 'effects': VAR_FX.get(v['nome'], [])})
    for s in r.get('subtipos', []):
        traits = '\n\n'.join(f"{t['nome']}. {clean(t['texto'])}" for t in s['tracos'])
        subtipos.append({'id': s['id'], 'name': s['nome'], 'description': clean(s['descricao']) + '\n\n' + traits,
                         'effects': [ADD('td', 1)] if s['id'] == 'guardatron' else []})
# fix Noturno id collision etc.
seen = set()
for v in variantes:
    while v['id'] in seen: v['id'] += '_2'
    seen.add(v['id'])

# ---------------------------------------------------------------- traits
tr = load('tracos')
trait_fx = {
    'metabolismo_rapido': ([ADD('fator_cura', 2), ADD('lr', 3)], [ADD('fator_cura', 'level')]),
    'pecas_baratas': ([ADD('fator_cura', 2), ADD('df', -1)], [ADD('fator_cura', 'level'), ADD('df', -1), ADD('td', -2)]),
    'parrudo': ([ADD('pv', 'level'), ADD('pe', '-level')], [ADD('pv', '2 * level'), ADD('pe', '-2 * level')]),
    'estrutura_pequena': ([ADD('pe', 'level'), ADD('pv', '-level')], [ADD('pe', '2 * level'), ADD('pv', '-2 * level')]),
    'dotado': ([ADD('carga_max', 10), ADD('iniciativa', 1), ADD('karma', 1)] + [ADD(s, -3) for s in SKILL_IDS],
               [ADD('carga_max', 20), ADD('iniciativa', 2), ADD('karma', 2)] + [ADD(s, -6) for s in SKILL_IDS]),
    'acumulador': ([ADD('carga_max', 25), NOTE('Acumulador: desvantagem em testes e ataques carregando menos de 50 de carga.')],
                   [NOTE('Acumulador (Ermo Selvagem): imune a sobrecarregado; ganha fadiga quando a carga fica abaixo do máximo.')]),
}
tracos = []
for t in tr['personagem']:
    req = f"Requisito: {t['requisito']}\n\n" if t.get('requisito') else ''
    fx, fx_ermo = trait_fx.get(t['id'], ([], []))
    tracos.append({'id': t['id'], 'name': t['nome'], 'requisito': t.get('requisito') or '', 'description': req + clean(t['texto']), 'effects': fx})
    if t.get('ermo_selvagem'):
        tracos.append({'id': f"{t['id']}_ermo", 'name': f"{t['nome']} (Ermo Selvagem)", 'requisito': t.get('requisito') or '',
                       'description': req + clean(t['ermo_selvagem']) + '\n\n' + clean(tr['ermo_selvagem']),
                       'tags': ['ermo_selvagem'], 'effects': fx_ermo})
bg_traits = {t['nome']: t for t in tr['antecedente']}

# ---------------------------------------------------------------- backgrounds
antecedentes = []
skill_name = {p[0]: p[1] for p in PER}
for a in load('antecedentes'):
    parts = [clean(a['descricao'])]
    if a['pericias']: parts.append('Perícias: +2 em ' + ', '.join(skill_name[s] for s in a['pericias']) + '.')
    if a['traco'] and a['traco'] in bg_traits: parts.append(f"Traço de antecedente: {a['traco']}. {clean(bg_traits[a['traco']]['texto'])}")
    for e in a.get('equipamento', []):
        parts.append(f"Equipamento ({e['rotulo']}): {clean(e['itens'])}")
    if a.get('nota_equipamento'): parts.append(clean(a['nota_equipamento']))
    fx = [ADD(s, 2) for s in a['pericias']]
    if a['id'] == 'antecedente_personalizado':
        fx = []
        parts.append('Escolha três perícias para receber +2: some os pontos na tela de perícias.')
    antecedentes.append({'id': a['id'], 'name': a['nome'], 'pericias': ', '.join(skill_name[s] for s in a['pericias']),
                         'traco': a['traco'], 'description': '\n\n'.join(parts), 'effects': fx})

# ---------------------------------------------------------------- perks
TAL_FX = {'acumulador': [ADD('carga_max', 50), NOTE('Acumulador: objetos pesados não deixam você lento.')], 'rato_de_carga': [ADD('carga_max', 10)]}
talentos = []
for t in load('talentos'):
    req = f"Requisito: {t['requisito']}\n\n" if t.get('requisito') else ''
    talentos.append({'id': t['id'], 'name': t['nome'], 'grupo': t['grupo'], 'requisito': t.get('requisito') or '',
                     'description': req + clean(t['texto']), 'tags': [t['grupo'].lower()], 'effects': TAL_FX.get(t['id'], [])})

# ---------------------------------------------------------------- conditions
COND_FX = {
    'atordoado': [ADD('pa', -3), NOTE('Atordoado: não pode reciclar PA.')],
    'bebado': [ADD('pa', -2), ADD('pe', 'level')],
    'mamado': [ADD('pe', 'level'), ADD('penalidade_d20', 5), NOTE('Mamado: inclua também Bêbado e Léso.')],
    'leso': [DIS('INT', 'Testes de Inteligência e Percepção'), ADV('RES', 'Testes de Resistência e Força')],
    'envenenado': [DIS('d20', 'Todas as rolagens de d20')],
    'choque': [DIS('d20', 'Todas as rolagens de d20'), NOTE('Choque: não recupera PE.')],
    'caido': [DIS('ataque', 'Rolagens de ataque')],
    'desequilibrado': [DIS('ataque', 'Rolagens de ataque'), ADD('df', -2)],
    'cego': [DIS('visao', 'Falha em testes que exigem visão')],
    'invisivel': [ADV('ataque', 'Seus ataques (ataques contra você têm desvantagem)')],
    'lento': [NOTE('Lento: começa o turno com no máximo 6 PA.')],
}
skip_conds = {c['id'] for c in counters} | {'radiacao_ou_rads'}
condicoes = [{'id': c['id'], 'name': c['nome'], 'description': clean(c['texto']), 'effects': COND_FX.get(c['id'], [])}
             for c in load('condicoes') if c['id'] not in skip_conds]

# ---------------------------------------------------------------- items
itens = load('itens')
cols = {k: [] for k in ['armas', 'armaduras', 'melhorias', 'armadura_potente', 'melhorias_potente', 'mods', 'explosivos', 'municao',
                        'quimicos', 'medicina', 'comida', 'equipamentos', 'revistas', 'itens_unicos']}
PERICIA_ARMA = {'Armas Cortantes': 'Corpo a Corpo', 'Armas Contundentes': 'Corpo a Corpo', 'Armas Mecânicas': 'Corpo a Corpo',
                'Armas Desarmadas': 'Pugilismo', 'Armas de Mão': 'Disparo', 'Submetralhadoras': 'Disparo', 'Rifles': 'Disparo',
                'Escopetas': 'Disparo', 'Armas Pesadas': 'Disparo', 'Armas de Energia': 'Energia'}
VEST = {
    'itens_e_equipamentos_mochila': [ADD('carga_max', 50)],
    'itens_e_equipamentos_mochila_de_acampamento': [ADD('carga_max', 100)],
    'itens_e_equipamentos_bandoleira': [ADD('carga_max', 25)],
    'itens_e_equipamentos_mascara_de_gas': [ADD('lr', -3), ADD('sentidos', -2)],
    'itens_e_equipamentos_traje_hazmat': [ADD('lr', -10), {'type': 'immunity', 'text': 'Dano de radiação'}, NOTE('Traje Hazmat: passar no teste de radiação não aumenta o LR.')],
    'itens_e_equipamentos_traje_hazmat_motorizado': [ADD('td', 3), {'type': 'immunity', 'text': 'Dano de radiação (com energia)'}],
    'itens_e_equipamentos_roupa_termica': [ADD('pa', -1), {'type': 'resistance', 'text': 'Isolado contra hipotermia'}],
    'itens_e_equipamentos_roupa_termica_leve': [{'type': 'resistance', 'text': 'Isolado contra hipotermia'}],
}
UPG = {  # armor upgrades: effects per level 1..3 (cumulative values)
    'reforcada': lambda n: [ADD('td', [1, 2, 4][n - 1])],
    'endurecida': lambda n: [ADD('df', n)],
    'leve': lambda n: [ADD('td', -1)],
    'chumbada': lambda n: [ADD('lr', -2 * n)],
    'cheia_de_bolsos': lambda n: [ADD('carga_max', [10, 15, 25][n - 1])],
    'justa': lambda n: [ADD('pe', 'level')] if n >= 2 else [],
    'isolamento': lambda n: [ADD('pa', -1)] if n == 1 else [],
    'camuflagem': lambda n: [ADV('furtividade', 'Furtividade (visão)' if n == 1 else 'Furtividade (visão e som)')],
}
PA_UPG = {'matriz_de_sensores': lambda n: [ADD('sentidos', [5, 10, 20][n - 1])],
          'amortecedores_calibrados': lambda n: [ADD('carga_max', [15, 30, 50][n - 1])]}

for it in itens:
    c, s, f, nome, iid = it['categoria'], it['subcategoria'], it['campos'], it['nome'], it['id']
    desc = clean(it.get('descricao', ''))
    carga, forca = carga_e_forca(f)
    custo = f.get('Custo Base') or f.get('Custo') or ''
    base = {'id': iid, 'name': nome}
    if c in ('Armas Corpo a Corpo', 'Tabelas de Armas à Distância') and 'Modificação' not in f:
        e = {**base, 'pericia': PERICIA_ARMA.get(s, ''), 'tipo': s, 'dano': f.get('Dano', ''), 'pa': f.get('PA', ''), 'critico': f.get('Crítico', ''),
             'alcance': f.get('Alcance', ''), 'municao': f.get('Munição e Recarga', ''), 'propriedades': f.get('Propriedades Especiais', ''),
             'custo': custo, 'carga': carga, 'forca': forca, 'description': desc}
        cols['armas'].append(e)
    elif c == 'Armas Corpo a Corpo' or c == 'Modificações de Armas à Distância':
        cols['mods'].append({**base, 'custo': custo, 'compativeis': f.get('Armas Compatíveis', 'Armas corpo a corpo' if c == 'Armas Corpo a Corpo' else ''),
                             'instalar': f.get('Tempo para Instalar/Remover', ''), 'description': clean(f.get('Descrição', '')) or desc})
    elif c == 'Armaduras' and not s:
        df, td = int(num(f.get('DF')) or 10), int(num(f.get('TD')) or 0)
        cols['armaduras'].append({**base, 'df': df, 'td': td, 'espacos': f.get('Espaços', ''), 'custo': custo, 'carga': carga, 'forca': forca, 'description': desc,
                                  'effects': [{'type': 'set', 'target': 'df', 'value': f'max(10, {df} - floor(wear / 2))'},
                                              ADD('td', f'max(0, {td} - floor(wear / 2))')]})
    elif c == 'Armaduras':
        key = iid.replace('melhorias_de_armadura_', '')
        for n in (1, 2, 3):
            txt = f.get(f'Nível {n}', '—')
            if txt.strip() in ('—', '-', ''): continue
            prev = '\n'.join(f"Nível {k}: {f.get(f'Nível {k}')}" for k in range(1, n))
            cols['melhorias'].append({'id': f'{key}_{n}', 'name': f"{nome} {'I' * n}", 'nivel': n, 'custo': custo,
                                      'description': f"Nível {n}: {txt}" + (f"\n\nNíveis anteriores (já incluídos):\n{prev}" if prev else '') + '\n\nSó uma melhoria de cada tipo por armadura, até o limite de espaços. Marque como equipada junto com a armadura vestida.',
                                      'effects': UPG.get(key, lambda n: [])(n)})
    elif c == 'Armadura Potente':
        cols['armadura_potente'].append({**base, 'df': f.get('DF', ''), 'pd': f.get('PD', ''), 'espacos': f.get('Espaços', ''), 'reparo': f.get('Reparo', ''),
                                         'autonomia': f.get('Autonomia', ''), 'custo': custo, 'description': desc,
                                         'effects': [{'type': 'set', 'target': 'df', 'value': str(int(num(f.get('DF')) or 10))}, NOTE(f"{nome}: Pontos de Dano (PD) {f.get('PD', '')}; autonomia {f.get('Autonomia', '')}.")]})
    elif c == 'Melhorias de Armadura Potente':
        key = iid.replace('melhorias_de_armadura_potente_', '')
        for n in (1, 2, 3):
            txt = f.get(f'Nível {n}', '—')
            if txt.strip() in ('—', '-', ''): continue
            cols['melhorias_potente'].append({'id': f'{key}_{n}', 'name': f"{nome} {'I' * n}", 'nivel': n, 'custo': custo,
                                              'description': f"Nível {n}: {txt}", 'effects': PA_UPG.get(key, lambda n: [])(n)})
    elif c == 'Explosivos':
        cols['explosivos'].append({**base, 'tipo': s, 'dano': f.get('Dano', ''), 'pa': f.get('PA', ''), 'alcance': f.get('Alcance', ''), 'area': f.get('Área de Efeito', ''),
                                   'cd': f.get('CD de Armar', ''), 'propriedades': f.get('Propriedades Especiais', ''), 'custo': custo, 'carga': carga, 'description': desc})
    elif c == 'Munição':
        label = f.get('Calibres') or f.get('Células') or f.get('Tipo de Munição (Custo)') or f.get('Tipo de Seringa') or ''
        cols['municao'].append({**base, 'tipo': s, 'custo': custo or f.get('Tipo de Munição (Custo)', ''), 'efeito': clean(f.get('Efeito', '')),
                                'carga': carga or 0, 'description': desc})
    elif c == 'Químicos e Aprimoramentos de Robô':
        cols['quimicos'].append({**base, 'tipo': s, 'propriedades': clean(f.get('Propriedades', '')), 'custo': custo, 'carga': carga, 'description': desc,
                                 'tags': ['programa_robo'] if 'Robô' in s else ['quimico']})
    elif c == 'Medicina':
        cols['medicina'].append({**base, 'custo': custo, 'carga': carga, 'description': desc, 'tags': ['stimpak'] if 'stimpak' in iid else []})
    elif c == 'Comidas e Bebidas':
        cols['comida'].append({**base, 'tipo': s, 'propriedades': clean(f.get('Propriedades', '')), 'custo': custo, 'carga': carga, 'description': desc})
    elif c == 'Itens e Equipamentos':
        cols['equipamentos'].append({**base, 'custo': custo, 'carga': carga, 'carga_texto': next((v for k, v in f.items() if k.startswith('Carga')), ''),
                                     'description': desc, 'effects': VEST.get(iid, [])})
    elif c == 'Revistas de Perícia':
        cols['revistas'].append({**base, 'efeito': clean(f.get('Efeito', '')), 'carga': 0, 'description': desc})
    elif c == 'Itens Únicos':
        e = {**base, 'custo': custo, 'carga': carga, 'description': desc}
        if iid == 'itens_unicos_traje_de_refugio':
            # Counts as cloth armor with Leaded, Reinforced, Fitted and Sturdy level 1 built in.
            e['description'] += '\n\nConta como armadura de tecido (DF 10) com as melhorias Chumbada, Reforçada, Justa e Robusta nível 1 embutidas. Vista na lista de Armaduras.'
            cols['armaduras'].append({**e, 'df': 10, 'td': 1, 'espacos': '4', 'forca': 1, 'effects': [
                {'type': 'set', 'target': 'df', 'value': 'max(10, 10 - floor(max(0, wear - 2) / 2))'},
                ADD('td', 'max(0, 1 - floor(max(0, wear - 2) / 2))'), ADD('lr', -2)]})
            continue
        cols['itens_unicos'].append(e)

for lst in cols.values():
    for e in lst:
        for k in [k for k, v in e.items() if v in (None, '')]: e.pop(k)
        if not e.get('effects'): e.pop('effects', None)

F = lambda t, label, unit=None: {k: v for k, v in {'type': t, 'label': label, 'unit': unit}.items() if v}
custo, carga = F('text', 'Custo'), F('number', 'Carga')
collections = {
    'racas': {'name': 'Raça', 'max': 1, 'fields': {}},
    'variantes': {'name': 'Variante de raça', 'fields': {'raca': F('text', 'Raça')}},
    'subtipos': {'name': 'Tipo de robô', 'max': 1, 'fields': {}},
    'antecedentes': {'name': 'Antecedente', 'max': 1, 'fields': {'pericias': F('text', 'Perícias (+2)'), 'traco': F('text', 'Traço')}},
    'tracos': {'name': 'Traços', 'fields': {'requisito': F('text', 'Requisito')}},
    'talentos': {'name': 'Talentos', 'fields': {'grupo': F('text', 'Grupo'), 'requisito': F('text', 'Requisito')}},
    'condicoes': {'name': 'Condições', 'fields': {}},
    'armas': {'name': 'Armas', 'equippable': True, 'quantity': True, 'wear': {'max': 10}, 'fields': {
        'pericia': F('text', 'Perícia'), 'tipo': F('text', 'Tipo'), 'dano': F('dice', 'Dano'), 'pa': F('text', 'PA'), 'critico': F('text', 'Crítico'),
        'alcance': F('text', 'Alcance (× PER)'), 'municao': F('text', 'Munição e Recarga'), 'propriedades': F('text', 'Propriedades'),
        'custo': custo, 'carga': carga, 'forca': F('number', 'Req. de FOR')}},
    'armaduras': {'name': 'Armaduras', 'equippable': True, 'wear': {'max': 10}, 'fields': {
        'df': F('number', 'DF'), 'td': F('number', 'TD'), 'espacos': F('text', 'Espaços'), 'custo': custo, 'carga': carga, 'forca': F('number', 'Req. de FOR')}},
    'melhorias': {'name': 'Melhorias de Armadura', 'equippable': True, 'fields': {'nivel': F('number', 'Nível'), 'custo': custo}},
    'armadura_potente': {'name': 'Armadura Potente', 'equippable': True, 'wear': {'max': 10}, 'fields': {
        'df': F('text', 'DF'), 'pd': F('text', 'PD'), 'espacos': F('text', 'Espaços'), 'reparo': F('text', 'Reparo'), 'autonomia': F('text', 'Autonomia'), 'custo': custo}},
    'melhorias_potente': {'name': 'Melhorias de Armadura Potente', 'equippable': True, 'fields': {'nivel': F('number', 'Nível'), 'custo': custo}},
    'mods': {'name': 'Modificações de Armas', 'quantity': True, 'fields': {'compativeis': F('text', 'Armas compatíveis'), 'instalar': F('text', 'Instalar/Remover'), 'custo': custo}},
    'explosivos': {'name': 'Explosivos', 'quantity': True, 'fields': {
        'tipo': F('text', 'Tipo'), 'dano': F('dice', 'Dano'), 'pa': F('text', 'PA'), 'alcance': F('text', 'Alcance'), 'area': F('text', 'Área'),
        'cd': F('text', 'CD de Armar'), 'propriedades': F('text', 'Propriedades'), 'custo': custo, 'carga': carga}},
    'municao': {'name': 'Munição', 'quantity': True, 'fields': {'tipo': F('text', 'Tipo'), 'efeito': F('text', 'Efeito'), 'custo': custo, 'carga': carga}},
    'quimicos': {'name': 'Químicos e Programas de Robô', 'quantity': True, 'fields': {'tipo': F('text', 'Tipo'), 'propriedades': F('text', 'Propriedades'), 'custo': custo, 'carga': carga}},
    'medicina': {'name': 'Medicina', 'quantity': True, 'fields': {'custo': custo, 'carga': carga}},
    'comida': {'name': 'Comidas e Bebidas', 'quantity': True, 'fields': {'tipo': F('text', 'Tipo'), 'propriedades': F('text', 'Propriedades'), 'custo': custo, 'carga': carga}},
    'equipamentos': {'name': 'Itens e Equipamentos', 'equippable': True, 'quantity': True, 'fields': {'custo': custo, 'carga': carga, 'carga_texto': F('text', 'Carga (detalhe)')}},
    'revistas': {'name': 'Revistas de Perícia', 'quantity': True, 'fields': {'efeito': F('text', 'Efeito')}},
    'itens_unicos': {'name': 'Itens Únicos', 'equippable': True, 'fields': {'custo': custo, 'carga': carga}},
}
entities = {'racas': racas, 'variantes': variantes, 'subtipos': subtipos, 'antecedentes': antecedentes, 'tracos': tracos,
            'talentos': talentos, 'condicoes': condicoes, **cols}

L = lambda col, **kw: {'block': 'list', 'collection': col, **kw}
layout = {'tabs': [
    {'id': 'status', 'name': 'Status', 'blocks': [
        {'block': 'attributes', 'title': 'S.P.E.C.I.A.L.', 'wide': True},
        {'block': 'resources'},
        {'block': 'derived', 'title': 'Combate', 'items': ['df', 'td', 'iniciativa', 'sentidos', 'fator_cura', 'lr', 'falhas_morte']},
        {'block': 'effects'},
        L('condicoes'),
        {'block': 'counters', 'title': 'Sobrevivência'},
    ]},
    {'id': 'pericias', 'name': 'Perícias', 'blocks': [
        {'block': 'skills', 'wide': True},
        {'block': 'derived', 'title': 'Progressão', 'items': ['pontos_pericia', 'pericia_por_concessao', 'pontos_talento', 'penalidade_d20']},
    ]},
    {'id': 'personagem', 'name': 'Personagem', 'blocks': [
        L('racas'), L('variantes'), L('subtipos'), L('antecedentes', columns=['pericias']), L('tracos'), L('talentos', columns=['grupo'], wide=True),
        {'block': 'notes', 'id': 'historia', 'title': 'História e aparência'},
    ]},
    {'id': 'combate', 'name': 'Armas', 'blocks': [
        L('armas', columns=['dano', 'pa', 'critico'], wide=True), L('municao'), L('explosivos', columns=['dano']), L('mods'),
    ]},
    {'id': 'armaduras', 'name': 'Armaduras', 'blocks': [
        L('armaduras', columns=['df', 'td']), L('melhorias'), L('armadura_potente', columns=['df', 'pd']), L('melhorias_potente'),
    ]},
    {'id': 'inventario', 'name': 'Inventário', 'blocks': [
        {'block': 'derived', 'title': 'Carga', 'items': ['carga', 'carga_max']},
        L('medicina'), L('quimicos'), L('comida'), L('equipamentos', columns=['carga']), L('revistas'), L('itens_unicos'),
        {'block': 'notes', 'id': 'inventario', 'title': 'Tampinhas e outros itens'},
    ]},
    {'id': 'rolar', 'name': 'Rolar', 'blocks': [{'block': 'roller', 'shortcuts': [
        '1d20 + disparo', '1d20 + corpo_a_corpo', '1d20 + pugilismo', '1d20 + energia', '1d20 + explosivos', '1d20 + furtividade', '1d20 + persuasao',
        '1d20 + mod(SOR)']}, {'block': 'notes', 'id': 'sessao', 'title': 'Anotações da sessão'}]},
]}

pkg = {
    'format': 1, 'id': 'fallout-2.2-pt', 'name': 'Fallout TTRPG 2.2 (Vault Texas)', 'version': '1.0.0', 'author': 'GabrielGugg (tradução e regras da casa)',
    'language': 'pt-BR', 'type': 'system',
    'description': 'Fallout TTRPG 2.1 da Arcane Arcade traduzido, com as regras da casa da versão 2.2 (veja a nota "Changelog 2.1 - 2.2"). '
                   'Distribua o S.P.E.C.I.A.L. começando em 5 com 3 pontos extras; cada atributo vai de 1 a 10.',
    'rolls': {'modifier': 'value - 5', 'default': '1d20'},
    'progression': {'max_level': 30, 'xp_per_level': 'level * 1000'},
    'attributes': [{'id': i, 'name': n, 'abbr': i, 'min': 1, 'max': 10, 'default': 5, 'description': f'{n} ({l} do S.P.E.C.I.A.L.)'} for i, n, l in ATR],
    'skills': skills, 'derived': derived, 'resources': resources, 'counters': counters,
    'collections': collections, 'entities': entities, 'layout': layout,
}
json.dump(pkg, open(OUT / 'fallout-2.2-pt.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print({k: len(v) for k, v in entities.items()})
