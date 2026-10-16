// Acesso ao cofre (pasta raiz) no disco: listar, ler, gravar com histórico, renomear, excluir.
"use strict";
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const crypto = require("crypto");
const { EventEmitter } = require("events");

const DADOS = ".tinteiro"; // pasta oculta do app dentro do cofre (histórico, cache, configuração)
const IGNORAR = new Set(["$RECYCLE.BIN", "System Volume Information", "node_modules", "desktop.ini", "Thumbs.db", ".DS_Store"]);
const HIST_MAX = 60;          // versões guardadas por arquivo
const HIST_DIAS = 365;        // versões mais antigas que isso são apagadas (mantendo as 10 últimas)
const HIST_INTERVALO = 5 * 60 * 1000; // gravação automática: no máximo uma cópia a cada 5 min

function ignorado(nome) {
  return nome.startsWith(".") || nome.startsWith("~$") || IGNORAR.has(nome) || nome.endsWith(".tmp~");
}

function carimbo(d = new Date()) {
  const p = (n, l = 2) => String(n).padStart(l, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}-${p(d.getMilliseconds(), 3)}`;
}

/** identificação da versão de um arquivo para a sincronização: tamanho + data de modificação */
function versao(st) { return st.size + ":" + Math.floor(st.mtimeMs); }

class ErroCofre extends Error {
  constructor(status, msg) { super(msg); this.status = status; }
}

class Vault extends EventEmitter {
  constructor(root, opts = {}) {
    super();
    this.root = path.resolve(root);
    this.trash = opts.trash || null; // função(caminhoAbsoluto) → envia para a lixeira do sistema
    this.hashCache = new Map();
    this.ultimoBackup = new Map();
    this.watchers = [];
    this.proprios = new Map(); // gravações feitas pelo próprio app (para não avisar como mudança externa)
  }

  get dataDir() { return path.join(this.root, DADOS); }

  async init() {
    await fsp.mkdir(this.root, { recursive: true });
    await fsp.mkdir(this.dataDir, { recursive: true });
    if (process.platform === "win32") {
      try { require("child_process").execFile("attrib", ["+h", this.dataDir], () => {}); } catch (e) {}
    }
    try {
      const j = JSON.parse(await fsp.readFile(path.join(this.dataDir, "cache", "hashes.json"), "utf8"));
      for (const [k, v] of Object.entries(j)) this.hashCache.set(k, v);
    } catch (e) {}
  }

  /** caminho relativo (com /) → absoluto, recusando sair da raiz */
  abs(rel, { permitirDados = false } = {}) {
    if (typeof rel !== "string") throw new ErroCofre(400, "caminho inválido");
    rel = rel.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");
    const partes = rel.split("/").filter(Boolean);
    if (partes.some(p => p === ".." || p === ".")) throw new ErroCofre(400, "caminho inválido");
    if (!permitirDados && partes[0] === DADOS) throw new ErroCofre(403, "pasta reservada");
    const a = path.join(this.root, ...partes);
    if (a !== this.root && !a.startsWith(this.root + path.sep)) throw new ErroCofre(400, "fora da pasta raiz");
    return a;
  }

  rel(abs) { return path.relative(this.root, abs).split(path.sep).join("/"); }

  /** lista com cache: refeita quando algo muda (observação de pastas) ou a cada 10 s sem observação */
  async list() {
    const valido = this.cacheLista && (this.observando ? true : Date.now() - this.cacheLista.em < 10000);
    if (valido) return this.cacheLista.itens;
    if (this._listando) return this._listando;
    this._listando = this.listarDisco().then(itens => { this.cacheLista = { itens, em: Date.now() }; return itens; }).finally(() => { this._listando = null; });
    return this._listando;
  }
  invalidarLista() { this.cacheLista = null; }

  async listarDisco() {
    const out = [];
    const anda = async (dir, prof) => {
      if (out.length > 300000 || prof > 40) return;
      let ents;
      try { ents = await fsp.readdir(dir, { withFileTypes: true }); } catch (e) { return; }
      const subs = [];
      for (const e of ents) {
        if (ignorado(e.name)) continue;
        const p = path.join(dir, e.name);
        let st;
        try { st = await fsp.stat(p); } catch (err) { continue; }
        if (st.isDirectory()) { out.push({ path: this.rel(p), type: "folder", mtime: st.mtimeMs }); subs.push(p); }
        else if (st.isFile()) out.push({ path: this.rel(p), type: "file", size: st.size, mtime: st.mtimeMs, ver: versao(st) });
      }
      for (const s of subs) await anda(s, prof + 1);
    };
    await anda(this.root, 0);
    return out;
  }

  async stat(rel) {
    const st = await fsp.stat(this.abs(rel)).catch(() => null);
    if (!st) return null;
    return { path: rel, type: st.isDirectory() ? "folder" : "file", size: st.size, mtime: st.mtimeMs, ver: st.isFile() ? versao(st) : null };
  }

  async read(rel) {
    const a = this.abs(rel);
    try { return await fsp.readFile(a); }
    catch (e) { if (e.code === "ENOENT") throw new ErroCofre(404, "arquivo não encontrado"); throw e; }
  }

  async hash(rel) {
    const a = this.abs(rel);
    const st = await fsp.stat(a);
    const c = this.hashCache.get(rel);
    if (c && c.size === st.size && c.mtime === st.mtimeMs) return c.hash;
    const h = await new Promise((res, rej) => {
      const hs = crypto.createHash("sha1");
      fs.createReadStream(a).on("data", d => hs.update(d)).on("end", () => res(hs.digest("hex"))).on("error", rej);
    });
    this.hashCache.set(rel, { size: st.size, mtime: st.mtimeMs, hash: h });
    this.salvarHashes();
    return h;
  }

  salvarHashes() {
    clearTimeout(this._th);
    this._th = setTimeout(async () => {
      try {
        await fsp.mkdir(path.join(this.dataDir, "cache"), { recursive: true });
        await fsp.writeFile(path.join(this.dataDir, "cache", "hashes.json"), JSON.stringify(Object.fromEntries(this.hashCache)));
      } catch (e) {}
    }, 2000);
  }

  histDir(rel) { return path.join(this.dataDir, "historico", ...rel.split("/")); }

  /** guarda a versão atual do arquivo no histórico antes de gravar por cima */
  async backup(rel, { forcar = false } = {}) {
    const a = this.abs(rel);
    const st = await fsp.stat(a).catch(() => null);
    if (!st || !st.isFile()) return null;
    const ult = this.ultimoBackup.get(rel) || 0;
    if (!forcar && Date.now() - ult < HIST_INTERVALO) return null;
    const dir = this.histDir(rel);
    await fsp.mkdir(dir, { recursive: true });
    const ext = path.extname(rel);
    const nome = carimbo(new Date(st.mtimeMs)) + ext;
    const destino = path.join(dir, nome);
    if (!fs.existsSync(destino)) await fsp.copyFile(a, destino);
    this.ultimoBackup.set(rel, Date.now());
    this.limparHistorico(rel).catch(() => {});
    return nome;
  }

  async limparHistorico(rel) {
    const dir = this.histDir(rel);
    let ns = (await fsp.readdir(dir).catch(() => [])).filter(n => /^\d{8}-\d{6}-\d{3}/.test(n)).sort();
    const limite = Date.now() - HIST_DIAS * 864e5;
    const apagar = [];
    if (ns.length > HIST_MAX) apagar.push(...ns.slice(0, ns.length - HIST_MAX));
    const resto = ns.slice(apagar.length);
    for (const n of resto.slice(0, Math.max(0, resto.length - 10))) {
      const st = await fsp.stat(path.join(dir, n)).catch(() => null);
      if (st && st.mtimeMs < limite) apagar.push(n);
    }
    for (const n of apagar) await fsp.unlink(path.join(dir, n)).catch(() => {});
  }

  async history(rel) {
    const dir = this.histDir(rel);
    const ns = (await fsp.readdir(dir).catch(() => [])).filter(n => /^\d{8}-\d{6}-\d{3}/.test(n)).sort().reverse();
    const out = [];
    for (const n of ns) {
      const st = await fsp.stat(path.join(dir, n)).catch(() => null);
      if (st) {
        const m = n.match(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})-(\d{3})/);
        const quando = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6], +m[7]).getTime();
        out.push({ id: n, size: st.size, time: quando });
      }
    }
    return out;
  }

  async readVersion(rel, id) {
    if (!/^[\w.-]+$/.test(id)) throw new ErroCofre(400, "versão inválida");
    try { return await fsp.readFile(path.join(this.histDir(rel), id)); }
    catch (e) { throw new ErroCofre(404, "versão não encontrada"); }
  }

  async restore(rel, id) {
    const dados = await this.readVersion(rel, id);
    return this.write(rel, dados, { explicito: true });
  }

  /** grava com cópia de segurança da versão anterior e troca atômica */
  async write(rel, dados, { explicito = false, baseVer = null } = {}) {
    const a = this.abs(rel);
    const existe = fs.existsSync(a);
    if (baseVer !== null && baseVer !== undefined) {
      const st = existe ? await fsp.stat(a) : null;
      const atual = st ? versao(st) : "";
      if (atual !== baseVer) throw new ErroCofre(409, "o arquivo mudou no computador");
    }
    await fsp.mkdir(path.dirname(a), { recursive: true });
    if (existe) {
      const antigo = await fsp.readFile(a);
      if (antigo.equals(dados)) return this.info(rel);
      await this.backup(rel, { forcar: explicito });
    }
    const tmp = path.join(path.dirname(a), "." + path.basename(a) + "." + process.pid + ".tmp~");
    await fsp.writeFile(tmp, dados);
    try {
      await this.renomearSeguro(tmp, a);
    } catch (e) {
      await fsp.unlink(tmp).catch(() => {});
      if (e.code === "EPERM" || e.code === "EBUSY" || e.code === "EACCES") {
        // arquivo travado (aberto no Word, por exemplo): tenta gravar por cima
        try { await fsp.writeFile(a, dados); }
        catch (e2) { throw new ErroCofre(423, "o arquivo está aberto em outro programa; feche-o e tente de novo"); }
      } else throw e;
    }
    this.marcarProprio(rel);
    return this.info(rel);
  }

  async renomearSeguro(de, para) {
    for (let i = 0; i < 5; i++) {
      try { return await fsp.rename(de, para); }
      catch (e) { if (i === 4 || !["EPERM", "EBUSY", "EACCES"].includes(e.code)) throw e; await new Promise(r => setTimeout(r, 120 * (i + 1))); }
    }
  }

  async info(rel) {
    const st = await fsp.stat(this.abs(rel));
    return { path: rel, type: st.isDirectory() ? "folder" : "file", size: st.size, mtime: st.mtimeMs, ver: st.isFile() ? versao(st) : null };
  }

  marcarProprio(rel) { this.proprios.set(rel, Date.now()); this.invalidarLista(); }

  async mkdir(rel) {
    const a = this.abs(rel);
    await fsp.mkdir(a, { recursive: true });
    this.marcarProprio(rel);
    return { path: rel, type: "folder" };
  }

  async create(rel, dados) {
    const a = this.abs(rel);
    if (fs.existsSync(a)) throw new ErroCofre(409, "já existe um arquivo com esse nome");
    await fsp.mkdir(path.dirname(a), { recursive: true });
    await fsp.writeFile(a, dados || Buffer.alloc(0));
    this.marcarProprio(rel);
    return this.info(rel);
  }

  async rename(de, para) {
    const a = this.abs(de), b = this.abs(para);
    if (!fs.existsSync(a)) throw new ErroCofre(404, "não encontrado");
    const mesmo = a.toLowerCase() === b.toLowerCase();
    if (fs.existsSync(b) && !mesmo) throw new ErroCofre(409, "já existe um item com esse nome");
    await fsp.mkdir(path.dirname(b), { recursive: true });
    await this.renomearSeguro(a, b);
    // leva o histórico junto
    const ha = this.histDir(de), hb = this.histDir(para);
    if (fs.existsSync(ha) && !fs.existsSync(hb)) {
      await fsp.mkdir(path.dirname(hb), { recursive: true });
      await fsp.rename(ha, hb).catch(() => {});
    }
    this.marcarProprio(de); this.marcarProprio(para);
    return { from: de, to: para };
  }

  async copy(de, para) {
    const a = this.abs(de), b = this.abs(para);
    if (fs.existsSync(b)) throw new ErroCofre(409, "já existe um item com esse nome");
    await fsp.cp(a, b, { recursive: true, errorOnExist: true });
    this.marcarProprio(para);
    return this.info(para);
  }

  async remove(rel) {
    const a = this.abs(rel);
    if (!fs.existsSync(a)) return { path: rel, removed: false };
    if (a === this.root) throw new ErroCofre(400, "não é possível apagar a raiz");
    let ok = false;
    if (this.trash) { try { await this.trash(a); ok = true; } catch (e) {} }
    if (!ok) {
      const dest = path.join(this.dataDir, "lixeira", carimbo(), ...rel.split("/"));
      await fsp.mkdir(path.dirname(dest), { recursive: true });
      await fsp.rename(a, dest).catch(async () => { await fsp.cp(a, dest, { recursive: true }); await fsp.rm(a, { recursive: true, force: true }); });
    }
    this.marcarProprio(rel);
    return { path: rel, removed: true };
  }

  async readConfig(nome) {
    if (!/^[\w.-]+\.json$/.test(nome)) throw new ErroCofre(400, "nome inválido");
    try { return JSON.parse(await fsp.readFile(path.join(this.dataDir, nome), "utf8")); } catch (e) { return null; }
  }

  async writeConfig(nome, obj) {
    if (!/^[\w.-]+\.json$/.test(nome)) throw new ErroCofre(400, "nome inválido");
    await fsp.mkdir(this.dataDir, { recursive: true });
    await fsp.writeFile(path.join(this.dataDir, nome), JSON.stringify(obj, null, 2));
  }

  /** observa mudanças feitas fora do app (Explorer, Word, sincronizações) */
  watch() {
    this.unwatch();
    const pend = new Set();
    let t = null;
    const avisa = () => {
      const lista = [...pend].filter(p => {
        const ult = this.proprios.get(p);
        return !(ult && Date.now() - ult < 3000);
      });
      pend.clear();
      if (lista.length) this.emit("change", lista);
    };
    try {
      const w = fs.watch(this.root, { recursive: true }, (ev, nome) => {
        if (!nome) return;
        const rel = String(nome).split(path.sep).join("/");
        if (rel.split("/").some(ignorado)) return;
        this.invalidarLista();
        pend.add(rel);
        clearTimeout(t); t = setTimeout(avisa, 400);
      });
      w.on("error", () => { this.observando = false; });
      this.watchers.push(w);
      this.observando = true;
    } catch (e) { /* sem observação recursiva: o app atualiza ao focar a janela */ }
  }

  unwatch() { for (const w of this.watchers) try { w.close(); } catch (e) {} this.watchers = []; this.observando = false; }
}

module.exports = { Vault, ErroCofre, DADOS, ignorado, carimbo, versao };
