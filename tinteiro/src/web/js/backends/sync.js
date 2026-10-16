// Sincronização celular ↔ computador (servidor do Tinteiro no computador, pela rede de casa ou Tailscale).
// Regra: o que mudou só de um lado vai para o outro; se mudou dos dois lados, a versão do computador
// fica com o nome original e a do celular vira uma cópia "(conflito celular …)" — nada se perde.
import { Emitter } from "../util/events.js";
import { dirname, basename, extname, stem, join } from "../util/path.js";

const TEMPO_LIMITE = 4000;

export class Sincronizador extends Emitter {
  constructor(backend) {
    super();
    this.b = backend;
    this.estado = "desligado"; // desligado | ocioso | sincronizando | erro | sem-conexao
    this.mensagem = "";
    this.rodando = null;
    this.timer = null;
  }

  get banco() { return this.b.banco; }
  get pareado() { return !!(this.cfg && this.cfg.token && this.cfg.urls?.length); }

  async carregar() {
    this.cfg = (await this.banco.get("meta", "pareamento")) || null;
    this.ultima = (await this.banco.get("meta", "ultimaSync")) || 0;
    this.ops = (await this.banco.get("meta", "operacoes")) || [];
    this.opcoes = { baixarTudo: true, limiteMB: 50, ...((await this.banco.get("meta", "opcoesSync")) || {}) };
    this.estado = this.pareado ? "ocioso" : "desligado";
    if (this.pareado) {
      setTimeout(() => this.sincronizar().catch(() => {}), 800);
      this.intervalo = setInterval(() => { if (!document.hidden) this.sincronizar().catch(() => {}); }, 2 * 60 * 1000);
      document.addEventListener("visibilitychange", () => { if (!document.hidden) this.sincronizar().catch(() => {}); });
      window.addEventListener("online", () => this.sincronizar().catch(() => {}));
    }
  }

  async salvarOpcoes(o) { this.opcoes = { ...this.opcoes, ...o }; await this.banco.put("meta", this.opcoes, "opcoesSync"); }

  /** guarda o computador (endereços + código) */
  async parear(urlOuLink, token) {
    let base = urlOuLink, t = token;
    try {
      const u = new URL(urlOuLink);
      if (!t) t = u.searchParams.get("t") || new URLSearchParams(u.hash.slice(1)).get("pair") || new URLSearchParams(u.hash.slice(1)).get("token");
      if (u.protocol === "tinteiro:") { base = u.searchParams.get("u"); t = t || u.searchParams.get("t"); }
      else base = u.origin;
    } catch (e) { if (!/^https?:\/\//.test(base)) base = "http://" + base; }
    base = String(base).replace(/\/+$/, "");
    if (!t) throw new Error("Código de acesso ausente.");
    const info = await this.req(base, "/api/info", { token: t, timeout: 6000 });
    let urls = [base];
    try {
      const m = await this.req(base, "/api/info", { token: t });
      if (m) urls = [base];
    } catch (e) {}
    this.cfg = { urls, token: t, computador: info.device || "computador", cofre: info.vaultName || "Tinteiro", desde: Date.now() };
    await this.banco.put("meta", this.cfg, "pareamento");
    await this.banco.put("meta", info.vaultName || "Tinteiro", "nomeCofre");
    if (this.b.info) this.b.info.vaultName = info.vaultName || "Tinteiro";
    this.estado = "ocioso";
    if (!this.intervalo) await this.carregar();
    this.emit("estado");
    return this.cfg;
  }

  async desparear() {
    this.cfg = null;
    await this.banco.del("meta", "pareamento");
    this.estado = "desligado";
    this.emit("estado");
  }

  async anotarOperacao(op) { this.ops.push(op); await this.banco.put("meta", this.ops, "operacoes"); }

  agendar(ms = 4000) { if (!this.pareado) return; clearTimeout(this.timer); this.timer = setTimeout(() => this.sincronizar().catch(() => {}), ms); }

  async req(base, rota, { token = this.cfg?.token, method = "GET", body, headers = {}, timeout = TEMPO_LIMITE, binario = false } = {}) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeout);
    try {
      const r = await fetch(base + rota, { method, body, headers: { "X-Tinteiro-Token": token, ...headers }, signal: ctl.signal, cache: "no-store" });
      if (!r.ok) { let m = r.statusText; try { m = (await r.json()).error || m; } catch (e) {} const err = new Error(m); err.status = r.status; throw err; }
      return binario ? r.arrayBuffer() : r.json();
    } finally { clearTimeout(t); }
  }

