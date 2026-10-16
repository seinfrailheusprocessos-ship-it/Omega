// Teste do editor de Word com documentos complexos (gerado pelo python-docx e regravado pelo LibreOffice).
// node test/docx2.test.mjs
import { chromium } from "playwright";
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const S = "/tmp/claude-0/-home-user-Omega/4509f1ec-d4e5-56fb-8705-e64f53ecd3fa/scratchpad";
const cofre = path.join(S, "cofre-docx2");
const PORTA = 27196, TOKEN = "TESTE123TESTE123TESTE123";
fs.rmSync(cofre, { recursive: true, force: true });
fs.mkdirSync(path.join(cofre, "Documentos"), { recursive: true });
execFileSync("python3", [path.join(raiz, "test/fixtures/docx_complexo.py"), path.join(cofre, "Documentos/Complexo.docx")]);
// versão regravada pelo LibreOffice (XML bem diferente do python-docx)
const lo = path.join(S, "lo-conv");
fs.rmSync(lo, { recursive: true, force: true }); fs.mkdirSync(lo);
execFileSync("soffice", ["--headless", "--convert-to", "docx:MS Word 2007 XML", "--outdir", lo, path.join(cofre, "Documentos/Complexo.docx")], { stdio: "ignore", timeout: 120000 });
fs.copyFileSync(path.join(lo, "Complexo.docx"), path.join(cofre, "Documentos/Complexo LO.docx"));
const originais = {};
for (const n of ["Complexo.docx", "Complexo LO.docx"]) { originais[n] = path.join(S, "orig-" + n.replace(/ /g, "_")); fs.copyFileSync(path.join(cofre, "Documentos", n), originais[n]); }

