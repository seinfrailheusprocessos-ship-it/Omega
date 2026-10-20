// Gera os ícones PNG do PWA (e depois do APK) a partir de public/icons/logo.svg, sem alterar o desenho.
// Uso: node ferramentas/gerar-icones.mjs   (precisa do Playwright com Chromium)
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright'); // npm i -D playwright (ou NODE_PATH apontando para ele)
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
const svg = readFileSync(join(raiz, 'logo.svg'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
const tamanhos = [48, 72, 96, 128, 144, 152, 180, 192, 384, 512];
const exec = process.env.CHROMIUM || undefined;
const nav = await chromium.launch(exec ? { executablePath: exec } : {});
const pg = await nav.newPage();
async function render(px, nome, area, raio) {
  await pg.setViewportSize({ width: px, height: px });
  await pg.setContent(`<html><body style="margin:0;background:transparent"><div style="width:${px}px;height:${px}px;background:#fff;border-radius:${raio}%;display:grid;place-items:center;color:#111">
    <div style="width:${area}%;height:${area}%">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div></div></body></html>`);
  await pg.screenshot({ path: join(raiz, nome), omitBackground: true });
}
for (const t of tamanhos) await render(t, `icone-${t}.png`, 78, 22);
await render(512, 'icone-maskable-512.png', 62, 0);
await nav.close();
console.log('ícones gerados em', raiz);