  async achar() {
    const lista = [...(this.cfg?.urls || [])];
    // aberto pelo próprio computador (Tailscale ou rede): tenta a origem primeiro
    if (/^https?:/.test(location.origin) && !/localhost|127\.0\.0\.1/.test(location.hostname) && !lista.includes(location.origin)) lista.unshift(location.origin);
    for (const u of lista) {
      try { await this.req(u, "/api/info", { timeout: 2500 }); this.base = u; return u; } catch (e) { if (e.status === 401) throw new Error("O código de acesso mudou no computador. Pareie de novo."); }
    }
    return null;
  }

  definirEstado(e, msg = "") { this.estado = e; this.mensagem = msg; this.emit("estado"); }

  sincronizar() {
    if (!this.pareado) return Promise.resolve(false);
    if (this.rodando) return this.rodando;
    this.rodando = this.executar().finally(() => { this.rodando = null; });
    return this.rodando;
  }

  async executar() {
    this.definirEstado("sincronizando", "Procurando o computador…");
    let base;
    try { base = await this.achar(); } catch (e) { this.definirEstado("erro", e.message); return false; }
    if (!base) { this.definirEstado("sem-conexao", "Computador fora de alcance (mesmo Wi-Fi e Tinteiro aberto no computador)."); return false; }
    const mudados = new Set();
    try {
      // 1) operações de renomear feitas no celular
      while (this.ops.length) {
        const op = this.ops[0];
        try { await this.req(base, "/api/rename", { method: "POST", body: JSON.stringify({ from: op.de, to: op.para }), headers: { "Content-Type": "application/json" } }); }
        catch (e) { if (e.status !== 404 && e.status !== 409) throw e; }
        this.ops.shift();
        await this.banco.put("meta", this.ops, "operacoes");
      }
      this.definirEstado("sincronizando", "Comparando arquivos…");
      const man = await this.req(base, "/api/sync/manifest", { timeout: 60000 });
      const remoto = new Map(man.entries.map(e => [e.path, e]));
      const locais = new Map((await this.banco.all("arquivos")).map(r => [r.path, r]));
      const tarefas = [];
      // pastas
      for (const [p, e] of remoto) {
        if (e.type !== "folder") continue;
        const l = locais.get(p);
        if (!l) { await this.banco.put("arquivos", { path: p, type: "folder", mtime: e.mtime, ver: "pasta", base: "pasta" }); mudados.add(p); }
        else if (l.apagado && l.type === "folder") tarefas.push({ tipo: "apagar-remoto", r: l });
        else if (!l.base) await this.banco.put("arquivos", { ...l, ver: "pasta", base: "pasta", local: false });
      }
      for (const [p, l] of locais) {
        if (l.type !== "folder") continue;
        if (!remoto.has(p)) {
          if (l.apagado) { await this.banco.del("arquivos", p); continue; }
          if (l.base) { if (!this.temFilhosLocais(p, locais)) { await this.banco.del("arquivos", p); mudados.add(p); } }
          else tarefas.push({ tipo: "criar-pasta", r: l });
        }
      }
      // arquivos
      for (const [p, e] of remoto) {
        if (e.type !== "file") continue;
        const l = locais.get(p);
        if (!l) { tarefas.push({ tipo: "baixar", e }); continue; }
        if (l.type !== "file") continue;
        const mudouLa = l.base !== e.ver;
        if (l.apagado) { tarefas.push(mudouLa ? { tipo: "baixar", e, desapagar: true } : { tipo: "apagar-remoto", r: l, e }); continue; }
        if (l.local && mudouLa) tarefas.push({ tipo: "conflito", r: l, e });
        else if (l.local) tarefas.push({ tipo: "enviar", r: l });
        else if (mudouLa || (!l.temDados && this.deveBaixar(e))) tarefas.push({ tipo: "baixar", e });
      }
      for (const [p, l] of locais) {
        if (l.type !== "file" || remoto.has(p)) continue;
        if (l.apagado) { await this.banco.del("arquivos", p); await this.banco.del("dados", p); continue; }
        if (l.base && !l.local) { await this.banco.del("arquivos", p); await this.banco.del("dados", p); mudados.add(p); } // apagado no computador
        else tarefas.push({ tipo: "enviar", r: l, novo: true }); // criado no celular (ou editado e apagado lá: mantém)
      }
      // pasta apagada no celular só some do computador se lá não houver nada novo dentro dela
      const pastasApagar = tarefas.filter(t => t.tipo === "apagar-remoto" && t.r.type === "folder");
      const tarefasArq = tarefas.filter(t => !(t.tipo === "apagar-remoto" && t.r.type === "folder"));
      for (const t of pastasApagar) {
        const novidade = [...remoto.values()].some(e => e.path.startsWith(t.r.path + "/") && e.type === "file" && !(locais.get(e.path)?.apagado && locais.get(e.path)?.base === e.ver));
        if (novidade) { await this.banco.put("arquivos", { ...t.r, apagado: false }); t.cancelada = true; }
      }
      // executa (até 4 ao mesmo tempo); pastas por último
      let feitas = 0;
      const total = tarefas.length;
      const exec = async t => {
        await this.executarTarefa(base, t, mudados);
        feitas++;
        if (total > 3) this.definirEstado("sincronizando", `Sincronizando ${feitas} de ${total}…`);
      };
      const fila = tarefasArq.slice();
      await Promise.all(Array.from({ length: Math.min(4, fila.length) }, async () => { while (fila.length) await exec(fila.shift()); }));
      for (const t of pastasApagar.filter(t => !t.cancelada).sort((a, b) => b.r.path.length - a.r.path.length)) await exec(t);
      this.ultima = Date.now();
      await this.banco.put("meta", this.ultima, "ultimaSync");
      if (man.version && this.b.info) this.b.info.versaoComputador = man.version;
      this.definirEstado("ocioso", total ? `${total} alteraç${total === 1 ? "ão" : "ões"} sincronizada${total === 1 ? "" : "s"}` : "Tudo sincronizado");
      if (mudados.size) this.b.emit("synced", [...mudados]);
      if (mudados.size) this.b.avisar([...mudados]);
      return true;
    } catch (e) {
      this.definirEstado("erro", "Falha na sincronização: " + (e.message || e));
      return false;
    }
  }

