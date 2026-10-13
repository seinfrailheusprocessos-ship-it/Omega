"""Gera prazos.md: objetos 'responder já' em ordem de urgência, com pedido e minuta curta de resposta."""
import json, os, sys, datetime
MP, OUT = sys.argv[1], sys.argv[2]
O = {o['grupo_objeto']: o for o in json.load(open(os.path.join(MP, 'mp_objetos.json')))}
HOJE = datetime.date(2026, 10, 13)
PROV = 'APROVADA em 13/10/2026'
def br(d): return datetime.date.fromisoformat(d).strftime('%d/%m/%Y') if d else '—'
FECHO_OF = ['Renovam-se a Vossa Excelência os protestos de elevada estima e consideração.', '', 'Respeitosamente,', '',
            'Ilhéus, *data da assinatura*.', '', '**{{NOME_DO_SIGNATARIO}}**', '**{{CARGO_DO_SIGNATARIO}}**']
FECHO_CI = ['Ilhéus, *data da assinatura*.', '', '**{{NOME_DO_SIGNATARIO}}**', '**{{CARGO_DO_SIGNATARIO}}**']

def oficio(orgao, unidade, assunto, referencia, abertura, pars):
    L = ['**OFÍCIO**', '**SEINFRA N. {{NUMERO}}**', '',
         f'Assunto: {assunto}', f'Destinatário: {orgao} / {unidade}', f'Referência: {referencia}', '', 'Excelência,', '', abertura, '']
    for i, p in enumerate(pars, 1): L += [f'{i}. {p}', '']
    return L + FECHO_OF

def ci(assunto, referencia, pars):
    L = ['**COMUNICAÇÃO INTERNA**', '**SEINFRA N. {{NUMERO}}**', '',
         f'Assunto: {assunto}', 'Emissor: {{NOME_DO_SIGNATARIO}} / {{CARGO_DO_SIGNATARIO}}', 'Destinatário: Procuradoria Geral do Município',
         f'Referência: {referencia}', '']
    for i, p in enumerate(pars, 1): L += [f'{i}. {p}', '']
    return L + FECHO_CI

