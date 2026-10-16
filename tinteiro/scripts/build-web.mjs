// Gera dist/web (interface) com esbuild.  node scripts/build-web.mjs [--watch] [--dev]
import * as esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = process.env.TINTEIRO_DIST ? path.resolve(process.env.TINTEIRO_DIST) : path.join(raiz, "dist/web");
const pkg = JSON.parse(fs.readFileSync(path.join(raiz, "package.json"), "utf8"));
const watch = process.argv.includes("--watch");
const dev = process.argv.includes("--dev") || watch;

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

function copiar(de, para) {
  const st = fs.statSync(de);
  if (st.isDirectory()) { fs.mkdirSync(para, { recursive: true }); for (const n of fs.readdirSync(de)) copiar(path.join(de, n), path.join(para, n)); }
  else { fs.mkdirSync(path.dirname(para), { recursive: true }); fs.copyFileSync(de, para); }
}

const comum = { bundle: true, minify: !dev, sourcemap: dev ? "inline" : false, logLevel: "warning", target: ["chrome110", "safari16"], legalComments: "none" };
const ctxJs = await esbuild.context({
  ...comum,
  entryPoints: { app: path.join(raiz, "src/web/js/main.js") },
  outdir: dist, format: "esm", splitting: true, chunkNames: "chunks/[name]-[hash]",
  define: { __VERSAO__: JSON.stringify(pkg.version) },
  loader: { ".ttf": "file", ".woff2": "file" },
});
const ctxCss = await esbuild.context({ ...comum, sourcemap: false, entryPoints: { app: path.join(raiz, "src/web/css/index.css") }, outdir: dist, loader: { ".svg": "dataurl", ".woff2": "file", ".ttf": "file" } });

async function estaticos() {
  copiar(path.join(raiz, "src/web/index.html"), path.join(dist, "index.html"));
  copiar(path.join(raiz, "src/web/static"), dist);
  const pdfjs = path.join(raiz, "node_modules/pdfjs-dist");
  copiar(path.join(pdfjs, "legacy/build/pdf.worker.min.mjs"), path.join(dist, "vendor/pdfjs/pdf.worker.min.mjs"));
  for (const d of ["cmaps", "standard_fonts", "wasm"]) if (fs.existsSync(path.join(pdfjs, d))) copiar(path.join(pdfjs, d), path.join(dist, "vendor/pdfjs", d));
  fs.writeFileSync(path.join(dist, "versao.json"), JSON.stringify({ version: pkg.version, build: Date.now() }));
  // lista de arquivos para o modo sem internet (service worker)
  const lista = [];
  const anda = d => { for (const n of fs.readdirSync(d)) { const p = path.join(d, n); if (fs.statSync(p).isDirectory()) anda(p); else lista.push(path.relative(dist, p).split(path.sep).join("/")); } };
  anda(dist);
  const sw = fs.readFileSync(path.join(raiz, "src/web/sw.js"), "utf8")
    .replace("__VERSAO__", pkg.version + "-" + Date.now())
    .replace("__ARQUIVOS__", JSON.stringify(lista.filter(n => !n.endsWith(".map") && n !== "sw.js")));
  fs.writeFileSync(path.join(dist, "sw.js"), sw);
}

if (watch) {
  await estaticos();
  await ctxJs.watch(); await ctxCss.watch();
  console.log("observando…");
} else {
  await ctxJs.rebuild(); await ctxCss.rebuild();
  await estaticos();
  await ctxJs.dispose(); await ctxCss.dispose();
  const tam = fs.statSync(path.join(dist, "app.js")).size;
  console.log(`dist/web pronto (app.js ${(tam / 1024).toFixed(0)} KB)`);
}
