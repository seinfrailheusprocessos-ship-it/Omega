**NOTA TÉCNICA**

**Parâmetros e triagem APROVADO em 13/10/2026**

**Assunto:** estimativa preliminar paramétrica de custo das demandas do Ministério Público, da Justiça e do Tribunal de Contas dos Municípios dirigidas à Secretaria de Infraestrutura e Defesa Civil.

**1. Objetivo**

1.1. Esta nota apresenta a estimativa preliminar de custo das demandas de obras e serviços de engenharia cobradas do Município pelo Ministério Público do Estado da Bahia, pelo Ministério Público Federal, pelo Ministério Público do Trabalho, pelo Poder Judiciário e pelo Tribunal de Contas dos Municípios, para subsidiar a confirmação de previsão orçamentária junto à Secretaria Municipal da Fazenda e Orçamento.

1.2. A estimativa é paramétrica, preliminar e não vinculante. Destina-se ao planejamento orçamentário e não substitui o orçamento detalhado, que será elaborado pelas equipes técnicas a partir dos projetos de engenharia.

**2. Universo analisado**

2.1. Levantamento do Ministério Público: foram lidos 493 documentos do acervo de procedimentos do Ministério Público, de processos judiciais e de documentos sem número, organizados em 76 objetos (mesmo procedimento ou mesmo objeto físico), conforme os arquivos mp_indice.json e mp_objetos.json.

2.2. Levantamento da Justiça: foram lidos 795 documentos do acervo jurídico da Secretaria (processos judiciais, comunicações da Procuradoria Geral do Município, processos no Tribunal de Contas dos Municípios e documentos sem número). Apenas as demandas formaram objeto: 35 objetos, dos quais 13 já constavam do levantamento do Ministério Público por se tratar do mesmo processo ou do mesmo objeto físico (arquivos justica_indice.json e justica_objetos.json). Processos licitatórios, medições, aditivos, certidões e documentos de empresas foram usados apenas como sinais de andamento.

2.3. A triagem do Ministério Público (triagem_provisoria.json) classificou 22 objetos como dependentes de obra ou serviço de engenharia sem licitação nem contrato vigente registrados. A triagem da Justiça (triagem_provisoria_justica.json) classificou 6 objetos nessa situação; 3 deles já estavam estimados no levantamento do Ministério Público e não foram somados de novo. Foram estimados, portanto, 25 objetos: 22 do Ministério Público e 3 da Justiça. Os demais estão resolvidos, com licitação em curso, com contrato assinado ou dependem apenas de resposta ao órgão ou à Procuradoria Geral do Município.

2.4. As duas triagens e os parâmetros foram aprovados pela Secretaria em 13/10/2026, com os seguintes ajustes: (a) no processo do antigo lixão de Itariri, estima-se só o cercamento de toda a poligonal do aterro; (b) no Estádio Municipal Mário Pessoa, estima-se só a adequação às normas de segurança previstas no Termo de Ajustamento de Conduta, sem reforma geral; (c) a reforma da Unidade de Acolhimento Renascer e a obra do Canal do Malhado têm licitação própria e ficaram fora da estimativa; (d) o projeto de segurança contra incêndio da Casa Lar Masculina é tratado à parte e também ficou fora.

**3. Metodologia**

3.1. Para cada objeto, o custo foi estimado em três cenários (mínimo, provável e máximo) pela expressão: Custo = Σ (Quantidade × Preço unitário) × (1 + BDI) × (1 + Contingência) × Fator regional.

3.2. As quantidades seguiram esta ordem de preferência: (a) metragem ou quantidade citada no próprio documento; (b) demanda-tipo padronizada, com premissas escritas; (c) apoio de base cartográfica aberta. O item (c) não pôde ser usado nesta versão, porque o acesso à base cartográfica não estava disponível no ambiente de trabalho.

3.3. Foram definidas 15 demandas-tipo: via urbana com drenagem e pavimentação; microdrenagem em via existente; contenção de encosta; edificação térrea nova; reforma predial; quadra poliesportiva coberta; campo de futebol; abrigo de passageiros; adequação de cozinha escolar; banheiro com chuveiro e grade; proteção emergencial de fachada; adequação de segurança de estádio; casa térrea com parque linear; infraestrutura básica de loteamento; e cercamento de área. Os coeficientes de cada uma estão na aba DEMANDAS-TIPO da planilha.

