// Servidor local do Tinteiro: entrega a interface, dá acesso aos arquivos do cofre e atende o celular.
"use strict";
const http = require("http");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { URL } = require("url");
const { Vault, ErroCofre } = require("./vault");
const { Indexer } = require("./indexer");
const tailscale = require("./tailscale");

const MIME = {
  ".html": "text/html; charset=utf-8", ".htm": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".bmp": "image/bmp", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json",
  ".pdf": "application/pdf", ".txt": "text/plain; charset=utf-8", ".md": "text/markdown; charset=utf-8", ".csv": "text/csv; charset=utf-8",
  ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".wasm": "application/wasm", ".map": "application/json",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".mp4": "video/mp4", ".mp3": "audio/mpeg",
  ".bcmap": "application/octet-stream", ".pfb": "application/octet-stream",
};
const mimeDe = p => MIME[path.extname(p).toLowerCase()] || "application/octet-stream";

function ipsLocais() {
  const out = [];
  for (const [nome, lista] of Object.entries(os.networkInterfaces())) {
    for (const i of lista || []) {
      if (i.family !== "IPv4" || i.internal) continue;
      if (/^169\.254\./.test(i.address)) continue;
      const vpn = /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(i.address) || /tailscale/i.test(nome);
      const virtual = /vEthernet|VirtualBox|VMware|WSL|docker|Hyper-V|br-|veth/i.test(nome);
      out.push({ nome, ip: i.address, vpn, virtual });
    }
  }
  const peso = x => (x.vpn ? 2 : 0) + (x.virtual ? 3 : 0) + (/^192\.168\./.test(x.ip) ? 0 : 1);
  return out.sort((a, b) => peso(a) - peso(b));
}

