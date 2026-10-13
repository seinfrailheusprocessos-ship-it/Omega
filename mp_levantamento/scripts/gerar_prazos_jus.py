"""Gera prazos_justica.md: prazos vencidos/a vencer da Justiça, em ordem de urgência, com pedido e minuta (CI à PGM, padrão lufa-lufa)."""
import json, os, sys, datetime
MP, OUT = sys.argv[1], sys.argv[2]
O = {o['grupo_objeto']: o for o in json.load(open(os.path.join(MP, 'justica_objetos.json')))}
HOJE = datetime.date(2026, 10, 13)
PROV = 'PROVISORIO - aguarda aprovacao'
def br(d): return datetime.date.fromisoformat(d).strftime('%d/%m/%Y') if d else '—'
FECHO_CI = ['Ilhéus, *data da assinatura*.', '', '**{{NOME_DO_SIGNATARIO}}**', '**{{CARGO_DO_SIGNATARIO}}**']

def ci(processo, referencia, pars):
    L = ['**COMUNICAÇÃO INTERNA**', '**SEINFRA N. {{NUMERO}}**', '',
         f'Assunto: Presta informações técnicas em relação ao Processo Judicial n. {processo}',
         'Emissor: {{NOME_DO_SIGNATARIO}} / {{CARGO_DO_SIGNATARIO}}', 'Destinatário: Procuradoria Geral do Município',
         f'Referência: {referencia}', '']
    for i, p in enumerate(pars, 1): L += [f'{i}. {p}', '']
    return L + FECHO_CI

