// Posições de linhas/colunas com tamanhos variáveis (busca binária sobre faixas personalizadas).
export class Eixo {
  /** padrao: tamanho padrão (px); faixas: [{a, b, t}] ordenadas, sem sobreposição; max: quantidade total */
  constructor(padrao, faixas, max) {
    this.padrao = padrao;
    this.max = max;
    this.a = []; this.b = []; this.t = []; this.acum = [];
    let soma = 0;
    for (const f of faixas) {
      if (f.b < f.a) continue;
      this.a.push(f.a); this.b.push(f.b); this.t.push(f.t); this.acum.push(soma);
      soma += (f.b - f.a + 1) * (f.t - padrao);
    }
  }
  /** última faixa com a <= i */
  faixa(i) {
    let lo = 0, hi = this.a.length - 1, k = -1;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (this.a[m] <= i) { k = m; lo = m + 1; } else hi = m - 1; }
    return k;
  }
  tam(i) { const k = this.faixa(i); return k >= 0 && i <= this.b[k] ? this.t[k] : this.padrao; }
  /** posição (px) do início do índice i */
  pos(i) {
    const k = this.faixa(i - 1);
    if (k < 0) return i * this.padrao;
    const fim = Math.min(i, this.b[k] + 1);
    return i * this.padrao + this.acum[k] + (fim - this.a[k]) * (this.t[k] - this.padrao);
  }
  /** índice que contém a posição px */
  indice(px) {
    if (px <= 0) return 0;
    let lo = 0, hi = this.max - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (this.pos(m) <= px) lo = m; else hi = m - 1; }
    // pula índices de tamanho zero (ocultos) para trás
    return lo;
  }
  oculto(i) { return this.tam(i) <= 0; }
}
