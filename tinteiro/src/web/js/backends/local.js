// Arquivos guardados no próprio celular (funciona sem internet) e sincronizados com o computador.
import { Emitter } from "../util/events.js";
import { abrirBanco, Banco } from "./idb.js";
import { Sincronizador } from "./sync.js";
import { basename, dirname, extname } from "../util/path.js";

const HIST_MAX = 20, HIST_INTERVALO = 5 * 60 * 1000;
const MIME = { pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", doc: "application/msword", xls: "application/vnd.ms-excel", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", txt: "text/plain", md: "text/markdown", csv: "text/csv", html: "text/html", zip: "application/zip", odt: "application/vnd.oasis.opendocument.text" };

class ErroLocal extends Error { constructor(status, msg) { super(msg); this.status = status; } }

export class LocalBackend extends Emitter {
  constructor() {
    super();
    this.kind = "local";
    const nativo = !!window.Capacitor?.isNativePlatform?.();
    this.nativo = nativo;
    this.caps = { openExternal: true, reveal: false, history: true, rawUrl: false, settings: false, pairing: false, sync: true };
    this.ultimoBackup = new Map();
  }

  async connect() {
    if (!window.indexedDB) throw new Error("Este navegador não permite guardar arquivos.");
    this.banco = new Banco(await abrirBanco());
    try { await navigator.storage?.persist?.(); } catch (e) {}
    this.info = { app: "Tinteiro", vaultName: (await this.banco.get("meta", "nomeCofre")) || "Tinteiro", root: null, device: "celular", local: false };
    this.sync = new Sincronizador(this);
    await this.sync.carregar();
    if (this._pendentePareamento) {
      try { await this.sync.parear(...this._pendentePareamento); await this.sync.sincronizar(); }
      catch (e) { console.warn("pareamento", e); }
      this._pendentePareamento = null;
    }
    if (!(await this.banco.all("arquivos")).length && !this.sync.pareado) await this.criarBoasVindas();
    return this.info;
  }

  parearCom(url, token) { this._pendentePareamento = [url, token]; }

  async criarBoasVindas() {
    const t = new TextEncoder().encode(`# Bem-vindo ao Tinteiro\n\nPara ver aqui os arquivos do computador, abra **☰ → Configurações → Sincronização** e leia o QR que aparece no Tinteiro do computador.\n\nEnquanto isso, você já pode criar notas neste celular.\n`);
    await this.gravarRegistro({ path: "Bem-vindo.md", type: "file", size: t.length, mtime: Date.now(), ver: null, base: null, local: true }, t);
  }

  // ---------------------------------------------------------------- registros
  async registro(path) { return this.banco.get("arquivos", path); }
  async gravarRegistro(r, dados) {
    if (dados !== undefined) await this.banco.put("dados", dados instanceof ArrayBuffer ? dados : dados.buffer.slice(dados.byteOffset, dados.byteOffset + dados.byteLength), r.path);
    await this.banco.put("arquivos", r);
  }
  avisar(paths, tipo = "change") { this.emit("event", { type: tipo, paths }); }

  async list() {
    const regs = await this.banco.all("arquivos");
    return regs.filter(r => !r.apagado).map(r => ({ path: r.path, type: r.type, size: r.size, mtime: r.mtime, ver: r.ver, offline: r.type === "file" ? !!r.temDados : true }));
  }
  async stat(path) { const r = await this.registro(path); return r && !r.apagado ? r : null; }

  async read(path) {
    let d = await this.banco.get("dados", path);
    if (d) return d;
    const r = await this.registro(path);
    if (!r || r.apagado) throw new ErroLocal(404, "arquivo não encontrado");
    // ainda não foi baixado: busca no computador agora
    d = await this.sync.baixarUm(r);
    if (!d) throw new ErroLocal(503, "Este arquivo ainda não foi baixado para o celular. Conecte-se ao Wi-Fi de casa (com o Tinteiro aberto no computador) e tente de novo.");
    return d;
  }
  async readText(path) { return new TextDecoder("utf-8").decode(await this.read(path)); }

