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

---
# Versão 3 (branch `v3`; a `main` continua com a versão 2)
- **Visual do Claude Docs** (prints do PDF): título em serifa leve, "Eu [data] · [@Morrão]", itens como lista com marcador e título em negrito seguido do texto, "Depende de: … Bloqueia: …. ( A fazer ▾ )" no fim do parágrafo, chips pequenos azul-claro, tabelas com cabeçalho cinza-claro e bordas finas, `código` em fonte monoespaçada com fundo bege. Fonte serifa: Tiempos/Source Serif se existirem no aparelho, senão Georgia (não embuti fontes).
- **Justificado só nos parágrafos**: as células das tabelas ficam à esquerda (números e datas à direita, chips centralizados). Alinhamentos que você já escolheu continuam valendo.
- **Barra de cima removida**: tudo foi para a lateral. Botão ☰ flutuante no canto; no celular a lateral abre também deslizando da borda esquerda (primeiros 30 px da tela) e fecha deslizando para a esquerda. Ela fecha sozinha ao usar Claude/Gemini/Copiar no celular.
- **Lateral lista só relatórios**: "número + rótulo da pasta" (`numero` e `pasta.rotulo` do relatório; sem eles, a ordem e o título). A lista de seções saiu da lateral.
- **📁 Arquivos**: computador com servidor → `POST /api/abrir-pasta` (só aceita pedido do próprio computador, só pasta existente, sem shell). Sem servidor → copia o caminho. Celular → só abre `pasta.drive` se houver (o celular não abre pastas do PC).
- **💬 Conversa**: link salvo por relatório no estado (campo na lateral). Sem link, o ícone leva ao campo.
- **Copiar em partes** nos quatro níveis (parágrafo, capítulo, texto inteiro, relatório inteiro).
- **Copiar tudo e enviar**: "tudo" = suas decisões (formato da seção 10) + relatório completo. O Claude não recebe texto pelo endereço de uma conversa existente (só em `claude.ai/new?q=`, que tem limite de tamanho), então o app copia, abre a conversa e avisa para colar.
- **Preservado da v2**: PWA, três temas, painel de escolhas, modo Texto, revisor, áudio, servidor local, `.gitignore` dos dados reais, ajuste de colunas, larguras e alinhamentos.
- **Decisões em aberto da v2** continuam como estavam (celular+PC em sincronia fica no BACKLOG; revisor sem LanguageTool; marcações da v1 não importadas).

