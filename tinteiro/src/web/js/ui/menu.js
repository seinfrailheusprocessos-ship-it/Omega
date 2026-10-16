// Menu de contexto no estilo do app de referência (no celular vira folha de baixo).
import { h } from "../util/dom.js";
import { icon } from "../util/icons.js";

let aberto = null;
export function fecharMenus() { if (aberto) { aberto.fechar(); aberto = null; } }

export class Menu {
  constructor() { this.itens = []; }
  addItem(cfg) { this.itens.push({ tipo: "item", ...cfg }); return this; }
  addSeparator() { if (this.itens.length && this.itens[this.itens.length - 1].tipo !== "sep") this.itens.push({ tipo: "sep" }); return this; }
  addLabel(t) { this.itens.push({ tipo: "label", title: t }); return this; }

  showAtMouseEvent(e) { e.preventDefault(); return this.showAtPosition({ x: e.clientX, y: e.clientY }); }
  showBelow(el) { const r = el.getBoundingClientRect(); return this.showAtPosition({ x: r.left, y: r.bottom + 4, alvo: r }); }

  showAtPosition({ x, y }) {
    fecharMenus();
    while (this.itens.length && this.itens[this.itens.length - 1].tipo === "sep") this.itens.pop();
    const mobile = document.body.classList.contains("is-mobile");
    const el = h("div.menu" + (mobile ? ".mod-sheet" : ""), { role: "menu", tabindex: "-1" });
    let sel = -1;
    const clicaveis = [];
    for (const it of this.itens) {
      if (it.tipo === "sep") { el.appendChild(h("div.menu-separator")); continue; }
      if (it.tipo === "label") { el.appendChild(h("div.menu-label", { text: it.title })); continue; }
      const linha = h("div.menu-item" + (it.disabled ? ".is-disabled" : "") + (it.warning ? ".is-warning" : "") + (it.checked ? ".is-checked" : ""),
        h("div.menu-item-icon", it.icon ? icon(it.icon) : it.checked ? icon("check") : null),
        h("div.menu-item-title", { text: it.title }),
        it.hotkey ? h("div.menu-item-hotkey", { text: it.hotkey }) : null);
      linha.addEventListener("click", ev => { ev.stopPropagation(); fecharMenus(); it.onClick && it.onClick(ev); });
      linha.addEventListener("mouseenter", () => { clicaveis.forEach(c => c.classList.remove("selected")); sel = clicaveis.indexOf(linha); });
      clicaveis.push(linha);
      el.appendChild(linha);
    }
    document.body.appendChild(el);
    if (!mobile) {
      const r = el.getBoundingClientRect();
      const W = window.innerWidth, H = window.innerHeight;
      el.style.left = Math.max(4, Math.min(x, W - r.width - 4)) + "px";
      el.style.top = Math.max(4, y + r.height > H - 4 ? Math.max(4, y - r.height) : y) + "px";
      el.style.maxHeight = (H - 8) + "px";
    }
    const fundo = h("div", { style: { position: "fixed", inset: "0", zIndex: 199, background: mobile ? "rgba(0,0,0,.35)" : "transparent" } });
    document.body.insertBefore(fundo, el);
    const tecla = ev => {
      if (ev.key === "Escape") { ev.preventDefault(); fecharMenus(); }
      else if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
        ev.preventDefault();
        sel = (sel + (ev.key === "ArrowDown" ? 1 : -1) + clicaveis.length) % clicaveis.length;
        clicaveis.forEach((c, i) => c.classList.toggle("selected", i === sel));
      } else if (ev.key === "Enter" && sel >= 0) { ev.preventDefault(); clicaveis[sel].click(); }
    };
    const fechar = () => { el.remove(); fundo.remove(); document.removeEventListener("keydown", tecla, true); };
    fundo.addEventListener("mousedown", e => { e.preventDefault(); fecharMenus(); });
    fundo.addEventListener("contextmenu", e => { e.preventDefault(); fecharMenus(); });
    document.addEventListener("keydown", tecla, true);
    aberto = { fechar };
    return this;
  }
}
