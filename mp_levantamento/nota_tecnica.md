**NOTA TÉCNICA**

**PROVISORIO - aguarda aprovacao**

**Assunto:** estimativa preliminar paramétrica de custo das demandas do Ministério Público, da Justiça e do Tribunal de Contas dos Municípios dirigidas à Secretaria de Infraestrutura e Defesa Civil.

**1. Objetivo**

1.1. Esta nota apresenta a estimativa preliminar de custo das demandas de obras e serviços de engenharia cobradas do Município pelo Ministério Público do Estado da Bahia, pelo Ministério Público Federal, pelo Ministério Público do Trabalho, pelo Poder Judiciário e pelo Tribunal de Contas dos Municípios, para subsidiar a confirmação de previsão orçamentária junto à Secretaria Municipal da Fazenda e Orçamento.

1.2. A estimativa é paramétrica, preliminar e não vinculante. Destina-se ao planejamento orçamentário e não substitui o orçamento detalhado, que será elaborado pelas equipes técnicas a partir dos projetos de engenharia.

**2. Universo analisado**

2.1. Levantamento do Ministério Público: foram lidos 493 documentos do acervo de procedimentos do Ministério Público, de processos judiciais e de documentos sem número, organizados em 76 objetos (mesmo procedimento ou mesmo objeto físico), conforme os arquivos mp_indice.json e mp_objetos.json.

2.2. Levantamento da Justiça: foram lidos 795 documentos do acervo jurídico da Secretaria (processos judiciais, comunicações da Procuradoria Geral do Município, processos no Tribunal de Contas dos Municípios e documentos sem número). Apenas as demandas formaram objeto: 35 objetos, dos quais 13 já constavam do levantamento do Ministério Público por se tratar do mesmo processo ou do mesmo objeto físico (arquivos justica_indice.json e justica_objetos.json). Processos licitatórios, medições, aditivos, certidões e documentos de empresas foram usados apenas como sinais de andamento.

2.3. A triagem provisória do Ministério Público (triagem_provisoria.json, PROVISORIO - aguarda aprovacao) classificou 22 objetos como dependentes de obra ou serviço de engenharia sem licitação nem contrato vigente registrados. A triagem provisória da Justiça (triagem_provisoria_justica.json, PROVISORIO - aguarda aprovacao) classificou 6 objetos nessa situação; 3 deles já estavam estimados no levantamento do Ministério Público e não foram somados de novo. Foram estimados, portanto, 25 objetos: 22 do Ministério Público e 3 da Justiça. Os demais estão resolvidos, com licitação em curso, com contrato assinado ou dependem apenas de resposta ao órgão ou à Procuradoria Geral do Município.

2.4. A triagem definitiva será feita pela equipe da Secretaria. Objeto que mudar de classificação será incluído ou excluído e a estimativa será recalculada.

**3. Metodologia**

3.1. Para cada objeto, o custo foi estimado em três cenários (mínimo, provável e máximo) pela expressão: Custo = Σ (Quantidade × Preço unitário) × (1 + BDI) × (1 + Contingência) × Fator regional.

3.2. As quantidades seguiram esta ordem de preferência: (a) metragem ou quantidade citada no próprio documento; (b) demanda-tipo padronizada, com premissas escritas; (c) apoio de base cartográfica aberta. O item (c) não pôde ser usado nesta versão, porque o acesso à base cartográfica não estava disponível no ambiente de trabalho.

3.3. Foram definidas 15 demandas-tipo: via urbana com drenagem e pavimentação; microdrenagem em via existente; contenção de encosta; edificação térrea nova; reforma predial; quadra poliesportiva coberta; campo de futebol; abrigo de passageiros; adequação de cozinha escolar; banheiro com chuveiro e grade; proteção emergencial de fachada; adequação de segurança de estádio; casa térrea com parque linear; infraestrutura básica de loteamento; e reforma de unidade de acolhimento. Os coeficientes de cada uma estão na aba DEMANDAS-TIPO da planilha e devem ser aprovados uma única vez por engenheiro revisor.

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

4.4. Não foram usados como base de preço contratos da Secretaria nem editais de outros municípios. Os mesmos preços, demandas-tipo e parâmetros foram aplicados aos dois levantamentos.

**5. Resultados**

5.1. Estimativa por objeto (PROVISORIO - aguarda aprovacao):

