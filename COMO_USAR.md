# Como usar o Ômega (versão 3)

**Novidade da v3:** não há mais barra de cima. Tudo (Claude, Gemini, Revisar texto, Áudio, Copiar, tema, contador) está na **barra lateral**. No celular ela abre **deslizando o dedo da borda esquerda para a direita** (ou tocando em ☰) e fecha deslizando para a esquerda ou tocando fora: volta ao relatório. Cada relatório é uma "pasta/conversa" na lateral, com dois atalhos: 📁 arquivos e 💬 conversa.

O Claude gera o relatório (arquivo `relatorio.json`); você abre no Ômega, decide cada item tocando no chip ( A fazer ▾ ) ou nas bolinhas, e no fim toca em **Copiar relatório** e cola na conversa com o Claude.

## Jeito mais simples (computador, sem instalar nada)
1. Baixe o repositório (**Code → Download ZIP**) e extraia (ex.: em `C:\CL\Omega`).
2. Dê duplo clique em `index.html`.
3. Toque em **Ver exemplo** (menu ☰ à esquerda) para testar. Para o relatório real: **Abrir arquivo .json**.
4. Para o Ômega recarregar sozinho quando o Claude gerar um relatório novo: no menu ☰, **Acompanhar arquivo (Chrome)** e escolha o `relatorio.json`. Na primeira vez em cada dia o Chrome pode pedir para você permitir.

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

## Teclas (computador)
Com o painel de escolhas aberto: **1 a 9** escolhem a opção · **N** próximo pendente · **P** anterior · setas ↑↓ percorrem as opções, **Enter** confirma, ←→ trocam de item, **Esc** fecha. Tab/Shift+Tab percorrem os chips.

## Modo Texto
Um toque na bolinha: vermelho → verde → azul → vermelho (segurar volta um passo). **Duplo toque** no parágrafo para editar. O botão **Revisar texto** liga/desliga o sublinhado de ortografia. O botão 🎙 dita uma nota para o item/parágrafo em foco.

## Se algo não abrir
- Endereço do celular dá erro 404: GitHub → Settings → Pages → Branch **main**, pasta **/ (root)** → Save.
- Tudo fica guardado só no navegador de cada aparelho (e em `dados\estado.json` quando usa o servidor). Limpar os dados do navegador apaga as marcações.
