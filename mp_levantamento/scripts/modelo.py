"""Etapa B - estimativa parametrica (PROVISORIO). Demandas-tipo com composicoes SINAPI-BA 08/2026 nao desonerado.
Uso: python3 -I modelo.py SCRATCH REPO_MP   -> grava SCRATCH/etapa_b/resultado.json
"""
import csv, json, math, os, sys

S, MP = sys.argv[1], sys.argv[2]
CEN = ('min', 'prov', 'max')
PROV = 'APROVADO em 13/10/2026'

# ---------------------------------------------------------------- precos SINAPI
COMP, INS = {}, {}
for r in csv.DictReader(open(os.path.join(S, 'sinapi', 'composicoes_CSD_BA.csv'), encoding='utf-8-sig'), delimiter=';'):
    COMP[r['codigo']] = (r['descricao'], r['unidade'], float(r['custo_BA_R$'] or 0))
for r in csv.DictReader(open(os.path.join(S, 'sinapi', 'insumos_ISD_BA.csv'), encoding='utf-8-sig'), delimiter=';'):
    INS[r['codigo']] = (r['descricao'], r['unidade'], float(r['preco_BA_R$'] or 0))

def preco(cod):
    if cod.startswith('I'):
        d, u, p = INS[cod[1:]]; tipo = 'SINAPI insumo'
    else:
        d, u, p = COMP[cod]; tipo = 'SINAPI composição'
    assert p > 0, f'codigo {cod} sem preco na BA'
    return d, u, p, tipo

# ---------------------------------------------------------------- parametros (PROVISORIO)
# APROVADO em 13/10/2026: BDI único por tipo de obra (valor médio do Acórdão 2.622/2013-TCU-Plenário), contingência 5/10/15%
# e fator regional 1,00 (SINAPI-BA, localidade Salvador, não desonerado, adotado como referência de Ilhéus)
BDI = {'edif': {'min': 0.2212, 'prov': 0.2212, 'max': 0.2212},
       'via': {'min': 0.2097, 'prov': 0.2097, 'max': 0.2097}}
CONT = {'min': 0.05, 'prov': 0.10, 'max': 0.15}
FREG = {'min': 1.00, 'prov': 1.00, 'max': 1.00}

# ---------------------------------------------------------------- demandas-tipo
# cada item: (macroetapa, codigo, quantidade, memoria)
TUBO = {0.6: '92212', 0.8: '92214', 1.0: '92216', 1.2: '92816'}            # tubo concreto AP fornec.+assent., baixa interferencia
PVB = {0.6: '99285', 0.8: '102457', 1.0: '102142', 1.2: '102142'}            # base PV pre-moldado (DI 1,0/1,2/1,5 m)
PVA = {0.6: '99288', 0.8: '99240', 1.0: '99246', 1.2: '99246'}               # acrescimo de profundidade do PV

def drenagem(L, DN, pre='2. Drenagem'):
    larg, prof = DN + 0.6, DN + 1.0
    vala = L * larg * prof
    tubo_ext = math.pi * (DN + 0.1) ** 2 / 4 * L
    npv = math.ceil(L / 40) + 1
    nbl = 2 * math.ceil(L / 40)
    return [
        (pre, '90082', vala, f'vala {larg:.2f} m x {prof:.2f} m x L {L:.0f} m'),
        (pre, TUBO[DN], L, f'rede DN {DN*1000:.0f} mm ao longo de L'),
        (pre, '93369', vala - tubo_ext, 'volume da vala - volume externo do tubo'),
        (pre, PVB[DN], npv, 'PV a cada 40 m + 1'),
        (pre, PVA[DN], npv * 0.5, 'acréscimo médio de 0,5 m de profundidade por PV'),
        (pre, '97956', nbl, 'boca de lobo simples, 2 a cada 40 m'),
        (pre, '92210', nbl * 4, 'ligação BL-PV em DN 400 mm, 4 m por boca de lobo'),
        (pre, '100982', tubo_ext, 'carga do solo excedente (volume do tubo)'),
        (pre, '95875', tubo_ext * 10, 'transporte do excedente, DMT 10 km'),
    ]

def dt_via(p):
    L, W, wp = p['L'], p['W'], p['wp']
    it = [('1. Serviços preliminares', '103689', 6, 'placa de obra 3 m x 2 m'),
          ('1. Serviços preliminares', '98525', L * (W + 2 * wp), 'limpeza da faixa: L x (pista + 2 passeios)')]
    it += drenagem(L, p['DN'])
    vb, vc = L * W * p['esp_base'], L * W * p['e_cbuq']
    it += [('3. Pavimentação', '100576', L * W, 'regularização do subleito: L x pista'),
           ('3. Pavimentação', '96396', vb, f"base/sub-base de brita graduada, espessura total {p['esp_base']*100:.0f} cm"),
           ('3. Pavimentação', '95875', vb * p['dmt_base'], f"transporte da brita, DMT {p['dmt_base']} km"),
           ('3. Pavimentação', '95995', vc, f"CBUQ, espessura {p['e_cbuq']*100:.0f} cm"),
           ('3. Pavimentação', '95875', vc * p['dmt_cbuq'], f"transporte do CBUQ, DMT {p['dmt_cbuq']} km"),
           ('4. Meio-fio, sarjeta e passeio', '94273', 2 * L, 'meio-fio nos dois lados'),
           ('4. Meio-fio, sarjeta e passeio', '94287', 2 * L, 'sarjeta 30x10 cm nos dois lados'),
           ('4. Meio-fio, sarjeta e passeio', '94992', 2 * L * wp, 'passeio de concreto 6 cm nos dois lados'),
           ('4. Meio-fio, sarjeta e passeio', '105002', 2 * math.ceil(L / 50), 'rampas de acessibilidade, 2 a cada 50 m'),
           ('5. Sinalização', '102501', 12 * math.ceil(L / 100), 'faixa de pedestre 4 m x 3 m a cada 100 m')]
    return it