  async guardarVersao(path, forcar) {
    const ult = this.ultimoBackup.get(path) || 0;
    if (!forcar && Date.now() - ult < HIST_INTERVALO) return;
    const antigo = await this.banco.get("dados", path);
    if (!antigo) return;
    const r = await this.registro(path);
    await this.banco.put("historico", { path, time: r?.mtime || Date.now(), size: antigo.byteLength, dados: antigo });
    this.ultimoBackup.set(path, Date.now());
    const vs = (await this.banco.porIndice("historico", "path", path)).sort((a, b) => b.time - a.time);
    for (const v of vs.slice(HIST_MAX)) await this.banco.del("historico", v.id);
  }

  async write(path, data, { explicit = false } = {}) {
    const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data instanceof ArrayBuffer ? new Uint8Array(data) : data;
    const r = (await this.registro(path)) || { path, type: "file", ver: null, base: null };
    if (r.apagado) delete r.apagado;
    const antigo = await this.banco.get("dados", path);
    if (antigo && antigo.byteLength === bytes.byteLength && iguais(new Uint8Array(antigo), bytes)) return { path, size: r.size, mtime: r.mtime };
    await this.guardarVersao(path, explicit);
    Object.assign(r, { size: bytes.byteLength, mtime: Date.now(), local: true, temDados: true });
    await this.garantirPastas(path);
    await this.gravarRegistro(r, bytes);
    this.sync.agendar();
    return { path, size: r.size, mtime: r.mtime };
  }

  async garantirPastas(path) {
    let p = dirname(path);
    while (p) {
      const r = await this.registro(p);
      if (!r || r.apagado) await this.banco.put("arquivos", { path: p, type: "folder", mtime: Date.now(), local: true, ver: null, base: null });
      p = dirname(p);
    }
  }

  async create(path, data = "") {
    const r = await this.registro(path);
    if (r && !r.apagado) throw new ErroLocal(409, "já existe um arquivo com esse nome");
    const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
    const novo = { path, type: "file", size: bytes.byteLength, mtime: Date.now(), ver: r?.ver ?? null, base: r?.base ?? null, local: true, temDados: true };
    await this.garantirPastas(path);
    await this.gravarRegistro(novo, bytes);
    this.sync.agendar();
    return novo;
  }

  async mkdir(path) {
    await this.garantirPastas(path + "/x");
    this.sync.agendar();
    return { path, type: "folder" };
  }

  async filhosDe(path) { return (await this.banco.all("arquivos")).filter(r => r.path === path || r.path.startsWith(path + "/")); }

  async rename(de, para) {
    const alvo = await this.registro(para);
    if (alvo && !alvo.apagado && de.toLowerCase() !== para.toLowerCase()) throw new ErroLocal(409, "já existe um item com esse nome");
    const regs = await this.filhosDe(de);
    if (!regs.length) throw new ErroLocal(404, "não encontrado");
    for (const r of regs) {
      const np = para + r.path.slice(de.length);
      const dados = await this.banco.get("dados", r.path);
      await this.banco.del("arquivos", r.path);
      if (dados) { await this.banco.del("dados", r.path); await this.banco.put("dados", dados, np); }
      await this.banco.put("arquivos", { ...r, path: np, local: r.type === "file" ? true : r.local });
      const vs = await this.banco.porIndice("historico", "path", r.path);
      for (const v of vs) await this.banco.put("historico", { ...v, path: np });
    }
    await this.garantirPastas(para);
    // só avisa o computador se o item já existia lá
    if (regs.some(r => r.base)) await this.sync.anotarOperacao({ tipo: "renomear", de, para });
    this.sync.agendar();
    return { from: de, to: para };
  }

  async copy(de, para) {
    const regs = await this.filhosDe(de);
    for (const r of regs) {
      const np = para + r.path.slice(de.length);
      if (r.type === "folder") await this.mkdir(np);
      else await this.create(np, new Uint8Array(await this.read(r.path)));
    }
    return this.registro(para);
  }

