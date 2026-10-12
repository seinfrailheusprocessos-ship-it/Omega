# Omega — formato dos dados no banco do artefato

O Omega roda só dentro do Claude, como artefato publicado com as capacidades `db` e `downloads`.
O Claude grava e lê pelo `ArtifactData` (no artefato `Omega`; o artefato de teste tem banco próprio).

| Caminho | Quem escreve | O que é |
|---|---|---|
| `relatorios/<id>` | Claude | `{ json: "<relatório em texto JSON>", rev }` |
| `decisoes/<id>` | Omega | decisões, comentários e o texto de retorno pronto (`texto`) |
| `config/pastas` | Claude | nomes e README das pastas numeradas |
| `config/brasao` | Omega ou Claude | `{ url: "data:image/png;base64,…", w, h }` |
| `pipeline/<lote>` | Claude (resultado do script) | lote de PDFs separados para revisar |
| `revisao/<lote>` | Omega | aprovações e correções do lote |
| `extracoes/<id>` | Omega | arquivo extraído na Mesa PDF e o destino escolhido |

O Claude lê **só** `decisoes/<id>` para saber o que foi decidido. O campo `texto` já vem no formato do "Copiar relatório".

## Relatório (`relatorios/<id>.json`)

```json
{
  "id": "canal-malhado-mp",
  "rev": 4,
  "numero": "3.1.1",
  "titulo": "Canal do Malhado – Requisição MP",
  "nome": "Canal do Malhado – MP",
  "pasta": { "rotulo": "Canal do Malhado", "caminho": "C:\\CL\\…", "drive": "" },
  "conversa": "https://claude.ai/chat/…",
  "readme": "Memorial descritivo / ficha central do objeto",
  "prazos": [ { "titulo": "Prazo do MP (Ofício 114/2026)", "data": "2026-10-23", "tipo": "oficio" } ],
  "atualizado": "2026-10-12T14:32:00-03:00",
  "secoes": [ … ]
}
```

- `id`: não muda entre levas. É a chave do documento `decisoes/<id>`.
- `rev`: sobe a cada leva. O Omega mantém as escolhas de cada item com o mesmo `num` e passa a contar como "desta leva" só o que for tocado depois.
- `numero`: **código** do objeto na hierarquia numérica das pastas (ex.: `3.1.1` fica dentro de `3.1`, que fica dentro de `3`). É o mesmo código no PDF, no relatório e na conversa. Sem código, o relatório aparece em "Sem código".
- `nome`: nome curto para as listas (padrão: `pasta.rotulo` ou `titulo`).
- `conversa`: link da conversa do objeto (opcional). O usuário também pode colar o link no Omega; o que ele colar fica em `decisoes/<id>.conversa`.
- `readme`: ficha do objeto (aparece recolhida no topo do relatório, com o caminho da pasta).
- `prazos`: aparecem no Início, ordenados por dias restantes; `tipo: "oficio"` passa na frente em empate.
- `exemplo: true` marca relatório de demonstração.

### Seção de itens

```json
{ "num": "2", "titulo": "Providências ao MP", "itens": [ … ] }
```

| Campo do item | O que é |
|---|---|
| `num` | número único (`"2.1"`). Chave da escolha entre levas |
| `tipo` | `acao` (A fazer, Feito, Ignorar, Não consegui), `decisao` (`opcoes` do item, ou Aguardando, Seguir, Ignorar), `info` (só leitura, com chip opcional Ciente / Dúvida) |
| `titulo`, `texto` | título e texto curto |
| `opcoes` | escolhas da decisão (o usuário também pode escrever uma opção própria) |
| `valor` | valor inicial |
| `dependeDe`, `bloqueia` | listas de `num`; item bloqueado fica esmaecido com "Aguardando o item de que depende" |
| `caminhos` | caminhos ou endereços; cada um ganha botão Copiar (endereço vira link) |
| `tabela` | `{ colunas: [{nome}], linhas: [[…]] }`; célula pode ser texto, `{ "chip": { "valor", "opcoes" } }` ou `{ "caminho": "…" }`. Uma linha com "Total" vira linha de total. No celular a tabela vira cartões |

### Seção de texto (documento com bolinhas)

```json
{ "num": "4", "titulo": "Minuta do ofício", "tipo": "texto",
  "documento": { "tipo": "Ofício", "destinatario": "Ao Ministério Público do Estado da Bahia\nPromotoria de Justiça de Ilhéus",
                 "assunto": "Resposta ao Ofício nº 114/2026 – Canal do Malhado.", "numero": "",
                 "signatarios": [ { "nome": "Nome do Signatário", "cargo": "Cargo do Signatário" } ] },
  "capitulos": [ { "num": "I", "titulo": "DOS FATOS",
    "paragrafos": [ { "id": "4.1", "texto": "…", "situacao": "vermelho" } ] } ] }
```

