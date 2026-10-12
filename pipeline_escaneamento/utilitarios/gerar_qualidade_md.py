"""Gera o QUALIDADE.md a partir de tests/metricas_qualidade.json (números reais, sem edição manual).
Uso: python utilitarios/gerar_qualidade_md.py"""
import json
import os
import sys

RAIZ = os.path.join(os.path.dirname(__file__), "..")
dados = json.load(open(os.path.join(RAIZ, "tests", "metricas_qualidade.json"), encoding="utf-8"))
res = dados["resumo"]
extra = os.path.join(RAIZ, "tests", "metricas_tesseract.json")
if os.path.exists(extra):          # rodada mais recente só do Tesseract (com as métricas de erro silencioso)
    res["tesseract"] = json.load(open(extra, encoding="utf-8"))["resumo"]["tesseract"]
par = dados["parametros"]


def pct(a, b):
    return f"{a}/{b} ({100 * a / b:.0f}%)" if b else "-"


L = []
L.append("# QUALIDADE — o que foi medido, o que ficou fraco e o que NÃO foi testado\n")
L.append("> **Leia isto antes de confiar nos números.** Todos os testes usam documentos **sintéticos** (fictícios, gerados pelo "
         "próprio projeto: `src/pipeline/sinteticos.py`). Eles imitam escaneamento (ruído, inclinação, páginas viradas, "
         "brancas, soltas, fora de ordem, misturadas), mas foram escritos por quem escreveu o programa. "
         "**Papel real será pior.** Os números abaixo são um *piso de sanidade*, não uma promessa.\n")
L.append("## 1. Como foi medido\n")
L.append(f"* Corpus: {len(par['sementes'])} lotes sintéticos (sementes {', '.join(map(str, par['sementes']))}), cada um com "
         f"{par['docs']} documentos + 1 extra (JPG), em 4 arquivos (em ordem, **fora de ordem e misturado**, com **brancas, soltas e "
         f"continuação órfã**, e um JPG avulso), a {par['dpi']} dpi, páginas viradas (180°/90°/270°) em ~22% dos casos, "
         "inclinação de até ±1,8°, ruído, sombra de fundo e fontes/margens diferentes por documento.")
L.append("* Categorias na proporção aproximada do pedido: CI e ofícios ~50%, MP e Justiça ~25%, resto (autorização, associação, outros).")
L.append("* Cada lote passou pelo pipeline **completo** (`executar`), e o catálogo gerado foi comparado com o gabarito (`verdade.json`).")
L.append("* **Separação correta** = o conjunto exato de páginas de origem do documento coincide com o gabarito. "
         "**Categoria correta** = só conta se a separação estiver certa. **Nome correto** = `TIPO_ORGAO_NUMERO_DATA` igual ao esperado "
         "(para empresas/associações a sigla é provisória e não entra na comparação).")
L.append("* Reproduzir: `python utilitarios/avaliar_qualidade.py --motores tesseract rapidocr --sementes 1 2 3 4 5` "
         "e `python utilitarios/gerar_qualidade_md.py`. Testes automáticos: `pytest tests`.\n")

L.append("## 2. Resultados por motor de OCR\n")
cab = "| Métrica | " + " | ".join(res.keys()) + " |"
L.append(cab)
L.append("|---|" + "---|" * len(res))


def linha(nome, f):
    L.append(f"| {nome} | " + " | ".join(f(res[m]) for m in res) + " |")


linha("Documentos (gabarito)", lambda r: str(r["docs"]))
linha("Páginas processadas", lambda r: str(r["paginas"]))
linha("Tempo total (s) — 3 processos", lambda r: f"{r['segundos']:.0f}")
linha("Tempo por página (s, por processo)", lambda r: f"{r['segundos'] * 3 / r['paginas']:.1f}")
linha("**Separação correta**", lambda r: pct(r["separacao_ok"], r["docs"]))
linha("**Categoria correta**", lambda r: pct(r["categoria_ok"], r["docs"]))
linha("**Nome final correto**", lambda r: pct(r["nome_ok"], r["docs"]))
linha("Itens marcados AUTO / REVISAR", lambda r: f"{r['auto_total']} / {r['revisar_total']}" if "auto_total" in r else "n/d")
linha("**AUTO com separação errada (erro silencioso)**", lambda r: str(r["auto_com_separacao_errada"]) if "auto_total" in r else "n/d")
linha("**AUTO com categoria errada (erro silencioso)**", lambda r: str(r["auto_com_categoria_errada"]) if "auto_total" in r else "n/d")
linha("Páginas soltas esperadas tratadas como soltas", lambda r: pct(r["soltos_acertados"], r["soltos_esperados"]))
linha("Páginas de documentos que viraram solto (erro)", lambda r: str(r["paginas_de_documento_viraram_solto"]))
linha("Páginas em branco registradas", lambda r: pct(r["brancas_acertadas"], r["brancas_esperadas"]))
L.append("")
L.append("### Campos extraídos (acertos / vezes em que o campo existia no gabarito)\n")
campos = list(next(iter(res.values()))["campos"].keys())
L.append("| Campo | " + " | ".join(res.keys()) + " |")
L.append("|---|" + "---|" * len(res))
for c in campos:
    L.append(f"| {c} | " + " | ".join(pct(*res[m]["campos"][c]) for m in res) + " |")