def dt_dren(p):
    L, DN = p['L'], p['DN']
    fx = DN + 0.8
    it = [('1. Serviços preliminares', '103689', 6, 'placa de obra 3 m x 2 m')]
    it += drenagem(L, DN)
    it += [('3. Recomposição do pavimento', '101849', L * fx * 0.20, f'base de brita graduada 20 cm na faixa da vala ({fx:.2f} m)'),
           ('3. Recomposição do pavimento', '102098', L * fx * 0.05, 'revestimento em CBUQ 5 cm na faixa da vala (inclui demolição)')]
    return it

def dt_enc(p):
    A, H, s, Lg = p['A'], p['H'], p['s'], p['Lg']
    cg = '93957' if Lg <= 6 else ('93959' if Lg <= 10 else '93961')
    cc = '107269' if p['e_cp'] == 10 else '107270'
    return [('1. Serviços preliminares', '103689', 6, 'placa de obra'),
            ('1. Serviços preliminares', '98525', A * 1.3, 'limpeza e supressão vegetal: face + 30% de entorno'),
            ('2. Contenção', cg, A / (s * s) * Lg, f'grampos em malha {s} m x {s} m, comprimento {Lg} m'),
            ('2. Contenção', cc, A, f"cortina de concreto projetado {p['e_cp']} cm na face"),
            ('3. Drenagem da encosta', '106545', A * 0.6, 'drenos sub-horizontais/barbacãs, 0,6 m por m² de face'),
            ('3. Drenagem da encosta', '102991', 2 * A / H, f'canaletas de crista e de pé (A / altura média {H} m, 2 linhas)'),
            ('3. Drenagem da encosta', '103933', A * 0.0125, 'descidas d\'água em concreto (0,0125 m³ por m² de face)'),
            ('4. Proteção superficial', '98504', A * 0.3, 'grama em placas em 30% da área (bermas/entorno)')]

def dt_ed(p, pre='', perfil='publico'):
    """Edificação térrea nova (por m² construído). p['A'] = área (ou área equivalente do remanescente)."""
    A = p['A']
    m = lambda s: (pre + s)
    it = [(m('1. Serviços preliminares'), '99059', 0.25 * A, 'locação de obra, 0,25 m de gabarito por m²'),
          (m('2. Fundação e estrutura'), '93358', 0.08 * A, 'escavação manual, 0,08 m³/m²'),
          (m('2. Fundação e estrutura'), '103672', 0.12 * A, 'concreto estrutural fck 25 MPa, 0,12 m³/m²'),
          (m('2. Fundação e estrutura'), '92762', 10 * A, 'armação CA-50, 10 kg/m²'),
          (m('2. Fundação e estrutura'), '92421', 1.1 * A, 'fôrmas, 1,1 m²/m²'),
          (m('3. Vedação e revestimentos'), '103328', 1.5 * A, 'alvenaria de vedação, 1,5 m²/m²'),
          (m('3. Vedação e revestimentos'), '87879', 3.0 * A, 'chapisco nas duas faces'),
          (m('3. Vedação e revestimentos'), '104958', 2.4 * A, 'massa única interna'),
          (m('3. Vedação e revestimentos'), '104235', 0.6 * A, 'emboço externo'),
          (m('3. Vedação e revestimentos'), '87265', 0.3 * A, 'revestimento cerâmico em áreas molhadas'),
          (m('4. Pisos'), '95241', 1.0 * A, 'lastro de concreto magro 5 cm'),
          (m('4. Pisos'), '98680', 1.0 * A, 'regularização/contrapiso cimentado 3 cm'),
          (m('4. Pisos'), '87248', 1.0 * A, 'piso cerâmico'),
          (m('4. Pisos'), '94992', 0.15 * A, 'calçada perimetral'),
          (m('5. Cobertura e forro'), '92539', 1.25 * A, 'trama de madeira (área inclinada + beirais)'),
          (m('5. Cobertura e forro'), '94440', 1.25 * A, 'telha cerâmica'),
          (m('5. Cobertura e forro'), '96116', 0.9 * A, 'forro de PVC'),
          (m('6. Esquadrias'), '91332', A / 15, 'portas, 1 a cada 15 m²'),
          (m('6. Esquadrias'), '94570', 0.15 * A, 'janelas, 0,15 m²/m²'),
          (m('7. Pintura'), '104642', 2.4 * A, 'pintura látex interna'),
          (m('7. Pintura'), '88423', 0.6 * A, 'textura acrílica externa'),
          (m('8. Instalações elétricas'), '92023', A / 6, 'pontos de interruptor/tomada, 1 a cada 6 m²'),
          (m('8. Instalações elétricas'), '103782', A / 8, 'luminárias, 1 a cada 8 m²'),
          (m('8. Instalações elétricas'), '91926', 12 * A, 'cabos 2,5 mm², 12 m/m²'),
          (m('8. Instalações elétricas'), '91854', 4 * A, 'eletrodutos, 4 m/m²'),
          (m('9. Instalações hidrossanitárias'), '89714', 0.3 * A, 'ramais de esgoto DN 100, 0,3 m/m²')]
    if perfil == 'publico':
        it += [(m('8. Instalações elétricas'), '101879', max(1, A / 150), 'quadro de distribuição, 1 a cada 150 m²'),
               (m('9. Instalações hidrossanitárias'), '86931', A / 40, 'bacias sanitárias, 1 a cada 40 m²'),
               (m('9. Instalações hidrossanitárias'), '86902', A / 40, 'lavatórios, 1 a cada 40 m²'),
               (m('9. Instalações hidrossanitárias'), '102623', max(1, A / 150), 'caixa d\'água 1.000 L, 1 a cada 150 m²'),
               (m('9. Instalações hidrossanitárias'), '98107', max(1, A / 300), 'caixa de gordura'),
               (m('10. Prevenção contra incêndio'), '101909', max(1, A / 150), 'extintor PQS 6 kg, 1 a cada 150 m²'),
               (m('10. Prevenção contra incêndio'), '97599', max(1, A / 50), 'luminária de emergência, 1 a cada 50 m²'),
               (m('10. Prevenção contra incêndio'), 'I37556', max(1, A / 50), 'placa fotoluminescente de rota de fuga')]
    else:  # residencial: por unidade habitacional
        n = p['N']
        it += [(m('8. Instalações elétricas'), '101875', n, 'quadro de distribuição, 1 por casa'),
               (m('9. Instalações hidrossanitárias'), '86931', n, 'bacia sanitária, 1 por casa'),
               (m('9. Instalações hidrossanitárias'), '86902', n, 'lavatório, 1 por casa'),
               (m('9. Instalações hidrossanitárias'), '100860', n, 'chuveiro elétrico, 1 por casa'),
               (m('9. Instalações hidrossanitárias'), '86934', n, 'bancada de pia com cuba, 1 por casa'),
               (m('9. Instalações hidrossanitárias'), '102622', n, 'caixa d\'água 500 L, 1 por casa')]
    return it