| Nº | Objeto | Levantamento | Origem | Categoria | Quantidade | Mínimo | Provável | Máximo |
|---|---|---|---|---|---|---|---|---|
| 01 | Proteção e estabilização do prédio da Sociedade União Protetora dos Artífices e Operários (Centro) | MP | MPBA | outro | demanda-tipo (medidas do próprio documento) | R$ 20.375,39 | R$ 31.196,76 | R$ 554.590,52 |
| 02 | Conclusão de unidades escolares paralisadas (Recomendação MPBA 02/2025) | MP | MPBA | escola/creche | demanda-tipo (unidades não listadas) | R$ 330.852,01 | R$ 781.244,32 | R$ 1.609.322,70 |
| 03 | Requalificação da drenagem pluvial da Av. Soares Lopes | MP | MPBA | drenagem | documento (extensão de 1.600 m) | R$ 2.199.510,94 | R$ 2.756.332,97 | R$ 4.174.865,18 |
| 04 | Banheiro com chuveiro e grade na sede do Conselho Municipal de Educação | MP | MPBA | outro | demanda-tipo (banheiro-tipo) | R$ 8.137,24 | R$ 10.266,79 | R$ 16.216,16 |
| 05 | Valetão aberto pela EMBASA em via pública (local não identificado) | MP | MPBA | drenagem | demanda-tipo (local não identificado) | R$ 63.307,49 | R$ 118.557,42 | R$ 351.155,12 |
| 06 | Quadra poliesportiva do distrito de Banco do Pedro | MP | MPBA | quadra/esporte | documento (1 quadra) + demanda-tipo | R$ 638.222,78 | R$ 855.621,59 | R$ 1.166.732,33 |
| 07 | Reforma do Instituto Municipal de Ensino Eusínio Lavigne – IME (Av. Canavieiras, Centro) | MP | MPBA | escola/creche | demanda-tipo (área a confirmar) | R$ 297.660,86 | R$ 907.542,49 | R$ 2.481.754,01 |
| 08 | Drenagem da Rua Jardim Alice (Banco da Vitória) | MP | MPBA | drenagem | demanda-tipo (escopo a confirmar) | R$ 160.465,94 | R$ 282.387,84 | R$ 694.200,07 |
| 09 | Drenagem da Rua Praia Dourada | MP | MPBA | drenagem | demanda-tipo (rua-tipo) | R$ 307.680,85 | R$ 659.546,56 | R$ 1.748.983,48 |
| 10 | Contenção de encosta da Rua Alto do Socorro (Conquista) | MP | MPF | encosta/contenção | documento (1.368,32 m², Meta 13 do Novo PAC) | R$ 1.328.465,10 | R$ 2.292.498,30 | R$ 4.832.014,30 |
| 11 | 96 casas e parques lineares pós-chuvas de 2021 (Salobrinho, Banco da Vitória e Vila Cachoeira) | MP | MPF | habitação | documento (96 casas e 5 parques lineares) | R$ 7.461.124,57 | R$ 8.393.660,71 | R$ 10.752.291,98 |
| 12 | Obras FNDE: Escola Vila Lídia, Quadra do Vilela e Creche Nossa Senhora da Vitória | MP | MPF | escola/creche | demanda-tipo (situação das obras não informada) | R$ 1.290.541,42 | R$ 2.284.651,78 | R$ 3.763.734,43 |
| 13 | Condições de trabalho e reforma do prédio do SAMU de Ilhéus | MP | MPT | outro | demanda-tipo (área a confirmar) | R$ 43.249,12 | R$ 139.248,08 | R$ 400.710,80 |
| 14 | Condições do prédio do Arquivo Público Municipal | MP | MPT | outro | demanda-tipo (área a confirmar) | R$ 62.764,17 | R$ 229.637,20 | R$ 797.089,81 |
| 15 | Condições estruturais da Clínica Municipal de Atendimento Especializado - CMAE (Av. Canavieiras) | MP | MPT | outro | demanda-tipo (área a confirmar) | R$ 62.764,17 | R$ 207.030,95 | R$ 598.900,30 |
| 16 | Cozinhas e áreas de limpeza das escolas municipais (saúde e segurança do trabalho) | MP | MPT | escola/creche | demanda-tipo (unidades não listadas) | R$ 41.628,82 | R$ 88.512,43 | R$ 208.379,65 |
| 17 | Requalificação do Estádio Municipal Mário Pessoa (Cidade Nova) – TAC | MP | Justiça | quadra/esporte | demanda-tipo (itens do TAC) | R$ 280.956,10 | R$ 579.542,15 | R$ 1.434.218,26 |
| 18 | Drenagem pluvial e alagamentos nas Ruas Castro Alves e Barão do Rio Branco (Pontal) | MP | Justiça | drenagem | demanda-tipo (duas ruas) | R$ 315.078,63 | R$ 549.169,41 | R$ 1.380.290,19 |
| 19 | Drenagem e pavimentação da Rua Aracuã (Nossa Senhora das Vitórias) | MP | Justiça | drenagem+pavimentação | demanda-tipo (rua-tipo) | R$ 307.680,85 | R$ 659.546,56 | R$ 1.748.983,48 |
| 20 | Abrigos de ônibus da Rodovia Jorge Amado (BR-415), perto do IFBA | MP | Justiça | outro | demanda-tipo (abrigo-tipo) | R$ 25.781,31 | R$ 41.112,74 | R$ 64.526,21 |
| 21 | Creche Municipal Padrão de 6 salas da Rua Genésio Santos (Teotônio Vilela) | MP | TCM | escola/creche | documento (6 salas) + demanda-tipo | R$ 385.923,81 | R$ 781.244,32 | R$ 1.448.377,79 |
| 22 | Requalificação e ampliação do Complexo Esportivo Campo do Rodão (Teotônio Vilela) | MP | outro | quadra/esporte | demanda-tipo (campo-tipo) | R$ 278.660,29 | R$ 426.327,92 | R$ 651.156,79 |
| 23 | Infraestrutura básica do Loteamento Santa Cruz (cumprimento de sentença) | Justiça | Justiça | drenagem+pavimentação | demanda-tipo (extensão de vias a confirmar) | R$ 1.348.883,23 | R$ 2.846.250,30 | R$ 7.453.266,74 |
| 24 | Estabilização de encosta da Ladeira Júlio Bagana / Rua Rio Almada (Tapera) | Justiça | Justiça | encosta/contenção | demanda-tipo (área da encosta a confirmar) | R$ 584.464,71 | R$ 1.676.406,22 | R$ 4.943.798,24 |
| 25 | Unidade de Acolhimento Renascer: projeto de incêndio e reforma (Conquista) | Justiça | Justiça | outro | demanda-tipo (área a confirmar) | R$ 44.832,49 | R$ 140.931,38 | R$ 454.217,26 |
| | **Total geral** | | | | | **R$ 17.889.012,25** | **R$ 27.738.467,19** | **R$ 53.729.775,82** |