  async remove(path) {
    const regs = await this.filhosDe(path);
    for (const r of regs) {
      if (r.base || r.ver) await this.banco.put("arquivos", { ...r, apagado: true });
      else { await this.banco.del("arquivos", r.path); await this.banco.del("dados", r.path); }
    }
    this.sync.agendar();
    return { path, removed: true };
  }

  async history(path) {
    const vs = await this.banco.porIndice("historico", "path", path);
    return vs.sort((a, b) => b.time - a.time).map(v => ({ id: String(v.id), size: v.size, time: v.time }));
  }
  async readVersion(path, id) { const v = await this.banco.get("historico", Number(id)); if (!v) throw new ErroLocal(404, "versão não encontrada"); return v.dados; }
  async restore(path, id) { const d = await this.readVersion(path, id); return this.write(path, new Uint8Array(d), { explicit: true }); }

  async getConfig(nome) { return (await this.banco.get("meta", "config:" + nome)) || null; }
  async setConfig(nome, obj) { await this.banco.put("meta", obj, "config:" + nome); }

  // ---------------------------------------------------------------- busca local
  async search(q) {
    const { buscar } = await import("../../../shared/search-core.mjs");
    const regs = (await this.banco.all("arquivos")).filter(r => r.type === "file" && !r.apagado);
    const indice = new Map((await this.banco.all("indice")).map(i => [i.path, i]));
    const itens = [];
    let pendentes = 0;
    for (const r of regs) {
      const chave = `${r.size}:${r.mtime}`;
      let it = indice.get(r.path);
      if (!it || it.chave !== chave) {
        if (/\.(md|txt|csv|html?|json|docx|xlsx|pdf)$/i.test(r.path) && r.temDados && r.size < 30 * 1024 * 1024) {
          const texto = await this.extrair(r).catch(() => "");
          it = { path: r.path, chave, text: texto };
          await this.banco.put("indice", it);
        } else { it = { path: r.path, chave, text: "" }; if (!r.temDados) pendentes++; }
      }
      itens.push({ path: r.path, text: it.text });
    }
    return { results: buscar(itens, q), ready: true, pending: pendentes };
  }
  async extrair(r) {
    const { extrairTexto } = await import("../../../shared/text-extract.mjs");
    const dados = new Uint8Array(await this.banco.get("dados", r.path));
    const libs = { JSZip: (await import("jszip")).default };
    if (/\.pdf$/i.test(r.path)) {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "vendor/pdfjs/pdf.worker.min.mjs";
      libs.pdfjs = pdfjs;
    }
    return extrairTexto(r.path, dados, libs);
  }

  // ---------------------------------------------------------------- abrir em outro app
  async openExternal(path) {
    const dados = await this.read(path);
    const tipo = MIME[extname(path)] || "application/octet-stream";
    if (this.nativo) {
      const { Filesystem, Directory } = await import("@capacitor/filesystem");
      const { FileOpener } = await import("@capacitor-community/file-opener");
      const nome = basename(path).replace(/[^\w.\- ()áéíóúâêôãõçÁÉÍÓÚÂÊÔÃÕÇ]/g, "_");
      const b64 = paraBase64(new Uint8Array(dados));
      const r = await Filesystem.writeFile({ path: "abrir/" + nome, data: b64, directory: Directory.Cache, recursive: true });
      await FileOpener.open({ filePath: r.uri, contentType: tipo, openWithDefault: true });
      return { ok: true };
    }
    const arquivo = new File([dados], basename(path), { type: tipo });
    if (navigator.canShare?.({ files: [arquivo] })) { await navigator.share({ files: [arquivo], title: basename(path) }); return { ok: true }; }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(arquivo); a.download = basename(path);
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
    return { ok: true };
  }
  reveal() {}
}

function iguais(a, b) { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; }
export function paraBase64(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