---
# Versão 3.1 (pedido por voz de 12/10/2026, sobre os prints do Claude Docs)
- **Nome sem acento**: "Omega" em tudo (tela, título, manifesto, texto copiado `[OMEGA] …`). Sem "central de comando".
- **Relatório em tabela de linhas transparentes** (Item | O que fazer | Depende de | Bloqueia | Escolha), como a Parte 2 do PDF. Tabelas reais e os documentos de texto (DFD, ETP…) têm linhas visíveis, como no Word.
- **Texto justificado**: parágrafos, "O que fazer" e colunas longas de tabelas reais (média acima de 45 caracteres). Colunas curtas ficam à esquerda; números/datas à direita. Dá para trocar por coluna.
- **Caixinha com Tab/Espaço/setas** no lugar do painel lateral: o dropdown abre colado na caixinha (folha de baixo no celular), com "Procurar ou adicionar opção…", pontos coloridos e ✓ na atual, como no print. **Escrever uma opção nova** substitui o antigo "Outro…". Só os chips (e os parágrafos dos documentos) recebem Tab; botões auxiliares ficam fora do Tab de propósito.
- **Comentário** é independente da escolha (campo na mesma caixa; Enter salva só o comentário). O ditado 🎙 da caixa escreve no comentário.
- **Depois de escolher**, o foco fica na mesma caixinha (Tab vai para a próxima). "Ir para o próximo pendente" é ajuste opcional, desligado.
- **Item "Feito" não sai mais do lugar** (isso era meu; no manual quem move para "Já feito" é o Claude na leva seguinte).
- **Documentos em campos**: Tab passa por parágrafo e caixinha (Pendente/Aprovado/Ajustar); Enter/F2 reescreve; a caixinha **Capítulo** aprova o capítulo inteiro (sai como uma linha "Todo o capítulo [Aprovado]"). O "toque na bolinha" da v2 foi trocado pela caixinha.
- **Copiar relatório** leva só o que você decidiu/alterou/comentou (`1.4.7 [Feito] — comentário: …`), com o rótulo `[OMEGA] 1 Exemplo Geral · relatório … rev …`.
- **Busca na lateral** (número, palavras ou nome do objeto) no lugar das categorias; "/" ou Ctrl+K foca nela. Com servidor e pastas liberadas, busca pastas/arquivos do computador. A frase sobre rolagem da lateral veio cortada; não implementei sumário com rolagem. Diga se era isso.
- **Claude em linha removido**: tirei a barrinha flutuante de selecionar trecho. Ficam só os atalhos que abrem conversa nova e o fluxo de relatório (copiar e colar). "Revisar no Gemini" continua no parágrafo.
- **Revisar tudo** (cada documento): lista todos os problemas, aceita sugestões uma a uma e corrige espaços/pontuação de uma vez.
- **Pastas do computador**: o navegador não lê o disco; quem lê é o `servidor.js`, só para pedidos do próprio computador, só nas pastas de `dados/config.json`. Mostra PDF/imagem/txt; Word/Excel abrem no Explorador. Não funciona pelo celular (de propósito, para não expor o PC na rede).
- **Visualizar impressão** (folha A4) e **imprimir/salvar PDF** pelo navegador (usa as impressoras do Windows, inclusive as da prefeitura se estiverem instaladas). **Abrir PDF** de qualquer pasta para ler/imprimir.
- **Novo documento** em branco (ofício, nota técnica, CI, despacho, anexo) só com a estrutura e "Nome do Signatário / Cargo do Signatário"; texto jurídico quem escreve é você ou o Claude pelo relatório.
- **Carimbo e numeração de páginas**: não coloquei. Pesaria o Omega e já existe na skill de licitações; o caminho é o Claude gerar o PDF carimbado e o Omega abrir/imprimir (Abrir PDF ou Pastas). Se quiser, vira a próxima etapa.
- **Editor de PDF / "mesa de PDF"**: não feito (só ler e imprimir). Está no BACKLOG.
- **Salvamento**: continua automático a cada toque (navegador e, com o servidor, `dados/estado.json`).
- **Tema padrão** agora é o "Mais escuro" (como nos seus prints novos); troca na lateral.

---
# Versão 3.2 (pedido por voz: objeto, upload, scripts do C:, Mesa PDF, conversa)
- **Omega não faz OCR nem pensa**: é gerenciador dos seus scripts. OCR no navegador (tesseract) pesaria dezenas de MB e não substitui o seu script; por isso não embuti.
- **Scripts**: só rodam os cadastrados por você em `dados/config.json` (ignorado pelo git), com `execFile`-style (sem shell), argumentos `{arquivo}`, `{pasta}`, `{nome}` validados contra as pastas liberadas, só a partir do próprio computador, e bloqueando nomes com `& | < > ^ % " ; $ ( )` quando o comando é cmd/PowerShell. Não conheço os nomes/argumentos dos seus scripts: o `config.exemplo.json` é ilustrativo e precisa ser ajustado por você. Saída do script aparece numa janela; "notas" gerando o relatório na pasta é problema do seu script, o Omega só mostra o arquivo na lista e abre `.json` como relatório.
- **Renomear**: botão do Omega (renomeia direto na pasta, recusa nome repetido) e, se você cadastrar, o seu script de renomear em "Executar ▾".
- **Upload**: grava na pasta do objeto (até 800 MB, sem sobrescrever: acrescenta "(2)").
- **Mesa PDF**: usa pdf-lib (MIT, `pdf-lib.min.js`, 440 KB) para extrair páginas; a leitura com miniaturas é do leitor de PDF do próprio Chrome. Não edita, não gira, não junta (backlog).
- **Recebidos** é uma tabela por objeto guardada no estado do navegador/servidor (não vem do `relatorio.json`). Entram no "Copiar relatório" até a próxima leva.
- **💬** deixou de só abrir o link: salva `RETORNO_OMEGA_rev<N>.txt` na pasta (se houver servidor e pasta), copia a mensagem e abre a conversa. A mensagem é editável por objeto.
- **E-mail**: abre o compose do Gmail com assunto/texto; **anexo não dá para automatizar pelo navegador** (precisa anexar à mão). Não enviei nada sozinho.
- **Impressão direta nas impressoras da prefeitura**: pelo diálogo de impressão do navegador/Windows (não há como escolher impressora por código no navegador).
- **Novo objeto** é um objeto vazio com id `obj-…`; o Claude deve usar esse mesmo id no `relatorio.json` para o estado se manter (o id aparece no objeto com botão Copiar id).
- **Não feito**: Claude/IA dentro do app (você preferiu o fluxo de relatório), OCR embutido, edição de PDF, anexos de e-mail automáticos.

