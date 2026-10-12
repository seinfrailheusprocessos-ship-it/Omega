# Como usar o Omega (versão 3.3)

**Novidade da v3:** não há mais barra de cima. Tudo (Claude, Gemini, Revisar texto, Áudio, Copiar, tema, contador) está na **barra lateral**. No celular ela abre **deslizando o dedo da borda esquerda para a direita** (ou tocando em ☰) e fecha deslizando para a esquerda ou tocando fora: volta ao relatório. Cada relatório é uma "pasta/conversa" na lateral, com dois atalhos: 📁 arquivos e 💬 conversa.

O Claude gera o relatório (arquivo `relatorio.json`); você abre no Omega, decide cada item tocando no chip ( A fazer ▾ ) ou nas bolinhas, e no fim toca em **Copiar relatório** e cola na conversa com o Claude.

## Jeito mais simples (computador, sem instalar nada)
1. Baixe o repositório (**Code → Download ZIP**) e extraia (ex.: em `C:\CL\Omega`).
2. Dê duplo clique em `index.html`.
3. Toque em **Ver exemplo** (menu ☰ à esquerda) para testar. Para o relatório real: **Abrir arquivo .json**.
4. Para o Omega recarregar sozinho quando o Claude gerar um relatório novo: no menu ☰, **Acompanhar arquivo (Chrome)** e escolha o `relatorio.json`. Na primeira vez em cada dia o Chrome pode pedir para você permitir.

