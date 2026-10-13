# RESUMO — Levantamento JUSTIÇA · SEINFRA Ilhéus

Pacote JUSTICA_FILTRADO de 13/10/2026 (partes 1 e 2). Branch `mp-levantamento`, pasta `mp_levantamento/`.

## ETAPA A-J CONCLUÍDA

- `justica_indice.json`: 795 documentos (854 no manifesto, menos 59 excluídos no próprio pacote: 36 processos da comarca de Salvador, 14 compactados e 9 editais de outro objeto ou município). 384 lidos por inteiro e 411 em leitura rápida do início (livros, certidões, editais, habilitações, medições).
- `justica_objetos.json`: 35 objetos. Só demandas viraram objeto: processo judicial, ACP, execução de TAC, cobrança da PGM por subsídios, decisão com obrigação de fazer e denúncia no TCM. Licitação, medição, aditivo, certidão e documento de empresa ficaram com `tipo: outro` e sem grupo, e serviram de sinal de andamento.
- `ja_no_mp`: 13 dos 35 objetos já estavam no levantamento do MP (mesmo processo ou mesmo objeto físico).
- Nomes de pessoa nos nomes de arquivo foram trocados por `[nome NN]` (48 ids; mesma numeração do MP para as mesmas pessoas). A tabela de correspondência fica fora do repositório.
- Processo criminal sigiloso (TRF1) e documentos de assunto particular foram registrados sem resumo do conteúdo.

### Objetos por categoria e por origem

| Categoria | Justiça | MPBA | TCM | Total | Já no MP |
|---|---|---|---|---|---|
| pavimentação | 2 | - | - | 2 | 0 |
| drenagem | 8 | - | - | 8 | 2 |
| drenagem+pavimentação | 2 | - | 2 | 4 | 3 |
| encosta/contenção | 4 | - | - | 4 | 1 |
| escola/creche | - | - | 2 | 2 | 2 |
| quadra/esporte | 1 | - | - | 1 | 1 |
| saneamento | 1 | - | 1 | 2 | 2 |
| outro | 11 | 1 | - | 12 | 2 |
| **Total** | **29** | **1** | **5** | **35** | **13** |

Origem "Justiça" inclui TJBA (Ilhéus), TRF1 (Justiça Federal, Subseção de Ilhéus) e TRT5. O objeto MPBA é a NF 001.9.230302/2024 (UBS de Olivença), cuja pasta veio no pacote da Justiça.

### Triagem sugerida (provisória)

| Sugestão | Objetos | Já no MP |
|---|---|---|
| responder já | 12 | 2 |
| orçamento paramétrico | 6 | 4 |
| licitação em curso | 7 | 2 |
| contrato assinado | 7 | 3 |
| resolvido | 3 | 2 |

### Documentos sem grupo

735 dos 795 documentos não formam objeto (não são demanda): 724 outro, 6 relatório técnico, 4 ofício, 1 decisão judicial.
Por pasta: SEM_NUMERO 503, TCM 191, JUSTICA 39, MPBA 1, MPF 1. São processos licitatórios, boletins de medição e processos de pagamento, certidões e documentos de empresas, aditivos, livros e apostilas, provas de concurso, minutas-modelo, planilhas de controle da SEINFRA e documentos de assunto particular. As coletâneas de ofícios da EMBASA (drenagem x esgoto) também ficaram sem grupo: a concessionária não é órgão de controle.

### Pontos de atenção da Etapa A-J

- 19 processos judiciais aparecem só nas planilhas de controle da SEINFRA, sem documento no pacote (ex.: 0001735-21.2012, ACP de drenagem e contenção; 0301918-79.2013, drenagem da Av. Uberlândia; 0503270-20.2015, Ruas M e N do Loteamento Moradas da Faelba; 8003452-14.2021, centro de abrigamento de animais; 8003915-53.2021, Rua Aracaju; 8006098-26.2023, Rua dos Alagados; 8007395-05.2022, Rua Demosthenes Berbert de Castro; 8007455-75.2022, ponto de ônibus na BA-001; 8007728-49.2025; 8000318-42.2022, 8006099-11.2023 e 8008992-43.2021, suspensos para cronograma). Três deles se ligam a objetos do MP (8011118-61.2024, Canal do Malhado; 8012931-26.2024, Alto do Socorro; 8003255-54.2024, Rua Praia Dourada). Não viraram objeto; vale pedir as peças à PGM.
- Seis processos de drenagem (0503101-28.2018, 0503189-66.2018, 0011730-29.2010, 8010615-06.2025, 8010643-71.2025 e 8014030-94.2025) só têm a CI de resposta da SEINFRA de 08/06/2026, sem inicial nem sentença: obra e local desconhecidos.
- Divergências com a triagem do MP (que não foi alterada): Ladeira Júlio Bagana, MP "contrato assinado" x Justiça "orçamento paramétrico" (contrato extinto em 25/08/2025); Rua Aracuã, MP "orçamento paramétrico" x Justiça "contrato assinado" (o Contrato 095/2026 pode ser só de projetos); Av. Soares Lopes, MP "orçamento paramétrico" x Justiça "licitação em curso" (licitação de projetos).

