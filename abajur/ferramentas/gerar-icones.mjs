// Gera os ícones PNG do PWA (e depois do APK) e o icons/logo.svg parado, a partir do estado final de public/logo-atelie.svg, sem alterar o desenho.
// Uso: node ferramentas/gerar-icones.mjs   (precisa do Playwright com Chromium)
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright'); // npm i -D playwright (ou NODE_PATH apontando para ele)
const pub = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const raiz = join(pub, 'icons');
// estado final: sem animação, traços inteiros e facho aceso
const FINAL = '<style>*{animation:none!important}.stroke-part{stroke-dashoffset:0!important}.lamp-glow{opacity:1!important}</style>';
const svg = readFileSync(join(pub, 'logo-atelie.svg'), 'utf8').replace(/<!--[\s\S]*?-->/g, '').replace('</style>', '</style>' + FINAL);
writeFileSync(join(raiz, 'logo.svg'), svg.replace(/<svg ([^>]*?)width="100%" height="100%"/, '<svg $1width="630" height="1000"'));
const tamanhos = [48, 72, 96, 128, 144, 152, 180, 192, 384, 512];
const exec = process.env.CHROMIUM || undefined;
const nav = await chromium.launch(exec ? { executablePath: exec } : {});
const pg = await nav.newPage();
async function render(px, nome, area, raio) {
  await pg.setViewportSize({ width: px, height: px });
  const h = Math.round(px * area / 100), w = Math.round(h * 630 / 1000);
  await pg.setContent(`<html><body style="margin:0;background:transparent"><div style="width:${px}px;height:${px}px;background:#fff;border-radius:${raio}%;display:grid;place-items:center">
    <div style="width:${w}px;height:${h}px">${svg}</div></div></body></html>`);
  await pg.screenshot({ path: join(raiz, nome), omitBackground: true });
}
for (const t of tamanhos) await render(t, `icone-${t}.png`, 84, 22);
await render(512, 'icone-maskable-512.png', 66, 0);
await nav.close();
console.log('ícones gerados em', raiz);