ITENS = [
 dict(k='JUSTICA_8008587-02.2024.8.05.0103', urg='URGENTE: multa diária, dilação de 10 dias vencida no início de setembro de 2026 e risco à vida (incêndio em unidade de acolhimento)',
      prazo='dilação pedida em 25/08/2026 (10 dias), vencida', falta='Concluir o Projeto de Segurança Contra Incêndio e Pânico (PA 14800/2026) com ART/RRT e protocolar no Corpo de Bombeiros; se não estiver pronto, informar a data de entrega.',
      minuta=ci('8008587-02.2024.8.05.0103', 'CI PROGER n. 725/2026 e CI SEINFRA n. 001.25.08.2026',
          ['Em atenção à CI PROGER n. 725/2026 e em complemento à CI SEINFRA n. 001.25.08.2026, informa-se que o Projeto de Segurança Contra Incêndio e Pânico da Casa Lar Masculina foi {{CONCLUIDO_EM_DATA_OU_ESTA_EM_FASE_X}}, sob responsabilidade técnica de profissional habilitado (ART/RRT n. {{NUMERO}}).',
           'O projeto {{FOI_PROTOCOLADO_NO_CORPO_DE_BOMBEIROS_EM_DATA_SOB_N_X_OU_SERA_PROTOCOLADO_ATE_DATA}}, para análise e emissão do Auto de Vistoria do Corpo de Bombeiros.',
           'Seguem anexos o projeto, a ART/RRT e o comprovante de protocolo, para juntada aos autos.'])),
 dict(k='JUSTICA_8008589-69.2024.8.05.0103', urg='URGENTE: acordo homologado em 11/03/2025, fiação exposta e falta de saída de emergência; prazo de 60 dias para o projeto de incêndio vencido',
      prazo=None, falta='Confirmar se a reforma do Renascer já está em licitação (o mapa de pastas da SEINFRA cita "REFORMA ABRIGO RENASCER" em 2026); informar o andamento do projeto de incêndio e o cronograma da reforma e do calendário de manutenção.',
      minuta=ci('8008589-69.2024.8.05.0103', 'C.I. n. 11/2025 da Secretaria de Promoção Social e Combate à Pobreza (acordo homologado em 11/03/2025)',
          ['Em atenção ao acordo homologado na Ação Civil Pública n. 8008589-69.2024.8.05.0103, informa-se o andamento dos itens técnicos a cargo desta Secretaria na Unidade de Acolhimento Renascer.',
           'Projeto de Segurança contra Incêndio e Pânico: {{SITUACAO_DO_PROJETO_E_DATA_DE_PROTOCOLO_NO_CORPO_DE_BOMBEIROS}}.',
           'Reforma da unidade e saída de emergência: {{NUMERO_DO_PROCESSO_LICITATORIO_SITUACAO_E_PREVISAO_DE_INICIO}}.',
           'Calendário anual de manutenção e armários: {{CALENDARIO_ANEXO_E_PREVISAO}}.',
           'Esta Secretaria encaminhará a cada etapa os documentos comprobatórios, para juntada aos autos.'])),
 dict(k='JUSTICA_8008052-39.2025.8.05.0103', urg='ALTA: risco de queda de árvores sobre casa de pessoa idosa; prazo judicial de 15 dias vencido em 29/07/2025',
      prazo=None, falta='Juntar o relatório de vistoria da Defesa Civil (já citado nos autos) e saber com a SEMA se a poda ou o corte foi feito; a resposta deve sair junto com a SEMA.',
      minuta=ci('8008052-39.2025.8.05.0103', 'Mandado de entrega de ofício de 14/07/2025 (decisão liminar de 10/07/2025)',
          ['Em atenção à decisão liminar de 10/07/2025, que determinou vistoria no local e, se necessário, poda ou corte das árvores com risco de queda, informa-se que a Coordenação de Defesa Civil realizou vistoria em {{DATA}}, conforme relatório anexo.',
           'Constatou-se {{SITUACAO_DAS_ARVORES_E_DO_TALUDE}}. A poda ou o corte {{FOI_EXECUTADO_PELA_SECRETARIA_DE_MEIO_AMBIENTE_EM_DATA_OU_ESTA_PROGRAMADO}}.',
           'Solicita-se a juntada do relatório aos autos.'])),
 dict(k='JUSTICA_0000917-10.2015.5.05.0493', urg='ALTA: execução de sentença com multas; o Município faltou à audiência de 03/08/2026 e a vista de 10 dias venceu',
      prazo=None, falta='Saber com a PGM o resultado da audiência de 31/08/2026 e se algum item (cercamento do antigo aterro) cabe à SEINFRA. No MP, ver também prazos.md.',
      minuta=ci('0000917-10.2015.5.05.0493', 'CI n. 746/2026 - PGM e audiência de 31/08/2026',
          ['Em atenção à execução da sentença na Ação Civil Pública n. 0000917-10.2015.5.05.0493, informa-se que, no que cabe a esta Secretaria, {{SITUACAO_DO_CERCAMENTO_DA_POLIGONAL_DO_ANTIGO_ATERRO_DE_ITARIRI}}.',
           'Os demais itens (vigilância, inclusão e matrícula dos menores e destinação de resíduos) cabem às Secretarias de Ordem Pública, de Promoção Social, de Educação e de Serviços Urbanos.',
           'Esta Secretaria permanece à disposição para o apoio técnico que a Procuradoria Geral entender necessário.'])),
 dict(k='JUSTICA_0006323-71.2012.8.05.0103', urg='ALTA: relatório técnico do TAC com prazo judicial vencido (estimado em 28/06/2026) e CI PROGER n. 742/2026 vencida em 02/09/2026',
      prazo=None, falta='Fazer a vistoria do estádio e o relatório item a item do TAC (extintores, guarda-corpos, sinalização, casas de força, brigada, alarme e SPDA). Conferir se o prazo suplementar pedido em 15/09/2026 foi deferido. A obra está na estimativa do MP.',
      minuta=ci('0006323-71.2012.8.05.0103', 'CI PROGER n. 742/2026 e decisão de 29/04/2026',
          ['Em atenção à CI PROGER n. 742/2026 e à decisão de 29/04/2026, que concedeu prazo para apresentação de relatório técnico do cumprimento do Termo de Ajustamento de Conduta de 2012, encaminha-se o relatório técnico do Estádio Municipal Mário Pessoa, elaborado após vistoria em {{DATA}}.',
           'Quanto aos itens do Termo, verificou-se: {{SITUACAO_DE_CADA_ITEM}}.',
           'Para os itens pendentes, a estimativa preliminar consta do levantamento paramétrico da Secretaria, e a contratação está prevista para {{PREVISAO}}, conforme cronograma anexo.'])),
 dict(k='JUSTICA_0001568-38.2011.8.05.0103', urg='ALTA: sentença com multa de R$ 20.000,00 por mês; os 60 dias pedidos em 23/09/2025 para o levantamento técnico já passaram',
      prazo=None, falta='Pedir à PGM a data do trânsito em julgado, a poligonal (fls. 185/186) e se o pedido de 60 dias foi deferido; fazer o levantamento técnico e o cronograma. A obra está na estimativa da Justiça.',
      minuta=ci('0001568-38.2011.8.05.0103', 'CI SEINFRA n. 2025.09.23.002/SEINFRA/GAB',
          ['Em complemento à CI n. 2025.09.23.002/SEINFRA/GAB, informa-se que esta Secretaria concluiu o levantamento técnico do Loteamento Santa Cruz em {{DATA}}, com o diagnóstico de drenagem, pavimentação, meios-fios, iluminação e redes de água e esgoto.',
           'A estimativa preliminar de custo da infraestrutura básica consta do levantamento paramétrico encaminhado à Secretaria da Fazenda e Orçamento. Propõe-se o cronograma anexo: {{ETAPAS_E_PRAZOS}}.',
           'Os serviços de água e esgoto dependem de articulação com a concessionária, que será consultada.',
           'Solicita-se informar a data do trânsito em julgado e a poligonal fixada na sentença, para conferência do escopo.'])),
 dict(k='JUSTICA_8004720-64.2025.8.05.0103', urg='ALTA: ação contra o Município com pedido de indenização; prazo de 72 horas vencido em 31/01/2026 (estimado)',
      prazo=None, falta='Pedir à PGM a cópia da inicial (local da praça). Levantar no arquivo da SEINFRA o projeto, a data e o contrato da praça e a situação dominial do terreno.',
      minuta=ci('8004720-64.2025.8.05.0103', 'CI PROGER n. 180/2026',
          ['Em atenção à CI PROGER n. 180/2026, informa-se que a praça indicada na inicial, situada em {{LOCAL}}, foi executada em {{DATA}}, no âmbito de {{CONTRATO_OU_OBRA_DIRETA}}, conforme documentos anexos.',
           'Quanto à área, {{SITUACAO_DOMINIAL_LOTEAMENTO_APROVADO_AREA_INSTITUCIONAL_OU_SEM_REGISTRO}}.',
           'Esta Secretaria permanece à disposição para indicar assistente técnico, se houver perícia.'])),
 dict(k='JUSTICA_0500963-88.2018.8.05.0103', urg='MÉDIA: pedido do juízo reiterado desde 2023; prazo da PGM vencido em 11/08/2026',
      prazo=None, falta='Combinar com a LOP e a SEMOP quem tem o processo da Notificação n. 00069/2018 e mandar uma resposta única.',
      minuta=ci('0500963-88.2018.8.05.0103', 'C.I. PROGER n. 606/2026',
          ['Em atenção à C.I. PROGER n. 606/2026, informa-se que o embargo da construção objeto da Notificação n. 00069, de 02/05/2018, {{PERMANECE_VIGENTE_OU_FOI_REGULARIZADO_OU_DESCONSTITUIDO_EM_DATA}}.',
           'Segue anexa a documentação do processo de fiscalização, obtida {{NESTA_SECRETARIA_OU_JUNTO_A_LOP_SEMOP}}.'])),
 dict(k='JUSTICA_8003278-97.2024.8.05.0103', urg='MÉDIA: prazo vencido em 20/07/2025 (estimado); a planilha marca "OFÍCIO OK", mas a CI de resposta não está no pacote',
      prazo=None, falta='Conferir no processo 14534/2025 se a resposta foi enviada. Se não foi, vistoriar a Rua Muniz Sodré com a concessionária.',
      minuta=ci('8003278-97.2024.8.05.0103', 'CI PROGER n. 502/2025 e Ofício n. 107/2025 da 2ª Vara de Relação de Consumo de Ilhéus',
          ['Em atenção à CI PROGER n. 502/2025, informa-se que a equipe técnica desta Secretaria vistoriou a Rua Muniz Sodré, no Alto São Sebastião, em {{DATA}}.',
           'Os postes de energia elétrica {{ESTAO_OU_NAO_ESTAO}} de acordo com as diretrizes municipais de uso do passeio, e {{HA_OU_NAO_HA}} fiação sobre residências, conforme relatório fotográfico anexo.',
           'A instalação e a manutenção dos postes e da fiação cabem à concessionária de energia elétrica.'])),
 dict(k='JUSTICA_8006145-39.2019.8.05.0103', urg='MÉDIA: prazo de 30 dias vencido em 06/11/2025 (estimado); competência a confirmar',
      prazo=None, falta='Confirmar se a fiscalização de obras particulares cabe à SEINFRA ou à Secretaria de Serviços Urbanos (interessada no processo); se não couber, redirecionar.',
      minuta=ci('8006145-39.2019.8.05.0103', 'Ofício n. 222/2025 da 1ª Vara de Relação de Consumo de Ilhéus',
          ['Em atenção ao Ofício n. 222/2025, que pergunta se foi retomada a fiscalização da obra embargada objeto da ação, informa-se que {{A_FISCALIZACAO_FOI_RETOMADA_EM_DATA_COM_RESULTADO_X_OU_A_COMPETENCIA_E_DA_SECRETARIA_Y}}.',
           '{{DOCUMENTOS_ANEXOS_OU_ENCAMINHAMENTO_A_SECRETARIA_COMPETENTE}}.'])),
 dict(k='JUSTICA_0502344-39.2015.8.05.0103', urg='MÉDIA: sentença a cumprir; levantamento técnico prometido em 24/09/2025 sem registro',
      prazo=None, falta='Pedir à PGM a cópia da sentença. Pelas planilhas, a obra é de encosta/urbanização na 2ª Travessa da Rua Visconde de Santo Amaro (Basílio).',
      minuta=ci('0502344-39.2015.8.05.0103', 'CI SEINFRA de 24/09/2025 (sentença id 495643463)',
          ['Em complemento à CI desta Secretaria de 24/09/2025, solicita-se cópia da sentença (id 495643463), para definição do escopo da obra e do prazo de cumprimento.',
           'O levantamento técnico do local indicado nos controles desta Secretaria, na 2ª Travessa da Rua Visconde de Santo Amaro, Basílio, {{FOI_REALIZADO_EM_DATA_OU_ESTA_PREVISTO_PARA_DATA}}. O relatório será encaminhado após a conferência com a sentença.'])),
 dict(k='MPBA_001.9.230302.2024', urg='MÉDIA: requisição do MPBA reiterada; confirmar o protocolo da resposta',
      prazo=None, falta='Mesmo objeto do levantamento do MP: usar a minuta de ofício ao MPBA de prazos.md (item 7). Confirmar com a PGM se a resposta do processo 14525/2025 foi protocolada.',
      minuta=None),
 dict(k='JUSTICA_0000130-63.2024.5.05.0493', urg='BAIXA: sem prazo fixado, mas o processo trabalhista aguarda a resposta do Município desde 03/2025',
      prazo=None, falta='Buscar no arquivo de alvarás o processo do alvará de 29/07/1988 (croqui ou planta).',
      minuta=ci('0000130-63.2024.5.05.0493', 'C.I. PROGER n. 251/2025',
          ['Em atenção à C.I. PROGER n. 251/2025, encaminha-se cópia do alvará de construção do empreendimento Tropical Residence Service, expedido em 29/07/1988, e dos documentos da autorização localizados no arquivo desta Secretaria: {{DOCUMENTOS}}.',
           'Pelo croqui ou planta, o primeiro bloco construído corresponde à designação {{1_2_OU_3}}. Se o documento não for localizado, informar: não foram localizados no arquivo desta Secretaria documentos que permitam identificar o primeiro bloco construído.'])),
 dict(k='JUSTICA_0011194-18.2010.8.05.0103', urg='BAIXA: sem prazo registrado; o pedido de documentos ao Ministério (20/01 e 11/02/2025) segue sem retorno',
      prazo=None, falta='Pedir à PGM o teor das requisições do juízo; reiterar o pedido à SNFI.',
      minuta=ci('0011194-18.2010.8.05.0103', 'Ofícios n. 2025.01.20.001/SEINFRA/GAB (reemitido em 11/02/2025)',
          ['Informa-se que esta Secretaria solicitou à Secretaria Nacional de Fundos e Instrumentos Financeiros os documentos do Convênio n. 538/94, para atender às requisições do juízo, e {{AINDA_NAO_OBTEVE_RETORNO_OU_RECEBEU_EM_DATA}}.',
           'Solicita-se cópia das requisições do juízo, para que esta Secretaria verifique o que pode ser atendido com o acervo local.'])),
 dict(k='JUSTICA_8014030-94.2025.8.05.0103', urg='BAIXA: sem prazo; obra e local desconhecidos (vale para outros 5 processos de drenagem na mesma situação)',
      prazo=None, falta='Pedir à PGM a inicial e a decisão; fazer o mesmo pedido para 0503101-28.2018, 0503189-66.2018, 0011730-29.2010, 8010615-06.2025 e 8010643-71.2025.',
      minuta=ci('8014030-94.2025.8.05.0103 e outros', 'CIs SEINFRA de 08/06/2026 (n. 002 a 009.08.0006/26)',
          ['Em complemento às CIs desta Secretaria de 08/06/2026, solicita-se cópia da petição inicial e da última decisão dos Processos n. 8014030-94.2025.8.05.0103, 0503101-28.2018.8.05.0103, 0503189-66.2018.8.05.0103, 0011730-29.2010.8.05.0103, 8010615-06.2025.8.05.0103 e 8010643-71.2025.8.05.0103.',
           'Os documentos permitirão identificar o local e a obra exigida em cada ação, verificar se estão abrangidos pela contratação dos projetos de macro e microdrenagem (Concorrência Pública n. 002/2026) e estimar o custo das obras.'])),
]
assert all(i['k'] in O for i in ITENS)
RESP = [k for k, o in O.items() if o['sugestao_triagem']['opcao'] == 'responder já']
assert set(RESP) <= {i['k'] for i in ITENS}, set(RESP) - {i['k'] for i in ITENS}

