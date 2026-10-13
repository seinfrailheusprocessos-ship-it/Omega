"""Gera dossies_justica_plano.json: objetos na ordem responder já -> paramétrico -> licitação -> contrato -> resolvido."""
import json, os, sys, re
MP, OUT, SCR = sys.argv[1], sys.argv[2], sys.argv[3]
O = json.load(open(os.path.join(MP, 'justica_objetos.json')))
src = open(os.path.join(SCR, 'gerar_prazos_jus.py'), encoding='utf-8').read()
ns = {'__file__': 'x', 'sys': sys}; sys_argv = sys.argv; sys.argv = ['x', MP, '/dev/null']
exec(src[:src.index("assert all(i['k'] in O")], ns); sys.argv = sys_argv
URG = [i['k'] for i in ns['ITENS']]                       # ordem de urgência do prazos_justica.md
ORD = ['responder já', 'orçamento paramétrico', 'licitação em curso', 'contrato assinado', 'resolvido']
def corta(t, n=700):
    if len(t) <= n: return t
    c = t[:n]; k = max(c.rfind('. '), c.rfind('; '))
    return (c[:k + 1] if k > n * 0.5 else c[:n - 1].rstrip() + '…')
def chave(o):
    p = o['prazo_mais_proximo'] or {}
    sit = {'vencido': 0, 'a vencer': 1}.get(p.get('situacao'), 2)
    u = URG.index(o['grupo_objeto']) if o['grupo_objeto'] in URG else 99
    return (ORD.index(o['sugestao_triagem']['opcao']), u, sit, p.get('data_limite') or '9999', o['grupo_objeto'])
plano = []
for n, o in enumerate(sorted(O, key=chave), 1):
    p = o['prazo_mais_proximo']
    sit = 'sem prazo' if not p else p['situacao'] + (' (estimado)' if p['data_limite_estimada'] else '')
    plano.append({'n': n, 'grupo_objeto': o['grupo_objeto'], 'titulo': o['titulo'], 'categoria': o['categoria'], 'origem': o['origem'],
                  'local': o['local'], 'prazo_mais_proximo': p['data_limite'] if p else None, 'situacao_prazo': sit,
                  'sugestao_triagem': o['sugestao_triagem']['opcao'], 'motivo': o['sugestao_triagem']['motivo'],
                  'pedido_consolidado': corta(o['pedido_consolidado']), 'docs': o['documentos']})
assert all(len(x['pedido_consolidado']) <= 700 for x in plano) and len(plano) == len(O)
json.dump(plano, open(OUT, 'w'), ensure_ascii=False, indent=2)
for x in plano: print(f"{x['n']:2d} {x['sugestao_triagem'][:12]:12} {x['situacao_prazo'][:18]:18} {len(x['docs']):2d} {x['grupo_objeto']}")
