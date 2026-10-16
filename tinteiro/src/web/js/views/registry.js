// Qual visualização abre cada tipo de arquivo (carregadas sob demanda).
const carregadores = new Map();

export function registrar(exts, carregar) { for (const e of exts) carregadores.set(e, carregar); }

registrar(["md", "markdown"], () => import("./markdown.js").then(m => m.MarkdownView));
registrar(["txt", "log", "json", "xml", "css", "js", "ini", "yml", "yaml", "bat", "ps1", "py", "sql", "tsv"], () => import("./text.js").then(m => m.TextView));
registrar(["html", "htm"], () => import("./html.js").then(m => m.HtmlView));
registrar(["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "ico", "avif"], () => import("./image.js").then(m => m.ImageView));
registrar(["docx"], () => import("../docx/docx-view.js").then(m => m.DocxView));
registrar(["xlsx", "csv"], () => import("../sheet/sheet-view.js").then(m => m.SheetView));
registrar(["pdf"], () => import("../pdf/pdf-view.js").then(m => m.PdfView));

export async function viewParaExtensao(ext) {
  const c = carregadores.get(ext);
  if (c) return c();
  return (await import("./other.js")).OtherView;
}

export function temEditor(ext) { return carregadores.has(ext); }
