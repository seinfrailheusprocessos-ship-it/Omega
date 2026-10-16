// Captura de tela rápida:  node test/shot.mjs URL-hash saida.png [largura altura] [--mobile] [--light] [--js "codigo"]
import { chromium } from "playwright";
const args = process.argv.slice(2);
const flag = f => args.includes(f);
const val = f => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const pos = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--") && ["--js", "--wait", "--click"].includes(args[i - 1])));
const [hash = "", saida = "/tmp/shot.png", w = "1400", hgt = "860"] = pos;
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await b.newContext({ viewport: { width: +w, height: +hgt }, deviceScaleFactor: flag("--mobile") ? 3 : 1, isMobile: flag("--mobile"), hasTouch: flag("--mobile"), colorScheme: flag("--light") ? "light" : "dark", locale: "pt-BR" });
const p = await ctx.newPage();
const erros = [];
p.on("pageerror", e => erros.push("pageerror: " + e.message));
p.on("console", m => { if (m.type() === "error" || m.type() === "warning") erros.push(m.type() + ": " + m.text()); });
await p.goto("http://127.0.0.1:27190/#token=TESTE123TESTE123TESTE123" + hash);
await p.waitForTimeout(+(val("--wait") || 1500));
if (val("--js")) { const r = await p.evaluate(val("--js")); if (r !== undefined) console.log("js:", JSON.stringify(r).slice(0, 2000)); await p.waitForTimeout(1200); }
await p.screenshot({ path: saida });
console.log(erros.join("\n") || "sem erros");
await b.close();
