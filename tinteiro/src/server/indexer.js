// Índice de busca do cofre: extrai texto dos arquivos em segundo plano (worker) e guarda em cache.
"use strict";
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const { Worker } = require("worker_threads");

const INDEXAVEIS = /\.(md|markdown|txt|csv|tsv|json|xml|log|html?|docx|xlsx|pdf|yml|yaml|ini)$/i;
const MAX_TAMANHO = 60 * 1024 * 1024;

class Indexer {
  constructor(vault) {
    this.vault = vault;
    this.itens = new Map(); // path → {path, size, mtime, text}
    this.fila = [];
    this.rodando = false;
    this.worker = null;
    this.pedidos = new Map();
    this.seq = 0;
    this.pronto = false;
    this.mod = null;
  }

  get arquivoCache() { return path.join(this.vault.dataDir, "cache", "indice.json"); }

  async iniciar() {
    try {
      const j = JSON.parse(await fsp.readFile(this.arquivoCache, "utf8"));
      for (const it of j) this.itens.set(it.path, it);
    } catch (e) {}
    this.atualizarTudo().catch(() => {});
  }

  async atualizarTudo() {
    const lista = await this.vault.list();
    const vivos = new Set();
    for (const e of lista) {
      if (e.type !== "file" || !INDEXAVEIS.test(e.path) || e.size > MAX_TAMANHO) continue;
      vivos.add(e.path);
      const c = this.itens.get(e.path);
      if (!c || c.size !== e.size || c.mtime !== e.mtime) this.enfileirar(e);
    }
    for (const k of [...this.itens.keys()]) if (!vivos.has(k)) this.itens.delete(k);
    if (!this.fila.length) { this.pronto = true; this.salvar(); }
    this.processar();
  }

  enfileirar(e) { if (!this.fila.some(x => x.path === e.path)) this.fila.push(e); }

  async mudou(paths) {
    for (const p of paths) {
      if (!INDEXAVEIS.test(p)) continue;
      const st = await this.vault.stat(p).catch(() => null);
      if (!st || st.type !== "file") { this.itens.delete(p); continue; }
      if (st.size <= MAX_TAMANHO) this.enfileirar(st);
    }
    this.processar();
  }

  renomeado(de, para) {
    for (const [k, v] of [...this.itens]) {
      if (k === de || k.startsWith(de + "/")) {
        this.itens.delete(k);
        const novo = para + k.slice(de.length);
        this.itens.set(novo, { ...v, path: novo });
      }
    }
    this.salvar();
  }

  garantirWorker() {
    if (this.worker) return this.worker;
    this.worker = new Worker(path.join(__dirname, "indexer-worker.js"));
    this.worker.on("message", m => { const r = this.pedidos.get(m.id); if (r) { this.pedidos.delete(m.id); r(m.text || ""); } });
    this.worker.on("error", () => { for (const r of this.pedidos.values()) r(""); this.pedidos.clear(); this.worker = null; });
    this.worker.on("exit", () => { this.worker = null; });
    this.worker.unref();
    return this.worker;
  }

  extrair(abs, rel) {
    return new Promise(res => {
      const id = ++this.seq;
      this.pedidos.set(id, res);
      const t = setTimeout(() => { if (this.pedidos.has(id)) { this.pedidos.delete(id); res(""); } }, 120000);
      t.unref && t.unref();
      this.garantirWorker().postMessage({ id, abs, rel });
    });
  }

  async processar() {
    if (this.rodando) return;
    this.rodando = true;
    try {
      while (this.fila.length) {
        const e = this.fila.shift();
        let abs;
        try { abs = this.vault.abs(e.path); } catch (err) { continue; }
        const text = await this.extrair(abs, e.path);
        this.itens.set(e.path, { path: e.path, size: e.size, mtime: e.mtime, text });
      }
    } finally {
      this.rodando = false;
      this.pronto = true;
      this.salvar();
      if (this.worker) { this.worker.terminate().catch(() => {}); this.worker = null; }
    }
  }

  salvar() {
    clearTimeout(this._ts);
    this._ts = setTimeout(async () => {
      try {
        await fsp.mkdir(path.dirname(this.arquivoCache), { recursive: true });
        const lista = [...this.itens.values()].map(({ _dob, ...r }) => r);
        await fsp.writeFile(this.arquivoCache, JSON.stringify(lista));
      } catch (e) {}
    }, 3000);
  }

  async buscar(q, opts) {
    if (!this.mod) this.mod = await import("../shared/search-core.mjs");
    // nomes de arquivos não indexáveis (imagens, outros) também entram pela busca por nome
    const lista = [...this.itens.values()];
    const extras = (await this.vault.list()).filter(e => e.type === "file" && !this.itens.has(e.path)).map(e => ({ path: e.path, text: "" }));
    return this.mod.buscar(lista.concat(extras), q, opts);
  }
}

module.exports = { Indexer };
