// Núcleo da busca (usado no computador e no celular): sem acento, sem maiúsculas, todas as palavras.

const cacheDobra = new Map();
/** baixa e tira acento, mantendo o mesmo comprimento do texto (para recortar trechos) */
export function dobrar(s) {
  let out = "";
  for (const c of s) {
    let d = cacheDobra.get(c);
    if (d === undefined) {
      d = c.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      if (d.length !== c.length) d = c.toLowerCase().length === c.length ? c.toLowerCase() : c;
      cacheDobra.set(c, d);
    }
    out += d;
  }
  return out;
}

/** "a b" → todas; "frase exata" entre aspas; -palavra exclui; path:/file: filtram pelo caminho */
export function analisarConsulta(q) {
  const termos = [], excluir = [], caminho = [];
  const re = /(-)?(?:(path|file|caminho|arquivo):)?(?:"([^"]+)"|(\S+))/gi;
  let m;
  while ((m = re.exec(q))) {
    const t = dobrar(m[3] || m[4] || "");
    if (!t) continue;
    if (m[2]) caminho.push(t);
    else if (m[1]) excluir.push(t);
    else termos.push(t);
  }
  return { termos, excluir, caminho };
}

/** procura em [{path, text}] → [{path, nameMatch, matches:[{before, match, after, offset}]}] */
export function buscar(indice, q, { maxArquivos = 300, maxTrechos = 6 } = {}) {
  const { termos, excluir, caminho } = analisarConsulta(q);
  if (!termos.length && !caminho.length) return [];
  const res = [];
  for (const item of indice) {
    const p = dobrar(item.path);
    if (caminho.length && !caminho.every(c => p.includes(c))) continue;
    const texto = item.text || "";
    const td = item._dob || (item._dob = dobrar(texto));
    const nome = dobrar(item.path.split("/").pop());
    const todos = termos.every(t => td.includes(t) || nome.includes(t));
    if (!todos) continue;
    if (excluir.some(t => td.includes(t))) continue;
    const matches = [];
    for (const t of termos) {
      let i = td.indexOf(t);
      while (i >= 0 && matches.length < maxTrechos) {
        const ini = Math.max(0, texto.lastIndexOf("\n", i) + 1, i - 60);
        let fim = texto.indexOf("\n", i + t.length); if (fim < 0) fim = texto.length;
        fim = Math.min(fim, i + t.length + 90);
        matches.push({ before: texto.slice(ini, i), match: texto.slice(i, i + t.length), after: texto.slice(i + t.length, fim), offset: i });
        i = td.indexOf(t, i + t.length);
      }
    }
    matches.sort((a, b) => a.offset - b.offset);
    res.push({ path: item.path, nameMatch: termos.some(t => nome.includes(t)), matches, total: matches.length });
    if (res.length >= maxArquivos) break;
  }
  res.sort((a, b) => (b.nameMatch - a.nameMatch) || (b.total - a.total) || a.path.localeCompare(b.path));
  return res;
}