3.4. A demanda-tipo de contenção de encosta foi calibrada com a média do programa de contenção de encostas citada nos documentos do acervo (cerca de R$ 1.692,00 por m² de face). O resultado provável da demanda-tipo ficou em cerca de R$ 1.675,00 por m².

**4. Fontes de preço e parâmetros**

4.1. Preços unitários: SINAPI/CAIXA, referência 08/2026, Bahia, regime não desonerado, com encargos sociais da própria tabela. O código de cada composição ou insumo consta da planilha. O SINAPI foi adotado como base oficial de referência, nos termos da Lei n. 14.133/2021 e do Decreto Municipal n. 269/2025.

4.2. Parâmetros aplicados (APROVADO em 13/10/2026):

| Parâmetro | Mínimo | Provável | Máximo | Fonte |
|---|---|---|---|---|
| BDI de edificações, encostas, cercamento e outros | 22,12% | 22,12% | 22,12% | Acórdão n. 2.622/2013-TCU-Plenário, construção de edifícios (valor médio) |
| BDI de pavimentação, drenagem e infraestrutura de vias | 20,97% | 20,97% | 20,97% | Acórdão n. 2.622/2013-TCU-Plenário, construção de rodovias e ferrovias (valor médio) |
| Contingência | 5,00% | 10,00% | 15,00% | Parâmetro técnico (projeto, sondagem, topografia, licenciamento e fiscalização) |
| Fator regional | 1,00 | 1,00 | 1,00 | SINAPI-BA, localidade Salvador, não desonerado, adotado como referência para Ilhéus |

4.3. Adotou-se um BDI único por tipo de obra, igual ao valor médio da faixa referencial do Acórdão n. 2.622/2013-TCU-Plenário, nos três cenários; a variação entre os cenários vem das quantidades e da contingência. O BDI não inclui a contribuição previdenciária sobre a receita bruta, por se tratar de regime não desonerado. A contingência tem como teto de referência a precisão esperada para estimativas na fase de estudos preliminares, de cerca de 30% para edificações, segundo orientação técnica do Instituto Brasileiro de Auditoria de Obras Públicas (OT-IBR 004/2012).

4.4. Não foram usados como base de preço contratos da Secretaria nem editais de outros municípios. Os mesmos preços, demandas-tipo e parâmetros foram aplicados aos dois levantamentos.

**5. Resultados**

5.1. Estimativa por objeto (APROVADO em 13/10/2026):

