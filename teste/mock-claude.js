/* Simulador local de window.claude (db e downloads) para testar o Omega fora do Claude.
   Só para os testes do repositório: o artefato publicado usa o runtime real do Claude. */
(() => {
  const semDb = /[?&]semdb\b/.test(location.search);
  const store = new Map();
  const subs = [];
  const congela = o => JSON.parse(JSON.stringify(o));
  const semente = window.__SEMENTE || {};
  for (const p in semente) store.set(p, congela(semente[p]));
  const espera = () => new Promise(r => setTimeout(r, 5));
  function docsDe(col) {
    const out = [];
    for (const [p, d] of store) { const i = p.lastIndexOf("/"); if (p.slice(0, i) === col) out.push({ id: p.slice(i + 1), exists: true, data: () => congela(d), metadata: { fromCache: false, hasPendingWrites: false } }); }
    return out.sort((a, b) => (a.id < b.id ? -1 : 1));
  }
  const snap = col => { const docs = docsDe(col); return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: { fromCache: false, hasPendingWrites: false } }; };
  function avisa(path) { const col = path.slice(0, path.lastIndexOf("/")); subs.filter(s => s.col === col).forEach(s => setTimeout(() => s.fn(snap(col)), 10)); }
  const mescla = (a, b) => { for (const k in b) { if (b[k] && typeof b[k] === "object" && !Array.isArray(b[k]) && a[k] && typeof a[k] === "object" && !Array.isArray(a[k])) mescla(a[k], b[k]); else a[k] = b[k]; } return a; };
  const tamanho = d => new Blob([JSON.stringify(d)]).size;
  window.__escritas = [];
  const db = {
    doc(path) {
      if (path.split("/").length % 2) throw new TypeError("caminho de documento precisa de número par de segmentos: " + path);
      return {
        id: path.split("/").pop(), path,
        async get() { await espera(); const d = store.get(path); return { id: path.split("/").pop(), exists: !!d, data: () => (d ? congela(d) : undefined), metadata: {} }; },
        async set(data) { await espera(); if (tamanho(data) > 256 * 1024) throw { code: "invalid_argument", message: "documento acima de 256 KiB" }; store.set(path, congela(data)); window.__escritas.push({ path, op: "set", t: Date.now() }); avisa(path); },
        async update(data) { await espera(); if (!store.has(path)) throw { code: "invalid_argument", message: "documento não existe" }; const novo = mescla(congela(store.get(path)), congela(data)); if (tamanho(novo) > 256 * 1024) throw { code: "invalid_argument", message: "documento acima de 256 KiB" }; store.set(path, novo); window.__escritas.push({ path, op: "update", t: Date.now() }); avisa(path); },
        async delete() { await espera(); store.delete(path); avisa(path); },
        onSnapshot(fn) { const t = setInterval(() => {}, 1e9); setTimeout(async () => fn(await this.get()), 10); return () => clearInterval(t); }
      };
    },
    collection(col) {
      return { path: col, onSnapshot(fn) { const s = { col, fn }; subs.push(s); setTimeout(() => fn(snap(col)), 30); return () => subs.splice(subs.indexOf(s), 1); }, async get() { await espera(); return snap(col); }, doc(id) { return db.doc(col + "/" + id); } };
    }
  };
  window.__downloads = [];
  const b64 = u => { let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  const downloads = { async save({ filename, data }) { let u; if (data instanceof Blob) u = new Uint8Array(await data.arrayBuffer()); else if (typeof data === "string") u = new TextEncoder().encode(data); else u = new Uint8Array(data.buffer ? data.buffer : data); window.__downloads.push({ filename, size: u.length, b64: b64(u) }); return { status: "saved" }; } };
  window.__mock = { dump: () => Object.fromEntries([...store].map(([k, v]) => [k, congela(v)])), escreverComoClaude(path, data) { store.set(path, congela(data)); avisa(path); }, ler: p => (store.has(p) ? congela(store.get(p)) : null) };
  window.claude = { use: async n => { await new Promise(r => setTimeout(r, 80)); if (n === "db") return semDb ? null : db; if (n === "downloads") return downloads; return null; } };
})();