L.append("")
L.append("*Assunto e destinatário são comparados por semelhança (≥85%) porque o OCR troca caracteres como `–`/`—` e `ª`.*\n")

L.append("## 3. Comparação dos motores de OCR\n")
tes = res.get("tesseract")
rap = res.get("rapidocr")
if tes and rap:
    L.append(f"* **Tesseract (por)** — {tes['segundos'] * 3 / tes['paginas']:.1f} s/página/processo; "
             f"separação {pct(tes['separacao_ok'], tes['docs'])}, categoria {pct(tes['categoria_ok'], tes['docs'])}.")
    L.append(f"* **RapidOCR (ONNX, só pip)** — {rap['segundos'] * 3 / rap['paginas']:.1f} s/página/processo; "
             f"separação {pct(rap['separacao_ok'], rap['docs'])}, categoria {pct(rap['categoria_ok'], rap['docs'])}.")
L.append("* O RapidOCR **perde acentos** (`Ilhéus` → `Ilheus`), funde palavras (`Osmoradoresda`) e erra mais a orientação da página; "
         "os campos continuam sendo extraídos porque todas as comparações ignoram acento, mas o **texto pesquisável fica pior**.")
L.append("* **Escolha: Tesseract**, com RapidOCR como reserva quando o Tesseract não puder ser instalado. Ver `DECISOES.md` (item 3).")
L.append("* Não foram avaliados EasyOCR/PaddleOCR/docTR: exigem PyTorch/PaddlePaddle (> 1 GB), contra o requisito de instalação simples.\n")

L.append("## 4. Erros que ainda acontecem nos sintéticos (todos os lotes)\n")
for m in res:
    L.append(f"**{m}** ({len(res[m]['erros'])} ocorrências):\n")
    for e in res[m]["erros"][:40]:
        L.append(f"* {e}")
    if len(res[m]["erros"]) > 40:
        L.append(f"* ... e mais {len(res[m]['erros']) - 40}")
    L.append("")

L.append("## 5. Onde o programa é FRACO (franqueza)\n")
if tes and "auto_total" in tes:
    L.append(f"0. **Erro silencioso.** Nos sintéticos, {tes['auto_com_separacao_errada']} de {tes['auto_total']} itens marcados `AUTO` "
             f"({100 * tes['auto_com_separacao_errada'] / tes['auto_total']:.0f}%) têm o conjunto de páginas errado (quase sempre: documento sem numeração "
             "ao qual faltou uma página, ou páginas trocadas entre documentos de mesmo tamanho). O `AUTO` **não** garante que o documento está completo. "
             "Por isso a primeira rodada com papel real deve ser conferida por amostragem.")
L.append("1. **Documentos sem numeração de página, fora de ordem.** Sem \"Página X de Y\" a única ligação possível é vizinhança, "
         "fecho/assinatura e vocabulário. Uma página do meio de um documento sem numeração, fora do lugar, "
         "costuma virar **solto** (comportamento seguro), e o documento fica sem essa página — **e sem aviso de que falta** "
         "(não há total declarado para comparar). Ver erros acima.")
L.append("2. **Vários documentos de mesmo tamanho misturados** (por exemplo, três ofícios de 3 páginas embaralhados): a ligação depende "
         "de sinais fracos (margem/tipografia, assinante, referência no topo). Nos testes, parte dessas páginas é trocada entre documentos. "
         "Na prática real, isso será pior se os documentos usarem o mesmo modelo/timbre.")
L.append("3. **Destinatário** é o campo mais fraco (formatos livres: \"Ao Senhor...\", \"À Secretaria...\", com ou sem cargo na linha seguinte). "
         "O **assunto** só é extraído quando há rótulo (`Assunto:`, `Ref.:`); o **objeto** é só uma frase do corpo e tem confiança baixa.")
