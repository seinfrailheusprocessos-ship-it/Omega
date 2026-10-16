// Teste do editor de Word: abre, edita (texto, parágrafo novo, negrito, alinhamento, tabela, exclusão),
// salva, confere o arquivo com python-docx/LibreOffice e reabre.  node test/docx.test.mjs
import { chromium } from "playwright";
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const S = "/tmp/claude-0/-home-user-Omega/4509f1ec-d4e5-56fb-8705-e64f53ecd3fa/scratchpad";
const cofre = path.join(S, "cofre-docx");
const shots = path.join(S, "shots");
const PORTA = 27193, TOKEN = "TESTE123TESTE123TESTE123";
fs.rmSync(cofre, { recursive: true, force: true });
fs.mkdirSync(shots, { recursive: true });
execFileSync("python3", [path.join(raiz, "test/fixtures/gerar.py"), cofre]);
const ARQ = "Documentos/Termo de Referencia ficticio.docx";
const original = fs.readFileSync(path.join(cofre, ARQ));
fs.rmSync(path.join(S, "docx-original.docx"), { force: true });

const srv = spawn("node", [path.join(raiz, "src/server/standalone.js"), "--root", cofre, "--data", path.join(S, "srvdata-docx"), "--port", String(PORTA), "--token", TOKEN, "--local"], { stdio: "ignore" });
await new Promise(r => setTimeout(r, 1500));
const falhas = [];
const ok = (cond, msg) => { console.log((cond ? "ok   " : "FALHA ") + msg); if (!cond) falhas.push(msg); };

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
try {
  const ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, colorScheme: "dark", locale: "pt-BR" });
  const p = await ctx.newPage();
  const erros = [];
  p.on("pageerror", e => erros.push(e.message));
  p.on("console", m => { if (m.type() === "error") erros.push(m.text()); });
  await p.goto(`http://127.0.0.1:${PORTA}/#token=${TOKEN}`);
  await p.waitForFunction(() => window.tinteiro && document.body.classList.contains("is-ready"));
  await p.evaluate(a => tinteiro.abrirArquivo(a), ARQ);
  await p.waitForSelector("article p");
  await p.waitForTimeout(800);
  ok(!(await p.evaluate(() => tinteiro.workspace.activeLeaf.view.dirty)), "abre sem marcar como alterado");

  // coloca o cursor no fim de um texto
  const cursorNoFimDe = async (trecho) => {
    await p.evaluate(t => {
      const tw = document.createTreeWalker(document.querySelector(".tinteiro-docx"), NodeFilter.SHOW_TEXT);
      for (let n = tw.nextNode(); n; n = tw.nextNode()) {
        const i = n.data.indexOf(t);
        if (i >= 0) {
          const host = n.parentElement.closest("[contenteditable=true]");
          host.focus();
          const r = document.createRange(); r.setStart(n, i + t.length); r.collapse(true);
          const s = getSelection(); s.removeAllRanges(); s.addRange(r);
          return true;
        }
      }
      throw new Error("trecho não achado: " + t);
    }, trecho);
  };
  const selecionar = async (trecho) => {
    await p.evaluate(t => {
      const tw = document.createTreeWalker(document.querySelector(".tinteiro-docx"), NodeFilter.SHOW_TEXT);
      for (let n = tw.nextNode(); n; n = tw.nextNode()) {
        const i = n.data.indexOf(t);
        if (i >= 0) {
          n.parentElement.closest("[contenteditable=true]").focus();
          const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + t.length);
          const s = getSelection(); s.removeAllRanges(); s.addRange(r);
          return;
        }
      }
      throw new Error("trecho não achado: " + t);
    }, trecho);
  };

  // 1) digitar no meio de um parágrafo
  await cursorNoFimDe("contratação fictícia");
  await p.keyboard.type(" (texto novo: ação, órgão)");
  // 2) parágrafo novo depois da data
  await cursorNoFimDe("16 de outubro de 2026.");
  await p.keyboard.press("Enter");
  await p.keyboard.type("Parágrafo inserido pelo teste do Tinteiro.");
  // 3) negrito numa palavra
  await selecionar("execução");
  await p.keyboard.press("Control+b");
  // 4) célula de tabela
  await cursorNoFimDe("Poda de árvores fictícias");
  await p.keyboard.type(" (editado)");
  // 5) centralizar um parágrafo
  await cursorNoFimDe("Texto sublinhado de exemplo");
  await p.click('[aria-label="Centralizar"]');
  // 6) apagar um parágrafo inteiro
  await p.evaluate(() => {
    const alvo = [...document.querySelectorAll(".tinteiro-docx article p")].find(x => x.textContent.includes("Item com marcador B"));
    alvo.closest("[contenteditable=true]").focus();
    const r = document.createRange(); r.selectNodeContents(alvo);
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  });
  await p.keyboard.press("Delete");
  await p.keyboard.press("Backspace");
  await p.waitForTimeout(300);
  ok(await p.evaluate(() => tinteiro.workspace.activeLeaf.view.dirty), "marca como alterado depois de editar");
  await p.screenshot({ path: path.join(shots, "docx-editado.png") });
  const salvou = await p.evaluate(() => tinteiro.workspace.activeLeaf.view.save({ explicit: true }));
  ok(salvou, "salvou");
  await p.waitForTimeout(400);
  ok(erros.length === 0, "sem erros no console: " + erros.join(" | "));

  // ---- confere o arquivo salvo ----
  const salvo = fs.readFileSync(path.join(cofre, ARQ));
  fs.writeFileSync(path.join(S, "docx-salvo.docx"), salvo);
  const py = execFileSync("python3", [path.join(raiz, "test/docx_check.py"), path.join(cofre, ARQ), path.join(S, "docx-original.docx")], { input: original, encoding: "utf8" });
  console.log(py.trim());
  const res = JSON.parse(py.trim().split("\n").pop());
  ok(res.abre, "python-docx abre o arquivo salvo");
  ok(res.texto.includes("contratação fictícia (texto novo: ação, órgão)"), "texto digitado foi salvo");
  ok(res.paragrafos.some(t => t === "Parágrafo inserido pelo teste do Tinteiro."), "parágrafo novo foi salvo");
  ok(!res.texto.includes("Item com marcador B"), "parágrafo apagado saiu do arquivo");
  ok(res.texto.includes("Item com marcador A"), "parágrafo vizinho continua");
  ok(res.negrito.includes("execução"), "negrito aplicado na palavra");
  ok(res.tabela.includes("Poda de árvores fictícias (editado)"), "célula da tabela editada");
  ok(res.centralizado.some(t => t.includes("Texto sublinhado de exemplo")), "parágrafo centralizado");
  ok(res.partes_iguais, "demais partes do arquivo idênticas: " + res.partes_diferentes.join(", "));
  ok(res.cabecalho_ok, "cabeçalho com brasão preservado");
  ok(fs.existsSync(path.join(cofre, ".tinteiro/historico", ARQ)), "versão anterior guardada no histórico");

  // ---- segunda edição (não pode duplicar nada) ----
  await cursorNoFimDe("Parágrafo inserido pelo teste do Tinteiro.");
  await p.keyboard.type(" Segunda edição.");
  await p.evaluate(() => tinteiro.workspace.activeLeaf.view.save({ explicit: true }));
  await p.waitForTimeout(300);
  const py2 = JSON.parse(execFileSync("python3", [path.join(raiz, "test/docx_check.py"), path.join(cofre, ARQ), path.join(S, "docx-original.docx")], { encoding: "utf8" }).trim().split("\n").pop());
  ok(py2.paragrafos.filter(t => t.startsWith("Parágrafo inserido pelo teste")).length === 1, "segunda gravação não duplica parágrafo");
  ok(py2.paragrafos.includes("Parágrafo inserido pelo teste do Tinteiro. Segunda edição."), "segunda edição salva");
  ok((py2.texto.match(/texto novo: ação/g) || []).length === 1, "segunda gravação não duplica texto");

  // ---- reabre ----
  await p.evaluate(() => tinteiro.workspace.activeLeaf.fechar());
  await p.evaluate(a => tinteiro.abrirArquivo(a), ARQ);
  await p.waitForSelector("article p");
  await p.waitForTimeout(600);
  const txt = await p.evaluate(() => document.querySelector(".tinteiro-docx").innerText);
  ok(txt.includes("Segunda edição") && txt.includes("(editado)"), "reabre com as alterações");
  await p.screenshot({ path: path.join(shots, "docx-reaberto.png") });

  // ---- tema claro e celular ----
  await p.evaluate(() => { tinteiro.config.tema = "claro"; tinteiro.aplicarTema(); });
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(shots, "docx-claro.png") });
  const m = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, colorScheme: "light", locale: "pt-BR" });
  const pm = await m.newPage();
  await pm.goto(`http://127.0.0.1:${PORTA}/#token=${TOKEN}`);
  await pm.waitForFunction(() => window.tinteiro && document.body.classList.contains("is-ready"));
  await pm.evaluate(a => tinteiro.abrirArquivo(a), ARQ);
  await pm.waitForSelector("article p");
  await pm.waitForTimeout(800);
  await pm.screenshot({ path: path.join(shots, "docx-celular.png") });
  ok(erros.length === 0, "sem erros no console (final): " + erros.join(" | "));
} finally {
  await b.close();
  srv.kill();
}
console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : "\nTODOS OS TESTES DO WORD PASSARAM");
process.exit(falhas.length ? 1 : 0);
