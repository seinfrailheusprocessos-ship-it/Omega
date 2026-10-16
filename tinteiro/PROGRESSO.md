# PROGRESSO — Tinteiro

Arquivo para retomar o trabalho se a sessão cair. Atualizado a cada etapa.

## Decisões principais
- Nome do app: **Tinteiro**. Pasta do projeto: `tinteiro/` (o resto do repositório é outro app).
- Desktop: Electron + servidor local (Node) que lê/grava em `C:\CL` (configurável). Instalador NSIS gerado no GitHub Actions.
- Celular: APK Android (Capacitor) + PWA (iPhone). Cópia local dos arquivos (IndexedDB) e sincronização própria com o computador (Wi-Fi de casa, pareamento por QR). Fora de casa: Tailscale (gratuito, opcional).
- Histórico: toda gravação guarda a versão anterior em `C:\CL\.tinteiro\historico\`.

## Etapas
- [ ] 1. Servidor local
- [ ] 2. Interface estilo Obsidian
- [ ] 3. Editores md/txt/html/imagem/outros
- [ ] 4. Editor docx
- [ ] 5. Editor planilhas
- [ ] 6. Editor PDF
- [ ] 7. Electron + instalador + atualização
- [ ] 8. Celular + sincronização
- [ ] 9. CI + Releases
- [ ] 10. Testes + capturas + relatório

## Como retomar
1. `cd tinteiro && ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci`
2. `npm run build:web && node src/server/standalone.js --root /caminho/de/teste`
3. Testes: `npm test`