MPBA = 'Ministério Público do Estado da Bahia'
ITENS = [
 dict(k='MPBA_001.9.256878.2026', urg='URGENTE: prazo estimado vence em 14/10/2026 e o objeto é risco de desabamento',
      falta='Fazer a vistoria (local no Id. 36338573 dos autos). Se não der até 14/10, protocolar hoje a minuta alternativa de dilação.',
      minuta=oficio(MPBA, '11ª Promotoria de Justiça de Ilhéus', 'Presta informações técnicas em relação à Notícia de Fato n. 001.9.256878/2026',
          'Ofícios n. 1654/2026 e n. 1900/2026',
          'Em resposta aos Ofícios n. 1654/2026 e n. 1900/2026, exarados no âmbito da 11ª Promotoria de Justiça de Ilhéus, referentes à Notícia de Fato n. 001.9.256878/2026, que tem como objeto a verificação de risco de desabamento de construção indicada nos autos, cumpre informar:',
          ['A equipe técnica desta Secretaria realizou vistoria na construção indicada nos autos, situada em {{ENDERECO}}, em {{DATA_DA_VISTORIA}}.',
           'Constatou-se {{SITUACAO_ESTRUTURAL}}, razão pela qual {{HA_OU_NAO_HA}} risco atual de desabamento, conforme relatório de vistoria anexo.',
           '{{PROVIDENCIAS_ADOTADAS_OU_RECOMENDADAS (interdição, notificação do responsável, acionamento da Defesa Civil)}}.']),
      alt='Alternativa, se a vistoria não couber no prazo: "A vistoria na construção indicada nos autos está agendada para {{DATA}}. Requer-se a dilação do prazo por 15 (quinze) dias para o envio do relatório de vistoria."'),
 dict(k='MPBA_003.9.121114.2026', urg='ALTA: risco de desabamento, prazo vencido e reiteração (Ofício n. 1857/2026, 30 dias)',
      falta='Conferir o arquivo "RVP 003.9.121114.2026" (só imagem, não lido), que pode ser o relatório da Defesa Civil. Sem relatório, pedir vistoria imediata.',
      minuta=oficio(MPBA, '11ª Promotoria de Justiça de Ilhéus', 'Presta informações técnicas em relação ao Procedimento Preparatório n. 003.9.121114/2026',
          '{{NUMERO_DO_PRIMEIRO_OFICIO}} e Ofício n. 1857/2026',
          'Em resposta aos Ofícios n. {{NUMERO_DO_PRIMEIRO_OFICIO}} e n. 1857/2026, exarados no âmbito da 11ª Promotoria de Justiça de Ilhéus, referentes ao Procedimento Preparatório n. 003.9.121114/2026, que tem como objeto a situação estrutural de imóvel abandonado no Caminho 48, bairro Hernani Sá, cumpre informar:',
          ['Em complemento ao Ofício n. 022/2026/SEINFRA/RSMP, que informou o encaminhamento da demanda à Defesa Civil, encaminha-se o relatório de vistoria do imóvel, elaborado em {{DATA}}.',
           'Quanto à situação estrutural, o relatório conclui {{CONCLUSAO}}, {{COM_OU_SEM}} risco de desabamento.',
           '{{PROVIDENCIAS_RECOMENDADAS}}.'])),
 dict(k='JUSTICA_TRABALHO_0000917-10.2015.5.05.0493', urg='ALTA: processo judicial com multas e prazo vencido em 31/08/2026',
      falta='Cabe à SEINFRA o cercamento de toda a poligonal do antigo aterro: a estimativa e a minuta completa estão em itariri_cercamento.md (cerca de R$ 288,00 por metro; R$ 737.185,86 para 2.500 m). Em processo judicial, a resposta é CI à PGM, não ofício.',
      minuta=ci('Presta informações técnicas em relação ao Processo Judicial n. 0000917-10.2015.5.05.0493', 'CI n. 746/2026 - PGM',
          ['Em atenção à CI n. 746/2026, informa-se que os subsídios solicitados para a audiência de conciliação (relatórios de matrícula escolar, destinação de resíduos, laudo do cercamento e ocorrências da Guarda Civil Municipal) foram dirigidos às Secretarias de Promoção Social, de Serviços Urbanos e de Ordem Pública.',
           'No que cabe a esta Secretaria, o cercamento de toda a poligonal do antigo aterro, segue a estimativa preliminar de custo: R$ 288,00 por metro de perímetro, com BDI e contingência, e R$ {{VALOR}} para o perímetro medido de {{PERIMETRO}} m (ver itariri_cercamento.md).',
           'Esta Secretaria permanece à disposição para o apoio técnico que a Procuradoria Geral entender necessário.'])),
 dict(k='MPBA_001.9.375062.2025', urg='ALTA: prazo "impreterível" vencido; sem resposta os autos seguem para medidas cabíveis',
      falta='Confirmar se há projeto ou intervenção do Município na área verde e quem eram os topógrafos citados na petição.',
      minuta=oficio(MPBA, '8ª Promotoria de Justiça de Ilhéus', 'Presta informações técnicas em relação à Notícia de Fato n. 001.9.375062/2025',
          'Ofícios n. 348/2025 e n. 390/2025',
          'Em resposta aos Ofícios n. 348/2025 e n. 390/2025, exarados no âmbito da 8ª Promotoria de Justiça de Ilhéus, referentes à Notícia de Fato n. 001.9.375062/2025, que tem como objeto possível intervenção na área verde menor do Loteamento Jardim Atlântico, cumpre informar:',
          ['{{NAO_HA_OU_HA}} intervenção ou projeto desta Secretaria previsto para a área verde menor do Loteamento Jardim Atlântico, entre as Ruas Helenilson Chaves, Saul Barbosa e Nerival Rosa Barros.',
           'Quanto à presença de topógrafos relatada na petição encaminhada pelo Ofício n. 390/2025, {{ESCLARECIMENTO}}.',
           '{{DOCUMENTOS_REQUISITADOS_NO_OFICIO_348_2025, SE HOUVER}}.'])),
 dict(k='MPBA_001.9.1829.2023', urg='MÉDIA: relatório técnico requisitado, prazo vencido em ago/2025',
      falta='Juntar o relatório técnico e o fotográfico (a planilha indica "RF OK") e o número da licitação em curso.',
      minuta=oficio(MPBA, '8ª Promotoria de Justiça de Ilhéus', 'Presta informações técnicas em relação ao Procedimento n. 001.9.1829/2023',
          'Ofício n. 235/2025',
          'Em resposta ao Ofício n. 235/2025, exarado no âmbito da 8ª Promotoria de Justiça de Ilhéus, referente ao Procedimento n. 001.9.1829/2023, que tem como objeto a adequação do prédio anexo da Prefeitura, cumpre informar:',
          ['Encaminha-se o relatório técnico do prédio anexo, com diagnóstico das condições estruturais e funcionais, deficiências identificadas e adequações necessárias, acompanhado de relatório fotográfico.',
           'As adequações {{SAO_OBJETO_DA_LICITACAO_N_X_EM_CURSO_OU_SERAO_CONTRATADAS}}, com previsão orçamentária {{SITUACAO}} e prazo estimado de conclusão de {{PRAZO}}, conforme cronograma anexo.'])),
 dict(k='MPBA_001.9.71615.2025', urg='MÉDIA: identificação dos imóveis não enviada; prazo vencido em jun/2025',
      falta='Concluir a identificação dos imóveis com muros sobre o córrego (endereços e fotos) e atualizar a situação do projeto na CONDER.',
      minuta=oficio(MPBA, '11ª Promotoria de Justiça de Ilhéus', 'Presta informações técnicas em relação à Notícia de Fato n. 001.9.71615/2025',
          'Ofício n. 079/2025',
          'Em resposta ao Ofício n. 079/2025, exarado no âmbito da 11ª Promotoria de Justiça de Ilhéus, referente à Notícia de Fato n. 001.9.71615/2025, que tem como objeto muros construídos sobre o córrego do bairro Hernani Sá, cumpre informar:',
          ['Em complemento aos Ofícios n. 2025.04.14.001/SEINFRA/GAB e n. 009/2026/SEINFRA/RSMP, encaminha-se o relatório de vistoria com a identificação dos imóveis que construíram muros de alvenaria sobre o córrego, com endereços e registro fotográfico.',
           'O projeto de pavimentação e microdrenagem das 16 vias da região, informado no Ofício n. 009/2026/SEINFRA/RSMP, {{SITUACAO_ATUAL_NA_CONDER}}. O edital será encaminhado após sua publicação, conforme já informado.'])),
 dict(k='MPBA_001.9.230302.2024', urg='MÉDIA: reiteração vencida; a resposta pronta não foi protocolada no MP',
      falta='Verificar se a resposta (ofício sem número, enviada à PGM no processo 14525/2025) chegou ao MP. Se não, numerar, datar e protocolar.',
      minuta=oficio(MPBA, '8ª Promotoria de Justiça de Ilhéus', 'Presta informações técnicas em relação à Notícia de Fato n. 001.9.230302/2024',
          'Ofícios n. 087/2025 e n. 244/2025',
          'Em resposta aos Ofícios n. 087/2025 e n. 244/2025, exarados no âmbito da 8ª Promotoria de Justiça de Ilhéus, referentes à Notícia de Fato n. 001.9.230302/2024, que tem como objeto a reforma da UBS de Olivença e a garantia das obras dos postos de saúde, cumpre informar:',
          ['Nenhuma das contratações da empresa indicada no ofício levantadas por esta Secretaria tem como objeto a reforma da UBS de Olivença.',
           'A construção dos postos de saúde de Olivença, Vila de São José e Conquista foi objeto da Concorrência Pública n. 003/2018, cuja cópia, com pagamentos e medições, segue anexa.',
           'Quanto à garantia construtiva, {{FALHAS_IDENTIFICADAS_E_PROVIDENCIAS_DE_ACIONAMENTO}}.'])),
 dict(k='MPBA_001.9.159804.2023', urg='MÉDIA: procedimento retomado em 2025, sem resposta registrada desde então',
      falta='Levantar quantas obras estão no portal e quantas placas têm QR code; alinhar com a Controladoria.',
      minuta=oficio(MPBA, '8ª Promotoria de Justiça de Ilhéus', 'Presta informações técnicas em relação ao Procedimento Administrativo n. 001.9.159804/2023',
          'Ofício n. 041/2025',
          'Em resposta ao Ofício n. 041/2025, exarado no âmbito da 8ª Promotoria de Justiça de Ilhéus, referente ao Procedimento Administrativo n. 001.9.159804/2023, que tem como objeto a transparência das obras públicas municipais, cumpre informar:',
          ['Encontram-se divulgadas no portal {{N}} obras, e {{N}} placas de obra contam com QR code de acesso às informações.',
           'Esta Secretaria permanece à disposição para reunião com a Controladoria Geral do Município, em data a ser designada por Vossa Excelência.'])),
 dict(k='MPT_000170.2025.05.001.9', urg='MÉDIA: teor do pedido desconhecido; planilha marca prazo previsto vencido',
      falta='Obter o ofício ou a notificação do MPT (o dossiê só tem minuta com campos em branco) e confirmar se o objeto é o colapso no Sítio São Paulo.',
      minuta=oficio('Ministério Público do Trabalho', 'Procuradoria do Trabalho no Município de Itabuna', 'Presta informações técnicas em relação ao Procedimento n. 000170.2025.05.001/9',
          '{{NUMERO_DA_NOTIFICACAO_OU_OFICIO}}',
          'Em resposta ao {{NUMERO_DA_NOTIFICACAO_OU_OFICIO}}, exarado no âmbito da Procuradoria do Trabalho no Município de Itabuna, referente ao Procedimento n. 000170.2025.05.001/9, que tem como objeto {{OBJETO}}, cumpre informar:',
          ['{{INFORMACOES_TECNICAS_PEDIDAS}}.'])),
 dict(k='MPBA_001.9.254842.2021', urg='BAIXA: não há prazo de resposta; vistoria de 07/05/2026 já passou',
      falta='Saber se a SEINFRA participou da vistoria e se o MP cobrou alguma providência de infraestrutura.',
      minuta=oficio(MPBA, '6ª Promotoria de Justiça de Ilhéus', 'Presta informações técnicas em relação à Notícia de Fato n. 001.9.254842/2021',
          'Despacho com valor de ofício requisitório (ID MP 34616432)',
          'Em resposta ao despacho com valor de ofício requisitório exarado no âmbito da 6ª Promotoria de Justiça de Ilhéus, referente à Notícia de Fato n. 001.9.254842/2021, que tem como objeto as condições da Creche Amotara, em Olivença, cumpre informar:',
          ['Esta Secretaria {{PARTICIPOU_OU_NAO}} da vistoria presencial realizada na creche em 07/05/2026.',
           '{{CONSTATACOES_E_PROVIDENCIAS_DE_INFRAESTRUTURA_A_CARGO_DESTA_SECRETARIA}}.'])),
 dict(k='TCM_06003e23-CANAL_DA_URBIS', urg='BAIXA: sem prazo conhecido; conferir no e-TCM',
      falta='Verificar no e-TCM se o Município foi notificado e se há prazo de defesa.',
      minuta=ci('Presta informações técnicas em relação ao Processo TCM n. 06003e23', 'Denúncia autuada no TCM-BA (Processo n. 06003e23)',
          ['Solicita-se à Procuradoria Geral informar se o Município foi notificado no Processo TCM n. 06003e23, que trata do Contrato n. 213/2022 (fechamento do Canal da Urbis), e se há prazo de defesa em curso.',
           'Para subsidiar eventual defesa, informa-se a situação do contrato: {{EXECUCAO_FISICA_MEDICOES_E_RECEBIMENTO}}.'])),
]
assert len(ITENS) == 11 and all(O[i['k']]['sugestao_triagem']['opcao'] == 'responder já' for i in ITENS)

