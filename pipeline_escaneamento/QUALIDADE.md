# QUALIDADE — o que foi medido, o que ficou fraco e o que NÃO foi testado

> **Leia isto antes de confiar nos números.** Todos os testes usam documentos **sintéticos** (fictícios, gerados pelo próprio projeto: `src/pipeline/sinteticos.py`). Eles imitam escaneamento (ruído, inclinação, páginas viradas, brancas, soltas, fora de ordem, misturadas), mas foram escritos por quem escreveu o programa. **Papel real será pior.** Os números abaixo são um *piso de sanidade*, não uma promessa.

## 1. Como foi medido

* Corpus: 5 lotes sintéticos (sementes 1, 2, 3, 4, 5), cada um com 24 documentos + 1 extra (JPG), em 4 arquivos (em ordem, **fora de ordem e misturado**, com **brancas, soltas e continuação órfã**, e um JPG avulso), a 200 dpi, páginas viradas (180°/90°/270°) em ~22% dos casos, inclinação de até ±1,8°, ruído, sombra de fundo e fontes/margens diferentes por documento.
* Categorias na proporção aproximada do pedido: CI e ofícios ~50%, MP e Justiça ~25%, resto (autorização, associação, outros).
* Cada lote passou pelo pipeline **completo** (`executar`), e o catálogo gerado foi comparado com o gabarito (`verdade.json`).
* **Separação correta** = o conjunto exato de páginas de origem do documento coincide com o gabarito. **Categoria correta** = só conta se a separação estiver certa. **Nome correto** = `TIPO_ORGAO_NUMERO_DATA` igual ao esperado (para empresas/associações a sigla é provisória e não entra na comparação).
* Reproduzir: `python utilitarios/avaliar_qualidade.py --motores tesseract rapidocr --sementes 1 2 3 4 5` e `python utilitarios/gerar_qualidade_md.py`. Testes automáticos: `pytest tests`.

## 2. Resultados por motor de OCR

| Métrica | tesseract | rapidocr |
|---|---|---|
| Documentos (gabarito) | 125 | 125 |
| Páginas processadas | 252 | 252 |
| Tempo total (s) — 3 processos | 141 | 1140 |
| Tempo por página (s, por processo) | 1.7 | 13.6 |
| **Separação correta** | 110/125 (88%) | 62/125 (50%) |
| **Categoria correta** | 109/125 (87%) | 47/125 (38%) |
| **Nome final correto** | 110/125 (88%) | 11/125 (9%) |
| Itens marcados AUTO / REVISAR | 111 / 15 | n/d |
| **AUTO com separação errada (erro silencioso)** | 7 | n/d |
| **AUTO com categoria errada (erro silencioso)** | 0 | n/d |
| Páginas soltas esperadas tratadas como soltas | 15/15 (100%) | 15/15 (100%) |
| Páginas de documentos que viraram solto (erro) | 20 | 104 |
| Páginas em branco registradas | 10/10 (100%) | 10/10 (100%) |

### Campos extraídos (acertos / vezes em que o campo existia no gabarito)

| Campo | tesseract | rapidocr |
|---|---|---|
| tipo | 110/110 (100%) | 58/62 (94%) |
| orgao | 88/88 (100%) | 3/53 (6%) |
| numero | 95/95 (100%) | 53/53 (100%) |
| data | 110/110 (100%) | 61/62 (98%) |
| signatario_nome | 102/110 (93%) | 8/62 (13%) |
| signatario_cargo | 102/110 (93%) | 33/62 (53%) |
| processo | 36/36 (100%) | 9/23 (39%) |
| assunto | 81/95 (85%) | 41/53 (77%) |
| destinatario | 87/105 (83%) | 14/58 (24%) |

*Assunto e destinatário são comparados por semelhança (≥85%) porque o OCR troca caracteres como `–`/`—` e `ª`.*

## 3. Comparação dos motores de OCR

