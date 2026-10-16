// Acesso aos arquivos pelo servidor do computador (app desktop ou navegador na rede de casa).
import { Emitter } from "../util/events.js";

export class HttpBackend extends Emitter {
  constructor(base, token) {
    super();
    this.base = base.replace(/\/+$/, "");
    this.token = token;
    this.kind = "http";
    this.caps = { openExternal: false, reveal: false, history: true, rawUrl: true, settings: false, pairing: false, sync: false };
  }

  async req(rota, { method = "GET", body, headers = {}, raw = false } = {}) {
    const r = await fetch(this.base + rota, { method, body, headers: { "X-Tinteiro-Token": this.token, ...headers }, cache: "no-store" });
    if (!r.ok) {
      let msg = r.statusText;
      try { const j = await r.json(); msg = j.error || msg; } catch (e) {}
      const err = new Error(msg); err.status = r.status; throw err;
    }
    return raw ? r : (r.headers.get("content-type") || "").includes("json") ? r.json() : r;
  }
  q(path) { return "?path=" + encodeURIComponent(path); }
  json(rota, obj, method = "POST") { return this.req(rota, { method, body: JSON.stringify(obj), headers: { "Content-Type": "application/json" } }); }

  async connect() {
    this.info = await this.req("/api/info");
    this.caps.openExternal = this.caps.reveal = this.caps.settings = this.caps.pairing = !!this.info.local;
    this.ouvirEventos();
    return this.info;
  }

  ouvirEventos() {
    try {
      const es = new EventSource(`${this.base}/api/events?t=${encodeURIComponent(this.token)}`);
      es.onmessage = ev => { try { const d = JSON.parse(ev.data); this.emit("event", d); } catch (e) {} };
      es.onerror = () => { this.emit("connection", false); };
      es.onopen = () => this.emit("connection", true);
      this.es = es;
    } catch (e) {}
  }

  async list() { return (await this.req("/api/tree")).entries; }
  async stat(path) { return this.req("/api/stat" + this.q(path)); }
  async read(path) {
    const r = await this.req("/api/file" + this.q(path), { raw: true });
    const buf = await r.arrayBuffer();
    return buf;
  }
  async readText(path) { return new TextDecoder("utf-8").decode(await this.read(path)); }
  async write(path, data, { explicit = false, origem = null } = {}) {
    const body = typeof data === "string" ? new TextEncoder().encode(data) : data;
    return this.req("/api/file" + this.q(path), { method: "PUT", body, headers: { "X-Explicit": explicit ? "1" : "0", "Content-Type": "application/octet-stream", ...(origem ? { "X-Origem": origem } : {}) } });
  }
  async create(path, data = "") {
    if (typeof data === "string") return this.json("/api/create", { path, text: data });
    return this.req("/api/upload" + this.q(path), { method: "POST", body: data, headers: { "Content-Type": "application/octet-stream" } });
  }
  mkdir(path) { return this.json("/api/mkdir", { path }); }
  rename(from, to) { return this.json("/api/rename", { from, to }); }
  copy(from, to) { return this.json("/api/copy", { from, to }); }
  remove(path) { return this.json("/api/delete", { path }); }
  async history(path) { return (await this.req("/api/history" + this.q(path))).versions; }
  async readVersion(path, id) { const r = await this.req("/api/history/file" + this.q(path) + "&id=" + encodeURIComponent(id), { raw: true }); return r.arrayBuffer(); }
  restore(path, id) { return this.json("/api/history/restore", { path, id }); }
  search(q) { return this.req("/api/search?q=" + encodeURIComponent(q)); }
  openExternal(path) { return this.json("/api/open-external", { path }); }
  reveal(path) { return this.json("/api/reveal", { path }); }
  async getConfig(name) { return this.req("/api/config?name=" + encodeURIComponent(name)); }
  setConfig(name, obj) { return this.json("/api/config?name=" + encodeURIComponent(name), obj, "PUT"); }
  async rawUrl(path) { const r = await this.req("/api/raw-url" + this.q(path)); return this.base + r.url; }
  pairing() { return this.req("/api/pairing"); }
  resetPairing() { return this.json("/api/pairing/reset", {}); }
  tailscaleServe() { return this.json("/api/tailscale/serve", {}); }
  settings() { return this.req("/api/settings"); }
  saveSettings(obj) { return this.json("/api/settings", obj, "PUT"); }
  chooseFolder() { return this.json("/api/choose-folder", {}); }
}
