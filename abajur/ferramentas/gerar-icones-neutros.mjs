// Ícones neutros (sem nome e sem logo) enquanto a marca não é definida. Uso: node ferramentas/gerar-icones-neutros.mjs
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright');
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="#2a2a2f"/><rect x="30" y="30" width="40" height="40" rx="10" fill="none" stroke="#b3a0ff" stroke-width="6"/></svg>';
writeFileSync(join(raiz, 'logo.svg'), svg);
const nav = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const pg = await nav.newPage();
async function render(px, nome, cheio) {
  await pg.setViewportSize({ width: px, height: px });
  await pg.setContent(`<html><body style="margin:0;background:transparent">${cheio ? svg.replace('rx="22"', 'rx="0"') : svg}</body></html>`.replace('<svg ', `<svg width="${px}" height="${px}" style="display:block" `));
  await pg.screenshot({ path: join(raiz, nome), omitBackground: true });
}
for (const t of [48, 72, 96, 128, 144, 152, 180, 192, 384, 512]) await render(t, `icone-${t}.png`, false);
await render(512, 'icone-maskable-512.png', true);
await nav.close();
console.log('ícones neutros em', raiz);
