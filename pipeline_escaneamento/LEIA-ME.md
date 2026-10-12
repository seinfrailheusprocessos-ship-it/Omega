# Pipeline de Escaneamento da SEINFRA (Ilhéus/BA)

Programa para Windows que pega PDFs escaneados em lote (páginas fora de ordem, vários documentos misturados),
**lê o texto (OCR)**, **separa cada documento**, **classifica**, **dá o nome certo**, **guarda na pasta da categoria**
e monta um **catálogo** (`CATALOGO.xlsx`) para você e para o Ômega.

Tudo roda **no seu computador, sem internet** (a internet só é usada uma vez, na instalação) e **sem custo**.
Os escaneados originais **nunca são apagados nem alterados**.

> **Importante, seja franco com o programa:** ele foi construído e testado só com documentos fictícios.
> Na primeira vez com papel de verdade, **use o CALIBRAR.bat** (passo 5) e confira o resultado antes de confiar.

---

## 1. O que você precisa

* Windows 10 ou 11.
* Internet **só durante a instalação** (uns 500 MB de download).
* Uns 5 GB livres em disco (mais, conforme o tamanho dos lotes).
* Uma pasta para o programa, de preferência **curta e sem acentos**. Exemplo:

```text
C:\Pipeline_SEINFRA
```

## 2. Instalar (uma única vez)

1. Descompacte o arquivo `pipeline_escaneamento.zip` dentro de `C:\Pipeline_SEINFRA`
   (botão direito no .zip → **Extrair tudo...**). Deve ficar assim:

```text
C:\Pipeline_SEINFRA\INSTALAR.bat
C:\Pipeline_SEINFRA\PROCESSAR.bat
C:\Pipeline_SEINFRA\config\config.yaml
```

2. Dê **duplo clique** em `INSTALAR.bat`.
3. Se o Windows mostrar "O Windows protegeu o computador" (SmartScreen): clique em **Mais informações** → **Executar assim mesmo**.
4. Se aparecer uma pergunta "Deseja permitir que este aplicativo faça alterações?", clique em **Sim**.
5. Espere. A janela mostra cinco passos (Python, pacotes, Tesseract, pastas, teste). Leva de 5 a 15 minutos.
6. No fim deve aparecer **TUDO PRONTO** e **INSTALACAO CONCLUIDA COM SUCESSO**. Se aparecer problema, abra o arquivo
   `instalacao_log.txt` (na mesma pasta) e mande o conteúdo para quem dá suporte.

> **Tesseract (leitor de texto principal).** O instalador tenta instalá-lo sozinho (pelo instalador oficial e, se falhar, pelo `winget`).
> Se o Windows pedir permissão, clique em **Sim**. Se ele **não** conseguir instalar, o programa usa o leitor reserva **RapidOCR**,
> que é cerca de **8 vezes mais lento**, **perde os acentos** e **erra muito mais a separação dos documentos**
> (nos testes com documentos fictícios: ~50% de acerto contra ~88% do Tesseract). O instalador avisa em letras grandes
> quando isso acontece. Nesse caso, instale o Tesseract à mão: baixe o instalador "Tesseract at UB Mannheim" (Windows 64 bits),
> instale com o idioma **Portuguese** marcado, e rode `INSTALAR.bat` de novo.

## 3. Onde ficam as coisas

