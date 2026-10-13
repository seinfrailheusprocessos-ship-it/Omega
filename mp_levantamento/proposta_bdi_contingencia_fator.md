# Proposta de BDI, contingência e fator regional — PROVISORIO - aguarda aprovacao

Levantamento MP/Justiça · SEINFRA Ilhéus · Etapa B · 13/10/2026.
Status: **PROVISORIO - aguarda aprovacao**. Os valores abaixo já foram aplicados na estimativa provisória
(`levantamento_parametrico.xlsx` e `nota_tecnica.md`). Se forem alterados, a planilha é recalculada.

## 1. Fórmula (00_LEIA)

`Custo_cenário = Σ_macroetapas (Quantidade × Preço_unit) × (1 + BDI) × (1 + Contingência) × Fator_regional_cenário`

Preço unitário: SINAPI/CAIXA, ref. 08/2026, Bahia (localidade Salvador), regime não desonerado (encargos sociais
horista 117,73%, mensalista 72,85%, conforme o arquivo recortado em `_PRECOS/`).

## 2. BDI — PROVISORIO - aguarda aprovacao

Faixas referenciais do Acórdão nº 2.622/2013 – TCU – Plenário, por tipo de obra. Cenário mínimo = 1º quartil;
provável = valor médio; máximo = 3º quartil.

| Tipo de obra (Acórdão 2.622/2013) | Aplicado a | Mínimo | Provável | Máximo |
|---|---|---|---|---|
| Construção de edifícios | escola/creche, quadra/esporte, habitação, prédios públicos, encosta/contenção, abrigos e outros | 20,34% | 22,12% | 25,00% |
| Construção de rodovias e ferrovias | pavimentação, drenagem e drenagem+pavimentação de vias urbanas | 19,60% | 20,97% | 24,23% |

- Os quartis do acórdão não incluem a CPRB (Lei nº 12.546/2011). Como o regime adotado é o não desonerado, a CPRB
  não entra no BDI.
- Encosta/contenção foi enquadrada em "construção de edifícios" por ser a faixa mais conservadora entre as duas
  conferidas. A linha "redes de abastecimento de água, coleta de esgoto e construções correlatas" não foi usada,
  porque só o 3º quartil pôde ser conferido.
- Conferência: os valores foram conferidos em reproduções públicas do texto do acórdão (página de pesquisa textual
  do TCU e cópia hospedada pela UFF, entre outras). O acesso direto aos sites oficiais foi bloqueado pela rede deste
  ambiente, então convém abrir o acórdão no site do TCU antes da versão final.
  - https://pesquisa.apps.tcu.gov.br/documento/acordao-completo/*/NUMACORDAO%253A2622%2520ANOACORDAO%253A2013%2520COLEGIADO%253A%2522Plen%25C3%25A1rio%2522/DTRELEVANCIA%2520desc%252C%2520NUMACORDAOINT%2520desc/0
  - https://www.editais.uff.br/sites/default/files/arquivos/Base%20BDI%20-%20Ac%C3%B3rd%C3%A3o-2622-2013.pdf
  - Nota sobre a CPRB: anexos de BDI do INSS e da Polícia Federal no gov.br, que citam o acórdão.

## 3. Contingência — PROVISORIO - aguarda aprovacao

| Mínimo | Provável | Máximo |
|---|---|---|
| 5% | 10% | 15% |

- Cobre o que não está nas composições de obra: projeto, sondagem, topografia, licenciamento e fiscalização (como
  definido no briefing de 08/10/2026). A incerteza de quantidade fica nas quantidades de cada cenário, e não aqui.
- Não há tabela oficial de contingência. O teto de referência é a precisão esperada para estimativas na fase de
  estudos preliminares: ±30% para edificações, podendo ser maior em outras tipologias, segundo a OT-IBR 004/2012
  do IBRAOP. Essa faixa foi conferida em documentos que reproduzem a OT (resolução do TCE-ES que a adota, artigo do
  repositório da CGU e livro de engenharia de custos do IBEC), sem acesso ao PDF original.
  - https://www.ibraop.org.br/wp-content/uploads/2013/04/OT_IBR0042012.pdf (original, não aberto)
  - https://diario.tcees.tc.br/Noticia/BaixarDocumento?idDocumento=3747830
  - https://repositorio.cgu.gov.br/bitstream/1/65273/3/Artigo_Renato_Camillo.pdf

## 4. Fator regional — PROVISORIO - aguarda aprovacao

| Mínimo | Provável | Máximo |
|---|---|---|
| 1,00 | 1,00 | 1,10 |

- O SINAPI coleta os preços de insumos nas 27 capitais, para pagamento à vista e sem frete, salvo exceções. O preço
  "BA" reflete Salvador (manual "SINAPI: metodologias e conceitos", CAIXA, conferido em reprodução pública).
  - https://www.caixa.gov.br/Downloads/sinapi-metodologia/Livro_SINAPI_Metodologias_Conceitos.pdf
- Mínimo e provável = 1,00, porque o SINAPI é a referência legal de preço para obras. Máximo = 1,10, para cobrir
  frete até Ilhéus, acesso difícil (obras em morro, distritos) e mobilização. É um parâmetro técnico declarado, não
  um índice oficial.

## 5. Efeito combinado

Sobre o custo direto do cenário (quantidade × preço), os multiplicadores ficam assim:

| Tipo | Mínimo | Provável | Máximo |
|---|---|---|---|
| Edificações e encostas | 1,2034 × 1,05 × 1,00 = 1,2636 | 1,2212 × 1,10 × 1,00 = 1,3433 | 1,2500 × 1,15 × 1,10 = 1,5813 |
| Vias e drenagem | 1,1960 × 1,05 × 1,00 = 1,2558 | 1,2097 × 1,10 × 1,00 = 1,3307 | 1,2423 × 1,15 × 1,10 = 1,5715 |

## 6. Base legal (citada sem artigo onde o texto não foi conferido)

- Lei nº 14.133/2021, art. 23, § 2º: em obras e serviços de engenharia, o valor estimado é acrescido de BDI e
  encargos sociais e tem o SINAPI (demais obras) e o SICRO (infraestrutura de transportes) como primeiro parâmetro.
  O conteúdo foi conferido em reproduções públicas (TCE-SP, legislação comentada); o site do Planalto ficou
  inacessível neste ambiente.
- Decreto Municipal nº 269/2025 de Ilhéus: citado como norma municipal aplicável, sem artigo, porque o texto não foi
  conferido. Se houver conflito, prevalece a lei federal.

Decisão pendente: aprovar ou alterar os itens 2, 3 e 4.
