# Pipeline de escaneamento (sessão 2) — contrato com o Omega

O Omega não faz OCR. Os scripts rodam no computador por ordem do Claude; o resultado chega ao Omega pelo banco do artefato.

## O script
1. Recebe o PDF em bloco, faz OCR e guarda o bloco original com OCR.
2. Detecta cada documento pelo título e pelo fecho (assinatura, cargo, data) e separa do título ao fecho.
3. Guarda por tipo (CI, OFICIO, …); o que não tiver título e fecho claros vai para uma pasta só de soltos.
4. Nome: maiúsculas, partes com `_`, sem "N." e sem barra, data sem parênteses. Ex.: `CI_SEDUC_045-2026_12-10-2026.pdf`.

## O que o Claude grava no Omega
`pipeline/<lote>` (ver `SCHEMA.md`): origem, data e a lista de arquivos com `arquivo`, `tipo`, `destino`, `status` (`ok`, `revisar_nome`, `pasta_duvidosa`, `solto`), `paginas` e `confianca`.

## O que volta
O usuário revisa na tela "Revisão da separação": Aprovar (mantém arquivado), Editar (nome, pasta, observação) ou Separar de novo na Mesa PDF. Fica em `revisao/<lote>`, que o Claude lê para renomear ou mover.
