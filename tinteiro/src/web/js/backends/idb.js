// IndexedDB com promessas (armazenamento do celular).
export function abrirBanco(nome = "tinteiro", versao = 2) {
  return new Promise((res, rej) => {
    const r = indexedDB.open(nome, versao);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains("arquivos")) db.createObjectStore("arquivos", { keyPath: "path" });
      if (!db.objectStoreNames.contains("dados")) db.createObjectStore("dados");
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
      if (!db.objectStoreNames.contains("historico")) { const s = db.createObjectStore("historico", { keyPath: "id", autoIncrement: true }); s.createIndex("path", "path"); }
      if (!db.objectStoreNames.contains("indice")) db.createObjectStore("indice", { keyPath: "path" });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export class Banco {
  constructor(db) { this.db = db; }
  tx(lojas, modo = "readonly") { return this.db.transaction(lojas, modo); }
  get(loja, chave) { return req(this.tx(loja).objectStore(loja).get(chave)); }
  all(loja) { return req(this.tx(loja).objectStore(loja).getAll()); }
  put(loja, valor, chave) { const t = this.tx(loja, "readwrite"); const s = t.objectStore(loja); return req(chave === undefined ? s.put(valor) : s.put(valor, chave)); }
  del(loja, chave) { return req(this.tx(loja, "readwrite").objectStore(loja).delete(chave)); }
  porIndice(loja, indice, valor) { return req(this.tx(loja).objectStore(loja).index(indice).getAll(valor)); }
  limpar(loja) { return req(this.tx(loja, "readwrite").objectStore(loja).clear()); }
}
