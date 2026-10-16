// Extrai texto pesquisável de cada tipo de arquivo (md, txt, html, docx, xlsx, pdf).
export const TEXTO = new Set(["md", "markdown", "txt", "csv", "tsv", "json", "xml", "log", "ini", "yml", "yaml", "js", "css", "py", "bat", "ps1", "sql"]);
export const LIMITE = 400000;

const decod = new TextDecoder("utf-8");
const entidades = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
function desescapar(s) {
  return s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => {
    if (e[0] === "#") { const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return isFinite(n) ? String.fromCodePoint(n) : m; }
    return entidades[e.toLowerCase()] ?? m;
  });
}

export function extOf(p) { const m = /\.([^./]+)$/.exec(p); return m ? m[1].toLowerCase() : ""; }

function textoDocxXml(xml) {
  return desescapar(xml
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<w:br[^>]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<w:delText[^>]*>[\s\S]*?<\/w:delText>/g, "")
    .replace(/<w:instrText[^>]*>[\s\S]*?<\/w:instrText>/g, "")
    .replace(/<[^>]+>/g, ""));
}

/** dados: Uint8Array; libs: { JSZip, pdfjs } */
export async function extrairTexto(caminho, dados, libs = {}) {
  const ext = extOf(caminho);
  try {
    if (TEXTO.has(ext)) return decod.decode(dados).slice(0, LIMITE);
    if (ext === "html" || ext === "htm") {
      const s = decod.decode(dados);
      return desescapar(s.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr)>/gi, "\n").replace(/<[^>]+>/g, " ")).replace(/[ \t]+/g, " ").slice(0, LIMITE);
    }
    if (ext === "docx" && libs.JSZip) {
      const zip = await libs.JSZip.loadAsync(dados);
      const partes = Object.keys(zip.files).filter(n => /^word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml$/.test(n)).sort((a, b) => (a === "word/document.xml" ? -1 : b === "word/document.xml" ? 1 : a.localeCompare(b)));
      let out = "";
      for (const n of partes) out += textoDocxXml(await zip.file(n).async("string")) + "\n";
      return out.slice(0, LIMITE);
    }
    if (ext === "xlsx" && libs.JSZip) {
      const zip = await libs.JSZip.loadAsync(dados);
      let out = "";
      const ss = zip.file("xl/sharedStrings.xml");
      if (ss) out += desescapar((await ss.async("string")).replace(/<\/si>/g, "\n").replace(/<rPh[\s\S]*?<\/rPh>/g, "").replace(/<[^>]+>/g, ""));
      for (const n of Object.keys(zip.files).filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))) {
        const x = await zip.file(n).async("string");
        const re = /<c [^>]*>([\s\S]*?)<\/c>/g; let m;
        while ((m = re.exec(x)) && out.length < LIMITE) {
          const is = /<is>([\s\S]*?)<\/is>/.exec(m[1]);
          if (is) out += desescapar(is[1].replace(/<[^>]+>/g, "")) + "\n";
          else if (!/t="s"/.test(m[0])) { const v = /<v>([^<]*)<\/v>/.exec(m[1]); if (v) out += v[1] + "\n"; }
        }
      }
      return out.slice(0, LIMITE);
    }
    if (ext === "pdf" && libs.pdfjs) {
      const tarefa = libs.pdfjs.getDocument({ data: dados.slice(0), isEvalSupported: false, disableFontFace: true, useSystemFonts: false, verbosity: 0 });
      const doc = await tarefa.promise;
      let out = "";
      for (let i = 1; i <= doc.numPages && out.length < LIMITE; i++) {
        const pg = await doc.getPage(i);
        const tc = await pg.getTextContent();
        let linha = "";
        for (const it of tc.items) { linha += it.str; if (it.hasEOL) { out += linha + "\n"; linha = ""; } }
        out += linha + "\n";
        pg.cleanup();
      }
      await tarefa.destroy();
      return out.slice(0, LIMITE);
    }
  } catch (e) { if (globalThis.__depurarExtracao) console.error(e); return ""; }
  return "";
}
