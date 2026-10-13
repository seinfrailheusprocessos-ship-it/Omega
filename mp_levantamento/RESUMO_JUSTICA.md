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