| Nº | Objeto | Levantamento | Origem | Categoria | Quantidade | Mínimo | Provável | Máximo |
|---|---|---|---|---|---|---|---|---|
| 01 | Proteção e estabilização do prédio da Sociedade União Protetora dos Artífices e Operários (Centro) | MP | MPBA | outro | demanda-tipo (medidas do próprio documento) | R$ 20.676,77 | R$ 31.196,76 | R$ 492.557,05 |
| 02 | Conclusão de unidades escolares paralisadas (Recomendação MPBA 02/2025) | MP | MPBA | escola/creche | demanda-tipo (unidades não listadas) | R$ 335.745,78 | R$ 781.244,32 | R$ 1.429.312,64 |
| 03 | Requalificação da drenagem pluvial da Av. Soares Lopes | MP | MPBA | drenagem | documento (extensão de 1.600 m) | R$ 2.224.706,01 | R$ 2.756.332,97 | R$ 3.695.736,21 |
| 04 | Banheiro com chuveiro e grade na sede do Conselho Municipal de Educação | MP | MPBA | outro | demanda-tipo (banheiro-tipo) | R$ 8.257,60 | R$ 10.266,79 | R$ 14.402,31 |
| 05 | Valetão aberto pela EMBASA em via pública (local não identificado) | MP | MPBA | drenagem | demanda-tipo (local não identificado) | R$ 64.032,66 | R$ 118.557,42 | R$ 310.854,76 |
| 06 | Quadra poliesportiva do distrito de Banco do Pedro | MP | MPBA | quadra/esporte | documento (1 quadra) + demanda-tipo | R$ 647.663,00 | R$ 855.621,59 | R$ 1.036.228,02 |
| 07 | Reforma do Instituto Municipal de Ensino Eusínio Lavigne – IME (Av. Canavieiras, Centro) | MP | MPBA | escola/creche | demanda-tipo (área a confirmar) | R$ 302.063,69 | R$ 907.542,49 | R$ 2.204.158,55 |
| 08 | Drenagem da Rua Jardim Alice (Banco da Vitória) | MP | MPBA | drenagem | demanda-tipo (escopo a confirmar) | R$ 162.304,06 | R$ 282.387,84 | R$ 614.530,11 |
| 09 | Drenagem da Rua Praia Dourada | MP | MPBA | drenagem | demanda-tipo (rua-tipo) | R$ 311.205,29 | R$ 659.546,56 | R$ 1.548.261,16 |
| 10 | Contenção de encosta da Rua Alto do Socorro (Conquista) | MP | MPF | encosta/contenção | documento (1.368,32 m², Meta 13 do Novo PAC) | R$ 1.348.114,99 | R$ 2.292.498,30 | R$ 4.291.531,53 |
| 11 | 96 casas e parques lineares pós-chuvas de 2021 (Salobrinho, Banco da Vitória e Vila Cachoeira) | MP | MPF | habitação | documento (96 casas e 5 parques lineares) | R$ 7.571.485,23 | R$ 8.393.660,71 | R$ 9.549.599,25 |
| 12 | Obras FNDE: Escola Vila Lídia, Quadra do Vilela e Creche Nossa Senhora da Vitória | MP | MPF | escola/creche | demanda-tipo (situação das obras não informada) | R$ 1.309.630,36 | R$ 2.284.651,78 | R$ 3.342.743,63 |
| 13 | Condições de trabalho e reforma do prédio do SAMU de Ilhéus | MP | MPT | outro | demanda-tipo (área a confirmar) | R$ 43.888,84 | R$ 139.248,08 | R$ 355.889,47 |
| 14 | Condições do prédio do Arquivo Público Municipal | MP | MPT | outro | demanda-tipo (área a confirmar) | R$ 63.692,54 | R$ 229.637,20 | R$ 707.931,69 |
| 15 | Condições estruturais da Clínica Municipal de Atendimento Especializado - CMAE (Av. Canavieiras) | MP | MPT | outro | demanda-tipo (área a confirmar) | R$ 63.692,54 | R$ 207.030,95 | R$ 531.910,58 |
| 16 | Cozinhas e áreas de limpeza das escolas municipais (saúde e segurança do trabalho) | MP | MPT | escola/creche | demanda-tipo (unidades não listadas) | R$ 42.244,57 | R$ 88.512,43 | R$ 185.071,44 |
| 17 | Adequação do Estádio Municipal Mário Pessoa às normas de segurança (TAC de 2012, Cidade Nova) | MP | Justiça | quadra/esporte | demanda-tipo (itens de segurança do TAC) | R$ 188.931,02 | R$ 289.593,23 | R$ 451.991,73 |
| 18 | Drenagem pluvial e alagamentos nas Ruas Castro Alves e Barão do Rio Branco (Pontal) | MP | Justiça | drenagem | demanda-tipo (duas ruas) | R$ 318.687,81 | R$ 549.169,41 | R$ 1.221.881,00 |
| 19 | Drenagem e pavimentação da Rua Aracuã (Nossa Senhora das Vitórias) | MP | Justiça | drenagem+pavimentação | demanda-tipo (rua-tipo) | R$ 311.205,29 | R$ 659.546,56 | R$ 1.548.261,16 |
| 20 | Abrigos de ônibus da Rodovia Jorge Amado (BR-415), perto do IFBA | MP | Justiça | outro | demanda-tipo (abrigo-tipo) | R$ 26.162,65 | R$ 41.112,74 | R$ 57.308,66 |
| 21 | Creche Municipal Padrão de 6 salas da Rua Genésio Santos (Teotônio Vilela) | MP | TCM | escola/creche | documento (6 salas) + demanda-tipo | R$ 391.632,18 | R$ 781.244,32 | R$ 1.286.370,15 |
| 22 | Requalificação e ampliação do Complexo Esportivo Campo do Rodão (Teotônio Vilela) | MP | outro | quadra/esporte | demanda-tipo (campo-tipo) | R$ 282.782,07 | R$ 426.327,92 | R$ 578.321,94 |
| 23 | Infraestrutura básica do Loteamento Santa Cruz (cumprimento de sentença) | Justiça | Justiça | drenagem+pavimentação | demanda-tipo (extensão de vias a confirmar) | R$ 1.364.334,48 | R$ 2.846.250,30 | R$ 6.597.891,58 |
| 24 | Estabilização de encosta da Ladeira Júlio Bagana / Rua Rio Almada (Tapera) | Justiça | Justiça | encosta/contenção | demanda-tipo (área da encosta a confirmar) | R$ 593.109,77 | R$ 1.676.406,22 | R$ 4.390.811,93 |
| 25 | Cercamento de toda a poligonal do antigo lixão de Itariri (ACP do MPT) | Justiça | Justiça | saneamento | demanda-tipo (perímetro da poligonal a medir) | R$ 422.293,79 | R$ 737.185,86 | R$ 1.078.876,37 |
| | **Total geral** | | | | | **R$ 18.418.542,97** | **R$ 28.044.772,75** | **R$ 47.522.432,92** |