def dt_ref(p, pre=''):
    """Reforma predial (por m² de área reformada). Intensidade = fração de cada serviço refeito."""
    A, kc, kf, kp, kr, ke, ki = p['A'], p['k_cob'], p['k_forro'], p['k_piso'], p['k_reb'], p['k_esq'], p['k_inst']
    m = lambda s: (pre + s)
    return [(m('1. Serviços preliminares'), '103689', 6, 'placa de obra'),
            (m('2. Demolições e retiradas'), '97647', 1.25 * kc * A, 'remoção de telhas'),
            (m('2. Demolições e retiradas'), '97650', 0.625 * kc * A, 'remoção de trama de madeira (metade da área refeita)'),
            (m('2. Demolições e retiradas'), '97640', kf * A, 'remoção de forro'),
            (m('2. Demolições e retiradas'), '97634', kp * A, 'demolição de piso cerâmico'),
            (m('2. Demolições e retiradas'), '97633', 0.3 * kp * A, 'demolição de revestimento de parede'),
            (m('2. Demolições e retiradas'), '97645', 0.15 * ke * A, 'remoção de janelas'),
            (m('3. Cobertura e forro'), '92539', 0.625 * kc * A, 'trama de madeira nova'),
            (m('3. Cobertura e forro'), '94440', 1.25 * kc * A, 'telha cerâmica nova'),
            (m('3. Cobertura e forro'), '96116', kf * A, 'forro de PVC novo'),
            (m('4. Revestimentos e pisos'), '87879', 2.4 * kr * A, 'chapisco em paredes recuperadas'),
            (m('4. Revestimentos e pisos'), '104958', 2.4 * kr * A, 'massa única em paredes recuperadas'),
            (m('4. Revestimentos e pisos'), '87265', 0.3 * kp * A, 'revestimento cerâmico de parede'),
            (m('4. Revestimentos e pisos'), '98680', kp * A, 'regularização de piso'),
            (m('4. Revestimentos e pisos'), '87248', kp * A, 'piso cerâmico novo'),
            (m('5. Pintura'), '104642', 3.0 * A, 'pintura de todas as paredes'),
            (m('5. Pintura'), '104640', 0.3 * A, 'pintura de tetos sem forro'),
            (m('6. Esquadrias'), '94570', 0.15 * ke * A, 'janelas novas'),
            (m('6. Esquadrias'), '91332', A / 15 * ke, 'portas novas'),
            (m('7. Instalações'), '92023', A / 6 * ki, 'pontos elétricos refeitos'),
            (m('7. Instalações'), '103782', A / 8 * ki, 'luminárias novas'),
            (m('7. Instalações'), '91926', 12 * A * ki, 'cabos 2,5 mm²'),
            (m('7. Instalações'), '91854', 4 * A * ki, 'eletrodutos'),
            (m('7. Instalações'), '101879', max(1, A / 150 * ki), 'quadros de distribuição'),
            (m('7. Instalações'), '86931', A / 40 * ki, 'bacias sanitárias'),
            (m('7. Instalações'), '86902', A / 40 * ki, 'lavatórios'),
            (m('7. Instalações'), '89714', 0.3 * A * ki, 'ramais de esgoto'),
            (m('8. Prevenção contra incêndio'), '101909', max(1, A / 150), 'extintores'),
            (m('8. Prevenção contra incêndio'), '97599', max(1, A / 50), 'luminárias de emergência'),
            (m('8. Prevenção contra incêndio'), 'I37556', max(1, A / 50), 'placas de rota de fuga'),
            (m('9. Entulho'), '100982', 0.05 * A, 'carga de entulho, 0,05 m³/m²'),
            (m('9. Entulho'), '95875', 0.5 * A, 'transporte de entulho, DMT 10 km')]