* **Tesseract (por)** — 1.7 s/página/processo; separação 110/125 (88%), categoria 109/125 (87%).
* **RapidOCR (ONNX, só pip)** — 13.6 s/página/processo; separação 62/125 (50%), categoria 47/125 (38%).
* O RapidOCR **perde acentos** (`Ilhéus` → `Ilheus`), funde palavras (`Osmoradoresda`) e erra mais a orientação da página; os campos continuam sendo extraídos porque todas as comparações ignoram acento, mas o **texto pesquisável fica pior**.
* **Escolha: Tesseract**, com RapidOCR como reserva quando o Tesseract não puder ser instalado. Ver `DECISOES.md` (item 3).
* Não foram avaliados EasyOCR/PaddleOCR/docTR: exigem PyTorch/PaddlePaddle (> 1 GB), contra o requisito de instalação simples.

## 4. Erros que ainda acontecem nos sintéticos (todos os lotes)

**tesseract** (16 ocorrências):

* [semente 1] S014: categoria OFICIO_MP != OFICIO_EXTERNO
* [semente 2] S013: separação errada (CI, CI_PGM_373-2026_24082026.pdf)
* [semente 2] S022: separação errada (CI, CI_GAB_414-2026_13072026.pdf)
* [semente 3] S010: separação errada (OUTROS, DECLARACAO_SEAD_SN_02022026.pdf)
* [semente 3] S013: separação errada (OFICIO_MP, OFICIO_PGM_264-2026_03122026.pdf)
* [semente 3] S012: separação errada (PEDIDO_VEREADOR, REQUERIMENTO_CMI_416-2026_16092026.pdf)
* [semente 3] S011: separação errada (OFICIO_EXTERNO, OFICIO_GAB_114-2026_23092026.pdf)
* [semente 4] S011: separação errada (OFICIO_EXTERNO, OFICIO_GAB_84-2026_28062026.pdf)
* [semente 4] S014: separação errada (CI, CI_SESAU_417-2026_26062026.pdf)
* [semente 4] S013: separação errada (OFICIO_JUSTICA, OFICIO_SESAU_415-2026_22032026.pdf)
* [semente 4] S019: separação errada (JUSTICA, INTIMACAO_TJBA_92866141120268050103_22052026.pdf)
* [semente 4] S018: separação errada (JUSTICA, INTIMACAO_TJBA_93945365620268050103_10112026.pdf)
* [semente 4] S022: separação errada (OFICIO_EXTERNO, OFICIO_SEDUC_33-2026_16072026.pdf)
* [semente 5] S015: separação errada (JUSTICA, DESPACHO_TJBA_19827151220268050103_08012026.pdf)
* [semente 5] S012: separação errada (JUSTICA, DESPACHO_TJBA_91812155720268050103_03102026.pdf)
* [semente 5] S017: separação errada (CI, CI_SEMAM_74-2026_10082026.pdf)

**rapidocr** (129 ocorrências):