def prazo_txt(o):
    p = o['prazo_mais_proximo']
    if not p: return 'sem prazo no documento', '—'
    return br(p['data_limite']) + (' (estimado)' if p['data_limite_estimada'] else ''), p['situacao']

L = ['# Prazos e minutas de resposta — Levantamento JUSTIÇA · SEINFRA Ilhéus', '',
     f'Gerado em 13/10/2026. Triagem usada: provisória da Justiça ({PROV}).', '',
     f'Os {len(RESP)} objetos com sugestão "responder já" e os 3 objetos de "orçamento paramétrico" que também têm resposta pendente ao juízo, em ordem de urgência: risco à vida e multa; execução de sentença; ação contra o Município; demais prazos vencidos; sem prazo. Não há prazo a vencer: todos os prazos encontrados já venceram.', '',
     'Em processo judicial a resposta da SEINFRA é CI à Procuradoria Geral do Município (padrão da skill lufa-lufa), nunca ofício direto ao juízo. Prazos "estimados" foram contados da data do documento; o prazo real conta da intimação ou do recebimento. Campos `{{...}}` são dados que não estão nos documentos: preencher antes de assinar. Sem nomes de pessoa: assinatura com `{{NOME_DO_SIGNATARIO}}` e `{{CARGO_DO_SIGNATARIO}}`.', '',
     '## Quadro-resumo', '', '| Ordem | Objeto | Processo | Prazo | Situação | Triagem | Urgência |', '|---|---|---|---|---|---|---|']
