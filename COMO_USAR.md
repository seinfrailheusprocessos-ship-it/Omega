# Como usar o Ômega

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

## Teclas (computador)
Com o painel de escolhas aberto: **1 a 9** escolhem a opção · **N** próximo pendente · **P** anterior · setas ↑↓ percorrem as opções, **Enter** confirma, ←→ trocam de item, **Esc** fecha. Tab/Shift+Tab percorrem os chips.

## Modo Texto
Um toque na bolinha: vermelho → verde → azul → vermelho (segurar volta um passo). **Duplo toque** no parágrafo para editar. O botão **Revisar texto** liga/desliga o sublinhado de ortografia. O botão 🎙 dita uma nota para o item/parágrafo em foco.

## Se algo não abrir
- Endereço do celular dá erro 404: GitHub → Settings → Pages → Branch **main**, pasta **/ (root)** → Save.
- Tudo fica guardado só no navegador de cada aparelho (e em `dados\estado.json` quando usa o servidor). Limpar os dados do navegador apaga as marcações.
