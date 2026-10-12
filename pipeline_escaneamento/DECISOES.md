# DECISÕES DE PROJETO

Onde o pedido era ambíguo, escolhi o padrão **mais seguro** e registrei aqui. Ordem: do que mais afeta o usuário ao detalhe técnico.

## A. Escolhas que mudam o comportamento

1. **Pasta do projeto.** O repositório já contém o aplicativo Ômega (JavaScript). Para não misturar, o pipeline fica na subpasta
   `pipeline_escaneamento/`, com seus próprios `DECISOES.md`, `LEIA-ME.md` etc. (o `DECISOES.md` da raiz é do Ômega).
2. **Copiar, não mover.** `mover_para_processados: false` por padrão. Com `true`, o original vai para `ESCANEADOS\PROCESSADOS\` e o `--desfazer` o devolve.
3. **Motor de OCR: Tesseract (por) preferido; RapidOCR como reserva.** Medi os dois nos sintéticos (ver `QUALIDADE.md`).
   O Tesseract é ~8 vezes mais rápido (≈1,7 s × 13,6 s por página a 200 dpi, por processo, medido), mantém acentos (importante para o texto pesquisável)
   e separa palavras; o RapidOCR (único que se instala só com `pip`, sem admin) **perde acentos e espaços** e erra mais a orientação —
   com ele, a separação correta cai de ~88% para ~50% nos sintéticos.
   Por isso o instalador **tenta** instalar o Tesseract (instalador oficial UB Mannheim, silencioso) e, se falhar, o programa segue com o RapidOCR e **avisa**.
   Alternativas só-pip (EasyOCR, PaddleOCR, docTR) não foram adotadas: exigem PyTorch/Paddle (>1 GB), o que contraria "computador comum, mínimo de etapas".
4. **`OFICIO_MP` x `MP` e `OFICIO_JUSTICA` x `JUSTICA`.** `MP`/`JUSTICA` = documento **emitido** pelo Ministério Público / Judiciário (decide o cabeçalho).
   `OFICIO_MP`/`OFICIO_JUSTICA` = ofício **da Prefeitura dirigido** ao MP/Juízo (decide o destinatário). `OFICIO_EXTERNO` = ofício municipal para outras entidades.
   Ofício que **chega** de empresa → `AUTORIZACAO` (se pede autorização) ou `ASSOCIACAO` (se vem de associação/sindicato); sem pista → `OUTROS`.
5. **Nome do arquivo.** `TIPO_ORGAO_NUMERO_DATA.pdf`. Ausentes: número `SN`, data `SD`, **órgão `SO`**, **tipo `DOC`** (os dois últimos são acréscimos meus, pois o pedido só previa SN/SD).
   Documento sem número próprio (intimação, decisão) usa os **20 dígitos do processo CNJ** no lugar do número (`usar_processo_como_numero`, desligável),
   porque só `SN` deixaria dezenas de arquivos com o mesmo nome. Número `123/2026` vira `123-2026`; data `DDMMAAAA`.
6. **Catálogo.** Uma única tabela `itens` guarda documentos, soltos, brancas e erros (coluna `status`). `data` no catálogo é **ISO** (`2026-10-12`) — melhor para máquinas;
   o nome do arquivo usa `DDMMAAAA`. `numero` fica `NNN-AAAA`.
7. **Sigla de órgão nova** ganha sigla provisória (primeiras duas palavras significativas, ex.: `CONSTRUTORA-ALFA`), é gravada em `orgaos_novos.csv`,
   mas **não** manda o documento para `REVISAR` (empresas e associações têm sigla "nova" quase sempre e inundariam a revisão). O motivo fica no JSON (`orgao_novo`).
8. **Limiares:** `AUTO` exige separação ≥ 0,70 e categoria ≥ 0,60. `OUTROS` sai com confiança 0,50 e portanto sempre vai para `REVISAR` (categoria genérica é "duvidosa" por definição).
   Documento com **páginas faltando** (numeração "Página X de Y" indica mais do que achado) sempre vai para `REVISAR`.
9. **Página solta em vez de chute.** Uma página de continuação só é anexada a um documento se a pontuação passar de 0,55 **e** a vantagem sobre o segundo candidato for ≥ 0,15.
   Caso contrário vai para `SOLTOS`, com a lista de documentos candidatos no JSON. Prefiro uma página solta a uma página no documento errado.
10. **Página em branco** é registrada (no catálogo, aba Soltos, e no mapa) mas não gera PDF (`copiar_paginas_brancas: false`). Branca = quase nenhuma "tinta" ou nenhum texto reconhecível numa página limpa.
11. **Segmentação por arquivo.** Cada arquivo escaneado é segmentado sozinho: documentos **não** são ligados entre arquivos diferentes (limitação conhecida).
12. **Simulação e calibração** gravam somente `_CATALOGO\simulacao\` e `_CATALOGO\calibracao\`; o OCR delas usa uma pasta temporária descartada e **não registra nada** no banco (um processamento real depois ainda faz todo o trabalho).
13. **--desfazer** usa o manifesto (`manifestos\run_*.jsonl`) da última execução **que criou algo**. Só apaga arquivo cujo SHA-256 continua igual ao registrado (se o usuário editou, mantém e avisa). Apaga também os registros do catálogo daquela execução, para os arquivos poderem ser reprocessados. Não apaga logs nem manifestos (trilha de auditoria).
14. **Duas execuções simultâneas** são impedidas por arquivo de trava `_CATALOGO\.trava` com "batimento" (expira em 3 min se o processo morrer; não uso PID porque `os.kill` no Windows é perigoso).
15. **Arquivo em uso** não é registrado como concluído (será tentado na próxima rodada) e aparece uma única vez na aba Erros. **Corrompido/protegido** é registrado com seu hash (não repete) e copiado para `ERROS\` com `.motivo.txt`; `--reprocessar-erros` tenta de novo.
16. **Correções (`correcoes.csv`)** ficam em `_CATALOGO\`. São aplicadas na geração (substituem o valor extraído, confiança 1.0). `--sugerir-regras` produz sugestões a partir delas (gancho da fase 2, **não altera nada sozinho**). Mover/renomear PDFs já gerados conforme correções **não** foi implementado.
17. **LLM opcional, desligado.** Gancho por **comando externo** (`PIPELINE_LLM_CMD`): recebe JSON no stdin (só 1.500 caracteres da 1ª página) e responde JSON. Assim o pipeline não embute nenhuma chave de API. Só é chamado quando a regra fica abaixo de `llm.confianca_minima_para_chamar`. **Não testado com um LLM real.**
18. **PDF de saída** = imagem **corrigida** (orientação e inclinação ajustadas, JPEG qualidade 75) + texto invisível. O original fica intacto; o `ORIGINAIS_OCR` é o lote com a mesma correção (decisão: um PDF girado de lado não serve para ninguém). Imagens de baixa resolução não são ampliadas (DPI efetivo = o do escaneamento, no mínimo 100).

## B. Método de classificação e separação

19. **Regras ponderadas** (`categorias.yaml`): soma de pesos por zona do documento (`cabecalho`, `titulo`, `destinatario`, `pagina1`, `ultima`, `doc`). A zona **cabeçalho** = linhas acima do título/endereçamento (quem **emite**); evita que um ofício "ao Ministério Público" seja tomado por documento do MP. Confiança = 55% força (pontos/6) + 45% margem sobre o 2º lugar. Tudo registrado em `motivo` e em `pontos_categorias`.
20. **Início de documento** = pontuação de cabeçalho institucional + título no começo da linha + CNJ no topo + campos De/Para/Assunto − (3,0 se a numeração diz "página > 1"). Limiar 2,0.
21. **Ligação de continuações** por pontuação entre página e documento: mesmo total em "Página X de Y", vaga livre, referência corrente (ex.: "CI 123/2026" no topo), vizinhança no arquivo e se o documento já tem assinatura, continuidade de frase, **estilo de numeração**, **cargo do assinante compatível com o cabeçalho** (juiz × Judiciário etc.), margem esquerda e tipografia parecidas, vocabulário em comum e distância no arquivo. Atribuição gulosa, uma página por vez, sempre a de maior certeza primeiro.
22. **Reordenação**: por numeração quando existe; senão, a página inicial primeiro e as demais na ordem do arquivo.
23. **Fim de documento** = bloco de assinatura (nome acima do cargo), data com cidade na metade de baixo ou carimbo de protocolo. "Atenciosamente" **sozinho não encerra** (a assinatura pode estar na página seguinte).
24. **Campos nunca inventados**: sem rótulo/padrão reconhecido, o campo fica vazio e a confiança é 0. O `objeto` é só uma frase do corpo com verbo de pedido (confiança baixa, 0,55).

## C. Técnicas e robustez

25. **Multiprocessamento com `spawn`** (como no Windows), não `fork`. Com `fork`, o OpenCV já carregado travava os processos (aconteceu nos testes: execução parada indefinidamente). Cada página é uma tarefa; o resultado é gravado em cache (`_CATALOGO\cache\<hash>\pNNNN.json/.jpg`) — é isso que permite **retomar** após queda. O cache é apagado quando o arquivo termina (`limpar_cache_apos_concluir`).
26. **Atomicidade**: cada arquivo escaneado é gravado numa transação; se algo falhar no meio, o banco volta atrás e os arquivos recém-criados são removidos; o arquivo vai para `ERROS`. Gravação em `.tmp` + troca.
27. **Caminhos difíceis (Windows).** Todo acesso passa por `caminho_longo()` (prefixo `\\?\`), o que permite pastas terminadas em espaço e caminhos > 260 caracteres. PDFs nesses caminhos são abertos pelos bytes (o MuPDF não garante o prefixo). O OCR recebe a imagem por *stdin* (evita problemas de acento no caminho temporário do Tesseract). Se a pasta configurada não existe, procura irmã igual ignorando espaço nas pontas. **Testado no Linux (espaço no fim, acentos, caminho > 260), mas o prefixo `\\?\` em si só pode ser verificado no Windows.**
28. **Orientação**: a projeção de linhas só define a **ordem** de tentativa; a decisão vem de uma leitura de teste em até 4 orientações (fração de palavras comuns do português + letras reconhecidas com confiança). Funciona também em página quase vazia (só assinatura). Inclinação por projeção (−6° a +6°).
29. **Pré-processamento para OCR**: a imagem é dividida pelo próprio fundo estimado (achata sombra/gradiente do scanner). Sem isso o Tesseract devolvia lixo em páginas com pouca tinta.
30. **Linha de numeração relida**: "Pág. 3/3" no rodapé é relida isolada e ampliada (o Tesseract às vezes lê "Pág. 33", e isso derruba a ligação das páginas).
31. **Instalador.** Python 3.12 oficial instalado **só para o usuário** (sem admin), com **verificação da assinatura digital** (Authenticode, "Python Software Foundation") antes de executar. Tesseract: instalador oficial UB Mannheim; o idioma português é copiado do instalador ou baixado de `tessdata_fast`. **Não fixei hashes SHA-256** dos downloads porque não consegui baixá-los na nuvem (rede restrita) para conferir; em vez disso há o **autoteste** no fim da instalação (gera documentos fictícios, processa e confere), que valida o resultado de ponta a ponta. **O instalador não pôde ser executado no Windows aqui.**
32. **Agendador**: `schtasks /SC DAILY` para o usuário atual (não exige admin; exige estar logado). Vigilância de pasta por varredura (sem dependência extra), espera o arquivo ficar estável.
33. **Dependências**: `pymupdf, numpy, opencv-python-headless, pillow, pyyaml, openpyxl, rapidocr-onnxruntime`; sem `pytesseract` (chamo o `tesseract` por subprocesso, com *stdin*).
34. **Sintéticos**: o gerador (`src/pipeline/sinteticos.py`) é do próprio projeto e usa fontes e layouts que **eu** escolhi. Cada documento recebe tipografia/margens próprias (modelos de emissores diferentes). Isso torna o teste mais realista do que uma fonte única, mas **continua otimista** em relação a papel real (ver `QUALIDADE.md`).
