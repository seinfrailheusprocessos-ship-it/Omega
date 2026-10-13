"""Etapa B-J - estimativa paramétrica da Justiça (parâmetros APROVADOS em 13/10/2026). Mesmo método, preços e parâmetros do modelo.py (MP).
Calcula só os objetos 'orçamento paramétrico' da Justiça que não foram calculados no MP (sem dupla contagem).
Uso: python3 -I modelo_jus.py SCRATCH REPO_MP   -> grava SCRATCH/etapa_b/resultado_justica.json
"""
import json, math, os, sys

S, MP = sys.argv[1], sys.argv[2]
_src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'modelo.py'), encoding='utf-8').read()
exec(_src[:_src.index('\nOBJ = [')])          # preços, parâmetros, demandas-tipo e cenários do MP (sem recalcular o MP)

def dt_loteamento(p):
    """Infraestrutura básica de loteamento por metro de via: via-tipo + água + esgoto + iluminação pública."""
    L = p['L']
    it = dt_via(p)
    va, ve = L * 0.6 * 1.0, L * 0.8 * 1.5
    it += [('6. Rede de água', '102279', va, 'vala 0,6 m x 1,0 m ao longo de L'),
           ('6. Rede de água', 'I36084', L, 'tubo PVC PBA DN 50 (insumo)'),
           ('6. Rede de água', '97124', L, 'assentamento do tubo DN 50'),
           ('6. Rede de água', '93379', va * 0.95, 'reaterro da vala'),
           ('7. Rede de esgoto', '102279', ve, 'vala 0,8 m x 1,5 m ao longo de L'),
           ('7. Rede de esgoto', '90695', L, 'tubo PVC DN 150 - fornecimento e assentamento'),
           ('7. Rede de esgoto', '97978', math.ceil(L / 60) + 1, 'PV pré-moldado DN 0,8 m a cada 60 m + 1'),
           ('7. Rede de esgoto', '93379', ve * 0.95, 'reaterro da vala'),
           ('8. Iluminação pública', '101656', math.ceil(L / 35), 'luminária LED 68-97 W a cada 35 m'),
           ('8. Iluminação pública', '101636', math.ceil(L / 35), 'braço de 1,5 m para poste de concreto')]
    return it

def dt_acolhimento(p):
    it = dt_ref(p)
    it += [('8. Prevenção contra incêndio', '90838', p['pcf'], 'porta corta-fogo 90x210 na rota de saída de emergência')]
    return it

def dt_cerca(p):
    """Cercamento de área por metro de perímetro: alambrado 2 m com mourões e mureta de concreto + concertina, portões e placas."""
    P = p['P']
    return [('1. Serviços preliminares', '103689', 6, 'placa de obra 3 m x 2 m'),
            ('1. Serviços preliminares', '98525', 3 * P, 'limpeza da faixa de 3 m ao longo do perímetro'),
            ('2. Cercamento', '98522', P, 'alambrado com mourões de concreto, tela de arame galvanizado e mureta de concreto'),
            ('2. Cercamento', '105126', P, 'concertina simples de 300 mm no topo do alambrado (impede a escalada)'),
            ('3. Portões de controle de acesso', '99861', p['portoes'] * 4 * 2.2, 'portões em gradil de aço, 4,0 m x 2,2 m cada (1/2/3 portões nos cenários mín/prov/máx)'),
            ('4. Sinalização', 'I34723', 0.5 * math.ceil(P / 100), 'placa de advertência 1,0 x 0,5 m em chapa de aço a cada 100 m')]

PREM_LOT = ('Infraestrutura básica por metro de via: via-tipo (drenagem, pavimentação, meio-fio, sarjeta, passeio e sinalização) + rede de '
            'água PVC DN 50 + rede de esgoto PVC DN 150 com PV a cada 60 m + luminária LED a cada 35 m em poste existente.')