## ETAPA B-J CONCLUÍDA

Tudo **PROVISORIO - aguarda aprovacao**. BDI, contingência e fator regional iguais aos do MP; triagem do MP sem mudança.

- `triagem_provisoria_justica.json`: 12 responder já, 6 orçamento paramétrico, 7 licitação em curso, 7 contrato assinado e 3 resolvidos. Dos 6 paramétricos, 3 já estavam calculados no MP e não foram somados de novo: Estádio Mário Pessoa, abrigos da BR-415 (IFBA) e creche da Rua Genésio Santos. Foram calculados os outros 3: Loteamento Santa Cruz, Ladeira Júlio Bagana e Unidade de Acolhimento Renascer.
- `levantamento_parametrico.xlsx`: abas 23 a 25 (Justiça). A aba RESUMO traz os totais MP, Justiça e Geral e, só como referência, os 3 objetos já calculados no MP. Recalculada no LibreOffice, sem erro de fórmula. Duas demandas-tipo novas: infraestrutura básica de loteamento e reforma de unidade de acolhimento.
- `nota_tecnica.md`: uma nota só para MP + Justiça (anexo da CI à Secretaria da Fazenda e Orçamento — Gabinete).
- `prazos_justica.md`: 15 itens em ordem de urgência, cada um com minuta de CI à PGM (padrão lufa-lufa). Todos os prazos encontrados estão vencidos.
- `dossies_justica_plano.json`: 35 dossiês na ordem responder já → paramétrico → licitação → contrato → resolvido. Em `docs` estão os ids do `justica_indice.json`; os 48 ids com `[nome NN]` se convertem pela tabela de correspondência, que fica fora do repositório.

| Total (R$) | Objetos | Mínimo | Provável | Máximo |
|---|---|---|---|---|
| MP | 22 | 15.910.831,83 | 23.074.879,28 | 40.878.493,59 |
| Justiça | 3 | 1.978.180,42 | 4.663.587,91 | 12.851.282,24 |
| **Geral** | **25** | **17.889.012,25** | **27.738.467,19** | **53.729.775,82** |

## RESUMO PARA O LUCAS

1. Pendência: aprovar BDI, contingência e fator (seguem PROVISÓRIOS) e a triagem provisória da Justiça (35 objetos, 13 já no MP).
2. Pendência: decidir 4 divergências com o MP. Rua Aracuã, Pontal (Ruas Castro Alves e Barão do Rio Branco) e Av. Soares Lopes estão estimadas no MP, mas na Justiça aparecem com licitação ou contrato do Novo PAC Drenagem, que é de projetos. A Ladeira Júlio Bagana, que o MP dava como contrato assinado, agora é estimada (o contrato foi extinto em 25/08/2025).
3. Pendência: pedir à PGM a inicial ou a sentença de 6 processos de drenagem sem obra nem local, e as peças de 19 processos que só aparecem nas planilhas da SEINFRA.
4. Pendência: confirmar se a reforma do Renascer já está em licitação (o mapa de pastas cita "REFORMA ABRIGO RENASCER" em 2026). Se estiver, ela sai da estimativa (R$ 0,14 mi).
5. Totais provisórios no cenário provável: MP R$ 23,07 mi, Justiça R$ 4,66 mi e Geral R$ 27,74 mi. A faixa geral vai de R$ 17,89 mi a R$ 53,73 mi.
6. Mais urgente: Casa Lar Masculina, cujo projeto de incêndio tem multa diária e dilação vencida no início de setembro de 2026.
7. Também urgentes: o projeto de incêndio do Renascer (acordo de 03/2025) e as árvores com risco de queda na Ladeira do Jacaré (prazo de 15 dias vencido em 07/2025).
8. Em seguida: lixão de Itariri (MPT; audiência de 31/08/2026), relatório do TAC do Estádio Mário Pessoa (vencido em 06/2026 e de novo em 02/09/2026) e Loteamento Santa Cruz (multa de R$ 20 mil por mês).
9. Prontos no branch `mp-levantamento`: índice e objetos da Justiça, triagem, planilha com 25 objetos, nota única MP + Justiça, 15 minutas de CI à PGM e plano dos 35 dossiês.
10. Se a triagem final mudar algum objeto, basta recalcular com os scripts de `mp_levantamento/scripts/` (ver `LEIA.md`).