def dt_quadra(p, pre=''):
    f = p.get('frac', 1.0)
    m = lambda s: (pre + s)
    it = [(m('1. Serviços preliminares'), '103689', 6 * f, 'placa de obra'),
          (m('1. Serviços preliminares'), '98525', 900 * f, 'limpeza do terreno'),
          (m('2. Fundações e pilares'), '93358', 30 * f, 'escavação de blocos'),
          (m('2. Fundações e pilares'), '103672', 15 * f, 'concreto de blocos e pilares'),
          (m('2. Fundações e pilares'), '92762', 1500 * f, 'armação'),
          (m('2. Fundações e pilares'), '92421', 120 * f, 'fôrmas'),
          (m('3. Piso esportivo'), '100576', 640 * f, 'regularização (área 32 m x 20 m)'),
          (m('3. Piso esportivo'), '96396', 64 * f, 'base de brita graduada 10 cm'),
          (m('3. Piso esportivo'), '94995', 640 * f, 'piso de concreto armado 8 cm'),
          (m('3. Piso esportivo'), '102504', 250 * f, 'demarcação das quadras'),
          (m('4. Cobertura'), '104314', p['kg_m2'] * 748 * f, f"estrutura de aço da cobertura, {p['kg_m2']} kg/m² em 748 m²"),
          (m('4. Cobertura'), '94216', 748 * f, 'telha metálica termoacústica'),
          (m('5. Fechamento e equipamentos'), '102363', 208 * f, 'alambrado (104 m x 2 m)'),
          (m('5. Fechamento e equipamentos'), 'I25400', 1 * f, 'par de tabelas de basquete'),
          (m('5. Fechamento e equipamentos'), 'I39391', 16 * f, 'refletores LED 50 W (insumo; iluminação esportiva a dimensionar)')]
    if p.get('A_vest', 0) > 0:
        it += dt_ed({'A': p['A_vest'] * f}, pre=pre + 'Vestiário - ')
    return it

def dt_campo(p):
    a, b = p['a'], p['b']; A = a * b
    it = [('1. Serviços preliminares', '103689', 6, 'placa de obra'),
          ('2. Campo', '100576', A, f'regularização do campo {a} m x {b} m'),
          ('2. Campo', '106543', A / 5, 'drenos DN 160 mm a cada 5 m'),
          ('2. Campo', '98504', A, 'gramado em placas'),
          ('3. Fechamento e acessos', '98522', 2 * (a + b) + 20, 'alambrado com mourões de concreto no perímetro + 20 m'),
          ('3. Fechamento e acessos', '94992', p['calcada'], 'calçadas e acessos'),
          ('3. Fechamento e acessos', 'I39391', 20, 'refletores LED 50 W (insumo; iluminação esportiva a dimensionar)')]
    it += dt_ed({'A': p['A_vest']}, pre='Vestiário - ')
    return it

def dt_abrigo(p):
    n = p['N']
    return [('1. Fundação', '93358', 1.0 * n, 'escavação, 1 m³ por abrigo'),
            ('1. Fundação', '103669', 0.8 * n, 'concreto de fundação, 0,8 m³ por abrigo'),
            ('1. Fundação', '92762', 40 * n, 'armação, 40 kg por abrigo'),
            ('2. Estrutura e cobertura', '104314', 300 * n, 'estrutura de aço, 300 kg por abrigo'),
            ('2. Estrutura e cobertura', '94216', 12 * n, 'telha metálica termoacústica, 12 m² por abrigo'),
            ('3. Piso, banco e acessibilidade', '94995', 12 * n, 'piso de concreto 8 cm, 12 m² por abrigo'),
            ('3. Piso, banco e acessibilidade', '103669', 0.3 * n, 'banco em concreto, 0,3 m³ por abrigo'),
            ('3. Piso, banco e acessibilidade', '104658', 4 * n, 'piso podotátil, 4 m² por abrigo')]

def dt_estadio(p):
    """Adequação estrita às normas de segurança previstas no TAC (sem reforma geral, pintura ou acessibilidade)."""
    return [('1. Extintores', '101911', p['ext'], 'extintores PQS 12 kg nas arquibancadas e circulações'),
            ('1. Extintores', '101905', p['ext_a'], 'extintores de água pressurizada 10 L (classe A)'),
            ('1. Extintores', '101907', p['co2'], 'extintores de CO2 6 kg nas casas de força'),
            ('2. Iluminação e sinalização de emergência', '97599', p['emerg'], 'luminárias de emergência nas rotas de fuga'),
            ('2. Iluminação e sinalização de emergência', 'I37558', p['placas'], 'placas fotoluminescentes de saída de emergência'),
            ('2. Iluminação e sinalização de emergência', 'I37560', p['alerta'], 'placas de alerta (risco elétrico, extintores)'),
            ('3. Saídas de emergência', 'I39621', p['saidas'], 'barras antipânico duplas nos portões de saída (insumo)'),
            ('4. Guarda-corpos', '99844', p['gc'], 'guarda-corpo de aço galvanizado 1,10 m em arquibancadas e desníveis'),
            ('5. SPDA', '96989', p['capt'], 'captores tipo Franklin'),
            ('5. SPDA', '96974', p['cord'], 'cordoalha de cobre nu 50 mm² (captação e descidas)'),
            ('5. SPDA', '96986', p['hastes'], 'hastes de aterramento 3/4" x 3 m'),
            ('5. SPDA', '98111', p['hastes'], 'caixas de inspeção do aterramento'),
            ('6. Casas de força (segurança elétrica)', '101879', p['qd'], 'quadros de distribuição novos'),
            ('6. Casas de força (segurança elétrica)', 'I39457', p['qd'], 'dispositivo DR 4 polos 30 mA por quadro (insumo)')]

def dt_escora(p):
    it = [('1. Isolamento', '98458', p['tapume'], 'tapume de compensado no perímetro frontal'),
          ('2. Escoramento da fachada', 'I14439', p['estr'] * 6, 'estroncas de eucalipto 6 m'),
          ('2. Escoramento da fachada', '88262', p['estr'] * 2, 'carpinteiro, 2 h por estronca'),
          ('2. Escoramento da fachada', '88316', p['estr'] * 2, 'servente, 2 h por estronca'),
          ('3. Proteção da fachada', '97063', p['fach'], 'montagem/desmontagem de andaime fachadeiro (exclusive locação)'),
          ('3. Proteção da fachada', '97062', p['fach'], 'colocação de tela de proteção na fachada'),
          ('4. Proteção da cobertura', 'I42408', p['cob'] * 1.1, 'lona plástica 200 micra (+10% de transpasse)'),
          ('4. Proteção da cobertura', '88316', p['cob'] / 15, 'servente para colocar a lona')]
    if p.get('ref'):
        it += dt_ref(p['ref'], pre='Início da estabilização/recuperação - ')
    return it