  temFilhosLocais(p, locais) { for (const [k, l] of locais) if (k.startsWith(p + "/") && (l.local || !l.base)) return true; return false; }
  deveBaixar(e) { return this.opcoes.baixarTudo && e.size <= this.opcoes.limiteMB * 1024 * 1024; }

  async executarTarefa(base, t, mudados) {
    const q = p => "?path=" + encodeURIComponent(p);
    if (t.tipo === "baixar") {
      const e = t.e;
      const reg = { path: e.path, type: "file", size: e.size, mtime: e.mtime, ver: e.ver, base: e.ver, local: false, temDados: false };
      if (this.deveBaixar(e) || (await this.banco.get("dados", e.path))) {
        const dados = await this.req(base, "/api/file" + q(e.path), { binario: true, timeout: 120000 });
        await this.banco.put("dados", dados, e.path);
        reg.temDados = true;
      }
      await this.banco.put("arquivos", reg);
      mudados.add(e.path);
    } else if (t.tipo === "enviar") {
      const r = t.r;
      const dados = await this.banco.get("dados", r.path);
      if (!dados) return;
      const info = await this.req(base, "/api/file" + q(r.path), { method: "PUT", body: dados, headers: { "Content-Type": "application/octet-stream", "X-Explicit": "1", "X-Base-Ver": r.base || "" }, timeout: 120000 })
        .catch(async err => { if (err.status === 409) { await this.conflito(base, r, null, mudados); return null; } throw err; });
      if (info) await this.banco.put("arquivos", { ...r, ver: info.ver, base: info.ver, mtime: info.mtime, local: false });
    } else if (t.tipo === "conflito") {
      await this.conflito(base, t.r, t.e, mudados);
    } else if (t.tipo === "apagar-remoto") {
      try { await this.req(base, "/api/delete", { method: "POST", body: JSON.stringify({ path: t.r.path, baseVer: t.r.type === "file" ? t.r.base : undefined }), headers: { "Content-Type": "application/json" } }); }
      catch (e) { if (e.status === 409) { await this.banco.put("arquivos", { ...t.r, apagado: false, local: false, base: null }); return; } throw e; }
      await this.banco.del("arquivos", t.r.path); await this.banco.del("dados", t.r.path);
    } else if (t.tipo === "criar-pasta") {
      await this.req(base, "/api/mkdir", { method: "POST", body: JSON.stringify({ path: t.r.path }), headers: { "Content-Type": "application/json" } });
      await this.banco.put("arquivos", { ...t.r, ver: "pasta", base: "pasta", local: false });
    }
  }

