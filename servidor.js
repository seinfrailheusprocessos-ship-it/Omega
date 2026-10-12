// Servidor local do Omega: serve esta pasta, guarda dados/estado.json e (só neste computador)
// deixa o Omega procurar/abrir pastas e ver arquivos das pastas liberadas em dados/config.json.
// Uso:  node servidor.js        (depois abra http://localhost:8765)
// Não precisa instalar nada além do Node.
const http = require("http"), fs = require("fs"), path = require("path"), os = require("os"), { execFile, spawn } = require("child_process");
const RAIZ = __dirname, PORTA = Number(process.env.PORTA) || 8765;
const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json" };
const ARQ = { ".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".txt": "text/plain; charset=utf-8", ".json": "application/json; charset=utf-8" };

/* pastas liberadas: dados/config.json  {"raizes": ["C:\\CL"]}  (ou variável OMEGA_RAIZES separada por ;) */
function config() { try { return JSON.parse(fs.readFileSync(path.join(RAIZ, "dados", "config.json"), "utf8")); } catch (e) { return {}; } }
function scripts() { return (config().scripts || []).filter(s => s && s.id && Array.isArray(s.comando) && s.comando.length); }
function raizes() {
  let r = [];
  try { r = config().raizes || []; } catch (e) {}
  if (process.env.OMEGA_RAIZES) r = process.env.OMEGA_RAIZES.split(";").filter(Boolean);
  return r.map(x => String(x)).filter(x => path.isAbsolute(x) && fs.existsSync(x));
}
function dentro(caminho) {
  try {
    const real = fs.realpathSync(caminho);
    return raizes().some(r => { const rr = fs.realpathSync(r), a = process.platform === "win32" ? real.toLowerCase() : real, b = process.platform === "win32" ? rr.toLowerCase() : rr; return a === b || a.startsWith(b + path.sep); }) ? real : null;
  } catch (e) { return null; }
}
const local = req => /^(::1|127\.0\.0\.1|::ffff:127\.0\.0\.1)$/.test(req.socket.remoteAddress || "");
let indice = null, indiceEm = 0;
function montarIndice() {
  if (indice && Date.now() - indiceEm < 60000) return indice;
  const out = []; const MAX = 80000;
  const anda = (dir, prof) => {
    if (out.length >= MAX || prof > 6) return;
    let ents; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const e of ents) {
      if (out.length >= MAX) return;
      if (e.name.startsWith(".") || e.name === "node_modules" || e.name === "$RECYCLE.BIN") continue;
      const p = path.join(dir, e.name);
      out.push({ nome: e.name, caminho: p, dir: e.isDirectory() });
      if (e.isDirectory()) anda(p, prof + 1);
    }
  };
  raizes().forEach(r => anda(r, 0));
  indice = out; indiceEm = Date.now(); return out;
}
const norm = s => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const json = (res, obj, cod) => { res.writeHead(cod || 200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); res.end(JSON.stringify(obj)); };
function corpoJson(req, cb, limite) { const p = []; let n = 0; req.on("data", c => { n += c.length; if (n < (limite || 20000)) p.push(c); }); req.on("end", () => { try { cb(JSON.parse(Buffer.concat(p).toString())); } catch (e) { cb(null); } }); }
const nomeSeguro = n => path.basename(String(n || "")).replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").replace(/^\.+/, "").trim().slice(0, 180);
function livre(dir, nome) { let p = path.join(dir, nome), i = 2; const ext = path.extname(nome), base = path.basename(nome, ext); while (fs.existsSync(p)) p = path.join(dir, `${base} (${i++})${ext}`); return p; }
const jobs = new Map();

