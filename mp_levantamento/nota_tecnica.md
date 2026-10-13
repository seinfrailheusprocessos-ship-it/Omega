**NOTA TÉCNICA**

**PROVISORIO - aguarda aprovacao**

**Assunto:** estimativa preliminar paramétrica de custo das demandas do Ministério Público, da Justiça e do Tribunal de Contas dos Municípios dirigidas à Secretaria de Infraestrutura e Defesa Civil.

**1. Objetivo**

1.1. Esta nota apresenta a estimativa preliminar de custo das demandas de obras e serviços de engenharia cobradas do Município pelo Ministério Público do Estado da Bahia, pelo Ministério Público Federal, pelo Ministério Público do Trabalho, pelo Poder Judiciário e pelo Tribunal de Contas dos Municípios, para subsidiar a confirmação de previsão orçamentária junto à Secretaria Municipal da Fazenda e Orçamento.

1.2. A estimativa é paramétrica, preliminar e não vinculante. Destina-se ao planejamento orçamentário e não substitui o orçamento detalhado, que será elaborado pelas equipes técnicas a partir dos projetos de engenharia.

**2. Universo analisado**

2.1. Foram lidos 493 documentos do acervo de procedimentos do Ministério Público, de processos judiciais e de documentos sem número, organizados em 76 objetos (mesmo procedimento ou mesmo objeto físico), conforme os arquivos mp_indice.json e mp_objetos.json.

2.2. A triagem provisória (triagem_provisoria.json, PROVISORIO - aguarda aprovacao) classificou 22 objetos como dependentes de obra ou serviço de engenharia sem licitação nem contrato vigente registrados. Somente esses 22 objetos foram estimados. Os demais estão resolvidos, com licitação em curso, com contrato assinado ou dependem apenas de resposta ao órgão.

2.3. A triagem definitiva será feita pela equipe da Secretaria. Objeto que mudar de classificação será incluído ou excluído e a estimativa será recalculada.

**3. Metodologia**

3.1. Para cada objeto, o custo foi estimado em três cenários (mínimo, provável e máximo) pela expressão: Custo = Σ (Quantidade × Preço unitário) × (1 + BDI) × (1 + Contingência) × Fator regional.

3.2. As quantidades seguiram esta ordem de preferência: (a) metragem ou quantidade citada no próprio documento; (b) demanda-tipo padronizada, com premissas escritas; (c) apoio de base cartográfica aberta. O item (c) não pôde ser usado nesta versão, porque o acesso à base cartográfica não estava disponível no ambiente de trabalho.

3.3. Foram definidas 13 demandas-tipo: via urbana com drenagem e pavimentação; microdrenagem em via existente; contenção de encosta; edificação térrea nova; reforma predial; quadra poliesportiva coberta; campo de futebol; abrigo de passageiros; adequação de cozinha escolar; banheiro com chuveiro e grade; proteção emergencial de fachada; adequação de segurança de estádio; e casa térrea com parque linear. Os coeficientes de cada uma estão na aba DEMANDAS-TIPO da planilha e devem ser aprovados uma única vez por engenheiro revisor.

3.4. A demanda-tipo de contenção de encosta foi calibrada com a média do programa de contenção de encostas citada nos documentos do acervo (cerca de R$ 1.692,00 por m² de face). O resultado provável da demanda-tipo ficou em cerca de R$ 1.675,00 por m².

**4. Fontes de preço e parâmetros**

4.1. Preços unitários: SINAPI/CAIXA, referência 08/2026, Bahia, regime não desonerado, com encargos sociais da própria tabela. O código de cada composição ou insumo consta da planilha. O SINAPI foi adotado como base oficial de referência, nos termos da Lei n. 14.133/2021 e do Decreto Municipal n. 269/2025.

4.2. Parâmetros aplicados (PROVISORIO - aguarda aprovacao):