L = ['# Prazos e minutas de resposta — Levantamento MP · SEINFRA Ilhéus', '',
     f'Gerado em 13/10/2026. Triagem do MP {PROV}. O Canal do Malhado, com licitação própria, é tratado à parte e não consta desta lista.', '',
     'Os 11 objetos com sugestão "responder já" incluem os 6 com prazo vencido sem resposta registrada e a NF 001.9.256878/2026 (prazo a vencer). Ordem de urgência: risco à vida e prazo a vencer; processo judicial; prazo impreterível; demais prazos vencidos (mais antigos e com reiteração primeiro); sem prazo.', '',
     'Prazos "estimados" foram contados da data do documento; o prazo real conta do recebimento. Campos `{{...}}` são dados que não estão nos documentos: preencher antes de assinar. Minutas no padrão da skill lufa-lufa (ofício para autoridade; em processo judicial e no TCM, CI à Procuradoria Geral do Município). Sem nomes de pessoa: assinatura com `{{NOME_DO_SIGNATARIO}}` e `{{CARGO_DO_SIGNATARIO}}`.', '',
     '## Quadro-resumo', '',
     '| Ordem | Objeto | Procedimento | Prazo | Situação | Urgência |', '|---|---|---|---|---|---|']
for n, it in enumerate(ITENS, 1):
    o = O[it['k']]; p = o['prazo_mais_proximo']
    prazo = (br(p['data_limite']) + (' (estimado)' if p['data_limite_estimada'] else '')) if p else 'sem prazo no documento'
    sit = p['situacao'] if p else '—'
    L.append(f"| {n} | {o['titulo']} | {'; '.join(o['procedimentos']) or '—'} | {prazo} | {sit} | {it['urg'].split(':')[0]} |")
