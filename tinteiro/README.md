# Tinteiro

Editor de documentos com o visual de um cofre de notas: abre e edita dentro do próprio app arquivos **Word (.docx)**, **Excel (.xlsx/.csv)**, **PDF**, **notas (.md/.txt)**, **relatórios HTML** e **imagens**, salvando no mesmo arquivo e guardando a versão anterior.

- Computador (Windows): instalador `Tinteiro-Setup.exe`.
- Android: `Tinteiro.apk`.
- iPhone: app web instalável (Adicionar à Tela de Início), pelo endereço seguro do computador (Tailscale).

Downloads (sempre a versão mais nova):
- https://github.com/seinfrailheusprocessos-ship-it/Omega/releases/latest/download/Tinteiro-Setup.exe
- https://github.com/seinfrailheusprocessos-ship-it/Omega/releases/latest/download/Tinteiro.apk

Veja `DECISOES.md` (como funciona) e `PROGRESSO.md` (estado do trabalho).

## Desenvolvimento
```
cd tinteiro
ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci
npm run build:web
node src/server/standalone.js --root PASTA_DE_TESTE      # abre no navegador
node test/ui.test.mjs && node test/docx.test.mjs && node test/docx2.test.mjs && node test/sync.test.mjs
```
Os testes usam só arquivos fictícios gerados por `test/fixtures/gerar.py`.
