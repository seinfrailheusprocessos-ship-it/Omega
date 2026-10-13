"""Aplica as decisões do usuário de 13/10/2026 às triagens (MP e Justiça), que passam a APROVADAS."""
import json, os, sys
MP = sys.argv[1]
APROV = 'APROVADA em 13/10/2026 (triagem provisória aprovada pelo usuário, com os ajustes registrados em decisoes_usuario)'
DEC_J = {
 'JUSTICA_0000917-10.2015.5.05.0493': ('orçamento paramétrico', 'Decisão do usuário (13/10/2026): estimar só o cercamento de toda a poligonal do antigo lixão de Itariri, obrigação da sentença. A resposta à PGM continua pendente.'),
 'JUSTICA_8008589-69.2024.8.05.0103': ('licitação em curso', 'Decisão do usuário (13/10/2026): a reforma da Unidade Renascer já tem licitação própria; retirada da estimativa. A resposta é tratada à parte.'),
 'JUSTICA_8008587-02.2024.8.05.0103': ('resolvido', 'Decisão do usuário (13/10/2026): o projeto de incêndio da Casa Lar Masculina foi retirado do levantamento e é tratado à parte.'),
}
DEC_MP = {
 'MPBA_001.9.592238.2025': ('licitação em curso', 'Decisão do usuário (13/10/2026): Canal do Malhado com licitação própria; resposta tratada à parte. Fora do levantamento.'),
 'JUSTICA_TRABALHO_0000917-10.2015.5.05.0493': ('responder já', 'Decisão do usuário (13/10/2026): o cercamento da poligonal foi estimado no levantamento da Justiça (JUSTICA_0000917-10.2015.5.05.0493), sem dupla contagem.'),
}
CH = {'orçamento paramétrico': 'levantamento', 'responder já': 'responder_ja', 'licitação em curso': 'licitacao_em_curso', 'contrato assinado': 'contrato_assinado', 'resolvido': 'resolvido'}
INV = {v: k for k, v in CH.items()}
def aplica(f, dec, rotulo_codigo):
    T = json.load(open(f))
    T['status'] = APROV
    T.setdefault('decisoes_usuario', [])
    for k, (nova, motivo) in dec.items():
        po = T['por_objeto'][k]
        antiga = po['triagem'] if not rotulo_codigo else INV.get(po['triagem'], po['triagem'])
        for lst in CH.values():
            if k in T[lst]: T[lst].remove(k)
        T[CH[nova]].append(k)
        po['triagem'] = CH[nova] if rotulo_codigo else nova
        po['motivo'] = motivo
        if not any(d['grupo_objeto'] == k for d in T['decisoes_usuario']):
            T['decisoes_usuario'].append({'grupo_objeto': k, 'de': antiga, 'para': nova, 'motivo': motivo})
    T['totais'].update({v: len(T[v]) for v in CH.values()})
    return T
TM = aplica(os.path.join(MP, 'triagem_provisoria.json'), DEC_MP, True)
json.dump(TM, open(os.path.join(MP, 'triagem_provisoria.json'), 'w'), ensure_ascii=False, indent=2)
TJ = aplica(os.path.join(MP, 'triagem_provisoria_justica.json'), DEC_J, False)
# lista do que a Justiça calcula: paramétricos cujo objeto do MP não está calculado no MP
ja = set(TM['levantamento'])
TJ['calcular_na_justica'] = [k for k in TJ['levantamento'] if TJ['por_objeto'][k]['ja_no_mp'] not in ja]
TJ['ja_calculado_no_mp'] = [k for k in TJ['levantamento'] if TJ['por_objeto'][k]['ja_no_mp'] in ja]
TJ['totais'].update(calcular_na_justica=len(TJ['calcular_na_justica']), ja_calculado_no_mp=len(TJ['ja_calculado_no_mp']))
TJ['criterio'] = ('Triagem da Justiça = sugestao_triagem do justica_objetos.json (Etapa A-J), aprovada pelo usuário em 13/10/2026 com os ajustes de '
                  'decisoes_usuario. Objeto "orçamento paramétrico" já calculado no MP (ja_no_mp) não é calculado de novo.')
json.dump(TJ, open(os.path.join(MP, 'triagem_provisoria_justica.json'), 'w'), ensure_ascii=False, indent=2)
print('MP', TM['totais']); print('JUS', TJ['totais'], TJ['calcular_na_justica'])