| O quê | Onde |
|---|---|
| Colocar os escaneados novos | `C:\CL_ENTRADA\ESCANEADOS\` |
| Resultado | `C:\CL\6_Pipeline\` |
| Catálogo (abra no Excel) | `C:\CL\6_Pipeline\_CATALOGO\CATALOGO.xlsx` |
| Andamento (barra de progresso) | `C:\CL\6_Pipeline\_CATALOGO\progresso.txt` |

Pode ter subpastas dentro de `ESCANEADOS`. Aceita `.pdf`, `.jpg`, `.png` e `.tif`.
Se você quiser outros caminhos, veja o item 9.

Dentro de `C:\CL\6_Pipeline\`:

```text
SAIDACI\                 CIs (um PDF pesquisável por documento, já com o nome final)
SAIDAOFICIO_EXTERNO\
SAIDAOFICIO_MP\
SAIDAOFICIO_JUSTICA\
SAIDAPEDIDO_VEREADOR\
SAIDAMP\
SAIDAJUSTICA\
SAIDAAUTORIZACAO\
SAIDAASSOCIACAO\
SAIDAOUTROS\
REVISAR\                 documentos em que o programa ficou na dúvida: CONFIRA ESTES
SOLTOS\                  páginas que não deu para ligar a nenhum documento
ORIGINAIS_OCR\           o PDF do lote inteiro, com texto pesquisável + mapa de páginas
ERROS\                   arquivos com problema (corrompido, com senha, em uso) + o motivo
_CATALOGO\               catálogo, logs, andamento
```

Exemplo de nome de arquivo gerado:

```text
CI_SEDUC_123-2026_12102026.pdf
```

`CI` = tipo, `SEDUC` = órgão que enviou, `123-2026` = número/ano, `12102026` = data (12/10/2026).
`SN` = sem número, `SD` = sem data, `SO` = sem órgão. Se o nome já existir, ganha `_V2`, `_V3`.

## 4. Uso diário (2 cliques)

1. Coloque os PDFs escaneados em `C:\CL_ENTRADA\ESCANEADOS\`.
2. Dê duplo clique em `PROCESSAR.bat`.
3. Acompanhe, se quiser, abrindo `C:\CL\6_Pipeline\_CATALOGO\progresso.txt`.
4. Ao terminar, abra `C:\CL\6_Pipeline\_CATALOGO\CATALOGO.xlsx`.

Só o que é **novo** é processado. Rodar de novo no mesmo arquivo não repete nada.
Se o computador desligar no meio, é só dar duplo clique em `PROCESSAR.bat` outra vez: ele continua de onde parou.

## 5. A primeira rodada com papel de verdade (importante)

1. Coloque **poucos** escaneados reais em `C:\CL_ENTRADA\ESCANEADOS\`.
2. Dê duplo clique em `CALIBRAR.bat`, digite `30` e aperte Enter. Ele lê só as 30 primeiras páginas e **não move nada**.
3. Abra o relatório em:

```text
C:\CL\6_Pipeline\_CATALOGO\calibracao\
```

   (o arquivo termina em `.md`; abra com o Bloco de Notas). Ele mostra quantos documentos achou, a confiança,
   quais campos ficaram vazios, quais siglas de órgão são novas e quais páginas ficaram soltas.
4. Dê duplo clique em `SIMULAR.bat` para ver o plano completo (nomes, pastas) sem criar documentos.
5. Se estiver razoável, rode `PROCESSAR.bat`. Se algo ficar ruim, `DESFAZER.bat` (item 7) e ajuste as regras (item 9).

## 6. Como ler o catálogo

Abra `CATALOGO.xlsx`. Abas:

* **Resumo**: totais por situação, por categoria e por arquivo.
* **Documentos**: um por linha, com tipo, órgão, número, data, assunto, destinatário, signatário, processo, objeto.
* **Revisar**: o que o programa não tem certeza (veja a coluna `motivo`).
* **Soltos**: páginas que não foram atribuídas a nenhum documento (e as páginas em branco).
* **Erros**: arquivos que não foram lidos.

Situações (`status`): `AUTO` (confiou), `REVISAR` (confira), `SOLTO`, `ERRO`.
As colunas `confianca_separacao` e `confianca_categoria` vão de 0 a 1 (use ponto/vírgula do seu Excel).
A coluna `motivo` explica por que o programa decidiu assim.

Também existe `catalogo.csv` (abre direto no Excel, separado por ponto e vírgula) e `catalogo.jsonl` (para outros programas, como o Ômega).
Ao lado de cada PDF há um `.json` com todos os campos e a confiança de cada um.

## 7. Desfazer a última execução

Dê duplo clique em `DESFAZER.bat`, digite `SIM`. Ele apaga **somente** o que a última execução do `PROCESSAR.bat` criou
(se você alterou algum desses arquivos depois, ele o **mantém**). Os escaneados originais não são tocados.
Depois você pode rodar `PROCESSAR.bat` de novo.

## 8. Rotina diária automática

* `AGENDAR_DIARIO.bat` cria uma tarefa no Agendador do Windows: escolha `1`, digite a hora (ex.: `18:00`).
  O computador precisa estar ligado e com você logado nessa hora. Para remover, rode de novo e escolha `2`.
* `VIGIAR.bat` (opcional): deixa uma janela aberta que processa sozinha quando chegam arquivos novos na pasta de entrada.

## 9. Ajustes (editáveis com o Bloco de Notas)

Pasta `C:\Pipeline_SEINFRA\config\`:

* `config.yaml` — caminhos de entrada e saída, DPI, limites de confiança, se move os originais, etc.
  Para mudar a pasta de entrada, troque a linha `entrada:` (mantenha as aspas e as barras duplas):

```yaml
entrada: "C:\\CL_ENTRADA\\ESCANEADOS"
saida: "C:\\CL\\6_Pipeline"
mover_para_processados: false
```

* `categorias.yaml` — as regras de classificação (palavras e pesos). Cada regra soma pontos; vence a categoria
  com mais pontos. É assim que você "ensina" o programa depois da calibração.
* `orgaos.yaml` — as siglas dos órgãos (ex.: `SEDUC`). Siglas novas aparecem em
  `C:\CL\6_Pipeline\_CATALOGO\orgaos_novos.csv`: copie para o `orgaos.yaml`.
* Correções: para corrigir um documento, o Ômega (ou você) acrescenta uma linha em
  `C:\CL\6_Pipeline\_CATALOGO\correcoes.csv`. Veja `CONTRATO_OMEGA.md`.

Depois de mudar uma regra, para reaplicar nos mesmos escaneados: `DESFAZER.bat` e depois `PROCESSAR.bat`.

Se você marcar `mover_para_processados: true`, depois de processar cada arquivo ele é **movido** para
`C:\CL_ENTRADA\ESCANEADOS\PROCESSADOS\` (o `DESFAZER.bat` devolve). Por padrão ele só **copia** (mais seguro).

## 10. Problemas comuns

| Sintoma | O que fazer |
|---|---|
| "O programa ainda não foi instalado" | Rode `INSTALAR.bat`. |
| SmartScreen bloqueia o `.bat` | **Mais informações → Executar assim mesmo**. |
| Antivírus reclama do instalador | O instalador baixa o Python oficial (python.org) e o Tesseract. Libere a pasta `C:\Pipeline_SEINFRA`. |
| "Já existe outro processamento em andamento" | Espere terminar (veja `progresso.txt`). Se travou de vez, aguarde 3 minutos e rode de novo. |
| Arquivo na pasta `ERROS` com `.motivo.txt` | Abra o `.motivo.txt`. Corrompido: escaneie de novo. Com senha: tire a senha. Em uso: feche o programa que está com ele aberto; será tentado de novo. |
| Muitos documentos em `REVISAR` | Normal na primeira rodada. Use o relatório de calibração e ajuste `categorias.yaml`. |
| Páginas em `SOLTOS` com "continuação ... sem documento" | A primeira página desse documento não estava no lote (ou veio ilegível). |
| Demora muito | Lotes de milhares de páginas levam horas em computador comum. Veja o tempo restante em `progresso.txt`. Com o Tesseract é cerca de 8 vezes mais rápido que com o leitor reserva. |
| Nome de pasta com espaço no fim (ex.: `ESCANEADOS `) | O programa acha sozinho a pasta mesmo se você digitar sem o espaço. |

## 11. Privacidade

Nada sai do seu computador. O recurso opcional de classificação por LLM vem **desligado**. Para ligá-lo (só se um dia
quiser, e sabendo que o início do texto de cada documento seria enviado ao serviço escolhido), defina a variável de ambiente
`PIPELINE_LLM_CMD` com um comando que leia JSON na entrada e responda `{"categoria": "...", "confianca": 0.9}`,
e mude `llm: ativo: true` no `config.yaml`.

## 12. Comandos avançados (para quem dá suporte)

Dentro de `C:\Pipeline_SEINFRA`, em um terminal:

```text
_rodar.bat --simular
_rodar.bat --amostra 30
_rodar.bat --desfazer
_rodar.bat --exportar
_rodar.bat --sugerir-regras
_rodar.bat --autoteste
_rodar.bat --gerar-sinteticos C:\teste_sinteticos
_rodar.bat --reprocessar-erros
_rodar.bat --motor rapidocr
```

Testes automáticos (instalam o pytest primeiro):

```text
.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.venv\Scripts\python.exe -m pytest tests
```

Os números medidos e o que NÃO foi possível testar sem papel real estão em `QUALIDADE.md`.
As decisões de projeto estão em `DECISOES.md` e o formato para o Ômega em `CONTRATO_OMEGA.md`.
