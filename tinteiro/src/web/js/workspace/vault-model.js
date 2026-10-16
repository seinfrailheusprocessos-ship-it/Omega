// Modelo dos arquivos do cofre no navegador: lista, árvore, operações e eventos.
import { Emitter } from "../util/events.js";
import { basename, dirname, extname, join, stem } from "../util/path.js";

const colar = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });
export const ordenarNomes = (a, b) => colar.compare(a, b);

export class VaultModel extends Emitter {
  constructor(backend) {
    super();
    this.backend = backend;
    this.map = new Map();
    this.ordem = "nome-asc";
  }

  entrada(e) {
    const nome = basename(e.path);
    return { ...e, name: nome, ext: e.type === "file" ? extname(e.path) : "", basename: e.type === "file" ? stem(e.path) : nome, parent: dirname(e.path) };
  }

  async load() {
    const lista = await this.backend.list();
    this.map = new Map();
    this.map.set("", { path: "", type: "folder", name: "", parent: null });
    for (const e of lista) this.map.set(e.path, this.entrada(e));
    this.emit("changed");
  }

  /** recarrega a lista e avisa o que mudou */
  async refresh() {
    const antes = this.map;
    const lista = await this.backend.list();
    const novo = new Map([["", antes.get("") || { path: "", type: "folder", name: "", parent: null }]]);
    const mudados = [];
    for (const e of lista) {
      const n = this.entrada(e);
      const a = antes.get(e.path);
      if (!a || a.mtime !== n.mtime || a.size !== n.size) mudados.push(e.path);
      novo.set(e.path, n);
    }
    const removidos = [...antes.keys()].filter(k => k && !novo.has(k));
    this.map = novo;
    if (mudados.length || removidos.length) this.emit("changed", { mudados, removidos });
    return { mudados, removidos };
  }

  get(path) { return this.map.get(path) || null; }
  exists(path) { return this.map.has(path); }
  files() { return [...this.map.values()].filter(e => e.type === "file"); }
  folders() { return [...this.map.values()].filter(e => e.type === "folder"); }

  children(pasta) {
    const out = [];
    for (const e of this.map.values()) if (e.path && e.parent === pasta) out.push(e);
    const [campo, sentido] = this.ordem.split("-");
    out.sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      let r;
      if (campo === "data" && a.type === "file") r = (a.mtime || 0) - (b.mtime || 0);
      else r = ordenarNomes(a.name, b.name);
      return sentido === "desc" ? -r : r;
    });
    return out;
  }

  /** nome livre: "Sem título.md", "Sem título 1.md"... */
  nomeLivre(pasta, base, ext) {
    let n = 0;
    for (;;) {
      const nome = n ? `${base} ${n}` : base;
      const p = join(pasta, ext ? `${nome}.${ext}` : nome);
      if (!this.map.has(p) && ![...this.map.keys()].some(k => k.toLowerCase() === p.toLowerCase())) return p;
      n++;
    }
  }

  // ---- operações (chamam o backend e atualizam o modelo) ----
  read(path) { return this.backend.read(path); }
  readText(path) { return this.backend.readText(path); }

  async write(path, data, opts = {}) {
    const info = await this.backend.write(path, data, opts);
    const e = this.entrada({ ...(this.map.get(path) || {}), ...info, path, type: "file" });
    this.map.set(path, e);
    this.garantirPastas(path);
    this.emit("modified", path);
    return info;
  }

  garantirPastas(path) {
    let p = dirname(path);
    let criou = false;
    while (p && !this.map.has(p)) { this.map.set(p, this.entrada({ path: p, type: "folder" })); p = dirname(p); criou = true; }
    if (criou) this.emit("changed");
  }

  async create(path, data = "") {
    const info = await this.backend.create(path, data);
    this.map.set(path, this.entrada({ ...info, path, type: "file" }));
    this.garantirPastas(path);
    this.emit("changed", { criados: [path] });
    return this.map.get(path);
  }

  async mkdir(path) {
    await this.backend.mkdir(path);
    this.map.set(path, this.entrada({ path, type: "folder", mtime: Date.now() }));
    this.garantirPastas(path);
    this.emit("changed", { criados: [path] });
    return this.map.get(path);
  }

  async rename(de, para) {
    await this.backend.rename(de, para);
    const novo = new Map();
    for (const [k, v] of this.map) {
      if (k === de || k.startsWith(de + "/")) {
        const np = para + k.slice(de.length);
        novo.set(np, this.entrada({ ...v, path: np }));
      } else novo.set(k, v);
    }
    this.map = novo;
    this.garantirPastas(para);
    this.emit("renamed", de, para);
    this.emit("changed");
  }

  async copy(de, para) {
    await this.backend.copy(de, para);
    await this.refresh();
    return this.get(para);
  }

  async remove(path) {
    await this.backend.remove(path);
    for (const k of [...this.map.keys()]) if (k === path || k.startsWith(path + "/")) this.map.delete(k);
    this.emit("deleted", path);
    this.emit("changed");
  }
}