5.2. Totais do Ministério Público, da Justiça e geral, sem dupla contagem:

| Levantamento | Objetos | Mínimo | Provável | Máximo |
|---|---|---|---|---|
| Ministério Público (inclui os processos judiciais e do TCM do acervo do MP) | 22 | R$ 16.038.804,92 | R$ 22.784.930,36 | R$ 35.454.853,04 |
| Justiça (objetos novos do acervo jurídico) | 3 | R$ 2.379.738,05 | R$ 5.259.842,39 | R$ 12.067.579,88 |
| **Geral** | **25** | **R$ 18.418.542,97** | **R$ 28.044.772,75** | **R$ 47.522.432,92** |

5.3. Constam também do acervo da Justiça, já estimados no levantamento do Ministério Público e por isso não somados de novo: Adequação do Estádio Municipal Mário Pessoa às normas de segurança (TAC de 2012, Cidade Nova); Abrigos de ônibus da Rodovia Jorge Amado (BR-415), perto do IFBA; Creche Municipal Padrão de 6 salas da Rua Genésio Santos (Teotônio Vilela).

5.4. Por órgão de origem da demanda:

| Origem | Objetos | Mínimo | Provável | Máximo |
|---|---|---|---|---|
| MPBA | 9 | R$ 4.076.654,85 | R$ 6.402.696,74 | R$ 11.346.040,80 |
| MPF | 3 | R$ 10.229.230,58 | R$ 12.970.810,79 | R$ 17.183.874,41 |
| MPT | 4 | R$ 213.518,49 | R$ 664.428,66 | R$ 1.780.803,19 |
| Justiça | 7 | R$ 3.224.724,81 | R$ 6.799.264,34 | R$ 15.347.022,43 |
| TCM | 1 | R$ 391.632,18 | R$ 781.244,32 | R$ 1.286.370,15 |
| MP sem ramo identificado | 1 | R$ 282.782,07 | R$ 426.327,92 | R$ 578.321,94 |

5.5. Total por categoria:

| Categoria | Objetos | Mínimo | Provável | Máximo |
|---|---|---|---|---|
| habitação | 1 | R$ 7.571.485,23 | R$ 8.393.660,71 | R$ 9.549.599,25 |
| escola/creche | 5 | R$ 2.381.316,57 | R$ 4.843.195,33 | R$ 8.447.656,41 |
| drenagem | 5 | R$ 3.080.935,82 | R$ 4.365.994,20 | R$ 7.391.263,24 |
| encosta/contenção | 2 | R$ 1.941.224,76 | R$ 3.968.904,52 | R$ 8.682.343,47 |
| drenagem+pavimentação | 2 | R$ 1.675.539,77 | R$ 3.505.796,86 | R$ 8.146.152,74 |
| quadra/esporte | 3 | R$ 1.119.376,09 | R$ 1.571.542,74 | R$ 2.066.541,69 |
| saneamento | 1 | R$ 422.293,79 | R$ 737.185,86 | R$ 1.078.876,37 |
| outro | 6 | R$ 226.370,94 | R$ 658.492,52 | R$ 2.159.999,77 |

5.6. O valor provável total é de R$ 28.044.772,75, com faixa de R$ 18.418.542,97 a R$ 47.522.432,92. Recomenda-se usar o valor provável como referência de reserva e o máximo como teto de planejamento.

**6. Premissas principais**

6.1. Quantidades citadas nos documentos: extensão de 1.600 m da Av. Soares Lopes; área de 1.368,32 m² da encosta da Rua Alto do Socorro (trecho 02); 96 casas e 5 parques lineares; uma quadra poliesportiva; creche padrão de 6 salas.

6.2. Nos demais objetos, as quantidades são premissas de demanda-tipo, registradas na aba de cada objeto (por exemplo, comprimento de rua de 150/250/400 m, área de prédio a reformar, número de cozinhas ou de abrigos). Devem ser confirmadas por medição em campo ou por projeto.

