// Emissor de eventos simples.
export class Emitter {
  constructor() { this._ev = new Map(); }
  on(nome, fn) { if (!this._ev.has(nome)) this._ev.set(nome, new Set()); this._ev.get(nome).add(fn); return () => this.off(nome, fn); }
  off(nome, fn) { this._ev.get(nome)?.delete(fn); }
  emit(nome, ...a) { for (const fn of [...(this._ev.get(nome) || [])]) { try { fn(...a); } catch (e) { console.error(e); } } }
}