for n, it in enumerate(ITENS, 1):
    o = O[it['k']]; pz, sit = prazo_txt(o)
    L.append(f"| {n} | {o['titulo']} | {'; '.join(o['procedimentos']) or '—'} | {pz} | {sit} | {o['sugestao_triagem']['opcao']} | {it['urg'].split(':')[0]} |")
L.append('')
for n, it in enumerate(ITENS, 1):
    o = O[it['k']]; pz, sit = prazo_txt(o)
    L += [f"## {n}. {o['titulo']}", '',
          f"- **Grupo-objeto:** {o['grupo_objeto']} · **Origem:** {o['origem']} · **Processo:** {'; '.join(o['procedimentos']) or '—'}"
          + (f" · **Já no MP:** {o['ja_no_mp']}" if o['ja_no_mp'] else ''),
          f"- **Urgência:** {it['urg']}",
          f"- **Prazo:** {pz}" + (f' — {sit}' if sit != '—' else ''),
          f"- **Pedido:** {o['pedido_consolidado']}",
          f"- **Triagem provisória:** {o['sugestao_triagem']['opcao']} — {o['sugestao_triagem']['motivo']}",
          f"- **O que falta para responder:** {it['falta']}", '']
    if it['minuta']:
        L += ['**Minuta**', ''] + ['> ' + x + '  ' if x else '>' for x in it['minuta']]
    L.append('')
L += ['## Outros prazos vencidos (já respondidos ou sem pendência para a SEINFRA)', '',
      '| Prazo | Objeto | Triagem provisória | Observação |', '|---|---|---|---|']
feitos = {i['k'] for i in ITENS}
for k, o in sorted(O.items(), key=lambda t: (t[1]['prazo_mais_proximo'] or {}).get('data_limite') or '', reverse=True):
    p = o['prazo_mais_proximo']
    if k in feitos or not p: continue
    est = ' (estimado)' if p['data_limite_estimada'] else ''
    obs = {'JUSTICA_8005263-04.2024.8.05.0103': 'Respondido em 22/07/2026 (CI 005.22.0007.26), depois do prazo. Avisar o juízo quando a Caixa autorizar o início do Contrato 095/2026.'}.get(k, 'Processo antigo do TCM, sem pedido pendente para a SEINFRA.')
    L.append(f"| {br(p['data_limite'])}{est} | {o['titulo']} | {o['sugestao_triagem']['opcao']} | {obs} |")
L.append('')
open(OUT, 'w').write('\n'.join(L))
print('ok', OUT, len(L), 'linhas', len(ITENS), 'itens')
