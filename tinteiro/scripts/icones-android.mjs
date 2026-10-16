// Ícones e tela de abertura do app Android a partir do SVG.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const svg = fs.readFileSync(path.join(raiz, "src/web/static/icons/icon.svg"), "utf8");
const semFundo = svg.replace(/<rect [^>]*fill="url\(#fundo\)"\/>/, "");
const res = path.join(raiz, "mobile/android/app/src/main/res");
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await b.newPage();
async function render(html, w, hgt, destino, transparente = true) {
  await p.setViewportSize({ width: w, height: hgt });
  await p.setContent(`<html><body style="margin:0;background:transparent">${html}</body></html>`);
  await p.screenshot({ path: destino, omitBackground: transparente, clip: { x: 0, y: 0, width: w, height: hgt } });
}
const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, f] of Object.entries(dens)) {
  const dir = path.join(res, "mipmap-" + d);
  fs.mkdirSync(dir, { recursive: true });
  const t = Math.round(48 * f);
  const icone = svg.replace("<svg ", `<svg width="${t}" height="${t}" `);
  await render(icone, t, t, path.join(dir, "ic_launcher.png"));
  await render(`<div style="width:${t}px;height:${t}px;border-radius:50%;overflow:hidden;background:linear-gradient(#1f6f78,#0d3b45)">${semFundo.replace("<svg ", `<svg width="${t}" height="${t}" `)}</div>`, t, t, path.join(dir, "ic_launcher_round.png"));
  const fg = Math.round(108 * f), arte = Math.round(fg * 0.62);
  await render(`<div style="width:${fg}px;height:${fg}px;display:flex;align-items:center;justify-content:center">${semFundo.replace("<svg ", `<svg width="${arte}" height="${arte}" `)}</div>`, fg, fg, path.join(dir, "ic_launcher_foreground.png"));
}
// tela de abertura
const splashes = fs.readdirSync(res).filter(n => n.startsWith("drawable")).map(n => path.join(res, n, "splash.png")).filter(f => fs.existsSync(f));
for (const f of splashes) {
  const { execSync } = await import("node:child_process");
  const [w, hgt] = execSync(`python3 -c "from PIL import Image; im=Image.open('${f}'); print(im.size[0], im.size[1])"`).toString().trim().split(" ").map(Number);
  const t = Math.round(Math.min(w, hgt) * 0.28);
  await render(`<div style="width:${w}px;height:${hgt}px;background:#1e1e1e;display:flex;align-items:center;justify-content:center">${svg.replace("<svg ", `<svg width="${t}" height="${t}" `)}</div>`, w, hgt, f, false);
}
fs.writeFileSync(path.join(res, "values/ic_launcher_background.xml"), `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#155A63</color>\n</resources>\n`);
await b.close();
console.log("ícones Android gerados", splashes.length, "telas de abertura");