| Parâmetro | Mínimo | Provável | Máximo | Fonte |
|---|---|---|---|---|
| BDI de edificações, encostas e outros | 20,34% | 22,12% | 25,00% | Acórdão n. 2.622/2013-TCU-Plenário, construção de edifícios (1º quartil, médio, 3º quartil) |
| BDI de pavimentação e drenagem | 19,60% | 20,97% | 24,23% | Acórdão n. 2.622/2013-TCU-Plenário, construção de rodovias e ferrovias |
| Contingência | 5,00% | 10,00% | 15,00% | Parâmetro técnico (projeto, sondagem, topografia, licenciamento e fiscalização) |
| Fator regional | 1,00 | 1,00 | 1,10 | Parâmetro técnico (frete, acesso e mobilização) |

4.3. O BDI não inclui a contribuição previdenciária sobre a receita bruta, por se tratar de regime não desonerado. A contingência tem como teto de referência a precisão esperada para estimativas na fase de estudos preliminares, de cerca de 30% para edificações, segundo orientação técnica do Instituto Brasileiro de Auditoria de Obras Públicas (OT-IBR 004/2012).

4.4. Não foram usados como base de preço contratos da Secretaria nem editais de outros municípios.

**5. Resultados**

5.1. Estimativa por objeto (PROVISORIO - aguarda aprovacao):

| Nº | Objeto | Origem | Categoria | Quantidade | Mínimo | Provável | Máximo |
|---|---|---|---|---|---|---|---|
| 01 | Proteção e estabilização do prédio da Sociedade União Protetora dos Artífices e Operários (Centro) | MPBA | outro | demanda-tipo (medidas do próprio documento) | R$ 20.375,39 | R$ 31.196,76 | R$ 554.590,52 |
| 02 | Conclusão de unidades escolares paralisadas (Recomendação MPBA 02/2025) | MPBA | escola/creche | demanda-tipo (unidades não listadas) | R$ 330.852,01 | R$ 781.244,32 | R$ 1.609.322,70 |
| 03 | Requalificação da drenagem pluvial da Av. Soares Lopes | MPBA | drenagem | documento (extensão de 1.600 m) | R$ 2.199.510,94 | R$ 2.756.332,97 | R$ 4.174.865,18 |
| 04 | Banheiro com chuveiro e grade na sede do Conselho Municipal de Educação | MPBA | outro | demanda-tipo (banheiro-tipo) | R$ 8.137,24 | R$ 10.266,79 | R$ 16.216,16 |
| 05 | Valetão aberto pela EMBASA em via pública (local não identificado) | MPBA | drenagem | demanda-tipo (local não identificado) | R$ 63.307,49 | R$ 118.557,42 | R$ 351.155,12 |
| 06 | Quadra poliesportiva do distrito de Banco do Pedro | MPBA | quadra/esporte | documento (1 quadra) + demanda-tipo | R$ 638.222,78 | R$ 855.621,59 | R$ 1.166.732,33 |
| 07 | Reforma do Instituto Municipal de Ensino Eusínio Lavigne – IME (Av. Canavieiras, Centro) | MPBA | escola/creche | demanda-tipo (área a confirmar) | R$ 297.660,86 | R$ 907.542,49 | R$ 2.481.754,01 |
| 08 | Drenagem da Rua Jardim Alice (Banco da Vitória) | MPBA | drenagem | demanda-tipo (escopo a confirmar) | R$ 160.465,94 | R$ 282.387,84 | R$ 694.200,07 |
| 09 | Drenagem da Rua Praia Dourada | MPBA | drenagem | demanda-tipo (rua-tipo) | R$ 307.680,85 | R$ 659.546,56 | R$ 1.748.983,48 |
| 10 | Contenção de encosta da Rua Alto do Socorro (Conquista) | MPF | encosta/contenção | documento (1.368,32 m², Meta 13 do Novo PAC) | R$ 1.328.465,10 | R$ 2.292.498,30 | R$ 4.832.014,30 |
| 11 | 96 casas e parques lineares pós-chuvas de 2021 (Salobrinho, Banco da Vitória e Vila Cachoeira) | MPF | habitação | documento (96 casas e 5 parques lineares) | R$ 7.461.124,57 | R$ 8.393.660,71 | R$ 10.752.291,98 |
| 12 | Obras FNDE: Escola Vila Lídia, Quadra do Vilela e Creche Nossa Senhora da Vitória | MPF | escola/creche | demanda-tipo (situação das obras não informada) | R$ 1.290.541,42 | R$ 2.284.651,78 | R$ 3.763.734,43 |
| 13 | Condições de trabalho e reforma do prédio do SAMU de Ilhéus | MPT | outro | demanda-tipo (área a confirmar) | R$ 43.249,12 | R$ 139.248,08 | R$ 400.710,80 |
| 14 | Condições do prédio do Arquivo Público Municipal | MPT | outro | demanda-tipo (área a confirmar) | R$ 62.764,17 | R$ 229.637,20 | R$ 797.089,81 |
| 15 | Condições estruturais da Clínica Municipal de Atendimento Especializado - CMAE (Av. Canavieiras) | MPT | outro | demanda-tipo (área a confirmar) | R$ 62.764,17 | R$ 207.030,95 | R$ 598.900,30 |
| 16 | Cozinhas e áreas de limpeza das escolas municipais (saúde e segurança do trabalho) | MPT | escola/creche | demanda-tipo (unidades não listadas) | R$ 41.628,82 | R$ 88.512,43 | R$ 208.379,65 |
| 17 | Requalificação do Estádio Municipal Mário Pessoa (Cidade Nova) – TAC | Justiça | quadra/esporte | demanda-tipo (itens do TAC) | R$ 280.956,10 | R$ 579.542,15 | R$ 1.434.218,26 |
| 18 | Drenagem pluvial e alagamentos nas Ruas Castro Alves e Barão do Rio Branco (Pontal) | Justiça | drenagem | demanda-tipo (duas ruas) | R$ 315.078,63 | R$ 549.169,41 | R$ 1.380.290,19 |
| 19 | Drenagem e pavimentação da Rua Aracuã (Nossa Senhora das Vitórias) | Justiça | drenagem+pavimentação | demanda-tipo (rua-tipo) | R$ 307.680,85 | R$ 659.546,56 | R$ 1.748.983,48 |
| 20 | Abrigos de ônibus da Rodovia Jorge Amado (BR-415), perto do IFBA | Justiça | outro | demanda-tipo (abrigo-tipo) | R$ 25.781,31 | R$ 41.112,74 | R$ 64.526,21 |
| 21 | Creche Municipal Padrão de 6 salas da Rua Genésio Santos (Teotônio Vilela) | TCM | escola/creche | documento (6 salas) + demanda-tipo | R$ 385.923,81 | R$ 781.244,32 | R$ 1.448.377,79 |
| 22 | Requalificação e ampliação do Complexo Esportivo Campo do Rodão (Teotônio Vilela) | outro | quadra/esporte | demanda-tipo (campo-tipo) | R$ 278.660,29 | R$ 426.327,92 | R$ 651.156,79 |
| | **Total geral** | | | | **R$ 15.910.831,83** | **R$ 23.074.879,28** | **R$ 40.878.493,59** |

