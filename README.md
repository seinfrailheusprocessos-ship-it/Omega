# Omega

Central de decisões da SEINFRA: um relatório interativo por objeto, que o usuário lê, decide e devolve ao Claude.
Roda só dentro do Claude, como artefato publicado (capacidades `db` e `downloads`).

- `COMO_USAR.md`: uso no dia a dia.
- `SCHEMA.md`: o que o Claude grava e lê no banco do artefato.
- `DECISOES.md`: decisões desta versão. `BACKLOG.md`: o que ficou para depois.
- `PIPELINE_SPEC.md`: contrato com os scripts de OCR e separação (sessão 2).
- `teste/`: testes no Chromium com um simulador do banco (`node teste/rodar.js`).

Só código e exemplos fictícios; nenhum dado de processo neste repositório.