* [semente 1] S001: categoria OUTROS != CI
* [semente 1] S001: nome DOC_SO_118-2026_26122026.pdf != CI_PGM_118-2026_26122026.pdf
* [semente 1] S002: nome OFICIO_SO_429-2026_14012026.pdf != OFICIO_SEMAM_429-2026_14012026.pdf
* [semente 1] S003: categoria OFICIO_EXTERNO != OFICIO_MP
* [semente 1] S003: nome OFICIO_SO_434-2026_16102026.pdf != OFICIO_SEMAM_434-2026_16102026.pdf
* [semente 1] S004: separação errada (OFICIO_JUSTICA, OFICIO_SEDES_241-2026_01122026.pdf)
* [semente 1] S005: separação errada (PEDIDO_VEREADOR, REQUERIMENTO_CMI_236-2026_12102026.pdf)
* [semente 1] S006: categoria OFICIO_EXTERNO != MP
* [semente 1] S006: nome OFICIO_SO_441-2026_06102026.pdf != OFICIO_MPBA_441-2026_06102026.pdf
* [semente 1] S007: nome DECISAO_SO_19158021320268050103_03052026.pdf != DECISAO_TJBA_19158021320268050103_03052026.pdf
* [semente 1] S008: separação errada (AUTORIZACAO, OFICIO_?_19-2026_05072026.pdf)
* [semente 1] S011: separação errada (CI, CI_SEDES_346-2026_09042026.pdf)
* [semente 1] S013: separação errada (JUSTICA, DECISAO_TJBA_18074211520268050103_18102026.pdf)
* [semente 1] S015: separação errada (PEDIDO_VEREADOR, INDICACAO_CMI_33-2026_13062026.pdf)
* [semente 1] S016: nome INDICACAO_SO_334-2026_03082026.pdf != INDICACAO_CMI_334-2026_03082026.pdf
* [semente 1] S010: nome CERTIDAO_SO_SN_20122026.pdf != CERTIDAO_SEFAZ_SN_20122026.pdf
* [semente 1] S017: nome RECOMENDACAO_SO_306-2026_26102026.pdf != RECOMENDACAO_MPBA_306-2026_26102026.pdf
* [semente 1] S019: separação errada (CI, CI_SEMAM_280-2026_05042026.pdf)
* [semente 1] S020: categoria OUTROS != CI
* [semente 1] S020: nome DOC_SO_6-2026_15092026.pdf != CI_PGM_6-2026_15092026.pdf
* [semente 1] S022: nome INDICACAO_SO_283-2026_28052026.pdf != INDICACAO_CMI_283-2026_28052026.pdf
* [semente 1] S023: separação errada (JUSTICA, DECISAO_TJBA_27641185120268050103_27102026.pdf)
* [semente 1] S018: separação errada (JUSTICA, INTIMACAO_TJBA_30126252920268050103_16062026.pdf)
* [semente 1] S024: separação errada (CI, CI_SEMAM_140-2026_07092026.pdf)
* [semente 1] S901: nome CI_SO_188-2026_22082026.pdf != CI_SEAD_188-2026_22082026.pdf
* [semente 2] S001: separação errada (CI, CI_GAB_258-2026_15092026.pdf)
* [semente 2] S002: nome OFICIO_SO_379-2026_23072026.pdf != OFICIO_SEFAZ_379-2026_23072026.pdf
* [semente 2] S003: categoria OFICIO_EXTERNO != OFICIO_MP
* [semente 2] S003: nome OFICIO_SO_362-2026_26052026.pdf != OFICIO_PGM_362-2026_26052026.pdf
* [semente 2] S004: separação errada (OFICIO_JUSTICA, OFICIO_SEAD_295-2026_02022026.pdf)
* [semente 2] S005: nome REQUERIMENTO_SO_374-2026_02012026.pdf != REQUERIMENTO_CMI_374-2026_02012026.pdf
* [semente 2] S006: nome NOTIFICACAO_SO_230-2026_10012026.pdf != NOTIFICACAO_MPBA_230-2026_10012026.pdf
* [semente 2] S007: nome DESPACHO_SO_38865287520268050103_20052026.pdf != DESPACHO_TJBA_38865287520268050103_20052026.pdf
* [semente 2] S008: separação errada (AUTORIZACAO, OFICIO_?_117-2026_19022026.pdf)
* [semente 2] S015: separação errada (AUTORIZACAO, OFICIO_?_361-2026_15032026.pdf)
* [semente 2] S014: categoria OUTROS != CI
* [semente 2] S014: nome DOC_SO_344-2026_23042026.pdf != CI_SEMAM_344-2026_23042026.pdf
* [semente 2] S013: separação errada (CI, CI_PGM_373-2026_24082026.pdf)
* [semente 2] S009: separação errada (ASSOCIACAO, OFICIO_?_238-2026_22092026.pdf)
* [semente 2] S016: separação errada (JUSTICA, INTIMACAO_TJBA_65428498120268050103_21082026.pdf)
* ... e mais 89

## 5. Onde o programa é FRACO (franqueza)