5.2. Total por grupo de origem:

| Grupo de origem | Objetos | Mínimo | Provável | Máximo |
|---|---|---|---|---|
| MP | 17 | R$ 14.595.411,13 | R$ 20.464.264,10 | R$ 34.802.097,65 |
| Justiça | 4 | R$ 929.496,89 | R$ 1.829.370,86 | R$ 4.628.018,14 |
| TCM | 1 | R$ 385.923,81 | R$ 781.244,32 | R$ 1.448.377,79 |
| **Total** | **22** | **R$ 15.910.831,83** | **R$ 23.074.879,28** | **R$ 40.878.493,59** |

5.3. O grupo MP reúne MPBA, MPF, MPT e um objeto cuja capa indica "Resposta Ministério Público" sem identificar o ramo. Por órgão:

| Origem | Objetos | Mínimo | Provável | Máximo |
|---|---|---|---|---|
| MPBA | 9 | R$ 4.026.213,49 | R$ 6.402.696,74 | R$ 12.797.819,58 |
| MPF | 3 | R$ 10.080.131,08 | R$ 12.970.810,79 | R$ 19.348.040,71 |
| MPT | 4 | R$ 210.406,28 | R$ 664.428,66 | R$ 2.005.080,57 |
| Justiça | 4 | R$ 929.496,89 | R$ 1.829.370,86 | R$ 4.628.018,14 |
| TCM | 1 | R$ 385.923,81 | R$ 781.244,32 | R$ 1.448.377,79 |
| MP sem ramo identificado | 1 | R$ 278.660,29 | R$ 426.327,92 | R$ 651.156,79 |