def dt_banheiro(p):
    k = p['k']
    it = [('1. Banheiro com chuveiro', '103328', 10 * k, 'alvenaria'), ('1. Banheiro com chuveiro', '87879', 20 * k, 'chapisco'),
          ('1. Banheiro com chuveiro', '104958', 20 * k, 'massa única'), ('1. Banheiro com chuveiro', '87265', 18 * k, 'revestimento cerâmico'),
          ('1. Banheiro com chuveiro', '95241', 4 * k, 'lastro de piso'), ('1. Banheiro com chuveiro', '98680', 4 * k, 'regularização'),
          ('1. Banheiro com chuveiro', '87248', 4 * k, 'piso cerâmico'), ('1. Banheiro com chuveiro', '86931', 1, 'bacia sanitária'),
          ('1. Banheiro com chuveiro', '86902', 1, 'lavatório'), ('1. Banheiro com chuveiro', '100860', 1, 'chuveiro elétrico'),
          ('1. Banheiro com chuveiro', '89714', 6 * k, 'esgoto DN 100'), ('1. Banheiro com chuveiro', '92023', 2, 'pontos elétricos'),
          ('1. Banheiro com chuveiro', '103782', 1, 'luminária'), ('1. Banheiro com chuveiro', '91328', 1, 'porta 60x210'),
          ('1. Banheiro com chuveiro', '94570', 0.48 * k, 'janela'),
          ('2. Grade na porta de entrada', '99861', 2.1, 'gradil de aço na porta (1,0 m x 2,1 m)')]
    if p.get('cob'):
        it += [('1. Banheiro com chuveiro', '92539', 5 * k, 'trama de cobertura'), ('1. Banheiro com chuveiro', '94440', 5 * k, 'telha cerâmica')]
    return it

def dt_cozinha(p):
    n = p['N']
    return [('1. Abrigo de GLP', '103328', 6 * n, 'alvenaria do abrigo, 6 m² por unidade'),
            ('1. Abrigo de GLP', '99861', 1.5 * n, 'porta em gradil de aço'),
            ('1. Abrigo de GLP', '98680', 2 * n, 'piso cimentado'),
            ('2. Ventilação e revestimentos da cozinha', '94570', 1.5 * n, 'janela adicional para ventilação'),
            ('2. Ventilação e revestimentos da cozinha', '97633', 15 * n, 'demolição de revestimento de parede'),
            ('2. Ventilação e revestimentos da cozinha', '87265', 15 * n, 'revestimento cerâmico de parede'),
            ('2. Ventilação e revestimentos da cozinha', '97634', 15 * n, 'demolição de piso'),
            ('2. Ventilação e revestimentos da cozinha', '87248', 15 * n, 'piso cerâmico'),
            ('3. Instalações e equipamentos', '98108', n, 'caixa de gordura dupla'),
            ('3. Instalações e equipamentos', '93441', n, 'bancada de granito com cuba de aço'),
            ('3. Instalações e equipamentos', '92023', 4 * n, 'pontos elétricos'),
            ('3. Instalações e equipamentos', '103782', 3 * n, 'luminárias'),
            ('3. Instalações e equipamentos', '101909', n, 'extintor')]

def dt_parque(p):
    A = p['A_parque'] * p['n_parques']
    return [('Parques lineares - 1. Gramado', '98504', 0.7 * A, 'gramado em 70% da área'),
            ('Parques lineares - 2. Passeios', '94992', 0.2 * A, 'passeios de concreto em 20% da área')]

def dt_casas(p):
    return dt_ed({'A': p['A_casa'] * p['N'], 'N': p['N']}, pre='Casas - ', perfil='residencial') + dt_parque(p)

# ---------------------------------------------------------------- objetos
def cen(mn, pv, mx): return {'min': mn, 'prov': pv, 'max': mx}
VIA = cen(dict(W=5, wp=1.2, esp_base=0.15, e_cbuq=0.04, DN=0.6, dmt_base=20, dmt_cbuq=30),
          dict(W=6, wp=1.5, esp_base=0.20, e_cbuq=0.05, DN=0.6, dmt_base=20, dmt_cbuq=30),
          dict(W=7, wp=2.0, esp_base=0.30, e_cbuq=0.05, DN=0.8, dmt_base=40, dmt_cbuq=60))
REF_INT = cen(dict(k_cob=0.2, k_forro=0.2, k_piso=0.1, k_reb=0.1, k_esq=0.1, k_inst=0.2),
              dict(k_cob=0.5, k_forro=0.5, k_piso=0.3, k_reb=0.3, k_esq=0.3, k_inst=0.5),
              dict(k_cob=1.0, k_forro=1.0, k_piso=0.6, k_reb=0.6, k_esq=0.6, k_inst=1.0))
def via(L): return {c: {**VIA[c], 'L': L[i]} for i, c in enumerate(CEN)}
def ref(A): return {c: {**REF_INT[c], 'A': A[i]} for i, c in enumerate(CEN)}
def dren(L, DN): return {c: {'L': L[i], 'DN': DN[i]} for i, c in enumerate(CEN)}

PREM_VIA = ('Rua-tipo: pista 5/6/7 m, passeios 1,2/1,5/2,0 m, base+sub-base 15/20/30 cm, CBUQ 4/5/5 cm, rede DN 600/600/800 mm, '
            'PV a cada 40 m, 2 bocas de lobo a cada 40 m, DMT da brita 20/20/40 km e do CBUQ 30/30/60 km (mín/prov/máx).')
