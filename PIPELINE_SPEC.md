# Pipeline de escaneamento (Sessão 2) — contrato com o Omega

O Omega **não faz OCR**: ele só dispara os seus scripts (cadastrados em `dados/config.json`) e mostra o resultado. Esta página diz o que o script deve entregar para a **Revisão** do Omega funcionar. (Sessão 1 = interface, já pronta; Sessão 2 = estes scripts.)

## O que o script faz
1. Recebe um PDF em bloco (`{arquivo}`), faz OCR e grava o bloco original com OCR (`BLOCO_N_ORIGINAL.pdf`).
2. Detecta o tipo de cada documento (CI, ofício, nota técnica…) achando o **título** e o **fecho** (assinatura, cargo do signatário, data). Do título ao fecho, separa um arquivo.
3. Guarda cada documento numa pasta do seu tipo (`CI/`, `OFICIO/`…). O que não tiver título/fecho claro vai para `SOLTOS/` (uma pasta só).
4. Renomeia: **tudo maiúsculo, partes com underline, sem "N." nem barra, data sem parênteses**. Ex.: `CI_SEDUC_045-2026_12-10-2026.pdf` (número `045/2026` vira `045-2026`; data `dd-mm-aaaa`).
5. Grava `_pipeline.json` na pasta de saída (formato abaixo) e um README.md da ficha.

## `_pipeline.json` (o Omega lê para mostrar tipo, páginas e título→fecho)
```json
{
  "origem": "BLOCO_1.pdf",
  "docs": [
    { "arquivo": "CI_SEDUC_045-2026_12-10-2026.pdf", "tipo": "CI", "paginas": "2-3",
      "titulo": "COMUNICAÇÃO INTERNA", "fecho": "Cargo do Signatário, 12/10", "confianca": 0.97 }
  ]
}
```
Campos obrigatórios: `arquivo`. O resto é opcional. `confianca` baixa deve cair em `SOLTOS/`.

## Revisão no Omega
O Lucas abre a pasta (objeto → "Revisar PDFs separados") e, para cada arquivo, escolhe **Arquivado** (sem ação pendente), **Corrigir** (muda o nome ou refaz pela Mesa PDF) ou **Responder** (cadastra como recebido e abre o documento de resposta). O que ele decidir volta no "Copiar relatório" em `## Revisão de arquivos`.

## Como o Omega chama o script (`dados/config.json`)
```json
{ "id": "ocr", "nome": "OCR e separação", "aplicaA": "arquivo", "extensoes": [".pdf"],
  "comando": ["python", "C:\\CL\\_Executar\\separar.py", "{arquivo}"] }
```
`{arquivo}`, `{pasta}` e `{nome}` são trocados pelo caminho escolhido. Saída do script (stdout/stderr) aparece numa janela.