L.append('')
for n, it in enumerate(ITENS, 1):
    o = O[it['k']]; p = o['prazo_mais_proximo']
    L += [f"## {n}. {o['titulo']}", '',
          f"- **Grupo-objeto:** {o['grupo_objeto']} · **Origem:** {o['origem']} · **Procedimento:** {'; '.join(o['procedimentos']) or '—'}",
          f"- **Urgência:** {it['urg']}",
          f"- **Prazo:** " + ((br(p['data_limite']) + (' (estimado)' if p['data_limite_estimada'] else '') + f" — {p['situacao']}") if p else 'não consta do documento'),
          f"- **Pedido:** {o['pedido_consolidado']}",
          f"- **Por que responder já:** {o['sugestao_triagem']['motivo']}",
          f"- **O que falta para responder:** {it['falta']}", '', '**Minuta**', '']
    L += ['> ' + x + '  ' if x else '>' for x in it['minuta']]
    if it.get('alt'): L += ['', it['alt']]
    L.append('')
# outros prazos
L += ['## Outros prazos vencidos (objetos em outras categorias da triagem)', '',
      'Prazo do documento mais recente com prazo de cada objeto. Vários já têm resposta registrada nas planilhas (ofícios RSMP de 08/04/2026): conferir antes de agir.', '',
      '| Prazo | Objeto | Triagem | Observação |', '|---|---|---|---|']

rows = []
for k, o in O.items():
    p = o['prazo_mais_proximo']
    if o['sugestao_triagem']['opcao'] == 'responder já' or not p or p['situacao'] != 'vencido' or k == 'MPBA_001.9.592238.2025': continue
    rows.append((p['data_limite'], o))
for d, o in sorted(rows, key=lambda t: (t[1]['origem'] != 'Justiça', t[0]), reverse=False):
    est = ' (estimado)' if o['prazo_mais_proximo']['data_limite_estimada'] else ''
    obs = 'Processo judicial: resposta via CI à PGM.' if o['origem'] == 'Justiça' else ''
    L.append(f"| {br(d)}{est} | {o['titulo']} | {o['sugestao_triagem']['opcao']} | {obs} |")
L.append('')
open(OUT, 'w').write('\n'.join(L))
print('ok', OUT, len(L))