PREM_DREN = ('Microdrenagem em via existente: vala com largura DN + 0,6 m e profundidade DN + 1,0 m, PV a cada 40 m, '
             '2 bocas de lobo a cada 40 m, recomposição de base (20 cm) e CBUQ (5 cm) na faixa da vala, bota-fora a 10 km.')
PREM_REF = ('Reforma-tipo por m²: fração refeita de cobertura/forro/piso/reboco/esquadrias/instalações = 20/20/10/10/10/20% (mín), '
            '50/50/30/30/30/50% (prov) e 100/100/60/60/60/100% (máx); pintura integral; extintores, emergência e sinalização de rota de fuga.')
PREM_ED = ('Edificação térrea-tipo por m²: concreto 0,12 m³/m², aço 10 kg/m², fôrma 1,1 m²/m², alvenaria 1,5 m²/m², cobertura em telha '
           'cerâmica (1,25 m²/m²), forro de PVC, piso cerâmico, 1 porta a cada 15 m², janelas 0,15 m²/m², instalações simplificadas.')

OBJ = [
 dict(k='MPBA_001.9.102305.2021', dt=dt_escora, bdi='edif', fonte='demanda-tipo (medidas do próprio documento)',
      p=cen(dict(tapume=50, estr=30, fach=150, cob=250), dict(tapume=66, estr=40, fach=250, cob=350),
            dict(tapume=90, estr=60, fach=400, cob=500, ref={**REF_INT['max'], 'A': 500})),
      prem=['Medidas citadas no documento: tapumes, escoramento da fachada com estroncas de eucalipto, rede de proteção e lona na cobertura.',
            'Fachada 150/250/400 m², cobertura 250/350/500 m², 30/40/60 estroncas (premissa; medir no local).',
            'Cenário máximo inclui início da estabilização/recuperação (reforma pesada de 500 m²). Restauro de prédio histórico não está incluído.',
            'Locação do andaime e da tela não têm preço no SINAPI-BA usado; só montagem e colocação.']),
 dict(k='MPBA_001.9.190096.2025', dt=lambda p: dt_ed(p), bdi='edif', fonte='demanda-tipo (unidades não listadas)',
      p=cen(dict(A=600 * 0.3), dict(A=800 * 0.5), dict(A=1000 * 0.7)),
      prem=['A Recomendação não lista as escolas; foi estimada só a conclusão da Escola Municipal Vovó Isaac (citada).',
            'Escola de 600/800/1.000 m² com remanescente de 30/50/70% (área equivalente 180/400/700 m²).', PREM_ED]),
 dict(k='MPBA_001.9.24192.2024', dt=dt_dren, bdi='via', fonte='documento (extensão de 1.600 m)',
      p=dren([1600] * 3, [0.8, 1.0, 1.2]),
      prem=['Extensão de 1.600 m citada no pedido de prorrogação da SEINFRA (minuta de 12/11/2024).',
            'Rede principal DN 800/1.000/1.200 mm (premissa até haver projeto).', PREM_DREN]),
 dict(k='MPBA_001.9.250850.2021', dt=dt_banheiro, bdi='edif', fonte='demanda-tipo (banheiro-tipo)',
      p=cen(dict(k=0.7), dict(k=1.0), dict(k=1.4, cob=True)),
      prem=['Banheiro com chuveiro de cerca de 4 m² e grade de 1,0 x 2,1 m na porta de entrada, como pedido pela 6ª PJ.',
            'Quantidades de alvenaria e revestimento x 0,7 / 1,0 / 1,4; no máximo, inclui cobertura própria.']),
 dict(k='MPBA_001.9.379764.2023', dt=dt_dren, bdi='via', fonte='demanda-tipo (local não identificado)',
      p=dren([50, 100, 200], [0.6, 0.6, 0.8]),
      prem=['Local do valetão não identificado; trecho de 50/100/200 m de rede com recomposição.',
            'A vala foi aberta pela EMBASA: parte do custo pode caber à concessionária.', PREM_DREN]),
 dict(k='MPBA_001.9.52800.2024', dt=dt_quadra, bdi='edif', fonte='documento (1 quadra) + demanda-tipo',
      p=cen(dict(kg_m2=18, A_vest=0), dict(kg_m2=25, A_vest=40), dict(kg_m2=32, A_vest=60)),
      prem=['Quadra poliesportiva coberta-tipo: piso 32 m x 20 m em concreto armado, cobertura metálica de 748 m², alambrado de 104 m.',
            'Estrutura de aço 18/25/32 kg/m²; vestiário de 0/40/60 m².',
            'Iluminação esportiva representada por refletores do SINAPI; o projeto luminotécnico pode elevar o custo.']),
 dict(k='MPBA_003.9.153337.2023', dt=lambda p: dt_ref(p), bdi='edif', fonte='demanda-tipo (área a confirmar)',
      p=ref([1500, 2000, 2500]),
      prem=['Prédio escolar de 1939 com dois pavimentos; área de 1.500/2.000/2.500 m² (premissa; confirmar).',
            'Inclui requalificação de cobertura pedida pela 6ª PJ. Exigências de preservação histórica podem elevar o custo.', PREM_REF]),
 dict(k='MPBA_003.9.198543.2025', dt=dt_dren, bdi='via', fonte='demanda-tipo (escopo a confirmar)',
      p=dren([150, 250, 400], [0.6, 0.6, 0.8]),
      prem=['Rua Jardim Alice (Banco da Vitória), segundo as planilhas da SEINFRA; trecho de 150/250/400 m.',
            'A NF fala em saneamento; o escopo de drenagem precisa ser confirmado.', PREM_DREN]),
 dict(k='MPBA_003.9.476383.2022', dt=dt_via, bdi='via', fonte='demanda-tipo (rua-tipo)',
      p=via([150, 250, 400]),
      prem=['Rua Praia Dourada (nome só na lista de controle); comprimento de 150/250/400 m (premissa).',
            'O esgoto cabe à EMBASA e não está incluído.', PREM_VIA]),
 dict(k='MPF_1.14.001.000105-2023', dt=dt_enc, bdi='edif', fonte='documento (1.368,32 m², Meta 13 do Novo PAC)',
      p=cen(dict(A=1368.32, H=8, s=2.0, Lg=6, e_cp=10), dict(A=1368.32, H=8, s=1.5, Lg=8, e_cp=10),
            dict(A=1368.32, H=8, s=1.25, Lg=12, e_cp=15)),
      prem=['Área de 1.368,32 m² da Meta 13 (Alto do Socorro, trecho 02), citada na resposta ao MPF no PA 1.14.001.000254/2022-91.',
            'Solução-tipo: solo grampeado com concreto projetado e drenagem. Grampos 2,0/1,5/1,25 m com 6/8/12 m; concreto 10/10/15 cm.',
            'Altura média da encosta de 8 m (premissa). A solução real depende de sondagem e projeto geotécnico.',
            'Referência no documento: Meta 13 orçada em R$ 2.682.472,20 no Novo PAC (fora da CP 006/2026).']),
 dict(k='MPF_1.14.001.000183-2023', dt=dt_casas, bdi='edif', fonte='documento (96 casas e 5 parques lineares)',
      p=cen(dict(N=96, A_casa=40, A_parque=1500, n_parques=5), dict(N=96, A_casa=42, A_parque=2000, n_parques=5),
            dict(N=96, A_casa=45, A_parque=3000, n_parques=5)),
      prem=['96 casas e 5 parques lineares citados no Processo MIDR 59053.005916/2022-05.',
            'Casa térrea de 40/42/45 m²; parque de 1.500/2.000/3.000 m² com gramado e passeios.',
            'Não inclui infraestrutura do conjunto, terreno nem trabalho social.',
            'Referências no documento: projeto de R$ 17.156.213,45; contrapartida municipal de R$ 4.549.844,04.', PREM_ED]),
 dict(k='SN_MPF-OBRAS_FNDE_2023', dt=lambda p: dt_ed({'A': p['A_esc']}, pre='Escola Vila Lídia - ') + dt_ed({'A': p['A_cre']}, pre='Creche N. Sra. da Vitória - ')
      + dt_quadra({'kg_m2': 25, 'A_vest': 40, 'frac': p['frac']}, pre='Quadra Themístocles Andrade - '),
      bdi='edif', fonte='demanda-tipo (situação das obras não informada)',
      p=cen(dict(A_esc=900 * 0.3, A_cre=1000 * 0.3, frac=0.3), dict(A_esc=900 * 0.5, A_cre=1000 * 0.5, frac=0.5),
            dict(A_esc=900 * 0.7, A_cre=1000 * 0.7, frac=0.7)),
      prem=['Três obras do FNDE citadas na resposta ao MPF: Escola Vila Lídia (remanescente), Quadra Themístocles Andrade e Creche N. Sra. da Vitória.',
            'Escola de 900 m², creche de 1.000 m² e quadra coberta-tipo, com remanescente de 30/50/70% (premissa).', PREM_ED]),
 dict(k='MPT_000120.2022.05.001.7', dt=lambda p: dt_ref(p), bdi='edif', fonte='demanda-tipo (área a confirmar)',
      p=ref([200, 300, 400]), prem=['Base do SAMU de 200/300/400 m² (premissa; endereço e escopo não informados).', PREM_REF]),
 dict(k='MPT_000252.2024.05.001.5', dt=lambda p: dt_ref(p), bdi='edif', fonte='demanda-tipo (área a confirmar)',
      p=ref([300, 500, 800]), prem=['Prédio do Arquivo Público de 300/500/800 m² (premissa).',
            'Laudos estrutural e elétrico com ART e projeto de incêndio estão na contingência (projetos e laudos).', PREM_REF]),
 dict(k='MPT_000282.2023.05.001.4', dt=lambda p: dt_ref(p), bdi='edif', fonte='demanda-tipo (área a confirmar)',
      p=ref([300, 450, 600]), prem=['Clínica (CMAE) de 300/450/600 m² (premissa). A mudança para outro imóvel pode dispensar a reforma.', PREM_REF]),
 dict(k='MPT_000393.2023.05.001.6', dt=dt_cozinha, bdi='edif', fonte='demanda-tipo (unidades não listadas)',
      p=cen(dict(N=5), dict(N=10), dict(N=20)),
      prem=['Adequação-tipo de cozinha escolar: abrigo de GLP, ventilação, revestimentos, caixa de gordura e bancada.',
            '5/10/20 cozinhas (premissa; a SEDUC ainda não enviou a lista).',
            'Exaustores não têm preço no SINAPI-BA usado e não estão incluídos. PGR, PCMSO, exames, EPIs e treinamentos cabem à SEDUC.']),
 dict(k='JUSTICA_0006323-71.2012.8.05.0103', dt=dt_estadio, bdi='edif', fonte='demanda-tipo (itens de segurança do TAC)',
      p=cen(dict(ext=15, ext_a=10, co2=2, emerg=40, placas=40, alerta=10, saidas=2, gc=200, capt=6, cord=300, hastes=6, qd=2),
            dict(ext=20, ext_a=15, co2=3, emerg=60, placas=60, alerta=15, saidas=4, gc=300, capt=8, cord=400, hastes=8, qd=3),
            dict(ext=30, ext_a=20, co2=4, emerg=90, placas=90, alerta=20, saidas=6, gc=450, capt=12, cord=600, hastes=12, qd=4)),
      prem=['Escopo estrito, por decisão do usuário (13/10/2026): só a adequação às normas de segurança previstas no TAC de 2012 (extintores, guarda-corpos, sinalização e saídas de emergência, casas de força e SPDA). Sem reforma geral, pintura ou acessibilidade.',
            'Quantidades-tipo para estádio de pequeno porte (premissa); o relatório técnico e o projeto de segurança contra incêndio e pânico devem confirmá-las.',
            'Central de alarme, acionadores e sirenes não têm preço no SINAPI-BA usado e não estão incluídos. Brigada de incêndio (treinamento) e projeto de segurança contra incêndio estão na contingência.',
            'Se o projeto aprovado pelo Corpo de Bombeiros exigir sistema de hidrantes, o custo será acrescido.']),
 dict(k='JUSTICA_8003152-18.2022.8.05.0103', dt=dt_dren, bdi='via', fonte='demanda-tipo (duas ruas)',
      p=dren([300, 500, 800], [0.6, 0.6, 0.8]),
      prem=['Ruas Castro Alves e Barão do Rio Branco (Pontal): 2 ruas de 150/250/400 m (premissa).',
            'A EMBASA é corré: parte do custo pode caber à concessionária.', PREM_DREN]),
 dict(k='JUSTICA_8005263-04.2024.8.05.0103', dt=dt_via, bdi='via', fonte='demanda-tipo (rua-tipo)',
      p=via([150, 250, 400]),
      prem=['Rua Aracuã: comprimento de 150/250/400 m (premissa; medir).',
            'Verificar se a rua está no escopo do Termo de Compromisso 969321/2024 (Novo PAC).', PREM_VIA]),
 dict(k='JUSTICA_8005837-61.2023.8.05.0103', dt=dt_abrigo, bdi='edif', fonte='demanda-tipo (abrigo-tipo)',
      p=cen(dict(N=2), dict(N=3), dict(N=4)),
      prem=['Abrigo de passageiros-tipo de 4 m x 3 m com estrutura metálica, telha termoacústica, piso, banco e piso podotátil.',
            '2/3/4 abrigos (a sentença fala em "novos abrigos", sem número).']),
 dict(k='TCM_03973e23-CRECHE_TEOTONIO_VILELA', dt=lambda p: dt_ed(p), bdi='edif', fonte='documento (6 salas) + demanda-tipo',
      p=cen(dict(A=700 * 0.3), dict(A=800 * 0.5), dict(A=900 * 0.7)),
      prem=['Creche padrão de 6 salas (documento) com 700/800/900 m² e remanescente de 30/50/70% (premissa).',
            'Situação atual da obra e do contrato não informada (último documento de 2023).', PREM_ED]),
 dict(k='SN_COMPLEXO_ESPORTIVO_CAMPO_DO_RODAO', dt=dt_campo, bdi='edif', fonte='demanda-tipo (campo-tipo)',
      p=cen(dict(a=70, b=45, calcada=150, A_vest=60), dict(a=90, b=60, calcada=200, A_vest=80), dict(a=100, b=64, calcada=300, A_vest=120)),
      prem=['Campo de futebol de 70x45 / 90x60 / 100x64 m com gramado, drenagem, alambrado, calçadas e vestiário de 60/80/120 m².',
            'Iluminação esportiva representada por refletores do SINAPI; o projeto luminotécnico pode elevar o custo.']),
]