5.2. Totais do Ministério Público, da Justiça e geral, sem dupla contagem:

| Levantamento | Objetos | Mínimo | Provável | Máximo |
|---|---|---|---|---|
| Ministério Público (inclui os processos judiciais e do TCM do acervo do MP) | 22 | R$ 15.910.831,83 | R$ 23.074.879,28 | R$ 40.878.493,59 |
| Justiça (objetos novos do acervo jurídico) | 3 | R$ 1.978.180,42 | R$ 4.663.587,91 | R$ 12.851.282,24 |
| **Geral** | **25** | **R$ 17.889.012,25** | **R$ 27.738.467,19** | **R$ 53.729.775,82** |

5.3. Constam também do acervo da Justiça, já estimados no levantamento do Ministério Público e por isso não somados de novo: Requalificação do Estádio Municipal Mário Pessoa (Cidade Nova) – TAC de 2012; Abrigos de ônibus na Rodovia Jorge Amado (BR-415), perto do IFBA; Creche Municipal Padrão de 6 salas da Rua Genésio Santos (Teotônio Vilela).

5.4. Por órgão de origem da demanda:

| Origem | Objetos | Mínimo | Provável | Máximo |
|---|---|---|---|---|
| MPBA | 9 | R$ 4.026.213,49 | R$ 6.402.696,74 | R$ 12.797.819,58 |
| MPF | 3 | R$ 10.080.131,08 | R$ 12.970.810,79 | R$ 19.348.040,71 |
| MPT | 4 | R$ 210.406,28 | R$ 664.428,66 | R$ 2.005.080,57 |
| Justiça | 7 | R$ 2.907.677,31 | R$ 6.492.958,77 | R$ 17.479.300,38 |
| TCM | 1 | R$ 385.923,81 | R$ 781.244,32 | R$ 1.448.377,79 |
| MP sem ramo identificado | 1 | R$ 278.660,29 | R$ 426.327,92 | R$ 651.156,79 |

5.5. Total por categoria:

| Categoria | Objetos | Mínimo | Provável | Máximo |
|---|---|---|---|---|
| habitação | 1 | R$ 7.461.124,57 | R$ 8.393.660,71 | R$ 10.752.291,98 |
| escola/creche | 5 | R$ 2.346.606,91 | R$ 4.843.195,33 | R$ 9.511.568,59 |
| drenagem | 5 | R$ 3.046.043,85 | R$ 4.365.994,20 | R$ 8.349.494,05 |
| encosta/contenção | 2 | R$ 1.912.929,81 | R$ 3.968.904,52 | R$ 9.775.812,53 |
| drenagem+pavimentação | 2 | R$ 1.656.564,07 | R$ 3.505.796,86 | R$ 9.202.250,23 |
| quadra/esporte | 3 | R$ 1.197.839,16 | R$ 1.861.491,66 | R$ 3.252.107,38 |
| outro | 7 | R$ 267.903,88 | R$ 799.423,90 | R$ 2.886.251,06 |