---
# Versão 3.3 (aprovação da simulação: IBM Plex Mono, três temas, "pode executar tudo")
- **D1 fonte:** IBM Plex Mono (a que você preferiu), embutida no CSS (OFL-1.1, `LICENCA-FONTE.txt`).
- **D2 sessões:** segui a recomendação (duas). Esta sessão fez a interface; os scripts de OCR/separação/renomeação ficam para a sessão 2, com o contrato em `PIPELINE_SPEC.md`. O Omega já dispara scripts (config.json) e lê `_pipeline.json` na revisão.
- **D3 atalho do ditado:** Ctrl+Shift+Espaço. **D4 data nos nomes:** `dd-mm-aaaa` (ex.: `12-10-2026`). **D5 hierarquia:** 1 Licitações, 2 Aditivos, 3 Jurídico, 4 Comunicações; 5 em diante a definir (nomes editáveis em `DB.cats`, hoje só no código).
- **Temas:** os três ficam; padrão agora "Mais escuro"; cores medidas do print no Escuro (#111111/#151515/#20201F/#313130/#292929/#4D4D4C/#F0EFEC/#C3C2B7/#B8B8B6), Mais escuro derivado, Claro em cinzas frios estilo Apple, destaque #4A5D78.
- **Proporções:** lateral `clamp(270px, 19,53vw, 420px)`, barra 56 px, itens 43 px, coluna 73%. Divisórias de 1 px e curtas (52% da largura) na lateral; o relatório não tem linhas longas.
- **Barra superior congelada** substitui a barra da v3 e concentra as funções; o que não cabia foi para ⋯. "Resposta" e "CI" visualizam a folha A4 do documento respectivo; avisam quando ainda não existe.
- **Lateral** só tem busca, organização e pastas. Pasta = objeto/relatório; categoria = primeiro número do código. Objeto sem ponto no código cai em "Sem categoria". "Últimos trabalhados" usa a data de modificação da pasta quando há servidor; senão, a última vez que você mexeu no objeto.
- **Ditado:** voz para texto do Chrome (não grava áudio), insere no cursor de qualquer caixa (inclui o parágrafo em edição), mostra o texto provisório enquanto fala, rola a tela e religa sozinho nas pausas. Não prometo "sem limite": o Chrome corta e o Omega religa. Celular: microfone do Gboard.
- **Códigos:** todo objeto e documento tem código numérico. Recebidos e documentos filhos usam `código.N` (contador único por objeto: 1.8.1, 1.8.2…). Pastas dos objetos: `código_NOME_MAIÚSCULO` (ex.: `1.8_CANAL_DO_MALHADO`), pastas das categorias: `1_LICITACOES`. Você disse "pastas só em números": usei o código numérico como início do nome, e não só o número, para você reconhecer a pasta.
- **README** em cada pasta de objeto e de categoria (modelo em `readmeObjeto`). Não consigo criar pastas reais no seu C: daqui; o Omega cria quando você usa Novo objeto / "Criar a hierarquia base".
- **Mesa PDF por gesto:** miniaturas com pdf.js 3.11 (Apache-2.0, `pdf-mesa.js`, 1,4 MB, worker embutido para funcionar com duplo clique). Arrastar para a direita > 110 px extrai; segurar 0,5 s seleciona; barra de extrair; rolagem automática (0–12, padrão 4), pausa por toque num espaço vazio ou ⏸. Digitar intervalo (2-4) foi removido, como pedido; sobrou o teclado.
- **Revisão do pipeline:** lê `_pipeline.json` se existir; senão lista os PDFs e a pasta de cada um como "tipo". "Arquivado" não conta como pendência.
- **Fora do que foi pedido:** não mexi nos scripts de OCR; não implementei sumário com rolagem na lateral (a frase cortada do pedido anterior).