5.4. Total por categoria:

| Categoria | Objetos | Mínimo | Provável | Máximo |
|---|---|---|---|---|
| habitação | 1 | R$ 7.461.124,57 | R$ 8.393.660,71 | R$ 10.752.291,98 |
| escola/creche | 5 | R$ 2.346.606,91 | R$ 4.843.195,33 | R$ 9.511.568,59 |
| drenagem | 5 | R$ 3.046.043,85 | R$ 4.365.994,20 | R$ 8.349.494,05 |
| encosta/contenção | 1 | R$ 1.328.465,10 | R$ 2.292.498,30 | R$ 4.832.014,30 |
| quadra/esporte | 3 | R$ 1.197.839,16 | R$ 1.861.491,66 | R$ 3.252.107,38 |
| drenagem+pavimentação | 1 | R$ 307.680,85 | R$ 659.546,56 | R$ 1.748.983,48 |
| outro | 6 | R$ 223.071,39 | R$ 658.492,52 | R$ 2.432.033,80 |

5.5. O valor provável total é de R$ 23.074.879,28, com faixa de R$ 15.910.831,83 a R$ 40.878.493,59. Recomenda-se usar o valor provável como referência de reserva e o máximo como teto de planejamento.

**6. Premissas principais**

6.1. Quantidades citadas nos documentos: extensão de 1.600 m da Av. Soares Lopes; área de 1.368,32 m² da encosta da Rua Alto do Socorro (trecho 02); 96 casas e 5 parques lineares; uma quadra poliesportiva; creche padrão de 6 salas.

6.2. Nos demais objetos, as quantidades são premissas de demanda-tipo, registradas na aba de cada objeto (por exemplo, comprimento de rua de 150/250/400 m, área de prédio a reformar, número de cozinhas ou de abrigos). Devem ser confirmadas por medição em campo ou por projeto.

6.3. Obras paralisadas (escolas, creches e quadra do FNDE) foram estimadas como fração remanescente de 30/50/70% da edificação-tipo, porque a situação física não está nos documentos.

**7. Limitações**

7.1. A maior incerteza está nas quantidades, e não nos preços: a maior parte dos documentos não traz metragem.

7.2. Alguns serviços não têm preço no SINAPI da Bahia na referência adotada (imprimação e pintura de ligação asfáltica, exaustores, central de alarme de incêndio, locação de andaime). Eles não foram incluídos, o que tende a subestimar levemente os objetos afetados.

7.3. Encostas dependem de sondagem e de projeto geotécnico. A faixa adotada (solo grampeado com concreto projetado) pode não representar a solução final.

7.4. Em objetos com corresponsabilidade de concessionária (rede aberta ou danificada pela empresa de saneamento), parte do custo pode caber a ela.

7.5. Nos objetos com recursos federais já previstos (casas do programa de reconstrução pós-chuvas, encosta incluída no programa federal de contenção e obras do FNDE), a estimativa é do custo total da obra. A parcela a cargo do Município pode ser menor; no caso das 96 casas, os documentos citam contrapartida municipal de R$ 4.549.844,04.

7.6. As fontes normativas foram conferidas em reproduções públicas dos textos, porque o acesso direto aos sítios oficiais não estava disponível no ambiente de trabalho. Recomenda-se conferência nos sítios oficiais antes da versão final.

**8. Encaminhamentos**

8.1. Aprovar ou ajustar o BDI, a contingência e o fator regional (planilha, aba PARAMETROS). A planilha recalcula sozinha.

8.2. Substituir a triagem provisória pela triagem definitiva e recalcular os objetos que mudarem.

8.3. Submeter as demandas-tipo à aprovação de engenheiro revisor e confirmar, com prioridade, as quantidades dos objetos de maior valor.

8.4. Anexar esta nota técnica e a planilha levantamento_parametrico.xlsx à comunicação interna dirigida à Secretaria Municipal da Fazenda e Orçamento.

Ilhéus, *data da assinatura*.


**{{NOME_DO_SIGNATARIO}}**

**{{CARGO_DO_SIGNATARIO}}**
