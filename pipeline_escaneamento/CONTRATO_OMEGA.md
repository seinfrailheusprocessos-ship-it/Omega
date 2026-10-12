# CONTRATO COM O ÔMEGA

Este documento descreve **o que o Pipeline de Escaneamento entrega** e **como o Ômega deve ler e corrigir**.
O Ômega nunca precisa ler o conteúdo bruto dos escaneados: tudo o que ele precisa para abrir um documento
e sugerir o encaminhamento já vem pré-extraído no catálogo e no JSON de cada documento.

Versão do contrato: **1** (campo `contrato_versao` em cada registro).
Mudanças que quebrem compatibilidade aumentam esse número.

---

## 1. Onde ficam as coisas

Raiz de saída (configurável em `config\config.yaml`, chave `saida`; padrão `C:\CL\6_Pipeline\`):

```text
C:\CL\6_Pipeline\
├── SAIDACI\                 um PDF pesquisável por documento (+ .json ao lado)
├── SAIDAOFICIO_EXTERNO\
├── SAIDAOFICIO_MP\
├── SAIDAOFICIO_JUSTICA\
├── SAIDAPEDIDO_VEREADOR\
├── SAIDAMP\
├── SAIDAJUSTICA\
├── SAIDAAUTORIZACAO\
├── SAIDAASSOCIACAO\
├── SAIDAOUTROS\
├── REVISAR\                 documentos de baixa confiança (separação ou categoria duvidosa)
├── SOLTOS\                  páginas/blocos que não puderam ser atribuídos a um documento
├── ORIGINAIS_OCR\           PDF do lote inteiro com camada de texto + .mapa.json
├── ERROS\                   arquivos corrompidos/protegidos/em uso, com .motivo.txt
└── _CATALOGO\
    ├── catalogo.sqlite      banco (fonte da verdade)
    ├── catalogo.jsonl       contrato para máquinas: 1 registro por linha
    ├── catalogo.csv         ponto e vírgula, UTF-8 com BOM (abre no Excel)
    ├── CATALOGO.xlsx        abas Resumo, Documentos, Soltos, Revisar, Erros
    ├── correcoes.csv        correções feitas pelo Ômega/usuário (ver seção 5)
    ├── status.json          andamento da execução (ver seção 6)
    ├── progresso.txt        barra de progresso legível
    ├── orgaos_novos.csv     siglas provisórias a revisar
    ├── textos\texto000123.txt   OCR do documento 123
    ├── manifestos\          registro do que cada execução criou (usado pelo --desfazer)
    ├── logs\  simulacao\  calibracao\
```

Os nomes das pastas de categoria vêm de `config\categorias.yaml` (campo `pasta`). **O Ômega deve usar
`caminho_final` do catálogo e nunca montar caminhos por conta própria.**

## 2. Catálogo (`catalogo.sqlite`, tabela `itens`; mesmas colunas no CSV/XLSX/JSONL)

Uma linha por **documento**, por **bloco de páginas soltas**, por **página em branco** ou por **erro**.

| coluna | tipo | significado |
|---|---|---|
| `id` | inteiro | identificador estável do item (também no nome `texto<id>.txt`) |
| `arquivo_origem` | texto | caminho do escaneado, relativo à pasta de entrada |
| `hash_origem` | texto | SHA-256 do arquivo escaneado original |
| `paginas_origem` | texto | páginas do arquivo de origem, 1-based, ex.: `12-14` ou `1-2,5` (na ordem em que o documento foi remontado, a ordem exata está no JSON, `paginas_lista`) |
| `n_paginas` | inteiro | quantas páginas tem o documento |
| `categoria` | texto | `CI`, `OFICIO_EXTERNO`, `OFICIO_MP`, `OFICIO_JUSTICA`, `PEDIDO_VEREADOR`, `MP`, `JUSTICA`, `AUTORIZACAO`, `ASSOCIACAO`, `OUTROS` (lista editável) |
| `tipo` | texto | tipo do documento: `CI`, `OFICIO`, `MEMORANDO`, `REQUERIMENTO`, `INDICACAO`, `NOTIFICACAO`, `RECOMENDACAO`, `DESPACHO`, `DECISAO`, `INTIMACAO`, `SENTENCA`, `PORTARIA`, `DECLARACAO`, `CERTIDAO`, `ATA`, `PARECER`, `RELATORIO` ou vazio |
| `orgao` | texto | sigla do órgão **emissor** (`SEDUC`, `MPBA`, `TJBA`, `CMI`...). Sigla nova vem provisória (ex.: `CONSTRUTORA-ALFA`) |
| `numero` | texto | número do documento no formato `NNN-AAAA` (hífen no lugar da barra). Vazio se não achado |
| `data` | texto | data do documento em **ISO** `AAAA-MM-DD`. Vazio se não achada |
| `assunto` | texto | linha "Assunto/Ref." |
| `destinatario` | texto | para quem o documento é dirigido |
| `signatario_nome` / `signatario_cargo` | texto | quem assina |
| `processo` | texto | nº do processo: CNJ (`0001234-56.2026.8.05.0103`), do MP (`003.0.123456/2026`) ou administrativo |
| `objeto` | texto | primeira frase do corpo que indica o pedido/informação (limitada a 300 caracteres) |
| `confianca_separacao` | 0–1 | certeza de que as páginas do documento estão certas e completas |
| `confianca_categoria` | 0–1 | certeza da categoria |
| `motivo` | texto | por que o pipeline decidiu assim (auditável) |
| `status` | texto | `AUTO`, `REVISAR`, `SOLTO` ou `ERRO` |
| `caminho_final` | texto | caminho absoluto do PDF (vazio em brancas e erros sem cópia) |
| `nome_final` | texto | nome do PDF, ex.: `CI_SEDUC_123-2026_12102026.pdf` |
| `caminho_texto` | texto | caminho do `texto<id>.txt` |
| `processo_tipo` | texto | `CNJ`, `MP`, `ADMINISTRATIVO` ou vazio *(extra)* |
| `caminho_origem`, `caminho_json`, `run_id`, `criado_em` | | *(extras)* |
| `campos_json` / `campos` (no JSONL) | JSON | cada campo com `valor`, `confianca`, `origem` |

**Regras que o Ômega pode assumir**

* Campo não encontrado = vazio (`null` no JSON, `""` no CSV). **O pipeline nunca inventa valor.**
* `status = AUTO`: confianças acima dos limiares de `config.yaml`. `REVISAR`: algum limiar não foi atingido,
  faltam páginas (a numeração "Página X de Y" indica mais páginas do que as achadas) etc. — o motivo está em `motivo`.
* Para `SOLTO`, o JSON traz `candidatos` (ids de documentos que podem ser donos da página) quando existirem.
* O nome do arquivo é **tipo_órgão_número_data**: `SN` = sem número, `SD` = sem data, `SO` = sem órgão,
  `DOC` = sem tipo; colisão ganha `_V2`, `_V3`. Intimações/decisões sem número próprio usam os 20 dígitos do processo no lugar do número.

## 3. JSON de cada documento (ao lado do PDF, mesmo nome, extensão `.json`)

```json
{
  "contrato_versao": 1,
  "versao_pipeline": "1.0.0",
  "id": 123,
  "status": "AUTO",
  "arquivo_origem": "lote_2026-10-12.pdf",
  "hash_origem": "3da89c5e…",
  "paginas_origem": "12-14",
  "paginas_lista": [12, 13, 14],
  "n_paginas": 3,
  "categoria": "CI",
  "confianca_categoria": 0.94,
  "motivo_categoria": "CI=14.5 pontos [titulo_comunicacao_interna (+6); …]; 2º lugar: OFICIO_EXTERNO=2",
  "pontos_categorias": {"CI": 14.5, "OFICIO_EXTERNO": 2.0, "…": 0},
  "confianca_separacao": 1.0,
  "motivo_separacao": "início: cabeçalho institucional (3.5), título CI (2.0); 3 de 3 páginas conferidas pela numeração",
  "motivo_revisao": "",
  "campos": {
    "tipo":            {"valor": "CI",        "confianca": 0.95, "origem": "título"},
    "orgao":           {"valor": "SEDUC",     "confianca": 0.90, "origem": "cabeçalho: …"},
    "numero":          {"valor": "123-2026",  "confianca": 0.92, "origem": "linha do título"},
    "data":            {"valor": "2026-10-12","confianca": 0.90, "origem": "linha de data"},
    "assunto":         {"valor": "…",         "confianca": 0.85, "origem": "rótulo 'Assunto'"},
    "destinatario":    {"valor": "…",         "confianca": 0.90, "origem": "rótulo 'Para'"},
    "signatario_nome": {"valor": "…",         "confianca": 0.80, "origem": "acima do cargo"},
    "signatario_cargo":{"valor": "…",         "confianca": 0.85, "origem": "linha de cargo"},
    "processo":        {"valor": null,        "confianca": 0.0,  "origem": ""},
    "objeto":          {"valor": "…",         "confianca": 0.55, "origem": "primeira frase com verbo de pedido/informação"}
  },
  "processo_tipo": null,
  "orgao_novo": false,
  "faltam_paginas": false,
  "nome_final": "CI_SEDUC_123-2026_12102026.pdf",
  "caminho_final": "C:\\CL\\6_Pipeline\\SAIDACI\\CI_SEDUC_123-2026_12102026.pdf",
  "caminho_texto": "C:\\CL\\6_Pipeline\\_CATALOGO\\textos\\texto000123.txt",
  "gerado_em": "2026-10-12T15:30:00"
}
```

JSON de página solta: `contrato_versao`, `id`, `status: "SOLTO"`, `arquivo_origem`, `hash_origem`, `paginas_origem`,
`motivo`, `candidatos: [{"id": 120, "pagina_ancora": 5}]`, `caminho_final`, `caminho_texto`.

`ORIGINAIS_OCR\<arquivo>__<hash8>_OCR.mapa.json` diz, página a página, o que aconteceu com cada página do lote:
`estado` = `DOCUMENTO` (com `id` e `ordem_no_documento`), `SOLTO`, `BRANCA` ou `ERRO`.

## 4. Como o Ômega usa isto (sugestão de fluxo)

1. Ler `catalogo.jsonl` (ou o SQLite, **somente leitura**) e filtrar `status` ∈ {`AUTO`,`REVISAR`}.
2. Para cada documento, abrir o PDF em `caminho_final` e pré-preencher o cabeçalho com `assunto`, `orgao`,
   `destinatario`, `objeto`, `signatario_nome/cargo`, `processo`, `numero`, `data`.
3. Sugerir o encaminhamento pela `categoria`: `CI` → CI (para projeto / geral), `OFICIO_EXTERNO` → ofício externo geral,
   `OFICIO_JUSTICA` → ofício para Justiça, `OFICIO_MP` → ofício para MP, `PEDIDO_VEREADOR`, `MP`, `JUSTICA`,
   `AUTORIZACAO`, `ASSOCIACAO`, `OUTROS`. Documentos `REVISAR` devem ser mostrados com destaque.
4. **Não escrever** nas pastas de saída nem no SQLite. Para corrigir, usar `correcoes.csv` (seção 5).

## 5. Como o Ômega registra correções

Arquivo `_CATALOGO\correcoes.csv`, **acrescentar linhas** (nunca reescrever o arquivo), CSV com `;`, UTF-8 (com BOM só no cabeçalho original):

```text
id;hash_origem;paginas_origem;campo;valor_antigo;valor_novo;data;usuario
123;3da89c5e…;12-14;categoria;OFICIO_EXTERNO;OFICIO_JUSTICA;2026-10-12T15:40:00;maria
123;3da89c5e…;12-14;assunto;;Pedido de vistoria na Rua X;2026-10-12T15:41:00;maria
```

* `campo` é uma destas colunas: `categoria`, `tipo`, `orgao`, `numero`, `data` (ISO), `assunto`, `destinatario`,
  `signatario_nome`, `signatario_cargo`, `processo`, `objeto`.
* A chave do documento é `hash_origem` + `paginas_origem` (estável, não depende do `id`).
* Usos pelo pipeline:
  1. **Reprocessamento**: se o documento for gerado de novo (por exemplo após `DESFAZER.bat`), o valor corrigido
     substitui o extraído e a confiança passa a 1.0 (`correção manual` em `origem`).
  2. **Ajuste de regras (gancho da fase 2)**: `python -m pipeline --sugerir-regras` lê as correções de
     `categoria` e escreve `_CATALOGO\sugestoes_regras.md` com linhas frequentes do cabeçalho dos documentos
     corrigidos, já no formato de regra do `categorias.yaml`. Nada é alterado automaticamente.
* O pipeline **não move** PDFs já gerados quando chega uma correção (para o Ômega isso é irrelevante: ele
  trabalha a partir de `caminho_final` e do valor corrigido). Mover/renomear os arquivos conforme as correções é
  trabalho da fase 2.

## 6. Acompanhamento sem ler documentos (`status.json`)

Atualizado a cada ~3 s durante a execução (e `progresso.txt` com a barra). Outro Claude pode ler **só** este arquivo
e o catálogo:

```json
{
  "etapa": "Lendo páginas (OCR)", "percentual": 42.0, "paginas_total": 1200, "paginas_feitas": 504,
  "arquivos_total": 8, "arquivos_feitos": 3, "documentos": 140,
  "por_categoria": {"CI": 70, "MP": 20}, "por_status": {"AUTO": 120, "REVISAR": 20, "SOLTO": 12},
  "tempo_restante_s": 780, "em_andamento": true, "arquivo_atual": "lote_03.pdf",
  "ultimos_erros": ["12:03:11 lote_04.pdf: PDF protegido por senha"], "iniciado_em": "…", "atualizado_em": "…"
}
```

`em_andamento: false` e `etapa: "Concluído"` indicam fim normal.

## 7. Garantias

* Os escaneados originais **nunca** são alterados, apagados ou sobrescritos (por padrão são copiados; a opção
  `mover_para_processados` só os move para `PROCESSADOS`, e o `--desfazer` os devolve).
* O processamento é **idempotente**: o SHA-256 de cada arquivo fica registrado; rodar de novo não repete trabalho.
* Os arquivos finais nunca sobrescrevem outros: colisão vira `_V2`, `_V3`.