  /** os dois lados mudaram: a versão do celular vira uma cópia e a do computador fica no lugar */
  async conflito(base, r, e, mudados) {
    const d = new Date();
    const p2 = n => String(n).padStart(2, "0");
    const sufixo = ` (conflito celular ${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}h${p2(d.getMinutes())})`;
    const ext = extname(r.path);
    const copia = join(dirname(r.path), stem(r.path) + sufixo + (ext ? "." + ext : ""));
    const dados = await this.banco.get("dados", r.path);
    if (dados) {
      const info = await this.req(base, "/api/upload" + "?path=" + encodeURIComponent(copia), { method: "POST", body: dados, headers: { "Content-Type": "application/octet-stream" }, timeout: 120000 }).catch(() => null);
      await this.banco.put("dados", dados, copia);
      await this.banco.put("arquivos", { path: copia, type: "file", size: dados.byteLength, mtime: Date.now(), ver: info?.ver || null, base: info?.ver || null, local: !info, temDados: true });
      mudados.add(copia);
    }
    const remoto = e || (await this.req(base, "/api/stat" + "?path=" + encodeURIComponent(r.path)));
    const novo = await this.req(base, "/api/file?path=" + encodeURIComponent(r.path), { binario: true, timeout: 120000 });
    await this.banco.put("dados", novo, r.path);
    await this.banco.put("arquivos", { path: r.path, type: "file", size: remoto.size, mtime: remoto.mtime, ver: remoto.ver, base: remoto.ver, local: false, temDados: true });
    mudados.add(r.path);
    this.emit("conflito", { path: r.path, copia });
  }

  /** baixa um arquivo que ainda não estava no celular (ao abrir) */
  async baixarUm(r) {
    if (!this.pareado) return null;
    const base = this.base || (await this.achar().catch(() => null));
    if (!base) return null;
    try {
      const dados = await this.req(base, "/api/file?path=" + encodeURIComponent(r.path), { binario: true, timeout: 120000 });
      await this.banco.put("dados", dados, r.path);
      await this.banco.put("arquivos", { ...r, temDados: true });
      return dados;
    } catch (e) { return null; }
  }

  async espacoUsado() {
    try { const e = await navigator.storage.estimate(); return e.usage || 0; } catch (e) { return 0; }
  }
}