http.createServer((req, res) => {
  const u = new URL(req.url || "/", "http://x"), url = decodeURIComponent(u.pathname);
  const rel = url === "/" ? "/index.html" : url;

  if (rel.startsWith("/api/")) {
    if (!local(req)) { res.writeHead(403); return res.end(); }   // só o próprio computador
    if (req.method === "GET" && rel === "/api/status") return json(res, { raizes: raizes(), scripts: scripts().map(x => ({ id: x.id, nome: x.nome || x.id, aplicaA: x.aplicaA === "pasta" ? "pasta" : "arquivo", extensoes: (x.extensoes || []).map(e => String(e).toLowerCase()) })) });
    if (req.method === "POST" && rel === "/api/enviar") {      // upload de arquivo para uma pasta liberada
      const dir = dentro(u.searchParams.get("caminho") || ""), nome = nomeSeguro(u.searchParams.get("nome"));
      if (!dir || !nome || !fs.statSync(dir).isDirectory()) { res.writeHead(403); return res.end(); }
      const destino = livre(dir, nome), out = fs.createWriteStream(destino); let n = 0, falhou = false;
      req.on("data", c => { n += c.length; if (n > 800e6 && !falhou) { falhou = true; req.destroy(); out.destroy(); try { fs.unlinkSync(destino); } catch (e) {} } });
      req.pipe(out);
      out.on("finish", () => json(res, { caminho: destino }));
      out.on("error", () => { res.writeHead(500); res.end(); });
      return;
    }
    if (req.method === "POST" && rel === "/api/renomear") {
      return corpoJson(req, b => {
        const orig = b && dentro(String(b.caminho || "")), nome = b && nomeSeguro(b.novoNome);
        if (!orig || !nome) { res.writeHead(403); return res.end(); }
        const novo = path.join(path.dirname(orig), nome);
        if (fs.existsSync(novo)) { res.writeHead(409); return res.end(); }
        try { fs.renameSync(orig, novo); json(res, { caminho: novo }); } catch (e) { res.writeHead(500); res.end(); }
      });
    }
    if (req.method === "POST" && rel === "/api/criar-pasta") {
      return corpoJson(req, b => {
        const alvo = b && String(b.caminho || "");
        if (!alvo || !path.isAbsolute(alvo)) { res.writeHead(400); return res.end(); }
        // sobe até achar um pai que exista e confira se está dentro de uma pasta liberada
        let pai = path.dirname(alvo); while (!fs.existsSync(pai) && path.dirname(pai) !== pai) pai = path.dirname(pai);
        if (!dentro(pai) && !dentro(alvo)) { res.writeHead(403); return res.end(); }
        try { fs.mkdirSync(alvo, { recursive: true }); json(res, { caminho: alvo }); } catch (e) { res.writeHead(500); res.end(); }
      });
    }
    if (req.method === "POST" && rel === "/api/salvar") {       // grava o relatório de retorno (texto) na pasta do objeto
      return corpoJson(req, b => {
        const dir = b && dentro(String(b.caminho || "")), nome = b && nomeSeguro(b.nome);
        if (!dir || !nome || !fs.statSync(dir).isDirectory() || !/\.(txt|md|json)$/i.test(nome)) { res.writeHead(403); return res.end(); }
        try { const p = path.join(dir, nome); fs.writeFileSync(p, String(b.texto || ""), "utf8"); json(res, { caminho: p }); } catch (e) { res.writeHead(500); res.end(); }
      }, 5e6);
    }
    if (req.method === "POST" && rel === "/api/executar") {      // roda um script que VOCÊ cadastrou em dados/config.json
      return corpoJson(req, b => {
        const sc = b && scripts().find(x => x.id === b.script), alvo = b && dentro(String(b.caminho || ""));
        if (!sc || !alvo) { res.writeHead(403); return res.end(); }
        const ehDir = fs.statSync(alvo).isDirectory();
        if ((sc.aplicaA === "pasta") !== ehDir) { res.writeHead(400); return res.end(); }
        const exts = (sc.extensoes || []).map(e => String(e).toLowerCase());
        if (exts.length && !exts.includes(path.extname(alvo).toLowerCase())) { res.writeHead(400); return res.end(); }
        if (/(^|[\\/])(cmd|powershell|pwsh)(\.exe)?$/i.test(String(sc.comando[0])) && /[&|<>^%"`;$()]/.test(alvo)) { return json(res, { erro: "nome de arquivo com caracteres que o Windows interpretaria; renomeie antes" }, 400); }
        const subs = { "{arquivo}": alvo, "{pasta}": ehDir ? alvo : path.dirname(alvo), "{nome}": path.basename(alvo) };
        const args = sc.comando.map(a => Object.keys(subs).reduce((t, k) => t.split(k).join(subs[k]), String(a)));
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const job = { id, script: sc.id, alvo, saida: "", status: "rodando", codigo: null };
        jobs.set(id, job); if (jobs.size > 40) jobs.delete(jobs.keys().next().value);
        const add = d => { job.saida = (job.saida + d.toString()).slice(-200000); };
        try {
          const pr = spawn(args[0], args.slice(1), { cwd: sc.cwd && fs.existsSync(sc.cwd) ? sc.cwd : (ehDir ? alvo : path.dirname(alvo)), windowsHide: true, shell: false });
          pr.stdout.on("data", add); pr.stderr.on("data", add);
          pr.on("error", e => { add("\nErro ao iniciar: " + e.message + "\n"); job.status = "erro"; });
          pr.on("close", c => { job.codigo = c; if (job.status === "rodando") job.status = c === 0 ? "ok" : "erro"; });
        } catch (e) { add("Erro: " + e.message); job.status = "erro"; }
        json(res, { job: id });
      });
    }
    if (req.method === "GET" && rel === "/api/job") { const j = jobs.get(u.searchParams.get("id") || ""); return j ? json(res, j) : json(res, { erro: "?" }, 404); }
    if (req.method === "GET" && rel === "/api/pastas") {
      const toks = norm(u.searchParams.get("q") || "").split(/\s+/).filter(Boolean);
      if (!toks.length || !raizes().length) return json(res, []);
      const achados = montarIndice().filter(x => { const c = norm(x.caminho); return toks.every(t => c.includes(t)); });
      achados.sort((a, b) => (b.dir - a.dir) || (a.caminho.length - b.caminho.length));
      return json(res, achados.slice(0, 30));
    }
    if (req.method === "GET" && rel === "/api/listar") {
      const dir = dentro(u.searchParams.get("caminho") || "");
      if (!dir || !fs.statSync(dir).isDirectory()) return json(res, { erro: "fora das pastas liberadas" }, 403);
      const lista = [];
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name.startsWith(".")) continue;
        const p = path.join(dir, e.name); let st; try { st = fs.statSync(p); } catch (x) { continue; }
        lista.push({ nome: e.name, caminho: p, dir: e.isDirectory(), tam: st.size, data: st.mtimeMs });
      }
      lista.sort((a, b) => (b.dir - a.dir) || a.nome.localeCompare(b.nome, "pt-BR", { numeric: true }));
      return json(res, lista);
    }
    if (req.method === "GET" && rel === "/api/arquivo") {
      const arq = dentro(u.searchParams.get("caminho") || "");
      if (!arq || !fs.statSync(arq).isFile()) { res.writeHead(403); return res.end(); }
      const tipo = ARQ[path.extname(arq).toLowerCase()];
      res.writeHead(200, { "Content-Type": tipo || "application/octet-stream", "Content-Disposition": tipo ? "inline" : "attachment", "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" });
      return fs.createReadStream(arq).pipe(res);
    }
    if (req.method === "POST" && rel === "/api/abrir-pasta") {
      return corpoJson(req, b => {
        const caminho = b && String(b.caminho || "");
        if (!caminho || !path.isAbsolute(caminho) || !fs.existsSync(caminho)) { res.writeHead(404); return res.end(); }
        const ehDir = fs.statSync(caminho).isDirectory();
        if (!ehDir && !dentro(caminho)) { res.writeHead(403); return res.end(); }   // arquivos: só dentro das pastas liberadas
        if (process.platform === "win32") execFile("explorer.exe", ehDir ? [caminho] : ["/select," + caminho], () => {});
        else execFile(process.platform === "darwin" ? "open" : "xdg-open", [ehDir ? caminho : path.dirname(caminho)], () => {});
        res.writeHead(204); res.end();
      });
    }
    res.writeHead(404); return res.end();
  }

  const arq = path.normalize(path.join(RAIZ, rel));
  if (!arq.startsWith(RAIZ)) { res.writeHead(403); return res.end(); }
  if (req.method === "PUT") {
    if (rel !== "/dados/estado.json") { res.writeHead(403); return res.end(); }
    let n = 0; const partes = [];
    req.on("data", c => { n += c.length; if (n > 20e6) { res.writeHead(413); res.end(); req.destroy(); } else partes.push(c); });
    req.on("end", () => { try { fs.mkdirSync(path.join(RAIZ, "dados"), { recursive: true }); fs.writeFileSync(arq, Buffer.concat(partes)); res.writeHead(204); } catch (e) { res.writeHead(500); } res.end(); });
    return;
  }
  if (req.method !== "GET") { res.writeHead(405); return res.end(); }
  if (rel === "/dados/config.json") { res.writeHead(403); return res.end(); }
  fs.readFile(arq, (e, dados) => {
    if (e) { res.writeHead(404); return res.end("Não encontrado"); }
    res.writeHead(200, { "Content-Type": TIPOS[path.extname(arq)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(dados);
  });
}).listen(PORTA, "0.0.0.0", () => {
  console.log("Omega no ar.\n  No computador:  http://localhost:" + PORTA);
  Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === "IPv4" && !i.internal).forEach(i => console.log("  No celular (mesma rede Wi-Fi):  http://" + i.address + ":" + PORTA));
  const r = raizes(); console.log(r.length ? "Pastas liberadas para o Omega: " + r.join(", ") : "Nenhuma pasta liberada (crie dados/config.json com {\"raizes\": [\"C:\\\\CL\"]} para ver pastas no Omega).");
  console.log("Deixe esta janela aberta. Para parar, feche a janela (ou Ctrl+C).");
});