- `situacao`: `vermelho` (pendente), `verde` (aprovado), `azul` (ajustar). Documento só fica verde com todos os parágrafos verdes.
- `documento` (opcional) define o padrão oficial da prévia e do PDF: `tipo` = `Ofício`, `Comunicação interna (CI)`, `Despacho`, `Nota técnica`, `Portaria` ou `Documento` (licitação: título = título da seção, capítulos numerados). Despacho usa `assunto`, `emissor`, `destinatario`, `objeto` (quadro em fonte 10) e `processo`. Em Ofício, CI e Despacho os títulos de capítulo não saem no documento, a menos que `"capitulos": true`.
- Nunca escrever o nome do usuário: usar "Nome do Signatário" e "Cargo do Signatário".

## Decisões (`decisoes/<id>`, escrito pelo Omega)

```json
{ "id": "canal-malhado-mp", "rev": 4, "titulo": "…", "numero": "3.1.1", "atualizado": "2026-10-12T17:35:02Z",
  "texto": "[OMEGA] 3.1.1 Canal do Malhado – MP · relatório canal-malhado-mp rev 4 | 12/10/2026 17:35\n\n## 2 Providências ao MP\n\n2.2 [Escolheu] opção A: \"ofício\" — comentário: …\n",
  "foco": { "t": "I", "num": "2.2" },
  "conversa": "https://claude.ai/chat/…",
  "st": { "I:2.2": { "v": "Ofício", "obs": "…", "t": 1760290502000, "rev": 4, … } },
  "entrada": [ … ], "notasGeral": [] }
```

- Chaves de `st`: `I:<num>` (item), `C:<num>:<linha>:<coluna>` (chip de célula), `T:<num>:<linha>:<coluna>` (célula editada), `P:<seção>:<id>` (parágrafo: `sit`, e `texto` + `base` se editado), `K:<seção>:<capítulo>` (capítulo inteiro), `E:<id>` (recebido).
- Cada chave guarda a data (`t`) e a leva (`rev`). O Omega grava só as chaves que mudaram (mescla), então dois aparelhos não apagam as decisões um do outro.
- `foco`: o item que o usuário tocou por último ("isso", "esse").
- Se o Claude reescrever um parágrafo numa leva nova, vale o texto novo do Claude (a edição antiga deixa de valer).

## Pastas (`config/pastas`)

```json
{ "1": { "nome": "Licitações" }, "2": { "nome": "Aditivos" }, "3": { "nome": "Jurídico" },
  "3.1": { "nome": "MP E JUSTIÇA", "readme": "Processos com o Ministério Público e o Judiciário…" },
  "3.2": { "nome": "Pareceres" }, "4": { "nome": "Contratos" }, "5": { "nome": "Pessoal" } }
```

Sem esse documento, o Omega usa exatamente essa lista. Pastas intermediárias sem nome aparecem só com o número.

## Lote do pipeline (`pipeline/<lote>`, escrito pelo Claude a partir do script)

```json
{ "id": "malhado-bloco-1", "origem": "processo_malhado_completo.pdf", "criado": "2026-10-12T14:00:00-03:00",
  "arquivos": [ { "arquivo": "CI_SEDUC_045-2026_12-10-2026.pdf", "tipo": "CI", "destino": "3.1.1/Entrada",
                  "status": "ok", "paginas": "2-3", "confianca": 0.97 } ] }
```

`status`: `ok`, `revisar_nome`, `pasta_duvidosa` ou `solto`. O Omega grava em `revisao/<lote>`:
`{ itens: { "<índice>": { acao: "aprovado" | "editado" | "separar_de_novo" | "pendente", arquivo, destino, obs, t } } }`.

## Extração da Mesa PDF (`extracoes/<id>`, escrito pelo Omega)

```json
{ "id": "X…", "arquivo": "3.1.1-laudo-vistoria.pdf", "origem": "bloco.pdf", "paginas": "4-6",
  "destino": { "tipo": "origem" | "existente" | "nova" | "resposta", "pasta": "3.1.1", "descricao": "…" },
  "relatorio": "canal-malhado-mp", "criado": "…", "baixado": true }
```

O arquivo vai para os Downloads do aparelho; o Claude move para a pasta indicada quando estiver com acesso ao computador.
