// Caminhos relativos ao cofre, sempre com "/".
export const basename = p => p.split("/").pop();
export const dirname = p => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "");
export const extname = p => { const b = basename(p); const i = b.lastIndexOf("."); return i > 0 ? b.slice(i + 1).toLowerCase() : ""; };
export const stem = p => { const b = basename(p); const i = b.lastIndexOf("."); return i > 0 ? b.slice(0, i) : b; };
export const join = (...ps) => ps.filter(Boolean).join("/").replace(/\/+/g, "/").replace(/^\//, "");
export const normalizar = p => p.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").replace(/\/+/g, "/");
export const NOME_INVALIDO = /[\\/:*?"<>|]/;
