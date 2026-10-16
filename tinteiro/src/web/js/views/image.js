// Visualizador de imagens com zoom.
import { h } from "../util/dom.js";
import { FileView } from "./base.js";
import { extname } from "../util/path.js";
import { formatBytes } from "../util/dom.js";

const TIPOS = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", bmp: "image/bmp", svg: "image/svg+xml", ico: "image/x-icon", avif: "image/avif" };
export class ImageView extends FileView {
  getViewType() { return "image"; }
  async onLoadFile(dados) {
    this.url = URL.createObjectURL(new Blob([dados], { type: TIPOS[extname(this.file.path)] || "image/*" }));
    this.img = h("img", { src: this.url, draggable: "false" });
    this.zoom = 0; // 0 = ajustar
    this.box = h("div.image-container", this.img);
    this.contentEl.classList.add("image-view-content");
    this.contentEl.appendChild(this.box);
    this.img.addEventListener("load", () => { this.nat = [this.img.naturalWidth, this.img.naturalHeight]; this.app.atualizarStatus(); });
    this.img.addEventListener("click", e => { this.zoom = this.zoom ? 0 : 1; this.aplicar(); });
    this.contentEl.addEventListener("wheel", e => { if (!e.ctrlKey) return; e.preventDefault(); this.zoom = Math.max(0.1, Math.min(8, (this.zoom || this.escalaAtual()) * (e.deltaY < 0 ? 1.15 : 1 / 1.15))); this.aplicar(); }, { passive: false });
    this.addAction("zoom-out", "Diminuir", () => { this.zoom = Math.max(0.1, (this.zoom || this.escalaAtual()) / 1.25); this.aplicar(); });
    this.addAction("zoom-in", "Aumentar", () => { this.zoom = Math.min(8, (this.zoom || this.escalaAtual()) * 1.25); this.aplicar(); });
    this.addAction("maximize", "Ajustar à tela", () => { this.zoom = 0; this.aplicar(); });
    this.aplicar();
  }
  escalaAtual() { return this.nat ? this.img.getBoundingClientRect().width / this.nat[0] : 1; }
  aplicar() {
    this.box.classList.toggle("is-fit", !this.zoom);
    if (this.zoom && this.nat) { this.img.style.width = this.nat[0] * this.zoom + "px"; this.img.style.maxWidth = "none"; this.img.style.maxHeight = "none"; }
    else { this.img.style.width = ""; this.img.style.maxWidth = ""; this.img.style.maxHeight = ""; }
    this.app.atualizarStatus();
  }
  getStatus() { return this.nat ? [{ texto: `${this.nat[0]} × ${this.nat[1]}` }, { texto: formatBytes(this.file.size) }, { texto: this.zoom ? Math.round(this.zoom * 100) + "%" : "ajustada" }] : []; }
  async onClose() { if (this.url) URL.revokeObjectURL(this.url); }
}