0. **Erro silencioso.** Nos sintéticos, 7 de 111 itens marcados `AUTO` (6%) têm o conjunto de páginas errado (quase sempre: documento sem numeração ao qual faltou uma página, ou páginas trocadas entre documentos de mesmo tamanho). O `AUTO` **não** garante que o documento está completo. Por isso a primeira rodada com papel real deve ser conferida por amostragem.
1. **Documentos sem numeração de página, fora de ordem.** Sem "Página X de Y" a única ligação possível é vizinhança, fecho/assinatura e vocabulário. Uma página do meio de um documento sem numeração, fora do lugar, costuma virar **solto** (comportamento seguro), e o documento fica sem essa página — **e sem aviso de que falta** (não há total declarado para comparar). Ver erros acima.
2. **Vários documentos de mesmo tamanho misturados** (por exemplo, três ofícios de 3 páginas embaralhados): a ligação depende de sinais fracos (margem/tipografia, assinante, referência no topo). Nos testes, parte dessas páginas é trocada entre documentos. Na prática real, isso será pior se os documentos usarem o mesmo modelo/timbre.
3. **Destinatário** é o campo mais fraco (formatos livres: "Ao Senhor...", "À Secretaria...", com ou sem cargo na linha seguinte). O **assunto** só é extraído quando há rótulo (`Assunto:`, `Ref.:`); o **objeto** é só uma frase do corpo e tem confiança baixa.
4. **Classificação** é por regras e foi afinada nos próprios sintéticos (risco de sobreajuste). Com nomes de órgãos, timbres e expressões reais, as regras precisarão de calibração — é para isso que existe o `CALIBRAR.bat`.
5. **Categoria `OUTROS`** sempre vai para `REVISAR`.
6. Número do documento com formatos fora do padrão (`Of. 12/2026-GAB`, `Processo SEI 00012.000123/2026-11`, número sem ano) é lido só em parte; sem ano, o número sai sem ano.
7. Segmentação **por arquivo**: documento cujas páginas estão em arquivos diferentes não é reunido.
8. Memória: o PDF do lote inteiro é montado em memória; arquivos com mais de ~1.500 páginas podem consumir vários GB. Recomendação: escanear em arquivos de até algumas centenas de páginas.
9. Ligação das páginas é uma atribuição **gulosa**; não há busca global ótima.

## 6. O que NÃO foi possível testar sem papel real (nem sem Windows)

* **Nenhum papel real.** Não testados: carimbos de protocolo sobre o texto, assinaturas e anotações manuscritas, grampos/furos/dobras, timbres e logomarcas coloridos, fotos coladas, escaneamento em cor, fax, texto muito claro, manuchas, folhas com verso transparente, pedidos de vereador manuscritos, DPIs variados e escâneres reais.
* **Nenhum teste no Windows.** `INSTALAR.bat`/`instalar.ps1` (download do Python e do Tesseract, assinatura digital, instalação sem administrador), `AGENDAR_DIARIO.bat` (schtasks), `VIGIAR.bat`, o prefixo `\\?\` para caminhos longos e pasta com espaço no fim (testados no Linux apenas com o equivalente funcional), bloqueio de arquivo "em uso" do Windows, SmartScreen e antivírus.
* **Tesseract no Windows** (a instalação silenciosa pode exigir administrador; se falhar, cai no RapidOCR, mais lento e sem acentos).
* **Escala real**: milhares de páginas em PC comum. Foram medidos apenas lotes de ~50 páginas (e a segmentação isolada com ~2.100 páginas sintéticas em ~1 minuto). Estimativa (não medida em PC real): Tesseract a 300 dpi ≈ 2–3 s/página/núcleo → 3.000 páginas em 4 núcleos ≈ 30–45 min.
* **DPI 300 em escala**: os testes usaram 200 dpi (para ser rápido). O padrão do `config.yaml` é 300.
* **Classificador por LLM** (gancho): testado só com a lógica, nunca com um LLM de verdade.
* **Excel brasileiro** abrindo o CSV e o XLSX: seguem o formato (`;`, UTF-8 com BOM, vírgula decimal), mas não foram abertos no Excel.
* **Integração com o Ômega**: o contrato foi escrito, mas o Ômega não existe nesta sessão para ler os arquivos.

## 7. Testes automáticos (`pytest tests`)

* `test_util.py`, `test_unidades.py`: regras sem OCR (campos, categorias, segmentação, reordenação, soltos, `_V2`, correções).
* `test_e2e.py`: lote sintético completo com **pasta de entrada com espaço no fim**, **saída com acentos**, métricas mínimas, originais intactos, arquivos corrompido/protegido em `ERROS`, PDFs pesquisáveis, JSON ao lado, catálogo (CSV com BOM, XLSX com 5 abas, JSONL), `status.json`, idempotência.
* `test_operacao.py`: `--simular` (não grava), `--amostra`, `--desfazer` (volta ao estado anterior e preserva arquivo editado), mover para PROCESSADOS, caminho de saída > 260 caracteres, erro numa página sem derrubar o lote.
* `test_instalacao.py`: arquivos de entrega presentes, `.bat/.ps1` com CRLF, BOM no `.ps1`, configurações válidas.

