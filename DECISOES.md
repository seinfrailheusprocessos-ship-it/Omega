# Decisões tomadas sozinho

## Plataforma e entrega
- **Sem Vite/TypeScript**: arquivos simples (`index.html`, `estilo.css`, `app.js`, `dicionario-ptbr.js`) que abrem com duplo clique (file://) e também no GitHub Pages. Menos peças para quebrar.
- **Celular alcança o app** (seção 14 do memorial): três caminhos. (1) GitHub Pages (https): funciona sempre, com microfone e instalação; abre o `.json` por arquivo ou colando. (2) `servidor.js` (Node, sem instalar nada além do Node) servindo a pasta pela rede Wi-Fi: recarrega o relatório sozinho e guarda `dados/estado.json`; em http comum o microfone e o PWA não funcionam fora do localhost. (3) Copiar/Colar estado entre aparelhos. VPN não foi configurada.
- **Recarregar sozinho**: pelo servidor (`dados/relatorio.json`, verificação a cada 4 s) ou, no Chrome/Edge do computador sem servidor, pelo botão "Acompanhar arquivo" (File System Access; o Chrome pode pedir permissão de novo a cada dia).
- **Estado**: sempre em `localStorage`; com o servidor, também em `dados/estado.json` (o mais novo vence). O app nunca escreve em `relatorio.json`. O servidor só aceita gravar `dados/estado.json`.
- **`dados/relatorio.json` e `dados/estado.json` estão no `.gitignore`**: dados reais nunca sobem para o repositório. O repositório só tem `dados/relatorio.exemplo.json` (fictício).
- **PWA**: manifesto, ícones e service worker simples (rede primeiro, cache se estiver sem rede). Só registra em https ou localhost.

## Comportamento
- **Item feito** sai da seção e vai para "Já feito" (recolhida). "Ignorar" fica na seção, em cinza, até a próxima leva. "Não consegui" fica pendente.
- **Bloqueado** = esmaecido e com aviso, mas ainda dá para marcar (aviso suave). "Pré-requisitos agrupados" ficou no backlog; hoje cada item mostra "Depende de" e "Bloqueia" como atalhos clicáveis.
- **Resolvido** (para desbloquear e contar): Feito, Seguir, Ignorar ou uma opção escolhida. Qualquer texto de `opcoes` conta como escolha.
- **"Outro…"**: guarda o texto digitado como escolha (sai como `[Escolheu] outro: "texto"`). Tipo `decisao` sem `opcoes` usa Aguardando/Seguir/Ignorar.
- **Chip em célula de tabela** usa o mesmo painel fixo; sai na cópia como `1.2 (linha 3, Situação) [Feito]`.
- **Navegação**: "próximo pendente" pula itens bloqueados enquanto houver outros; o avanço automático vem ligado e pode ser desligado no painel ou nos Ajustes. No celular, deslizar para o lado também troca de item.
- **Tabelas**: colunas se ajustam sozinhas; cada coluna tem 4 botões de alinhamento (salvos). Largura arrastável no computador (volta ao automático se o conteúdo da tabela mudar; botão "Ajustar tabela"). Vira lista de cartões quando a coluna ficaria menor que ~115 px (celular com 3+ colunas); no modo cartões os botões de alinhamento ficam no topo.
- **Modo Texto**: toque na bolinha avança vermelho → verde → azul; segurar 0,5 s volta. Duplo toque edita (um toque nunca abre o teclado); ao sair, o parágrafo fica "alterado por você", azul, e o texto novo vai na saída. Se o Claude reescrever o parágrafo numa leva nova, vale o texto novo.
- **Texto exibido** em Arial 12, justificado, sem recuo (só exibição). Parágrafos de assinatura devem usar "Nome do Signatário" / "Cargo do Signatário" (regra para o Claude que gera o relatório).
- **Revisar texto**: liga o sublinhado em todos os parágrafos (ligado por padrão ao abrir capítulo de texto). Palavras: dicionário Hunspell pt-BR. Regras simples: espaço duplo, espaço antes de pontuação, falta de espaço depois de vírgula. Balão: sugestões, Ignorar, Adicionar ao meu dicionário. Aceitar sugestão marca o parágrafo como alterado. "Revisar no Gemini" (no parágrafo em foco) copia o texto com o pedido de revisão e abre o Gemini. LanguageTool local não coube; está no backlog.
- **Dicionário**: VERO pt-BR (pacote npm `dictionary-pt-br`), licença LGPL-3.0 ou MPL-2.0 (texto em `LICENCA-DICIONARIO.txt`). Biblioteca nspell não foi usada (muito lenta com este dicionário); verificação própria. O arquivo tem ~5 MB e carrega em alguns segundos na primeira revisão.
- **Áudio**: Web Speech do Chrome (pt-BR), contínuo, religa sozinho quando o navegador corta, com indicador de gravação (bolinha vermelha no botão e faixa "ouvindo…"). Anexa uma nota ao item/parágrafo/célula em foco (ou "geral" se não há foco). "Áudio sempre ligado" fica nos Ajustes. Correções de sigla: "sé infra", "isso é infra", "sei infra" → SEINFRA; "lá na infra" → "lá na SEINFRA" (mantive o "lá na").
- **Foco** = último item/parágrafo/célula tocado (borda lateral na cor de destaque). Claude/Gemini usam o trecho selecionado; sem seleção, o item em foco.
- **Claude**: tenta `?q=` (até 1.500 caracteres) e também copia; **Gemini** só copia e abre. Não testei nos sites reais (sem internet na sessão).
- **Saída**: segue a seção 10 do memorial. Quando o item tem `opcoes`, sai `[Escolheu] opção B: "texto em minúsculas"` (B = posição da opção). "Não consegui" leva "nota:" (anotação ou a última nota de voz); parágrafo azul sem edição leva "ajuste:" com a primeira nota de voz; as demais notas vão em "Notas de voz". Só entra o que foi tocado desde a última leva (uma leva nova com `rev` maior zera isso, mantendo os valores).
- **Cores**: destaque #4A5D78 no claro; nos escuros usei uma variação mais clara do mesmo azul para dar contraste.
- **Barra lateral**: "pastas" = Relatórios (cada relatório é uma caixinha), Seções, Abrir, Ferramentas e Ajustes. Gaveta no celular.
- **Imagens de referência** (`referencia\`) não estavam disponíveis nesta sessão; o visual segue só as medidas do memorial (Georgia/serifa nos títulos, chips azul-claro, tabelas leves).
- **Relatório antigo (v1)** ainda abre (convertido); as marcações antigas (v1) não são importadas.
