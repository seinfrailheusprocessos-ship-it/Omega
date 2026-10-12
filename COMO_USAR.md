# Como usar o Omega (versão 3.1)

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

## Teclado (computador): só Tab, Espaço e setas
1. **Tab** pula de caixinha em caixinha ( A fazer ▾ ). Num documento de licitação (DFD, ETP, TR, CI…), o Tab passa por cada parágrafo e pela caixinha dele.
2. **Espaço** (ou Enter, ou seta ↓) abre as opções. O cursor já fica na busca "Procurar ou adicionar opção": digite para filtrar, ou escreva uma resposta nova e tecle Enter para adicioná-la.
3. **Setas ↑↓** escolhem, **Enter** confirma e o foco volta à caixinha (aí é só dar Tab para a próxima). **Esc** fecha.
4. **Comentário:** na mesma caixa há o campo "Comentário". Pode escolher **e** comentar. Seta ↓ depois da última opção (ou Tab) vai ao comentário; **Enter** no comentário salva só o comentário. O botão 🎙 Ditar converte a sua fala em texto.
5. **No parágrafo de um documento:** Enter (ou F2) para reescrever como num campo de formulário; Ctrl+Enter ou Tab terminam; a caixinha ao lado marca Pendente, Aprovado ou Ajustar. A caixinha **Capítulo** aprova o capítulo inteiro.
6. **/** (barra) ou Ctrl+K vai para a busca; **N** e **P** vão ao próximo e ao anterior pendente.

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