OBJ_J = [
 dict(k='JUSTICA_0001568-38.2011.8.05.0103', dt=dt_loteamento, bdi='via', fonte='demanda-tipo (extensão de vias a confirmar)',
      p={c: {**VIA[c], 'L': L} for c, L in zip(CEN, (600, 1000, 1600))},
      prem=['Sentença: infraestrutura básica do Loteamento Santa Cruz (drenagem, esgoto, água, iluminação, pavimentação e meio-fio).',
            'Extensão total de vias de 600/1.000/1.600 m (premissa; a poligonal da sentença não consta do pacote).', PREM_LOT, PREM_VIA,
            'Ligações domiciliares, postes novos, estação elevatória e tratamento de esgoto não estão incluídos; parte da água e do esgoto pode caber à concessionária.']),
 dict(k='JUSTICA_8007670-17.2023.8.05.0103', dt=dt_enc, bdi='edif', fonte='demanda-tipo (área da encosta a confirmar)',
      p=cen(dict(A=600, H=8, s=2.0, Lg=6, e_cp=10), dict(A=1000, H=8, s=1.5, Lg=8, e_cp=10), dict(A=1400, H=8, s=1.25, Lg=12, e_cp=15)),
      prem=['Estabilização de encosta da Ladeira Júlio Bagana / Rua Rio Almada (Tapera); obra paralisada e contrato anterior extinto.',
            'Face de 600/1.000/1.400 m² (premissa). O levantamento técnico em curso deve indicar o remanescente: parte da obra pode já ter sido executada.',
            'Solução-tipo: solo grampeado com concreto projetado e drenagem; grampos 2,0/1,5/1,25 m com 6/8/12 m; concreto 10/10/15 cm.',
            'Recuperação do pavimento da ladeira não está incluída.']),
 dict(k='JUSTICA_0000917-10.2015.5.05.0493', dt=dt_cerca, bdi='edif', fonte='demanda-tipo (perímetro da poligonal a medir)',
      p={c: {'P': P, 'portoes': n} for c, P, n in zip(CEN, (1500, 2500, 3500), (1, 2, 3))},
      prem=['Sentença da ACP do MPT (1ª Vara do Trabalho de Ilhéus): cercar toda a poligonal do antigo aterro de Itariri. Só o cercamento; vigilância 24 h e ações sociais cabem a outras secretarias.',
            'Perímetro de 1.500/2.500/3.500 m (premissa): a poligonal não consta do acervo e a base cartográfica aberta não pôde ser acessada. Custo linear: recalcular com o perímetro medido.',
            'Alambrado de 2 m com tela de arame galvanizado, mourões e mureta de concreto, com concertina no topo; 1/2/3 portões de 4,0 x 2,2 m; placas de advertência a cada 100 m.',
            'Não inclui recuperação de cerca existente, terraplenagem de taludes, drenagem nem guarita (a vigilância é da Secretaria de Ordem Pública).'])]

TITULO = {'JUSTICA_0000917-10.2015.5.05.0493': 'Cercamento de toda a poligonal do antigo lixão de Itariri (ACP do MPT)'}
# ---------------------------------------------------------------- cálculo
JO = {o['grupo_objeto']: o for o in json.load(open(os.path.join(MP, 'justica_objetos.json')))}
TJ = json.load(open(os.path.join(MP, 'triagem_provisoria_justica.json')))     # triagem aprovada (com as decisões do usuário)
param, calcular = TJ['levantamento'], TJ['calcular_na_justica']
assert sorted(calcular) == sorted(o['k'] for o in OBJ_J), (calcular, [o['k'] for o in OBJ_J])
N0 = json.load(open(os.path.join(S, 'etapa_b', 'resultado.json')))['objetos'][-1]['n']
res = []
for i, o in enumerate(OBJ_J, N0 + 1):
    meta = JO[o['k']]
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
                    local=meta['local'], bdi_tipo=o['bdi'], fonte_quant=o['fonte'], premissas=o['prem'], itens=itens, totais=tot,
                    levantamento='Justiça', ja_no_mp=meta['ja_no_mp']))
nao = [dict(grupo_objeto=k, titulo=JO[k]['titulo'], ja_no_mp=JO[k]['ja_no_mp']) for k in param if k not in calcular]
json.dump(dict(status=PROV, BDI=BDI, CONT=CONT, FREG=FREG, objetos=res, ja_calculados_no_mp=nao),
          open(os.path.join(S, 'etapa_b', 'resultado_justica.json'), 'w'), ensure_ascii=False, indent=1)
g = {c: sum(r['totais'][c]['total'] for r in res) for c in CEN}
for r in res:
    t = r['totais']
    print(f"{r['n']:2d} {r['grupo_objeto'][:36]:36} {t['min']['total']:>15,.0f} {t['prov']['total']:>15,.0f} {t['max']['total']:>15,.0f}")
print(f"{'TOTAL JUSTIÇA':39} {g['min']:>15,.0f} {g['prov']:>15,.0f} {g['max']:>15,.0f}")
print('paramétricos já calculados no MP (não somados):', [x['grupo_objeto'] for x in nao])