L.append("4. **Classificação** é por regras e foi afinada nos próprios sintéticos (risco de sobreajuste). Com nomes de órgãos, timbres e "
         "expressões reais, as regras precisarão de calibração — é para isso que existe o `CALIBRAR.bat`.")
L.append("5. **Categoria `OUTROS`** sempre vai para `REVISAR`.")
L.append("6. Número do documento com formatos fora do padrão (`Of. 12/2026-GAB`, `Processo SEI 00012.000123/2026-11`, número sem ano) "
         "é lido só em parte; sem ano, o número sai sem ano.")
L.append("7. Segmentação **por arquivo**: documento cujas páginas estão em arquivos diferentes não é reunido.")
L.append("8. Memória: o PDF do lote inteiro é montado em memória; arquivos com mais de ~1.500 páginas podem consumir vários GB. "
         "Recomendação: escanear em arquivos de até algumas centenas de páginas.")
L.append("9. Ligação das páginas é uma atribuição **gulosa**; não há busca global ótima.\n")

L.append("## 6. O que NÃO foi possível testar sem papel real (nem sem Windows)\n")
L.append("* **Nenhum papel real.** Não testados: carimbos de protocolo sobre o texto, assinaturas e anotações manuscritas, grampos/furos/dobras, "
         "timbres e logomarcas coloridos, fotos coladas, escaneamento em cor, fax, texto muito claro, manuchas, folhas com verso transparente, "
         "pedidos de vereador manuscritos, DPIs variados e escâneres reais.")
L.append("* **Nenhum teste no Windows.** `INSTALAR.bat`/`instalar.ps1` (download do Python e do Tesseract, assinatura digital, instalação sem administrador), "
         "`AGENDAR_DIARIO.bat` (schtasks), `VIGIAR.bat`, o prefixo `\\\\?\\` para caminhos longos e pasta com espaço no fim "
         "(testados no Linux apenas com o equivalente funcional), bloqueio de arquivo \"em uso\" do Windows, SmartScreen e antivírus.")
L.append("* **Tesseract no Windows** (a instalação silenciosa pode exigir administrador; se falhar, cai no RapidOCR, mais lento e sem acentos).")
L.append("* **Escala real**: milhares de páginas em PC comum. Foram medidos apenas lotes de ~50 páginas (e a segmentação isolada com ~2.100 páginas "
         "sintéticas em ~1 minuto). Estimativa (não medida em PC real): Tesseract a 300 dpi ≈ 2–3 s/página/núcleo → 3.000 páginas em 4 núcleos ≈ 30–45 min.")
L.append("* **DPI 300 em escala**: os testes usaram 200 dpi (para ser rápido). O padrão do `config.yaml` é 300.")
L.append("* **Classificador por LLM** (gancho): testado só com a lógica, nunca com um LLM de verdade.")
L.append("* **Excel brasileiro** abrindo o CSV e o XLSX: seguem o formato (`;`, UTF-8 com BOM, vírgula decimal), mas não foram abertos no Excel.")
L.append("* **Integração com o Ômega**: o contrato foi escrito, mas o Ômega não existe nesta sessão para ler os arquivos.\n")

L.append("## 7. Testes automáticos (`pytest tests`)\n")
L.append("* `test_util.py`, `test_unidades.py`: regras sem OCR (campos, categorias, segmentação, reordenação, soltos, `_V2`, correções).")
L.append("* `test_e2e.py`: lote sintético completo com **pasta de entrada com espaço no fim**, **saída com acentos**, métricas mínimas, originais intactos, "
         "arquivos corrompido/protegido em `ERROS`, PDFs pesquisáveis, JSON ao lado, catálogo (CSV com BOM, XLSX com 5 abas, JSONL), `status.json`, idempotência.")
L.append("* `test_operacao.py`: `--simular` (não grava), `--amostra`, `--desfazer` (volta ao estado anterior e preserva arquivo editado), "
         "mover para PROCESSADOS, caminho de saída > 260 caracteres, erro numa página sem derrubar o lote.")
L.append("* `test_instalacao.py`: arquivos de entrega presentes, `.bat/.ps1` com CRLF, BOM no `.ps1`, configurações válidas.\n")

open(os.path.join(RAIZ, "QUALIDADE.md"), "w", encoding="utf-8").write("\n".join(L) + "\n")
print("QUALIDADE.md gerado")