5.6. O valor provável total é de R$ 27.738.467,19, com faixa de R$ 17.889.012,25 a R$ 53.729.775,82. Recomenda-se usar o valor provável como referência de reserva e o máximo como teto de planejamento.

**6. Premissas principais**

6.1. Quantidades citadas nos documentos: extensão de 1.600 m da Av. Soares Lopes; área de 1.368,32 m² da encosta da Rua Alto do Socorro (trecho 02); 96 casas e 5 parques lineares; uma quadra poliesportiva; creche padrão de 6 salas.

6.2. Nos demais objetos, as quantidades são premissas de demanda-tipo, registradas na aba de cada objeto (por exemplo, comprimento de rua de 150/250/400 m, área de prédio a reformar, número de cozinhas ou de abrigos). Devem ser confirmadas por medição em campo ou por projeto.

6.3. Obras paralisadas (escolas, creches e quadra do FNDE) foram estimadas como fração remanescente de 30/50/70% da edificação-tipo, porque a situação física não está nos documentos.

6.4. Justiça: o Loteamento Santa Cruz foi estimado com 600/1.000/1.600 m de vias com drenagem, pavimentação, redes de água e esgoto e iluminação pública, porque a poligonal da sentença não consta do acervo; a encosta da Ladeira Júlio Bagana, com 600/1.000/1.400 m² de face, sem descontar o que o contrato anterior executou; a Unidade de Acolhimento Renascer, com reforma de 200/300/450 m² e portas corta-fogo.

**7. Limitações**

7.1. A maior incerteza está nas quantidades, e não nos preços: a maior parte dos documentos não traz metragem.

7.2. Alguns serviços não têm preço no SINAPI da Bahia na referência adotada (imprimação e pintura de ligação asfáltica, exaustores, central de alarme de incêndio, locação de andaime). Eles não foram incluídos, o que tende a subestimar levemente os objetos afetados.

7.3. Encostas dependem de sondagem e de projeto geotécnico. A faixa adotada (solo grampeado com concreto projetado) pode não representar a solução final.

7.4. Em objetos com corresponsabilidade de concessionária (rede aberta ou danificada pela empresa de saneamento), parte do custo pode caber a ela.

7.5. Nos objetos com recursos federais já previstos (casas do programa de reconstrução pós-chuvas, encosta incluída no programa federal de contenção e obras do FNDE), a estimativa é do custo total da obra. A parcela a cargo do Município pode ser menor; no caso das 96 casas, os documentos citam contrapartida municipal de R$ 4.549.844,04.

7.6. As fontes normativas foram conferidas em reproduções públicas dos textos, porque o acesso direto aos sítios oficiais não estava disponível no ambiente de trabalho. Recomenda-se conferência nos sítios oficiais antes da versão final.

7.7. Na Justiça, seis processos de drenagem só têm a resposta da Secretaria à Procuradoria Geral do Município, sem petição inicial nem sentença, e dezenove processos aparecem apenas nas planilhas de controle da Secretaria. Esses casos não foram estimados, porque a obra e o local não são conhecidos.

7.8. Em três objetos estimados no levantamento do Ministério Público (drenagem da Av. Soares Lopes, drenagem das Ruas Castro Alves e Barão do Rio Branco e Rua Aracuã), o acervo da Justiça informa licitação ou contrato vinculado ao programa federal de drenagem, que, segundo os próprios documentos, trata de projetos. Se ficar confirmado contrato de execução da obra, esses objetos sairão da estimativa. Em sentido inverso, a encosta da Ladeira Júlio Bagana passou a ser estimada, porque o contrato anterior foi extinto com a obra paralisada.

**8. Encaminhamentos**

8.1. Aprovar ou ajustar o BDI, a contingência e o fator regional (planilha, aba PARAMETROS). A planilha recalcula sozinha.

8.2. Substituir a triagem provisória pela triagem definitiva e recalcular os objetos que mudarem.

8.3. Submeter as demandas-tipo à aprovação de engenheiro revisor e confirmar, com prioridade, as quantidades dos objetos de maior valor.

8.4. Solicitar à Procuradoria Geral do Município cópia da petição inicial ou da sentença dos processos sem obra ou local identificados e incluir na estimativa os que exigirem obra.

8.5. Anexar esta nota técnica e a planilha levantamento_parametrico.xlsx à comunicação interna dirigida à Secretaria Municipal da Fazenda e Orçamento.

Ilhéus, *data da assinatura*.


**{{NOME_DO_SIGNATARIO}}**

**{{CARGO_DO_SIGNATARIO}}**