6.3. Obras paralisadas (escolas, creches e quadra do FNDE) foram estimadas como fração remanescente de 30/50/70% da edificação-tipo, porque a situação física não está nos documentos.

6.4. Justiça: o Loteamento Santa Cruz foi estimado com 600/1.000/1.600 m de vias com drenagem, pavimentação, redes de água e esgoto e iluminação pública, porque a poligonal da sentença não consta do acervo; a encosta da Ladeira Júlio Bagana, com 600/1.000/1.400 m² de face, sem descontar o que o contrato anterior executou; o cercamento do antigo lixão de Itariri, com 1.500/2.500/3.500 m de perímetro, porque a poligonal não consta do acervo (custo de cerca de R$ 288,00 por metro, com BDI e contingência, no cenário provável).

6.5. Estádio Municipal Mário Pessoa: só os itens de segurança do Termo de Ajustamento de Conduta (extintores, iluminação e sinalização de emergência, barras antipânico nas saídas, guarda-corpos, sistema de proteção contra descargas atmosféricas e quadros com dispositivo diferencial-residual nas casas de força), com quantidades-tipo de estádio de pequeno porte. Não incluem reforma, pintura nem acessibilidade.

**7. Limitações**

7.1. A maior incerteza está nas quantidades, e não nos preços: a maior parte dos documentos não traz metragem.

7.2. Alguns serviços não têm preço no SINAPI da Bahia na referência adotada (imprimação e pintura de ligação asfáltica, exaustores, central de alarme de incêndio com acionadores e sirenes, locação de andaime). Eles não foram incluídos, o que tende a subestimar levemente os objetos afetados.

7.3. Encostas dependem de sondagem e de projeto geotécnico. A faixa adotada (solo grampeado com concreto projetado) pode não representar a solução final.

7.4. Em objetos com corresponsabilidade de concessionária (rede aberta ou danificada pela empresa de saneamento), parte do custo pode caber a ela.

7.5. Nos objetos com recursos federais já previstos (casas do programa de reconstrução pós-chuvas, encosta incluída no programa federal de contenção e obras do FNDE), a estimativa é do custo total da obra. A parcela a cargo do Município pode ser menor; no caso das 96 casas, os documentos citam contrapartida municipal de R$ 4.549.844,04.

7.6. As fontes normativas foram conferidas em reproduções públicas dos textos, porque o acesso direto aos sítios oficiais não estava disponível no ambiente de trabalho. Recomenda-se conferência nos sítios oficiais antes da versão final.

7.7. Na Justiça, seis processos de drenagem só têm a resposta da Secretaria à Procuradoria Geral do Município, sem petição inicial nem sentença, e dezenove processos aparecem apenas nas planilhas de controle da Secretaria. Esses casos não foram estimados, porque a obra e o local não são conhecidos.

7.8. Em três objetos estimados no levantamento do Ministério Público (drenagem da Av. Soares Lopes, drenagem das Ruas Castro Alves e Barão do Rio Branco e Rua Aracuã), o acervo da Justiça informa licitação ou contrato vinculado ao programa federal de drenagem, que, segundo os próprios documentos, trata de projetos. Se ficar confirmado contrato de execução da obra, esses objetos sairão da estimativa. Em sentido inverso, a encosta da Ladeira Júlio Bagana passou a ser estimada, porque o contrato anterior foi extinto com a obra paralisada.

**8. Encaminhamentos**

8.1. Os parâmetros aprovados estão na aba PARAMETROS da planilha. Se forem alterados, a planilha recalcula sozinha.

8.2. Medir o perímetro da poligonal do antigo lixão de Itariri e a extensão de vias do Loteamento Santa Cruz, que são as premissas de maior peso na estimativa da Justiça, e recalcular.

8.3. Confirmar, com prioridade, as quantidades dos objetos de maior valor, por medição em campo ou projeto.

8.4. Solicitar à Procuradoria Geral do Município cópia da petição inicial ou da sentença dos processos sem obra ou local identificados e incluir na estimativa os que exigirem obra.

8.5. Anexar esta nota técnica e a planilha levantamento_parametrico.xlsx à comunicação interna dirigida à Secretaria Municipal da Fazenda e Orçamento.

Ilhéus, *data da assinatura*.


**{{NOME_DO_SIGNATARIO}}**

**{{CARGO_DO_SIGNATARIO}}**