const srv = spawn("node", [path.join(raiz, "src/server/standalone.js"), "--root", cofre, "--data", path.join(S, "srvdata-docx2"), "--port", String(PORTA), "--token", TOKEN, "--local"], { stdio: "ignore" });
await new Promise(r => setTimeout(r, 1500));
const falhas = [];
const ok = (c, m) => { console.log((c ? "ok   " : "FALHA ") + m); if (!c) falhas.push(m); };
const validar = (salvo, original) => {
  try { return execFileSync("python3", [path.join(S, "val/office/validate.py"), salvo, "--original", original], { encoding: "utf8", cwd: path.join(S, "val/office") }); }
  catch (e) { return (e.stdout || "") + (e.stderr || "") + " ERRO"; }
};
const paginasPdf = arq => {
  const out = path.join(S, "lo-pag"); fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out);
  execFileSync("soffice", ["--headless", "--convert-to", "pdf", "--outdir", out, arq], { stdio: "ignore", timeout: 120000 });
  const pdf = path.join(out, path.basename(arq).replace(/\.docx$/, ".pdf"));
  return Number(execFileSync("python3", ["-c", "import pypdf,sys; print(len(pypdf.PdfReader(sys.argv[1]).pages))", pdf], { encoding: "utf8" }).trim());
};

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
try {
  const p = await (await b.newContext({ viewport: { width: 1400, height: 900 }, locale: "pt-BR" })).newPage();
  const erros = [];
  p.on("pageerror", e => erros.push(e.message));
  p.on("console", m => { if (m.type() === "error") erros.push(m.text()); });
  await p.goto(`http://127.0.0.1:${PORTA}/#token=${TOKEN}`);
  await p.waitForFunction(() => window.tinteiro && document.body.classList.contains("is-ready"));
  const cursorNoFimDe = async t => p.evaluate(t => {
    const tw = document.createTreeWalker(document.querySelector(".tinteiro-docx"), NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) { const i = n.data.indexOf(t); if (i >= 0) { n.parentElement.closest("[contenteditable=true]").focus(); const r = document.createRange(); r.setStart(n, i + t.length); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return true; } }
    throw new Error("não achei " + t);
  }, t);
  for (const nome of ["Complexo.docx", "Complexo LO.docx"]) {
    const arq = "Documentos/" + nome;
    const pagsAntes = paginasPdf(path.join(cofre, arq));
    await p.evaluate(a => tinteiro.abrirArquivo(a), arq);
    await p.waitForSelector("article p");
    await p.waitForTimeout(800);
    await cursorNoFimDe("e texto depois do link.");
    await p.keyboard.type(" [editado após o link]");
    await cursorNoFimDe("Depois da quebra de página, no mesmo parágrafo.");
    await p.keyboard.type(" [editado após a quebra]");
    await cursorNoFimDe("Mesclada vertical");
    await p.keyboard.type(" [célula]");
    await cursorNoFimDe("Interna 2");
    await p.keyboard.type(" [aninhada]");
    await cursorNoFimDe("Texto na seção em paisagem.");
    await p.keyboard.press("Enter");
    await p.keyboard.type("Novo parágrafo na seção paisagem.");
    ok(await p.evaluate(() => tinteiro.workspace.activeLeaf.view.save({ explicit: true })), `${nome}: salvou`);
    const salvo = path.join(cofre, arq);
    const v = validar(salvo, originais[nome]);
    ok(/All validations PASSED/.test(v), `${nome}: validação XSD do Word ` + (/PASSED/.test(v) ? "" : v.slice(-600)));
    const texto = execFileSync("python3", ["-c", `
import docx,sys
d=docx.Document(sys.argv[1])
def todos(tab):
  out=[]
  for row in tab.rows:
    for c in row.cells:
      out.append(c.text)
      for t2 in c.tables: out+=todos(t2)
  return out
partes=[p.text for p in d.paragraphs]
for t in d.tables: partes+=todos(t)
print("\\n".join(partes))
print("RODAPE:"+"|".join(p.text for s in d.sections for p in s.footer.paragraphs))
print("SECOES:"+str(len(d.sections))+":"+str([s.orientation for s in d.sections]))
print("LINKS:"+str(len(d.part.rels)))
`, salvo], { encoding: "utf8" });
    ok(texto.includes("e texto depois do link. [editado após o link]"), `${nome}: edição após hyperlink`);
    ok(texto.includes("site fictício"), `${nome}: hyperlink preservado`);
    ok(texto.includes("no mesmo parágrafo. [editado após a quebra]"), `${nome}: edição após quebra de página`);
    ok(texto.includes("Mesclada vertical [célula]"), `${nome}: célula mesclada editada`);
    ok(texto.includes("Interna 2 [aninhada]"), `${nome}: tabela aninhada editada`);
    ok(texto.includes("Novo parágrafo na seção paisagem."), `${nome}: parágrafo novo na seção paisagem`);
    ok(/SECOES:2:/.test(texto) && /LANDSCAPE/.test(texto), `${nome}: seções e orientação preservadas`);
    const xml = execFileSync("python3", ["-c", "import zipfile,sys; print(zipfile.ZipFile(sys.argv[1]).read('word/document.xml').decode())", salvo], { encoding: "utf8" });
    ok(/w:br w:type="page"/.test(xml) || /w:br [^>]*w:type="page"/.test(xml) || /pageBreakBefore/.test(xml), `${nome}: quebra de página continua no XML`);
    ok((xml.match(/<w:hyperlink /g) || []).length >= 1, `${nome}: elemento de link continua no XML`);
    ok((xml.match(/<w:drawing>/g) || []).length >= 1, `${nome}: imagem continua no XML`);
    const pagsDepois = paginasPdf(salvo);
    ok(pagsDepois === pagsAntes, `${nome}: LibreOffice abre e mantém o número de páginas (${pagsAntes} → ${pagsDepois})`);
    await p.evaluate(() => tinteiro.workspace.activeLeaf.fechar());
  }
  ok(erros.length === 0, "sem erros no console: " + erros.join(" | "));
} finally { await b.close(); srv.kill(); }
console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : "\nTODOS OS TESTES DO WORD (COMPLEXO) PASSARAM");
process.exit(falhas.length ? 1 : 0);