function criarServidor(opts) {
  const { config, webDir, versao = "0.0.0", hooks = {} } = opts;
  let vault = null, indexer = null;
  const clientes = new Set(); // conexões de eventos (SSE)
  const segredoRaw = crypto.randomBytes(16).toString("hex");
  let servidor = null, portaReal = null;

  async function abrirCofre() {
    if (vault) { vault.unwatch(); vault.removeAllListeners(); }
    vault = new Vault(config.get("root"), { trash: hooks.trash });
    await vault.init();
    indexer = new Indexer(vault);
    indexer.iniciar().catch(() => {});
    vault.on("change", paths => {
      indexer.mudou(paths).catch(() => {});
      enviarEvento({ type: "change", paths });
    });
    vault.watch();
  }

  function enviarEvento(obj) {
    const s = `data: ${JSON.stringify(obj)}\n\n`;
    for (const c of clientes) { try { c.write(s); } catch (e) {} }
  }

  const token = () => config.get("token");
  const ehLocal = req => /^(::1|127\.0\.0\.1|::ffff:127\.0\.0\.1)$/.test(req.socket.remoteAddress || "") && !req.headers["x-forwarded-for"] && !req.headers["tailscale-user-login"];
  const assinar = dir => crypto.createHmac("sha256", segredoRaw).update(dir).digest("hex").slice(0, 24);

  function cabecalhosCors(res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "X-Tinteiro-Token, Content-Type, X-Base-Ver, X-Explicit");
    res.setHeader("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Expose-Headers", "X-Ver, X-Mtime, X-Size");
    res.setHeader("Access-Control-Allow-Private-Network", "true");
    res.setHeader("Access-Control-Max-Age", "600");
  }

  function json(res, status, obj) {
    const b = Buffer.from(JSON.stringify(obj));
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": b.length, "Cache-Control": "no-store" });
    res.end(b);
  }

  function lerCorpo(req, limite = 1024 * 1024 * 1024) {
    return new Promise((resolve, reject) => {
      const partes = []; let total = 0;
      req.on("data", d => { total += d.length; if (total > limite) { reject(new ErroCofre(413, "arquivo grande demais")); req.destroy(); } else partes.push(d); });
      req.on("end", () => resolve(Buffer.concat(partes)));
      req.on("error", reject);
    });
  }
  const lerJson = async req => { const b = await lerCorpo(req, 10 * 1024 * 1024); return b.length ? JSON.parse(b.toString("utf8")) : {}; };

  async function servirEstatico(req, res, url) {
    let rel = decodeURIComponent(url.pathname);
    if (rel === "/" || rel === "") rel = "/index.html";
    const a = path.join(webDir, path.normalize(rel).replace(/^([/\\])+/, ""));
    if (!a.startsWith(webDir)) return json(res, 400, { error: "inválido" });
    let st = await fsp.stat(a).catch(() => null);
    let alvo = a;
    if (!st || !st.isFile()) { alvo = path.join(webDir, "index.html"); st = await fsp.stat(alvo).catch(() => null); }
    if (!st) { res.writeHead(404); return res.end("interface não encontrada (rode npm run build:web)"); }
    const semCache = /index\.html$|sw\.js$|\.webmanifest$|versao\.json$/.test(alvo);
    res.writeHead(200, { "Content-Type": mimeDe(alvo), "Content-Length": st.size, "Cache-Control": semCache ? "no-cache" : "public, max-age=300" });
    fs.createReadStream(alvo).pipe(res);
  }

  async function enviarArquivo(res, rel, extra = {}) {
    const a = vault.abs(rel);
    const st = await fsp.stat(a).catch(() => null);
    if (!st || !st.isFile()) throw new ErroCofre(404, "arquivo não encontrado");
    res.writeHead(200, { "Content-Type": mimeDe(a), "Content-Length": st.size, "Cache-Control": "no-store", "X-Ver": st.size + ":" + Math.floor(st.mtimeMs), "X-Mtime": String(st.mtimeMs), "X-Size": String(st.size), ...extra });
    fs.createReadStream(a).pipe(res);
  }

  function urls() {
    const porta = portaReal || config.get("port");
    const lista = ipsLocais().filter(x => !x.virtual).map(x => `http://${x.ip}:${porta}`);
    return lista;
  }

  async function api(req, res, url) {
    const p = url.pathname;
    const q = k => url.searchParams.get(k);
    const tk = req.headers["x-tinteiro-token"] || q("t");
    if (!tk || tk.length !== token().length || !crypto.timingSafeEqual(Buffer.from(tk), Buffer.from(token()))) return json(res, 401, { error: "código de acesso inválido" });
    const local = ehLocal(req);
    const so = () => { if (!local) throw new ErroCofre(403, "só no próprio computador"); };

    switch (`${req.method} ${p}`) {
      case "GET /api/info":
        return json(res, 200, {
          app: "Tinteiro", version: versao, root: config.get("root"), vaultName: path.basename(config.get("root")) || config.get("root"),
          device: config.get("deviceName"), platform: process.platform, local, lan: !!config.get("lan"), port: portaReal,
        });
      case "GET /api/tree":
        return json(res, 200, { entries: await vault.list(), time: Date.now() });
      case "GET /api/file":
        return enviarArquivo(res, q("path"));
      case "GET /api/stat":
        return json(res, 200, await vault.stat(q("path")));
      case "PUT /api/file": {
        const dados = await lerCorpo(req);
        const baseVer = req.headers["x-base-ver"];
        const info = await vault.write(q("path"), dados, { explicito: req.headers["x-explicit"] === "1", baseVer: baseVer === undefined ? null : baseVer });
        indexer.mudou([info.path]).catch(() => {});
        enviarEvento({ type: "change", paths: [info.path], origem: req.headers["x-origem"] || null });
        return json(res, 200, info);
      }
      case "POST /api/create": {
        const b = await lerJson(req);
        const info = await vault.create(b.path, b.base64 ? Buffer.from(b.base64, "base64") : Buffer.from(b.text || "", "utf8"));
        enviarEvento({ type: "change", paths: [b.path] });
        return json(res, 200, info);
      }
      case "POST /api/upload": { // cria arquivo novo com o corpo binário (não sobrescreve)
        const dados = await lerCorpo(req);
        const info = await vault.create(q("path"), dados);
        indexer.mudou([info.path]).catch(() => {});
        enviarEvento({ type: "change", paths: [info.path] });
        return json(res, 200, info);
      }
      case "POST /api/mkdir": {
        const b = await lerJson(req);
        const r = await vault.mkdir(b.path);
        enviarEvento({ type: "change", paths: [b.path] });
        return json(res, 200, r);
      }
      case "POST /api/rename": {
        const b = await lerJson(req);
        const r = await vault.rename(b.from, b.to);
        indexer.renomeado(b.from, b.to);
        enviarEvento({ type: "rename", from: b.from, to: b.to });
        return json(res, 200, r);
      }
      case "POST /api/copy": {
        const b = await lerJson(req);
        const r = await vault.copy(b.from, b.to);
        indexer.mudou([b.to]).catch(() => {});
        enviarEvento({ type: "change", paths: [b.to] });
        return json(res, 200, r);
      }
      case "POST /api/delete": {
        const b = await lerJson(req);
        if (b.baseVer) {
          const st = await vault.stat(b.path);
          if (st && st.ver && st.ver !== b.baseVer) throw new ErroCofre(409, "o arquivo mudou no computador");
        }
        const r = await vault.remove(b.path);
        indexer.mudou([b.path]).catch(() => {});
        enviarEvento({ type: "delete", path: b.path });
        return json(res, 200, r);
      }
      case "GET /api/history":
        return json(res, 200, { versions: await vault.history(q("path")) });
      case "GET /api/history/file": {
        const dados = await vault.readVersion(q("path"), q("id"));
        res.writeHead(200, { "Content-Type": mimeDe(q("path")), "Content-Length": dados.length, "Cache-Control": "no-store" });
        return res.end(dados);
      }
      case "POST /api/history/restore": {
        const b = await lerJson(req);
        const info = await vault.restore(b.path, b.id);
        enviarEvento({ type: "change", paths: [b.path] });
        return json(res, 200, info);
      }
      case "GET /api/search":
        return json(res, 200, { results: await indexer.buscar(q("q") || ""), ready: indexer.pronto, pending: indexer.fila.length });
      case "GET /api/config":
        return json(res, 200, (await vault.readConfig(q("name"))) || {});
      case "PUT /api/config":
        await vault.writeConfig(q("name"), await lerJson(req));
        return json(res, 200, { ok: true });
      case "GET /api/raw-url": { // endereço para abrir HTML com seus arquivos vizinhos (imagens, css)
        const rel = vault.abs(q("path")) && q("path").replace(/^\/+/, "");
        const dir = rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : "";
        const nome = rel.slice(dir ? dir.length + 1 : 0);
        const base = `/raw/${assinar(dir)}/${dir ? dir.split("/").map(encodeURIComponent).join("/") + "/" : ""}`;
        return json(res, 200, { url: base + encodeURIComponent(nome) });
      }
      case "GET /api/events": {
        res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" });
        res.write(`data: ${JSON.stringify({ type: "hello" })}\n\n`);
        clientes.add(res);
        const ping = setInterval(() => { try { res.write(": ping\n\n"); } catch (e) {} }, 25000);
        req.on("close", () => { clearInterval(ping); clientes.delete(res); });
        return;
      }
      case "GET /api/sync/manifest": {
        const entries = await vault.list();
        return json(res, 200, { entries, time: Date.now(), device: config.get("deviceName"), version: versao });
      }
      // ------- só no próprio computador -------
      case "POST /api/open-external": {
        so(); const b = await lerJson(req);
        if (!hooks.openPath) throw new ErroCofre(501, "indisponível");
        const erro = await hooks.openPath(vault.abs(b.path));
        if (erro) throw new ErroCofre(500, erro);
        return json(res, 200, { ok: true });
      }
      case "POST /api/reveal": {
        so(); const b = await lerJson(req);
        if (!hooks.reveal) throw new ErroCofre(501, "indisponível");
        hooks.reveal(vault.abs(b.path));
        return json(res, 200, { ok: true });
      }
      case "GET /api/pairing": {
        so();
        const ts = await tailscale.status().catch(() => null);
        const t = token();
        const lista = urls();
        const principal = lista[0] || `http://127.0.0.1:${portaReal}`;
        const link = `${principal}/parear?t=${encodeURIComponent(t)}`;
        return json(res, 200, { token: t, urls: lista, link, tailscale: ts, port: portaReal, device: config.get("deviceName") });
      }
      case "POST /api/pairing/reset": {
        so(); config.novoToken();
        return json(res, 200, { token: token() });
      }
      case "POST /api/tailscale/serve": {
        so();
        const r = await tailscale.serve(portaReal);
        return json(res, 200, r);
      }
      case "GET /api/settings": {
        so();
        return json(res, 200, { root: config.get("root"), port: config.get("port"), lan: config.get("lan"), deviceName: config.get("deviceName") });
      }
      case "PUT /api/settings": {
        so(); const b = await lerJson(req);
        let reabrir = false;
        if (typeof b.root === "string" && b.root && b.root !== config.get("root")) {
          if (!path.isAbsolute(b.root)) throw new ErroCofre(400, "use um caminho completo, como C:\\CL");
          await fsp.mkdir(b.root, { recursive: true });
          config.set("root", b.root); reabrir = true;
        }
        if (typeof b.lan === "boolean" && b.lan !== config.get("lan")) { config.set("lan", b.lan); setTimeout(() => reiniciar().catch(() => {}), 300); }
        if (typeof b.deviceName === "string" && b.deviceName.trim()) config.set("deviceName", b.deviceName.trim());
        if (reabrir) { await abrirCofre(); enviarEvento({ type: "vault" }); }
        return json(res, 200, { ok: true, root: config.get("root") });
      }
      case "POST /api/choose-folder": {
        so();
        if (!hooks.chooseFolder) throw new ErroCofre(501, "indisponível");
        return json(res, 200, { path: await hooks.chooseFolder() });
      }
    }
    return json(res, 404, { error: "rota desconhecida" });
  }

  async function servirRaw(req, res, url) {
    // /raw/<assinatura>/<pasta...>/<arquivo>
    const partes = url.pathname.split("/").slice(2).map(decodeURIComponent);
    const assinatura = partes.shift();
    const rel = partes.join("/");
    // a assinatura vale para a pasta do HTML e suas subpastas
    let dir = rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : "";
    let ok = false;
    for (;;) {
      if (assinar(dir) === assinatura) { ok = true; break; }
      if (!dir) break;
      dir = dir.includes("/") ? dir.slice(0, dir.lastIndexOf("/")) : "";
    }
    if (!ok) return json(res, 403, { error: "sem permissão" });
    return enviarArquivo(res, rel, { "Content-Security-Policy": "sandbox allow-scripts allow-popups allow-forms allow-modals allow-downloads" });
  }

  function paginaPareamento(res, url) {
    const t = url.searchParams.get("t") || "";
    const base = `http://${url.host}`;
    const intent = `intent://parear?u=${encodeURIComponent(base)}&t=${encodeURIComponent(t)}#Intent;scheme=tinteiro;package=app.tinteiro.editor;end`;
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tinteiro — parear celular</title><style>body{font:16px -apple-system,system-ui,Segoe UI,Roboto,sans-serif;background:#1e1e1e;color:#dadada;margin:0;padding:24px;max-width:520px}
a.b{display:block;background:#8a5cf5;color:#fff;text-decoration:none;padding:14px 16px;border-radius:8px;margin:14px 0;text-align:center;font-weight:600}
a.s{background:#363636}p{color:#b3b3b3;line-height:1.5}h1{font-size:22px}</style></head><body>
<h1>Parear este celular com o computador</h1>
<p><b>Android:</b> com o app Tinteiro instalado, toque no botão abaixo.</p>
<a class="b" href="${intent}">Abrir no app Tinteiro</a>
<p><b>iPhone:</b> abra o endereço seguro do computador (Tailscale) mostrado na tela de pareamento do computador e depois use “Compartilhar → Adicionar à Tela de Início”.</p>
<a class="b s" href="/#pair=${encodeURIComponent(t)}">Usar pelo navegador agora</a>
</body></html>`;
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    res.end(html);
  }

  async function tratar(req, res) {
    const url = new URL(req.url, "http://x");
    try {
      if (url.pathname.startsWith("/api/")) {
        cabecalhosCors(res);
        if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
        return await api(req, res, url);
      }
      if (url.pathname.startsWith("/raw/")) return await servirRaw(req, res, url);
      if (url.pathname === "/parear") return paginaPareamento(res, url);
      return await servirEstatico(req, res, url);
    } catch (e) {
      const status = e.status || (e.code === "ENOENT" ? 404 : e.code === "EACCES" || e.code === "EPERM" ? 423 : 500);
      if (!res.headersSent) json(res, status, { error: e.message || String(e), code: e.code || null });
      else try { res.end(); } catch (x) {}
    }
  }

  function escutar(porta, host) {
    return new Promise((resolve, reject) => {
      const s = http.createServer(tratar);
      s.keepAliveTimeout = 30000;
      s.once("error", reject);
      s.listen(porta, host, () => { s.removeListener("error", reject); resolve(s); });
    });
  }

  async function iniciar() {
    if (!vault) await abrirCofre();
    const host = config.get("lan") ? "0.0.0.0" : "127.0.0.1";
    let porta = Number(config.get("port")) || 27182;
    for (let i = 0; i < 20; i++) {
      try { servidor = await escutar(porta + i, host); portaReal = porta + i; break; }
      catch (e) { if (e.code !== "EADDRINUSE" || i === 19) throw e; }
    }
    return { port: portaReal, url: `http://127.0.0.1:${portaReal}`, token: token() };
  }

  async function parar() {
    for (const c of clientes) try { c.end(); } catch (e) {}
    clientes.clear();
    if (servidor) await new Promise(r => servidor.close(() => r()));
    servidor = null;
  }

  async function reiniciar() { await parar(); return iniciar(); }

  return {
    iniciar, parar, reiniciar,
    get vault() { return vault; },
    get porta() { return portaReal; },
    token, urls,
  };
}

module.exports = { criarServidor, ipsLocais };
