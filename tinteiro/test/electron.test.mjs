// Teste do app de computador empacotado (roda no GitHub Actions, Windows).  node test/electron.test.mjs CAMINHO_DO_EXE
// Imprime as capturas de tela em base64 no log (entre marcadores) para conferência.
import { _electron as electron } from "playwright";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const exe = process.argv[2];
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tinteiro-"));
const cofre = path.join(tmp, "CL");
execFileSync(process.platform === "win32" ? "python" : "python3", [path.join(raiz, "test/fixtures/gerar.py"), cofre], { stdio: "inherit" });
const falhas = [];
const ok = (c, m) => { console.log((c ? "ok   " : "FALHA ") + m); if (!c) falhas.push(m); };
const capturas = path.join(raiz, "out", "capturas");
fs.mkdirSync(capturas, { recursive: true });

const app = await electron.launch({ executablePath: exe, env: { ...process.env, TINTEIRO_DADOS: path.join(tmp, "dados"), TINTEIRO_RAIZ: cofre } });
const janela = await app.firstWindow();
const erros = [];
janela.on("pageerror", e => erros.push(e.message));
janela.on("console", m => { if (m.type() === "error") erros.push(m.text()); });
await janela.waitForFunction(() => window.tinteiro && document.body.classList.contains("is-ready"), null, { timeout: 60000 });
await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.setSize(1366, 820); w.center(); });
await janela.waitForTimeout(1000);
const foto = async nome => {
  const arq = path.join(capturas, nome + ".jpg");
  await janela.screenshot({ path: arq, type: "jpeg", quality: 70 });
  const b64 = fs.readFileSync(arq).toString("base64");
  console.log(`===CAPTURA ${nome} INICIO===`);
  for (let i = 0; i < b64.length; i += 8000) console.log(b64.slice(i, i + 8000));
  console.log(`===CAPTURA ${nome} FIM===`);
};
ok(await janela.evaluate(() => !!window.tinteiroDesktop), "ponte do Electron ativa");
ok((await janela.evaluate(() => tinteiro.backend.info.root)) === cofre, "pasta raiz configurada");
await janela.evaluate(() => tinteiro.abrirArquivo("Bem-vindo.md"));
await janela.waitForTimeout(1200);
await foto("windows-escuro-nota");
// Word: editar e salvar
await janela.evaluate(() => tinteiro.abrirArquivo("Documentos/Termo de Referencia ficticio.docx"));
await janela.waitForSelector("article p", { timeout: 30000 });
await janela.evaluate(() => {
  const tw = document.createTreeWalker(document.querySelector(".tinteiro-docx"), NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) if (n.data.includes("16 de outubro de 2026.")) {
    n.parentElement.closest("[contenteditable=true]").focus();
    const r = document.createRange(); r.setStart(n, n.data.indexOf("2026.") + 5); r.collapse(true);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r); break;
  }
});
await janela.keyboard.type(" Editado no Windows.");
ok(await janela.evaluate(() => tinteiro.workspace.activeLeaf.view.save({ explicit: true })), "salvou o Word no Windows");
const py = execFileSync(process.platform === "win32" ? "python" : "python3", ["-c", "import docx,sys; d=docx.Document(sys.argv[1]); print('\\n'.join(p.text for p in d.paragraphs))", path.join(cofre, "Documentos/Termo de Referencia ficticio.docx")], { encoding: "utf8" });
ok(py.includes("Editado no Windows."), "arquivo Word salvo abre com a edição");
await janela.evaluate(() => { tinteiro.config.tema = "claro"; tinteiro.aplicarTema(); });
await janela.waitForTimeout(800);
await foto("windows-claro-word");
for (const [arq, nome] of [["Planilhas/Orcamento ficticio.xlsx", "windows-claro-planilha"], ["PDFs/Relatorio ficticio.pdf", "windows-claro-pdf"]]) {
  await janela.evaluate(a => tinteiro.abrirArquivo(a), arq);
  await janela.waitForTimeout(3000);
  await foto(nome);
}
await janela.evaluate(() => { tinteiro.config.tema = "escuro"; tinteiro.aplicarTema(); tinteiro.paletaComandos(); });
await janela.waitForTimeout(800);
await foto("windows-escuro-paleta");
ok(erros.length === 0, "sem erros no console: " + erros.join(" | "));
await app.close();
console.log(falhas.length ? `${falhas.length} FALHA(S)` : "TODOS OS TESTES DO APP DE COMPUTADOR PASSARAM");
process.exit(falhas.length ? 1 : 0);
