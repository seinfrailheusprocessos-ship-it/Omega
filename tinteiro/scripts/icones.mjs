// Gera os PNG do ícone a partir do SVG (usa o Chromium do Playwright).
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const svg = fs.readFileSync(path.join(raiz, "src/web/static/icons/icon.svg"), "utf8");
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium" });
const p = await b.newPage();
async function png(tam, destino, { maskable = false } = {}) {
  await p.setViewportSize({ width: tam, height: tam });
  const conteudo = maskable
    ? `<div style="width:${tam}px;height:${tam}px;background:#0d3b45;display:flex;align-items:center;justify-content:center"><div style="width:${tam * 0.8}px;height:${tam * 0.8}px">${svg.replace("<svg ", `<svg width="${tam * 0.8}" height="${tam * 0.8}" `)}</div></div>`
    : svg.replace("<svg ", `<svg width="${tam}" height="${tam}" `);
  await p.setContent(`<html><body style="margin:0;background:transparent">${conteudo}</body></html>`);
  await p.screenshot({ path: destino, omitBackground: !maskable, clip: { x: 0, y: 0, width: tam, height: tam } });
}
const ic = path.join(raiz, "src/web/static/icons");
await png(192, path.join(ic, "icon-192.png"));
await png(512, path.join(ic, "icon-512.png"));
await png(180, path.join(ic, "icon-180.png"));
await png(512, path.join(ic, "icon-maskable-512.png"), { maskable: true });
fs.mkdirSync(path.join(raiz, "build"), { recursive: true });
await png(1024, path.join(raiz, "build/icon.png"));
await png(256, path.join(raiz, "build/icon-256.png"));
for (const t of [16, 24, 32, 48, 64, 128]) await png(t, path.join(raiz, `build/icon-${t}.png`));
await b.close();
console.log("ícones gerados");
