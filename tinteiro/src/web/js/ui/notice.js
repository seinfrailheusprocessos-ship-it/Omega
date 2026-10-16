// Avisos curtos no canto da tela.
import { h } from "../util/dom.js";
let caixa = null;
export function notice(msg, { tempo = 4000, erro = false } = {}) {
  if (!caixa) { caixa = h("div.notice-container"); document.body.appendChild(caixa); }
  const el = h("div.notice" + (erro ? ".mod-error" : ""), { text: msg });
  const sair = () => { el.classList.add("is-leaving"); setTimeout(() => el.remove(), 260); };
  el.addEventListener("click", sair);
  caixa.appendChild(el);
  if (tempo) setTimeout(sair, tempo);
  return { el, hide: sair, setMessage: m => { el.textContent = m; } };
}
export const erro = (msg, e) => { console.error(msg, e); return notice(msg + (e && e.message ? `\n${e.message}` : ""), { erro: true, tempo: 7000 }); };
