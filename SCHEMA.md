# Formato do `relatorio.json` (o Claude escreve, o Omega lê)

O Omega **nunca** escreve neste arquivo. As escolhas ficam em `dados/estado.json` (e no navegador).
Exemplo completo e fictício: `dados/relatorio.exemplo.json`.

```json
{
  "id": "organizacao-geral",          // identifica o relatório (não mude entre levas)
  "rev": 38,                           // número da leva; subiu = "novo relatório carregado"
  "numero": 1,                         // número do relatório na lateral
  "titulo": "Relatório de Organização Geral",
  "autor": "@Morrão",                  // aparece como chip sob o título (padrão: @Morrão)
  "pasta": {                           // a "pasta/conversa" deste relatório
    "rotulo": "Organização Geral",     // nome mostrado na lateral (padrão: o título)
    "caminho": "C:\\CL\\Organizacao",   // atalho 📁 no computador (abre no Explorador pelo servidor local)
    "drive": "https://drive.google.com/..."  // atalho 📁 no celular (opcional)
  },
  "atualizado": "2026-10-11T14:30:00-03:00",
  "secoes": [ ...seções de itens... , ...seções de texto... ]
}
```

## Seção de itens
```json
{ "num": "1", "titulo": "Layout", "itens": [ ...itens... ] }
```

### Item
| campo | obrigatório | o que é |
|---|---|---|
| `num` | sim | número único no relatório (ex.: `"1.7"`). É a chave que mantém a escolha entre levas |
| `tipo` | não | `acao` (padrão se não houver `opcoes`), `decisao` (padrão se houver `opcoes`), `info` (só leitura) |
| `titulo`, `texto` | sim / não | título e texto curto |
| `dependeDe` | não | lista de `num`. Item fica esmaecido até todos estarem resolvidos (Feito, Seguir, escolha ou Ignorar) |
| `bloqueia` | não | lista de `num`, só informativa (vira atalho clicável) |
| `caminhos` | não | lista de caminhos de arquivo; cada um ganha botão Copiar |
| `opcoes` | não | lista de botões da escolha (tipo `decisao`). Aparece também "Outro…" |
| `valor` | não | valor inicial. `acao`: `A fazer` (padrão), `Feito`, `Ignorar`, `Não consegui`. `decisao`: `Aguardando` (padrão), `Seguir`, `Ignorar` ou uma das `opcoes` |
| `tabela` | não | veja abaixo |

Escolhas padrão: `acao` → A fazer, Feito, Ignorar, Não consegui. `decisao` sem `opcoes` → Aguardando, Seguir, Ignorar.

### Tabela dentro de um item
```json
"tabela": {
  "colunas": [ { "nome": "Contrato" }, { "nome": "Vigência", "alinhamento": "right" } ],
  "linhas": [
    ["001/2026", "31/12/2026"],
    ["002/2026", { "chip": { "valor": "A fazer", "opcoes": ["A fazer", "Feito"] } }],
    ["003/2026", { "caminho": "C:\\pasta\\arquivo.pdf" }]
  ]
}
```
Célula: texto/número, `{ "chip": {...} }` (escolha na própria célula) ou `{ "caminho": "..." }`.
`alinhamento` inicial: `left`, `center`, `right` ou `justify`. Padrão: texto justificado, números e datas à direita, chips centralizados.

## Seção de texto (elaboração de documento)
```json
{
  "num": "T1", "titulo": "DFD", "tipo": "texto",
  "capitulos": [
    { "num": "2", "titulo": "Descrição da necessidade da contratação",
      "paragrafos": [ { "id": "2.1", "texto": "…", "situacao": "vermelho" } ] }
  ]
}
```
`situacao`: `vermelho` (pendente, padrão), `verde` (aprovado) ou `azul` (ajustar).

## Regras da "leva"
- Chegou `relatorio.json` com `rev` maior: o Omega mantém a escolha de cada item de mesmo `num`, zera a marca "decidido desde a última leva" e avisa "Novo relatório carregado".
- Parágrafo que você editou e que o Claude reescreveu na leva nova: vale o texto novo do Claude.
- Itens "Feito" saem da seção e vão para "Já feito"; itens "Ignorar" continuam visíveis em cinza até o Claude tirá-los da leva seguinte.

## Formato antigo
Relatórios da versão 1 (`secoes[].itens[]` com `id`, `categoria`, `opcoes`, `requer`) ainda abrem: `id`→`num`, `requer`→`dependeDe`, `rodada`→`rev`.

## Novidades da 3.1
- Dois campos por escolha: o **valor** (A fazer, Feito…) e o **comentário** (texto livre). Os dois voltam no "Copiar relatório".
- Para o Claude oferecer caminhos de resposta (ex.: um ofício recebido), use um item `decisao` com `opcoes`, por exemplo: `["Responder por ofício", "Criar nota técnica como anexo", "Arquivar sem resposta"]`. A escolha volta no relatório copiado e o Claude elabora o documento (como seção `texto`) na leva seguinte.
- Itens "Feito" **ficam no lugar** até o Claude refazer o relatório (ele decide se move para uma seção "Já feito" do próprio relatório).
- Situação dos parágrafos nos documentos: **Pendente, Aprovado, Ajustar**. No arquivo continuam `vermelho`, `verde`, `azul`.