## Jeito completo (servidor local — recarrega sozinho, guarda `dados\estado.json`, celular na mesma rede)
1. Instale o Node.js (https://nodejs.org, versão LTS) uma vez.
2. Coloque o `relatorio.json` na pasta `dados`.
3. Dê duplo clique em **Iniciar Omega.bat**. Abre em `http://localhost:8765` e mostra na janela o endereço para o celular.
4. Deixe a janela preta aberta enquanto usa.

## Celular
- **Pelo PC (mesma rede Wi-Fi):** com o `Iniciar Omega.bat` aberto, no celular digite o endereço `http://192.168.x.x:8765` que apareceu na janela. Atenção: por ser http (sem cadeado), nesse endereço o **microfone e a instalação como app não funcionam**. Para ditar por voz, use o endereço https abaixo.
- **Endereço https (GitHub Pages):** https://seinfrailheusprocessos-ship-it.github.io/Omega/ — no celular, abra o arquivo `.json` (Abrir arquivo) ou cole o texto (Colar relatório). Menu do Chrome → **Instalar app** / **Adicionar à tela inicial**. Microfone funciona aqui.
- **Levar as marcações de um aparelho para o outro:** menu ☰ → **Levar estado para outro aparelho** → Copiar estado (num) / Colar estado (noutro).

## Pasta e conversa de cada relatório
- **📁 Arquivos:** no computador, com o servidor (`Iniciar Omega.bat`) abre a pasta direto no Explorador; sem servidor, copia o caminho para você colar no Explorador (Win+E). No celular abre o link do Drive, se o relatório tiver.
- **💬 Conversa:** cole uma vez, no campo da lateral, o link da conversa de desenvolvimento daquele relatório e tecle Enter; depois, um toque no 💬 abre a conversa.

## Copiar em partes
- **Copiar parágrafo** (em cada parágrafo), **Copiar capítulo** (no cabeçalho do capítulo), **Copiar texto inteiro** (no cabeçalho do texto) e, na lateral, **Copiar relatório inteiro**.
- **Copiar tudo e enviar relatório** (lateral): copia as suas decisões + o relatório inteiro e abre a conversa do relatório; na conversa, toque no campo de texto e cole. (O Claude não aceita texto no endereço de uma conversa já existente, por isso o texto fica copiado.)

## Novo visual (3.3)
- Fonte **IBM Plex Mono** (embutida, funciona offline) e as **três iluminações**: Claro, Escuro e Mais escuro (⋯ → Iluminação). Proporções do Claude desktop: lateral de 19,5%, barra de 56 px, linhas de 43 px, coluna de leitura de 73%.
- **Barra superior congelada** com: Relatório (PDF), Documento, Resposta, CI, Copiar relatório, Copiar item, Foco, Pasta, Conversa, 🎙 e ⋯ (tudo o que saiu da lateral: Novo objeto, Mesa PDF, hierarquia, ajustes…). Os "visualizar" mostram a folha A4 para imprimir/salvar PDF.
- **Lateral enxuta** (☰ recolhe; no celular abre deslizando da borda): só busca, **Numérica / Últimos trabalhados** e as **pastas numeradas** (1 Licitações, 2 Aditivos, 3 Jurídico, 4 Comunicações…). Clicar abre o relatório da pasta.
- **Caixa de comentário** arredondada na base: escreve o comentário do item em foco (Enter salva).

## Ditado em qualquer caixa
Microfone flutuante em toda caixa de texto e atalho **Ctrl+Shift+Espaço** (liga/desliga no campo onde está o cursor, inclusive dentro de um parágrafo). O texto aparece enquanto você fala, a tela desce sozinha e o ditado **não para na pausa** (o Chrome corta de vez em quando; o Omega religa sozinho). No celular use também o microfone do teclado Gboard.

## Códigos, pastas e README
Todo objeto e documento tem **código numérico** (1.7, 1.7.1…). Novo objeto sugere o próximo código da categoria, a pasta `1_LICITACOES/1.8_NOME` e cria o **README.md** (memorial + ficha). ⋯ → "Criar a hierarquia base de pastas" cria as pastas das categorias. "Atualizar README" (em Arquivos deste objeto) regrava a ficha.

## Mesa PDF por gesto
Abra o PDF (⋯ → Mesa PDF, ou "Mesa PDF" num arquivo). **Arraste uma página para a direita** para extrair. **Segure** uma página para selecionar várias: a lista rola sozinha (velocidade em ⋯ → Ajustes ou na própria Mesa), marcar uma página destaca a próxima, toque num espaço vazio ou em ⏸ para pausar, e arraste a barra "extrair" para a direita. Depois: **Renomear** (padrão MAIÚSCULAS_COM_UNDERLINE, com o código) e **Salvar onde**: mesma pasta, outra pasta que já existe, pasta nova ou **Criar resposta** (pasta com o nome do arquivo). Teclado: setas, Espaço seleciona, Enter extrai.

## Revisão dos PDFs separados pelo script
Em "Arquivos deste objeto", **Revisar PDFs separados**: lista cada arquivo (tipo, páginas, título→fecho quando o script grava `_pipeline.json`) com a caixinha Pendente / Arquivado / Corrigir / Responder. Veja `PIPELINE_SPEC.md` (o contrato com os scripts).

## Teclado (computador): só Tab, Espaço e setas
1. **Tab** pula de caixinha em caixinha ( A fazer ▾ ). Num documento de licitação (DFD, ETP, TR, CI…), o Tab passa por cada parágrafo e pela caixinha dele.
2. **Espaço** (ou Enter, ou seta ↓) abre as opções. O cursor já fica na busca "Procurar ou adicionar opção": digite para filtrar, ou escreva uma resposta nova e tecle Enter para adicioná-la.
3. **Setas ↑↓** escolhem, **Enter** confirma e o foco volta à caixinha (aí é só dar Tab para a próxima). **Esc** fecha.
4. **Comentário:** na mesma caixa há o campo "Comentário". Pode escolher **e** comentar. Seta ↓ depois da última opção (ou Tab) vai ao comentário; **Enter** no comentário salva só o comentário. O botão 🎙 Ditar converte a sua fala em texto.
5. **No parágrafo de um documento:** Enter (ou F2) para reescrever como num campo de formulário; Ctrl+Enter ou Tab terminam; a caixinha ao lado marca Pendente, Aprovado ou Ajustar. A caixinha **Capítulo** aprova o capítulo inteiro.
6. **/** (barra) ou Ctrl+K vai para a busca; **N** e **P** vão ao próximo e ao anterior pendente.

## Novo objeto, arquivos do C:, scripts, Mesa PDF
O Omega **não pensa nem faz OCR sozinho**: ele é o gerenciador que liga as suas pastas do C: aos scripts que você já tem e à conversa com o Claude.
1. **Novo objeto** (lateral): nome (o mesmo da pasta e da conversa), número, pasta no computador (pode criar) e link da conversa do Claude.
2. **Arquivos deste objeto** (aparece no objeto, com o servidor ligado): **Subir arquivo** (upload para a pasta), Ver, Mesa PDF, **Renomear**, Explorador e **Executar ▾** (seus scripts: OCR, "fazer notas" que gera o relatório do arquivo na pasta, renomear pelo script…). O resultado do script aparece numa janela. Arquivos `.json` têm "Abrir como relatório".
3. **Seus scripts:** copie `dados/config.exemplo.json` para `dados/config.json` e troque os comandos pelos seus (o exemplo é só ilustração). O Omega só executa o que estiver escrito nesse arquivo, só com arquivos dentro das pastas liberadas e só a partir do próprio computador.
4. **Mesa PDF** (lateral ou botão no arquivo; funciona também no celular, sem servidor): vê o PDF com miniaturas, você escreve as páginas (ex.: 2-4, 7) e **Extrair páginas** gera um PDF só com elas (para separar um ofício de um bloco escaneado de 50 páginas). Daí: Baixar, Salvar na pasta do objeto, Imprimir, E-mail (Gmail), **Cadastrar como recebido (Pendente)** ou **Responder (novo documento)**. Os recebidos ficam numa tabela no objeto, com a caixinha Pendente / Em análise / Responder / Respondido / Arquivar, e vão no Copiar relatório.
5. **💬 Conversa:** o ícone 💬 (e o botão Ir) salva o relatório de retorno na pasta (`RETORNO_OMEGA_rev<N>.txt`), copia a mensagem "Leia o relatório de retorno do Omega do objeto …" e abre a conversa; é só colar com Ctrl+V. Você pode trocar a mensagem no campo da lateral. Sem servidor, ele cola o próprio relatório de decisões.
6. **Gmail** está na lateral. O e-mail abre já com assunto e texto; o anexo você coloca (o arquivo está na pasta do objeto).

## Buscar
A busca no alto da lateral aceita número (ex.: 1.4.7), palavras do texto ou o nome do objeto (ex.: "canal do malhado": aparece o relatório e tudo o que está pendente nele). Com o servidor ligado e as pastas liberadas, aparecem também pastas e arquivos do computador.

## Pastas do computador, PDF, impressão, novo documento
- **Pastas:** crie `dados\config.json` com `{"raizes": ["C:\\CL"]}` (veja `dados/config.exemplo.json`) e abra pelo `Iniciar Omega.bat`. Digite na busca ou use "Pastas do computador": navega, mostra PDF/imagem/txt no próprio Omega (com botão Imprimir) e abre no Explorador. Só funciona no próprio computador, nunca pelo celular.
- **Abrir PDF:** na lateral, escolhe um PDF do aparelho para ler e imprimir (não precisa de servidor).
- **Visualizar impressão:** no cabeçalho de cada documento; mostra a folha A4 (Arial 12, justificado). "Imprimir / Salvar como PDF" usa as impressoras instaladas no computador.
- **Novo documento:** ofício, nota técnica, CI, despacho ou anexo em branco, em campos; depois é só copiar para o Claude.

## Modo Texto
Um toque na bolinha: vermelho → verde → azul → vermelho (segurar volta um passo). **Duplo toque** no parágrafo para editar. O botão **Revisar texto** liga/desliga o sublinhado de ortografia. O botão 🎙 dita uma nota para o item/parágrafo em foco.

## Se algo não abrir
- Endereço do celular dá erro 404: GitHub → Settings → Pages → Branch **main**, pasta **/ (root)** → Save.
- Tudo fica guardado só no navegador de cada aparelho (e em `dados\estado.json` quando usa o servidor). Limpar os dados do navegador apaga as marcações.
