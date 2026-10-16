# PROGRESSO — Tinteiro

Arquivo para retomar o trabalho se a sessão cair. Atualizado a cada etapa.

## Decisões principais
- Nome do app: **Tinteiro**. Pasta do projeto: `tinteiro/` (o resto do repositório é outro app).
- Desktop: Electron + servidor local (Node) que lê/grava em `C:\CL` (configurável). Instalador NSIS gerado no GitHub Actions.
- Celular: APK Android (Capacitor) + PWA (iPhone). Cópia local dos arquivos (IndexedDB) e sincronização própria com o computador (Wi-Fi de casa, pareamento por QR). Fora de casa: Tailscale (gratuito, opcional).
- Histórico: toda gravação guarda a versão anterior em `C:\CL\.tinteiro\historico\`.

## Etapas
- [x] 1. Servidor local (`src/server/`): arquivos, histórico (`.tinteiro/historico`), busca com índice (docx/xlsx/pdf/md), eventos, API de sincronização.
- [x] 2. Interface estilo Obsidian (`src/web/js/app.js`, `workspace/`, `css/`): faixa de ícones, explorador, abas, divisões, painel direito, barra de status, Ctrl+P, Ctrl+O, busca, configurações; celular com gavetas e barra de baixo (`mobile/mobile.js`).
- [x] 3. Notas md (CodeMirror 6 + pré-visualização ao vivo + modo leitura), txt/código, html (iframe isolado), imagens, outros formatos (abrir no programa padrão), histórico de versões.
- [x] 4. Word (`src/web/js/docx/`): docx-preview modificado + reconciliação cirúrgica. Teste: `node test/docx.test.mjs` (passa; XSD do Word passa; LibreOffice renderiza igual).
- [ ] 5. Planilhas (`src/web/js/sheet/`) — feito por agente em paralelo; teste `test/sheet.test.mjs`.
- [ ] 6. PDF (`src/web/js/pdf/`) — feito por agente em paralelo; teste `test/pdf.test.mjs`.
- [x] 7. Electron (`src/main/`), instalador NSIS e atualização automática (electron-updater, GitHub Releases).
- [x] 8. Celular: cópia local (IndexedDB) + sincronização (`backends/local.js`, `backends/sync.js`), pareamento por QR, Android (Capacitor em `mobile/android`), PWA com service worker. Teste: `node test/sync.test.mjs` (passa).
- [x] 9. CI: `.github/workflows/tinteiro.yml` gera .exe e .apk; publica Release quando a mensagem do commit tem `[publicar]`.
- [ ] 10. Testes finais + capturas + relatório.

## Como retomar
1. `cd tinteiro && ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci`
2. `npm run build:web && node src/server/standalone.js --root /caminho/de/teste`
3. Testes: `npm test`