TITULO = {'JUSTICA_0006323-71.2012.8.05.0103': 'Adequação do Estádio Municipal Mário Pessoa às normas de segurança (TAC de 2012, Cidade Nova)'}
# ---------------------------------------------------------------- calculo
objs_mp = {o['grupo_objeto']: o for o in json.load(open(os.path.join(MP, 'mp_objetos.json')))}
res = []
for i, o in enumerate(OBJ, 1):
    meta = objs_mp[o['k']]
    assert meta['sugestao_triagem']['opcao'] == 'orçamento paramétrico', o['k']
    linhas = {}
    for c in CEN:
        for macro, cod, q, memo in o['dt'](o['p'][c]):
            key = (macro, cod, memo)
            if key not in linhas:
                d, u, pr, tipo = preco(cod)
                linhas[key] = dict(macro=macro, codigo=cod.lstrip('I'), tipo=tipo, descricao=d, unidade=u, preco=pr, memoria=memo,
                                   q={'min': 0.0, 'prov': 0.0, 'max': 0.0})
            linhas[key]['q'][c] += q
    itens = list(linhas.values())
    tot = {}
    for c in CEN:
        direto = sum(round(x['q'][c], 2) * x['preco'] for x in itens)
        tot[c] = dict(direto=direto, total=direto * (1 + BDI[o['bdi']][c]) * (1 + CONT[c]) * FREG[c])
    res.append(dict(n=i, grupo_objeto=o['k'], titulo=TITULO.get(o['k'], meta['titulo']), origem=meta['origem'], categoria=meta['categoria'],
                    local=meta['local'], bdi_tipo=o['bdi'], fonte_quant=o['fonte'], premissas=o['prem'], itens=itens, totais=tot))
os.makedirs(os.path.join(S, 'etapa_b'), exist_ok=True)
json.dump(dict(status=PROV, BDI=BDI, CONT=CONT, FREG=FREG, objetos=res), open(os.path.join(S, 'etapa_b', 'resultado.json'), 'w'),
          ensure_ascii=False, indent=1)
g = {c: sum(r['totais'][c]['total'] for r in res) for c in CEN}
for r in res:
    t = r['totais']
    print(f"{r['n']:2d} {r['grupo_objeto'][:36]:36} {r['origem']:7} {t['min']['total']:>15,.0f} {t['prov']['total']:>15,.0f} {t['max']['total']:>15,.0f}")
print(f"{'TOTAL':48} {g['min']:>15,.0f} {g['prov']:>15,.0f} {g['max']:>15,.0f}")
