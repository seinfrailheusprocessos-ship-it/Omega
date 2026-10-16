// Teste de ponta a ponta do editor de planilhas (.xlsx e .csv).
//   node test/sheet.test.mjs            (compila, cria o cofre fictício, sobe o servidor e roda tudo)
// Variáveis: TINTEIRO_TESTE_DIR (pasta de trabalho), SHEET_SKIP_BUILD=1, SHEET_PORTA (27192), SHEET_SO="csv,xlsx,…"
import { chromium } from "playwright";
import { spawn, spawnSync, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.TINTEIRO_TESTE_DIR || "/tmp/claude-0/-home-user-Omega/4509f1ec-d4e5-56fb-8705-e64f53ecd3fa/scratchpad";
const DIST = path.join(BASE, "dist-sheet");
const COFRE = path.join(BASE, "cofre-sheet-teste");
const DADOS = path.join(BASE, "srvdata-sheet-teste");
const FOTOS = path.join(BASE, "shots");
const TMP = path.join(BASE, "sheet-tmp");
const PORTA = +(process.env.SHEET_PORTA || 27192);
const TOKEN = "TESTE123TESTE123TESTE123";
const URL = `http://127.0.0.1:${PORTA}/#token=${TOKEN}`;
const SO = process.env.SHEET_SO ? process.env.SHEET_SO.split(",") : null;
const CHROME = fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined;

const resultados = [];
let falhas = 0;
async function caso(nome, fn) {
  if (SO && !SO.some(s => nome.toLowerCase().includes(s.toLowerCase()))) return;
  const t0 = Date.now();
  try { await fn(); resultados.push(`  ok   ${nome} (${Date.now() - t0} ms)`); console.log(`ok   ${nome}`); }
  catch (e) { falhas++; resultados.push(`  FALHOU ${nome}: ${e.message}`); console.log(`FALHOU ${nome}\n${e.stack}`); }
}

// ------------------------------------------------------------------ preparação
function py(codigo, ...args) {
  const r = spawnSync("python3", ["-c", codigo, ...args], { encoding: "utf8" });
  if (r.status !== 0) throw new Error("python: " + r.stderr);
  return JSON.parse(r.stdout.trim().split("\n").pop());
}
fs.mkdirSync(FOTOS, { recursive: true });
fs.rmSync(TMP, { recursive: true, force: true }); fs.mkdirSync(TMP, { recursive: true });
if (!process.env.SHEET_SKIP_BUILD) execFileSync("node", ["scripts/build-web.mjs"], { cwd: RAIZ, env: { ...process.env, TINTEIRO_DIST: DIST }, stdio: "ignore" });
fs.rmSync(COFRE, { recursive: true, force: true }); fs.rmSync(DADOS, { recursive: true, force: true });
execFileSync("python3", [path.join(RAIZ, "test/fixtures/gerar.py"), COFRE], { stdio: "ignore" });
execFileSync("python3", [path.join(RAIZ, "test/sheet-fixtures.py"), COFRE], { stdio: "ignore" });
fs.copyFileSync(path.join(COFRE, "Planilhas", "Orcamento ficticio.xlsx"), path.join(COFRE, "Planilhas", "Teclado ficticio.xlsx"));
fs.copyFileSync(path.join(COFRE, "Planilhas", "Completa ficticia.xlsx"), path.join(COFRE, "Planilhas", "Abas ficticia.xlsx"));
const ORIGINAIS = {};
for (const n of fs.readdirSync(path.join(COFRE, "Planilhas"))) ORIGINAIS[n] = fs.readFileSync(path.join(COFRE, "Planilhas", n));

const servidor = spawn("node", [path.join(RAIZ, "src/server/standalone.js"), "--root", COFRE, "--data", DADOS, "--port", String(PORTA), "--token", TOKEN, "--web", DIST], { stdio: ["ignore", "pipe", "pipe"] });
await new Promise((ok, falha) => {
  const t = setTimeout(() => falha(new Error("servidor não iniciou")), 15000);
  servidor.stdout.on("data", d => { if (String(d).includes("servidor em")) { clearTimeout(t); ok(); } });
  servidor.on("exit", c => falha(new Error("servidor saiu: " + c)));
});

const navegador = await chromium.launch({ executablePath: CHROME });
const errosConsole = [];
async function novaPagina({ largura = 1400, altura = 860, tema = "dark", celular = false } = {}) {
  const ctx = await navegador.newContext({
    viewport: { width: largura, height: altura }, colorScheme: tema, locale: "pt-BR",
    deviceScaleFactor: celular ? 3 : 1, isMobile: celular, hasTouch: celular,
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const p = await ctx.newPage();
  p.setDefaultTimeout(20000);
  p.erros = [];
  p.on("pageerror", e => { p.erros.push("pageerror: " + e.message); errosConsole.push(e.message); });
  p.on("console", m => { if (m.type() === "error") { p.erros.push("console: " + m.text()); errosConsole.push(m.text()); } });
  await p.goto(URL);
  await esperarApp(p);
  await p.evaluate(t => { localStorage.setItem("tinteiro.config", JSON.stringify({ ...(JSON.parse(localStorage.getItem("tinteiro.config") || "{}")), tema: t === "dark" ? "escuro" : "claro" })); }, tema);
  return p;
}
/** espera o app carregar e terminar de restaurar as abas da sessão anterior */
async function esperarApp(p) {
  await p.waitForFunction(() => window.tinteiro && tinteiro.workspace && tinteiro.vault.files().length > 0, null, { timeout: 20000 });
  await p.waitForFunction(() => !document.querySelector(".view-loading") && tinteiro.workspace.leaves().every(l => !l.view || l.view.getViewType() !== "sheet" || l.view.grade || l.pendente), null, { timeout: 30000 });
  await p.waitForTimeout(300);
}
async function abrir(p, arquivo) {
  await p.evaluate(async a => { await tinteiro.abrirArquivo(a); }, arquivo);
  try { await p.waitForFunction(a => { const v = tinteiro.workspace.activeLeaf?.view; return v && v.file?.path === a && v.grade && v.pasta; }, arquivo, { timeout: 60000 }); }
  catch (e) { const estado = await p.evaluate(() => { const v = tinteiro.workspace.activeLeaf?.view; return { tipo: v?.getViewType?.(), arq: v?.file?.path, grade: !!v?.grade }; }); throw new Error("não abriu " + arquivo + " " + JSON.stringify(estado) + " erros: " + p.erros.join(" | ")); }
  await p.waitForTimeout(250);
}
const V = "tinteiro.workspace.activeLeaf.view";
const ev = (p, codigo, arg) => p.evaluate(new Function("arg", `const v = ${V}; const g = v.grade, pasta = v.pasta, f = g.folha; ${codigo}`), arg);
/** posição na tela do centro da célula "B3" */
async function pontoCelula(p, ref) {
  return ev(p, `
    const m = /^([A-Z]+)(\\d+)$/.exec(arg); let c = 0; for (const ch of m[1]) c = c * 26 + ch.charCodeAt(0) - 64; c--; const r = +m[2] - 1;
    g.rolarAte(r, c); g.medir(); const rt = g.retangulo(r, c); const b = g.canvas.getBoundingClientRect();
    return { x: b.left + rt.x + Math.min(rt.w / 2, 30), y: b.top + rt.y + rt.h / 2 };`, ref);
}
async function clicar(p, ref, opcoes = {}) {
  const pt = await pontoCelula(p, ref);
  const mods = opcoes.modifiers || [];
  for (const m of mods) await p.keyboard.down(m);
  await p.mouse.click(pt.x, pt.y, { button: opcoes.button || "left" });
  for (const m of mods) await p.keyboard.up(m);
  await p.waitForTimeout(40);
}
async function digitarEm(p, ref, texto) { await clicar(p, ref); await p.keyboard.type(texto, { delay: 5 }); await p.keyboard.press("Enter"); await p.waitForTimeout(60); }
const exibido = (p, ref, folha) => ev(p, `
  const fo = arg.folha ? pasta.folhaPorNome(arg.folha) : f; const m = /^([A-Z]+)(\\d+)$/.exec(arg.ref); let c = 0; for (const ch of m[1]) c = c * 26 + ch.charCodeAt(0) - 64; c--;
  const e = pasta.exibir(fo, +m[2] - 1, c); return e ? e.texto : null;`, { ref, folha });
const barraFormula = p => p.evaluate(() => document.querySelector(".sheet-formula-input").value);
async function salvar(p) {
  const ok = await p.evaluate(() => tinteiro.workspace.activeLeaf.view.save());
  assert.equal(ok, true, "salvar devolveu falso");
  await p.waitForTimeout(150);
}
/** fecha a aba atual descartando alterações não salvas */
async function fecharAba(p) {
  await p.evaluate(() => { const l = tinteiro.workspace.activeLeaf; const v = l.view?.interno || l.view; if (v?.setDirty) v.setDirty(false); if (l.view?.setDirty) l.view.setDirty(false); return Promise.race([l.fechar(), new Promise(r => setTimeout(r, 5000))]); });
  await p.evaluate(() => document.querySelectorAll(".modal-container").forEach(m => m.remove()));
  await p.waitForTimeout(200);
}
const arquivo = n => path.join(COFRE, "Planilhas", n);
async function entradasZip(buf) { const z = await JSZip.loadAsync(buf); const out = {}; for (const [n, e] of Object.entries(z.files)) if (!e.dir) out[n] = await e.async("uint8array"); return out; }
const iguais = (a, b) => a && b && a.length === b.length && a.every((x, i) => x === b[i]);
const soffice = (() => { try { execFileSync("which", ["soffice"], { stdio: "ignore" }); return true; } catch (e) { return false; } })();
/** abre no LibreOffice (sem interface), recalcula e exporta cada planilha para CSV; devolve {nomeDaAba: linhas} */
function libreOffice(arq) {
  const saida = fs.mkdtempSync(path.join(TMP, "lo-"));
  const perfil = "file://" + path.join(TMP, "lo-perfil");
  // converte para xlsx (o LibreOffice abre, recalcula e regrava) e lê os valores com o openpyxl
  execFileSync("soffice", ["-env:UserInstallation=" + perfil, "--headless", "--calc", "--convert-to", "xlsx", "--outdir", saida, arq], { stdio: "ignore", timeout: 120000 });
  const conv = path.join(saida, path.basename(arq));
  assert.ok(fs.existsSync(conv), "LibreOffice não conseguiu abrir/converter " + arq);
  return py(`
import json, sys, openpyxl
wb = openpyxl.load_workbook(sys.argv[1], data_only=True)
out = {}
for ws in wb.worksheets:
    out[ws.title] = [[c.value if not hasattr(c.value, 'isoformat') else c.value.isoformat() for c in row] for row in ws.iter_rows(min_row=1, max_row=min(ws.max_row, 40))]
print(json.dumps(out, default=str))`, conv);
}

// ================================================================== testes
let pagina;

await caso("xlsx: abrir, editar, fórmulas em português, formatação, inserir linha, salvar e conferir com openpyxl", async () => {
  const p = pagina = await novaPagina();
  await abrir(p, "Planilhas/Orcamento ficticio.xlsx");
  assert.equal(await exibido(p, "E6"), "R$ 1.647,30");
  assert.equal(await exibido(p, "A1", "Resumo"), "Total geral");
  assert.equal(await exibido(p, "B1", "Resumo"), "R$ 1.647,30");
  assert.equal(await exibido(p, "B3", "Resumo"), "16/10/2026", "data dd/mm/aaaa");
  // barra de fórmulas mostra a fórmula em português
  await clicar(p, "E6");
  assert.equal(await barraFormula(p), "=SOMA(E2:E5)");
  // editar número → fórmulas dependentes recalculam
  await digitarEm(p, "C2", "20");
  assert.equal(await exibido(p, "E2"), "R$ 710,00");
  assert.equal(await exibido(p, "E6"), "R$ 2.002,30");
  assert.equal(await ev(p, `return pasta.valor(pasta.folhaPorNome("Resumo"), 0, 1)`), 2002.3, "fórmula em outra aba (=Orçamento!E6)");
  // fórmula digitada em português com ; e vírgula decimal
  await digitarEm(p, "C8", "=SOMA(C2:C5;1)");
  assert.equal(await exibido(p, "C8"), "44");
  await digitarEm(p, "D8", "=MÉDIA(D2:D5)*2,5");
  assert.equal(await ev(p, `return pasta.valor(f, 7, 3)`), (35.5 + 120 + 89.9 + 15.25) / 4 * 2.5);
  await digitarEm(p, "E8", "=SE(C8>40;\"alto\";\"baixo\")");
  assert.equal(await exibido(p, "E8"), "alto");
  await clicar(p, "C8");
  assert.equal(await barraFormula(p), "=SOMA(C2:C5;1)");
  // texto com acentos
  await digitarEm(p, "B9", "Observação: ação concluída — São João");
  assert.equal(await exibido(p, "B9"), "Observação: ação concluída — São João");
  // número digitado no padrão brasileiro e data
  await digitarEm(p, "F2", "1.234,56");
  assert.equal(await ev(p, `return pasta.valor(f, 1, 5)`), 1234.56);
  await digitarEm(p, "F3", "16/10/2026");
  assert.equal(await exibido(p, "F3"), "16/10/2026");
  // desfazer / refazer
  await digitarEm(p, "F4", "999");
  await clicar(p, "F5");
  await p.keyboard.press("Control+z");
  assert.equal(await exibido(p, "F4"), null, "desfazer");
  await p.keyboard.press("Control+y");
  assert.equal(await exibido(p, "F4"), "999", "refazer");
  await p.keyboard.press("Control+z");
  // negrito com Ctrl+B e preenchimento pela paleta
  await clicar(p, "B2");
  await p.keyboard.press("Control+b");
  assert.equal(await ev(p, `return pasta.infoEstilo(f, 1, 1).b`), true);
  await p.click(".sheet-tool.mod-color[aria-label='Cor de preenchimento']");
  await p.click(".sheet-palette-swatch[title='#FFFF00']");
  assert.equal(await ev(p, `return pasta.estilos.render(f.estilo(1, 1)).fundo`), "#FFFF00");
  // formato moeda pela barra
  await clicar(p, "F2");
  await p.click(".sheet-tool[aria-label='Moeda (R$)']");
  assert.equal(await exibido(p, "F2"), "R$ 1.234,56");
  // inserir linha no meio (menu do cabeçalho da linha 4)
  const pt = await pontoCelula(p, "A4");
  const xCab = await ev(p, `return g.canvas.getBoundingClientRect().left + g.larguraCab / 2`);
  await p.mouse.click(xCab, pt.y, { button: "right" });
  await p.click(".menu .menu-item:has-text('Inserir linha acima')");
  await p.waitForTimeout(80);
  assert.equal(await exibido(p, "B5"), "Tinta de teste", "linha deslocada");
  assert.equal(await exibido(p, "E7"), "R$ 2.002,30", "total deslocado");
  await clicar(p, "E7");
  assert.equal(await barraFormula(p), "=SOMA(E2:E6)");
  await clicar(p, "C9");
  assert.equal(await barraFormula(p), "=SOMA(C2:C6;1)");
  // na outra aba: inserir linha acima da área mesclada (A5:C5 → A6:C6)
  await p.click(".sheet-tab:has-text('Resumo')");
  await clicar(p, "A4");
  await p.click(".sheet-tool[aria-label='Linhas: inserir ou excluir']");
  await p.click(".menu .menu-item:has-text('Inserir linha acima')");
  assert.deepEqual(await ev(p, `return f.mesclas`), [{ r1: 5, c1: 0, r2: 5, c2: 2 }]);
  assert.equal(await exibido(p, "A6"), "Células mescladas de exemplo");
  await clicar(p, "B1");
  assert.equal(await barraFormula(p), "=Orçamento!E7");
  // copiar e colar (interno, com fórmula ajustada)
  await p.click(".sheet-tab:has-text('Orçamento')");
  await clicar(p, "E2");
  await p.keyboard.press("Control+c");
  await clicar(p, "G2");
  await p.keyboard.press("Control+v");
  await p.waitForTimeout(80);
  await clicar(p, "G2");
  assert.equal(await barraFormula(p), "=E2*F2", "fórmula colada com referências ajustadas");
  await p.keyboard.press("Delete");
  // colar texto vindo do Excel/Google Planilhas (TSV)
  await clicar(p, "H2");
  await p.evaluate(() => {
    const dt = new DataTransfer();
    dt.setData("text/plain", "10\t20,5\r\nR$ 1.000,00\t15%\r\n");
    tinteiro.workspace.activeLeaf.view.grade.ta.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  assert.equal(await exibido(p, "H2"), "10");
  assert.equal(await ev(p, `return pasta.valor(f, 1, 8)`), 20.5);
  assert.equal(await exibido(p, "H3"), "R$ 1.000,00");
  assert.equal(await exibido(p, "I3"), "15%");
  // status: soma da seleção
  await clicar(p, "C2"); await clicar(p, "C6", { modifiers: ["Shift"] });
  await p.waitForTimeout(120);
  const status = await p.evaluate(() => document.querySelector(".status-bar").textContent);
  assert.match(status, /Soma: 43/);
  assert.match(status, /Contagem: 4/);
  assert.deepEqual(p.erros, [], "erros no console");
  await p.screenshot({ path: path.join(FOTOS, "sheet-desktop-escuro-editado.png") });

  await salvar(p);
  const caminho = arquivo("Orcamento ficticio.xlsx");
  const r = py(`
import json, sys, openpyxl
wb = openpyxl.load_workbook(sys.argv[1])
ws = wb["Orçamento"]; rs = wb["Resumo"]
def cor(c):
    f = c.fill
    return f.fgColor.rgb if f and f.fill_type == "solid" else None
print(json.dumps({
  "c2": ws["C2"].value, "c9": ws["C9"].value, "d9": ws["D9"].value, "e9": ws["E9"].value, "e7": ws["E7"].value, "e2": ws["E2"].value, "b5": ws["B5"].value,
  "b10": ws["B10"].value, "f2": ws["F2"].value, "f2fmt": ws["F2"].number_format, "f3": str(ws["F3"].value), "f3fmt": ws["F3"].number_format,
  "b2bold": ws["B2"].font.b, "b2fill": cor(ws["B2"]), "a1fill": cor(ws["A1"]), "a1bold": ws["A1"].font.b, "a1color": ws["A1"].font.color.rgb if ws["A1"].font.color else None,
  "d2fmt": ws["D2"].number_format, "d3fmt": ws["D3"].number_format, "e7bold": ws["E7"].font.b, "b7bold": ws["B7"].font.b,
  "larguras": [ws.column_dimensions[c].width for c in "BDE"], "congelar": ws.freeze_panes,
  "h2": ws["H2"].value, "i2": ws["I2"].value, "h3": ws["H3"].value, "h3fmt": ws["H3"].number_format, "i3": ws["I3"].value, "i3fmt": ws["I3"].number_format,
  "rb1": rs["B1"].value, "rb2": rs["B2"].value, "rb3": rs["B3"].value, "rb3fmt": rs["B3"].number_format, "mescla": [str(m) for m in rs.merged_cells.ranges], "ra6": rs["A6"].value,
  "abas": wb.sheetnames, "borda": ws["C4"].border.left.style,
}))`, caminho);
  assert.equal(r.c2, 20);
  assert.equal(r.c9, "=SUM(C2:C6,1)", "fórmula gravada em inglês com vírgula");
  assert.equal(r.d9, "=AVERAGE(D2:D6)*2.5");
  assert.equal(r.e9, '=IF(C9>40,"alto","baixo")');
  assert.equal(r.e7, "=SUM(E2:E6)");
  assert.equal(r.e2, "=C2*D2");
  assert.equal(r.b5, "Tinta de teste");
  assert.equal(r.b10, "Observação: ação concluída — São João");
  assert.equal(r.f2, 1234.56); assert.equal(r.f2fmt, '"R$" #,##0.00');
  assert.match(r.f3, /^2026-10-16/); assert.equal(r.f3fmt, "dd/mm/yyyy");
  assert.equal(r.b2bold, true); assert.equal(r.b2fill, "FFFFFF00");
  assert.equal(r.a1fill.slice(-6), "1F4E79"); assert.equal(r.a1bold, true); assert.equal(r.a1color.slice(-6), "FFFFFF");
  assert.equal(r.d2fmt, '"R$" #,##0.00'); assert.equal(r.d3fmt, '"R$" #,##0.00');
  assert.equal(r.e7bold, true); assert.equal(r.b7bold, true);
  assert.deepEqual(r.larguras, [28, 14, 16]);
  assert.equal(r.congelar, "A2");
  assert.equal(r.h2, 10); assert.equal(r.i2, 20.5); assert.equal(r.h3, 1000); assert.equal(r.i3, 0.15); assert.equal(r.i3fmt, "0%");
  assert.equal(r.rb1, "=Orçamento!E7"); assert.equal(r.rb2, "=AVERAGE(Orçamento!D2:D6)"); assert.equal(r.rb3, "=DATE(2026,10,16)"); assert.equal(r.rb3fmt, "dd/mm/yyyy");
  assert.deepEqual(r.mescla, ["A6:C6"]); assert.equal(r.ra6, "Células mescladas de exemplo");
  assert.deepEqual(r.abas, ["Orçamento", "Resumo"]);
  assert.equal(r.borda, "thin");
  // valores calculados gravados (para quem lê o arquivo sem recalcular)
  const vals = py(`
import json, sys, openpyxl
wb = openpyxl.load_workbook(sys.argv[1], data_only=True)
ws = wb["Orçamento"]
print(json.dumps([ws["E2"].value, ws["E7"].value, ws["C9"].value, ws["E9"].value, wb["Resumo"]["B1"].value]))`, caminho);
  assert.deepEqual(vals, [710, 2002.3, 44, "alto", 2002.3]);
  // estrutura do pacote: sem calcChain, com recálculo ao abrir, partes não tocadas idênticas
  const novo = await entradasZip(fs.readFileSync(caminho)), velho = await entradasZip(ORIGINAIS["Orcamento ficticio.xlsx"]);
  assert.ok(!novo["xl/calcChain.xml"]);
  assert.match(new TextDecoder().decode(novo["xl/workbook.xml"]), /fullCalcOnLoad="1"/);
  assert.match(new TextDecoder().decode(novo["xl/worksheets/sheet1.xml"]), /^<\?xml version="1.0" encoding="UTF-8" standalone="yes"\?>/);
  for (const n of ["xl/theme/theme1.xml", "docProps/core.xml", "docProps/app.xml", "_rels/.rels"]) if (velho[n]) assert.ok(iguais(novo[n], velho[n]), "parte alterada sem necessidade: " + n);
  // cópia de segurança feita pelo servidor
  const hist = path.join(COFRE, ".tinteiro", "historico", "Planilhas", "Orcamento ficticio.xlsx");
  assert.ok(fs.existsSync(hist) && fs.readdirSync(hist).length >= 1, "histórico não criado em " + hist);
  // reabrir no app
  await fecharAba(p);
  await abrir(p, "Planilhas/Orcamento ficticio.xlsx");
  assert.equal(await exibido(p, "E7"), "R$ 2.002,30");
  assert.equal(await exibido(p, "C9"), "44");
  assert.equal(await exibido(p, "B10"), "Observação: ação concluída — São João");
  assert.equal(await ev(p, `return pasta.estilos.render(f.estilo(1, 1)).fundo`), "#FFFF00");
  await clicar(p, "C9");
  assert.equal(await barraFormula(p), "=SOMA(C2:C6;1)");
  // segunda gravação (sem mudanças nas células) não estraga nada
  await digitarEm(p, "A12", "segunda gravação");
  await salvar(p);
  const r2 = py(`
import json, sys, openpyxl
wb = openpyxl.load_workbook(sys.argv[1]); ws = wb["Orçamento"]
print(json.dumps([ws["A12"].value, ws["C9"].value, ws["E7"].value, wb["Resumo"]["B1"].value]))`, caminho);
  assert.deepEqual(r2, ["segunda gravação", "=SUM(C2:C6,1)", "=SUM(E2:E6)", "=Orçamento!E7"]);
  if (soffice) {
    const lo = libreOffice(caminho);
    assert.equal(lo["Orçamento"][6][4], 2002.3, "LibreOffice recalculou o total");
    assert.equal(lo["Orçamento"][8][2], 44);
    assert.equal(lo["Resumo"][0][1], 2002.3);
  }
  assert.deepEqual(p.erros, [], "erros no console");
});

await caso("xlsx: gráfico, imagem, formatação condicional, validação, nomes e comentários sobrevivem", async () => {
  const p = pagina ??= await novaPagina();
  await fecharAba(p);
  await abrir(p, "Planilhas/Completa ficticia.xlsx");
  assert.equal(await exibido(p, "G3"), "2961", "fórmula com nome definido (Taxa)");
  await digitarEm(p, "G2", "10%");
  assert.ok(Math.abs(await ev(p, `return pasta.valor(f, 2, 6)`) - 2820 * 1.1) < 1e-9, "recalculou com a nova taxa");
  // inserir linha 3 (desloca validação, formatação condicional, comentários, hiperlink, imagem, gráfico)
  await clicar(p, "A3");
  await p.click(".sheet-tool[aria-label='Linhas: inserir ou excluir']");
  await p.click(".menu .menu-item:has-text('Inserir linha acima')");
  await digitarEm(p, "A3", "Fevereiro e meio");
  await digitarEm(p, "B3", "500");
  assert.equal(await exibido(p, "B9"), "R$ 10.550,00", "total incluiu a linha nova");
  // aba com espaço no nome
  await p.click(".sheet-tab:has-text('Resumo Geral')");
  assert.equal(await exibido(p, "B1"), "R$ 2.820,00");
  await digitarEm(p, "D1", "='Resumo Geral'!B1*2");
  assert.equal(await ev(p, `return pasta.valor(f, 0, 3)`), 5640);
  await p.screenshot({ path: path.join(FOTOS, "sheet-desktop-escuro-completa.png") });
  await salvar(p);
  const caminho = arquivo("Completa ficticia.xlsx");
  const r = py(`
import json, sys, openpyxl
wb = openpyxl.load_workbook(sys.argv[1])
ws = wb["Dados"]
cf = [str(r.sqref) for r in ws.conditional_formatting]
dv = sorted([str(d.sqref) for d in ws.data_validations.dataValidation])
print(json.dumps({
  "cf": cf, "dv": dv, "nome": wb.defined_names["Taxa"].attr_text, "coment": sorted([c.coordinate for row in ws.iter_rows() for c in row if c.comment]),
  "link": [c.coordinate for row in ws.iter_rows() for c in row if c.hyperlink], "imagens": len(ws._images), "area": ws.print_area,
  "orient": ws.page_setup.orientation, "congelar": ws.freeze_panes, "mescla": [str(m) for m in ws.merged_cells.ranges],
  "g2": ws["G2"].value, "g4": ws["G4"].value, "d9": ws["D9"].value, "b9": ws["B9"].value, "a3": ws["A3"].value, "b3": ws["B3"].value,
  "estados": [w.sheet_state for w in wb.worksheets], "abas": wb.sheetnames, "tabela": list(wb["Resumo Geral"].tables.keys()), "tref": wb["Resumo Geral"].tables["TabelaCodigos"].ref,
  "rb1": wb["Resumo Geral"]["B1"].value, "rd1": wb["Resumo Geral"]["D1"].value, "rb2": wb["Resumo Geral"]["B2"].value,
}))`, caminho);
  assert.deepEqual(r.cf, ["D2:D8"]);
  assert.deepEqual(r.dv, ["B11:B21", "G5"]);
  assert.equal(r.nome, "Dados!$G$2", "nome Taxa continua apontando para G2 (linha inserida abaixo)");
  assert.deepEqual(r.coment, ["B2", "D9"]);
  assert.deepEqual(r.link, ["F7"]);
  assert.equal(r.imagens, 1);
  assert.match(r.area, /\$A\$1:\$D\$9/);
  assert.equal(r.orient, "landscape");
  assert.equal(r.congelar, "B2");
  assert.deepEqual(r.mescla, ["F1:H1"]);
  assert.equal(r.g2, 0.1); assert.equal(r.g4, "=D9*(1+Taxa)"); assert.equal(r.d9, "=SUM(D2:D8)"); assert.equal(r.b9, "=SUM(B2:B8)");
  assert.equal(r.a3, "Fevereiro e meio"); assert.equal(r.b3, 500);
  assert.deepEqual(r.estados, ["visible", "visible", "hidden"]);
  assert.deepEqual(r.tabela, ["TabelaCodigos"]); assert.equal(r.tref, "A4:B7");
  assert.equal(r.rb1, "=Dados!D9"); assert.equal(r.rd1, "='Resumo Geral'!B1*2"); assert.equal(r.rb2, "=MAX(Dados!B2:B8)");
  // partes que o app não entende continuam no pacote
  const novo = await entradasZip(fs.readFileSync(caminho)), velho = await entradasZip(ORIGINAIS["Completa ficticia.xlsx"]);
  const nomes = Object.keys(velho).filter(n => n !== "xl/calcChain.xml");
  for (const n of nomes) assert.ok(novo[n], "parte perdida: " + n);
  for (const n of nomes.filter(n => /media\/|theme|tables\/|docProps\/core/.test(n))) assert.ok(iguais(novo[n], velho[n]), "parte alterada sem necessidade: " + n);
  const grafico = Object.keys(novo).find(n => /charts\/chart\d+\.xml$/.test(n));
  assert.ok(grafico, "gráfico sumiu");
  const gx = new TextDecoder().decode(novo[grafico]);
  assert.match(gx, /\$B\$2:\$B\$8|\$B\$1:\$B\$8/, "série do gráfico ajustada à linha inserida");
  const desenho = new TextDecoder().decode(novo[Object.keys(novo).find(n => /drawings\/drawing\d+\.xml$/.test(n))]);
  assert.match(desenho, /<(xdr:)?row>18<\/(xdr:)?row>/, "imagem acompanhou a linha inserida");
  const comentarios = new TextDecoder().decode(novo[Object.keys(novo).find(n => /^xl\/comments.*\.xml$/.test(n) && !/threaded/i.test(n))]);
  assert.match(comentarios, /ref="D9"/);
  if (soffice) {
    const lo = libreOffice(caminho);
    assert.equal(lo["Dados"][8][1], 10550, "LibreOffice: total da receita");
    assert.ok(Math.abs(lo["Dados"][3][6] - 3102) < 1e-6, "LibreOffice: fórmula com nome definido");
    assert.equal(lo["Resumo Geral"][0][3], 2 * lo["Resumo Geral"][0][1]);
  }
  // reabre e confere
  await fecharAba(p);
  await abrir(p, "Planilhas/Completa ficticia.xlsx");
  assert.equal(await exibido(p, "A3"), "Fevereiro e meio");
  assert.equal(await exibido(p, "F1"), "Observações (mescladas)");
  assert.deepEqual(p.erros, [], "erros no console");
});

await caso("xlsx: abas (nova, renomear, excluir), mesclar, bordas, classificar, congelar, largura, excluir linha", async () => {
  const p = pagina ??= await novaPagina();
  await fecharAba(p);
  await abrir(p, "Planilhas/Abas ficticia.xlsx");
  // excluir linha 5 (Abril): fórmulas, formatação condicional, validação e comentários encolhem
  await clicar(p, "A5");
  await p.click(".sheet-tool[aria-label='Linhas: inserir ou excluir']");
  await p.click(".menu .menu-item:has-text('Excluir linha')");
  assert.equal(await exibido(p, "A5"), "Maio");
  await clicar(p, "B7");
  assert.equal(await barraFormula(p), "=SOMA(B2:B6)");
  // classificar A2:D6 de Z a A pela coluna A
  await clicar(p, "A2"); await clicar(p, "D6", { modifiers: ["Shift"] });
  await ev(p, `g.sel.ativa = { r: 1, c: 0 }`);
  await clicar(p, "B3", { button: "right" });
  await p.click(".menu .menu-item:has-text('Classificar de Z a A')");
  assert.deepEqual(await ev(p, `return [1,2,3,4,5].map(r => pasta.exibir(f, r, 0).texto)`), ["Março", "Maio", "Junho", "Janeiro", "Fevereiro"]);
  await clicar(p, "D2");
  assert.equal(await barraFormula(p), "=B2-C2", "fórmula acompanhou a linha classificada");
  // bordas em A10:B11
  await clicar(p, "A10"); await clicar(p, "B11", { modifiers: ["Shift"] });
  await p.click(".sheet-tool[aria-label='Bordas']");
  await p.click(".menu .menu-item:has-text('Todas as bordas')");
  // mesclar F10:H10 e digitar
  await clicar(p, "F10"); await clicar(p, "H10", { modifiers: ["Shift"] });
  await p.click(".sheet-tool[aria-label='Mesclar e centralizar']");
  await digitarEm(p, "F10", "Mesclado novo");
  // congelar até C3
  await clicar(p, "C3", { button: "right" });
  await p.click(".menu .menu-item:has-text('Congelar até C3')");
  assert.deepEqual(await ev(p, `return f.congelar`), { linhas: 2, colunas: 2 });
  // largura da coluna B: arrastar a borda do cabeçalho
  const borda = await ev(p, `g.scroller.scrollLeft = 0; g.scroller.scrollTop = 0; g.medir(); const b = g.canvas.getBoundingClientRect(); return { x: b.left + g.x(2) - 1, y: b.top + g.cabAlt / 2 }`);
  await p.mouse.move(borda.x, borda.y); await p.mouse.down(); await p.mouse.move(borda.x + 60, borda.y, { steps: 5 }); await p.mouse.up();
  // nova aba, renomear pelo duplo clique e fórmula entre abas
  await p.click(".sheet-tab-add");
  await p.dblclick(".sheet-tab.is-active");
  await p.keyboard.press("Control+a"); await p.keyboard.type("Notas Fiscais"); await p.keyboard.press("Enter");
  await p.waitForTimeout(100);
  await digitarEm(p, "A1", "Receita total");
  await digitarEm(p, "B1", "=SOMA(Dados!B2:B6)");
  assert.equal(await exibido(p, "B1"), "8300");
  // excluir a aba "Resumo Geral" (tem tabela) pelo menu da aba
  await p.click(".sheet-tab:has-text('Resumo Geral')", { button: "right" });
  await p.click(".menu .menu-item:has-text('Excluir planilha')");
  await p.click(".modal-button-container button:has-text('Excluir')");
  await p.waitForTimeout(100);
  assert.deepEqual(await p.$$eval(".sheet-tab-name", els => els.map(e => e.textContent)), ["Dados", "Notas Fiscais"]);
  await salvar(p);
  const caminho = arquivo("Abas ficticia.xlsx");
  const r = py(`
import json, sys, openpyxl
wb = openpyxl.load_workbook(sys.argv[1])
ws = wb["Dados"]; nf = wb["Notas Fiscais"]
print(json.dumps({
  "abas": wb.sheetnames, "estados": [w.sheet_state for w in wb.worksheets], "a": [ws.cell(r, 1).value for r in range(2, 7)], "d2": ws["D2"].value, "b7": ws["B7"].value,
  "cf": [str(x.sqref) for x in ws.conditional_formatting], "dv": sorted(str(d.sqref) for d in ws.data_validations.dataValidation),
  "coment": sorted(c.coordinate for row in ws.iter_rows() for c in row if c.comment), "mescla": sorted(str(m) for m in ws.merged_cells.ranges),
  "f10": ws["F10"].value, "borda": [ws["A10"].border.left.style, ws["B11"].border.bottom.style, ws["B11"].border.right.style], "congelar": ws.freeze_panes,
  "largB": ws.column_dimensions["B"].width, "nf": [nf["A1"].value, nf["B1"].value], "nomes": {n: wb.defined_names[n].attr_text for n in wb.defined_names},
  "area": ws.print_area,
}))`, caminho);
  assert.deepEqual(r.abas, ["Dados", "Oculta", "Notas Fiscais"]);
  assert.deepEqual(r.estados, ["visible", "hidden", "visible"]);
  assert.deepEqual(r.a, ["Março", "Maio", "Junho", "Janeiro", "Fevereiro"]);
  assert.equal(r.d2, "=B2-C2"); assert.equal(r.b7, "=SUM(B2:B6)");
  assert.deepEqual(r.cf, ["D2:D6"]); assert.deepEqual(r.dv, ["B9:B19", "G4"]);
  assert.deepEqual(r.coment, ["B2", "D7"]);
  assert.deepEqual(r.mescla.sort(), ["F1:H1", "F10:H10"].sort()); assert.equal(r.f10, "Mesclado novo");
  assert.deepEqual(r.borda, ["thin", "thin", "thin"]);
  assert.equal(r.congelar, "C3");
  assert.ok(r.largB > 18, "largura da coluna B gravada: " + r.largB);
  assert.deepEqual(r.nf, ["Receita total", "=SUM(Dados!B2:B6)"]);
  assert.equal(r.nomes.Taxa, "Dados!$G$2");
  const pacote = await entradasZip(fs.readFileSync(caminho));
  assert.ok(!Object.keys(pacote).some(n => /worksheets\/sheet2\.xml$/.test(n)), "parte da aba excluída removida");
  const ct = new TextDecoder().decode(pacote["[Content_Types].xml"]);
  assert.ok(!ct.includes("/xl/worksheets/sheet2.xml"), "tipo de conteúdo da aba excluída removido");
  if (soffice) {
    const lo = libreOffice(caminho);
    assert.deepEqual(Object.keys(lo), ["Dados", "Oculta", "Notas Fiscais"]);
    assert.equal(lo["Notas Fiscais"][0][1], 8300);
    assert.equal(lo["Dados"][6][1], 8300);
  }
  await fecharAba(p);
  await abrir(p, "Planilhas/Abas ficticia.xlsx");
  assert.deepEqual(await p.$$eval(".sheet-tab-name", els => els.map(e => e.textContent)), ["Dados", "Notas Fiscais"]);
  assert.deepEqual(p.erros, [], "erros no console");
});

await caso("xlsx: teclado (setas, Tab, Enter, Ctrl+setas, Home/End, F2, Esc, Delete, Ctrl+D)", async () => {
  const p = pagina ??= await novaPagina();
  await fecharAba(p);
  await abrir(p, "Planilhas/Teclado ficticio.xlsx");
  const ativa = () => ev(p, `return [g.sel.ativa.r, g.sel.ativa.c]`);
  const area = () => ev(p, `const a = g.area(); return [a.r1, a.c1, a.r2, a.c2]`);
  await clicar(p, "A1");
  await p.keyboard.press("ArrowDown"); await p.keyboard.press("ArrowRight");
  assert.deepEqual(await ativa(), [1, 1]);
  await p.keyboard.press("Tab"); assert.deepEqual(await ativa(), [1, 2]);
  await p.keyboard.press("Shift+Tab"); assert.deepEqual(await ativa(), [1, 1]);
  await p.keyboard.press("Enter"); assert.deepEqual(await ativa(), [2, 1]);
  await p.keyboard.press("Shift+Enter"); assert.deepEqual(await ativa(), [1, 1]);
  await p.keyboard.press("Control+ArrowDown"); assert.deepEqual(await ativa(), [5, 1], "Ctrl+↓ vai ao fim do bloco");
  await p.keyboard.press("Control+ArrowUp"); assert.deepEqual(await ativa(), [0, 1]);
  await p.keyboard.press("Control+ArrowRight"); assert.deepEqual((await ativa())[1] >= 4, true);
  await p.keyboard.press("Home"); assert.deepEqual(await ativa(), [0, 0]);
  await p.keyboard.press("Shift+ArrowDown"); await p.keyboard.press("Shift+ArrowDown"); await p.keyboard.press("Shift+ArrowRight");
  assert.deepEqual(await area(), [0, 0, 2, 1]);
  await p.keyboard.press("Control+End"); assert.deepEqual(await ativa(), [5, 4], "Ctrl+End vai à última célula usada");
  await p.keyboard.press("Control+Home");
  await p.keyboard.press("PageDown"); assert.ok((await ativa())[0] > 10, "PageDown");
  // F2 edita, Esc cancela
  await clicar(p, "B3");
  await p.keyboard.press("F2"); await p.keyboard.type(" X"); await p.keyboard.press("Escape");
  assert.equal(await exibido(p, "B3"), "Areia imaginária");
  // digitar substitui; Esc cancela
  await p.keyboard.type("zzz"); await p.keyboard.press("Escape");
  assert.equal(await exibido(p, "B3"), "Areia imaginária");
  // F2 + texto + Enter
  await p.keyboard.press("F2"); await p.keyboard.type(" (lote 2)"); await p.keyboard.press("Enter");
  assert.equal(await exibido(p, "B3"), "Areia imaginária (lote 2)");
  // Delete limpa
  await clicar(p, "G10"); await p.keyboard.type("apagar"); await p.keyboard.press("Enter");
  await clicar(p, "G10"); await p.keyboard.press("Delete");
  assert.equal(await exibido(p, "G10"), null);
  // Ctrl+D (preencher abaixo) ajusta a fórmula
  await clicar(p, "G2"); await p.keyboard.type("=C2+1"); await p.keyboard.press("Enter");
  await clicar(p, "G2"); await clicar(p, "G4", { modifiers: ["Shift"] });
  await p.keyboard.press("Control+d");
  await clicar(p, "G4");
  assert.equal(await barraFormula(p), "=C4+1");
  // alça de preenchimento: série 1, 2 → 3, 4
  await digitarEm(p, "G12", "1"); await digitarEm(p, "G13", "2");
  await clicar(p, "G12"); await clicar(p, "G13", { modifiers: ["Shift"] });
  const alca = await ev(p, `const rt = g.retanguloArea(g.area()); const b = g.canvas.getBoundingClientRect(); return { x: b.left + rt.x + rt.w - 1, y: b.top + rt.y + rt.h - 1 }`);
  const destino = await pontoCelula(p, "G15");
  await p.mouse.move(alca.x, alca.y); await p.mouse.down(); await p.mouse.move(destino.x, destino.y, { steps: 6 }); await p.mouse.up();
  assert.equal(await exibido(p, "G15"), "4", "série pela alça de preenchimento");
  // Ctrl+F procura
  await p.keyboard.press("Control+f");
  await p.keyboard.type("pincel");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(300);
  assert.deepEqual(await ativa(), [4, 1]);
  await p.keyboard.press("Escape");
  // ponto e vírgula + clicar para apontar referência
  await clicar(p, "I2");
  await p.keyboard.type("=");
  await clicar(p, "C2");
  await p.keyboard.type("*");
  await clicar(p, "D2");
  await p.keyboard.press("Enter");
  await clicar(p, "I2");
  assert.equal(await barraFormula(p), "=C2*D2");
  // autocompletar função com Tab
  await clicar(p, "I3");
  await p.keyboard.type("=PROC");
  assert.ok(await p.evaluate(() => !document.querySelector(".sheet-autocomplete").classList.contains("is-hidden")), "lista de funções");
  await p.keyboard.press("Escape"); await p.keyboard.press("Escape");
  assert.deepEqual(p.erros, [], "erros no console");
  await p.evaluate(() => { tinteiro.workspace.activeLeaf.view.setDirty(false); });
});

await caso("xlsx grande: 20 mil linhas abrem, rolam e salvam", async () => {
  const p = pagina ??= await novaPagina();
  await fecharAba(p);
  const t0 = Date.now();
  await abrir(p, "Planilhas/Grande 20 mil linhas.xlsx");
  const tAbrir = Date.now() - t0;
  const temposCarga = await ev(p, "return v.tempos");
  assert.ok(tAbrir < 8000, "demorou para abrir: " + tAbrir);
  // rolagem: mede o tempo de desenho
  const tempos = await ev(p, `
    const s = g.scroller; const out = [];
    for (let i = 0; i < 40; i++) { s.scrollTop += 900; const t = performance.now(); g.pintar(); out.push(performance.now() - t); }
    return out;`);
  const medio = tempos.reduce((a, b) => a + b, 0) / tempos.length;
  assert.ok(medio < 30, "desenho lento: " + medio.toFixed(1) + " ms");
  await p.keyboard.press("Control+End");
  assert.equal(await ev(p, `return g.sel.ativa.r`), 20000);
  assert.equal(await exibido(p, "B20001"), "Item fictício 20000");
  await digitarEm(p, "C15000", "1");
  const v = await ev(p, `return [pasta.valor(f, 14999, 3), pasta.valor(f, 14999, 4)]`);
  assert.equal(v[1], v[0]);
  await p.screenshot({ path: path.join(FOTOS, "sheet-desktop-escuro-grande.png") });
  const t1 = Date.now();
  await salvar(p);
  const tSalvar = Date.now() - t1;
  assert.ok(tSalvar < 30000, "demorou para salvar: " + tSalvar);
  const r = py(`
import json, sys, openpyxl
wb = openpyxl.load_workbook(sys.argv[1], read_only=True)
ws = wb.active
rows = list(ws.iter_rows(min_row=15000, max_row=15000, values_only=True))
print(json.dumps([rows[0][2], rows[0][4], ws.max_row]))`, arquivo("Grande 20 mil linhas.xlsx"));
  assert.deepEqual(r, [1, "=C15000*D15000", 20001]);
  console.log(`     (abrir ${tAbrir} ms ${JSON.stringify(temposCarga)}, desenho médio ${medio.toFixed(1)} ms, salvar ${tSalvar} ms)`);
  assert.deepEqual(p.erros, [], "erros no console");
});

await caso("csv: separador ;, edição com fórmula, número brasileiro, salvar mantendo o formato", async () => {
  const p = pagina ??= await novaPagina();
  await fecharAba(p);
  await abrir(p, "Planilhas/contatos-ficticios.csv");
  assert.equal(await exibido(p, "C3"), "250,5");
  await digitarEm(p, "C2", "1.234,56");
  await digitarEm(p, "D1", "Dobro");
  await digitarEm(p, "D2", "=C2*2");
  assert.equal(await exibido(p, "D2"), "2469,12");
  await digitarEm(p, "D3", "=SOMA(C2:C4;0,5)");
  assert.equal(await ev(p, `return pasta.valor(f, 2, 3)`), 1234.56 + 250.5 + 75 + 0.5);
  await digitarEm(p, "A5", "Fulana; com ponto e vírgula");
  await p.screenshot({ path: path.join(FOTOS, "sheet-desktop-escuro-csv.png") });
  await salvar(p);
  const bytes = fs.readFileSync(arquivo("contatos-ficticios.csv"));
  const txt = new TextDecoder().decode(bytes);
  assert.ok(bytes[0] !== 0xEF, "não deve ganhar BOM");
  assert.ok(!txt.includes("\r\n"), "mantém LF");
  assert.equal(txt, "Nome;Cidade;Valor;Dobro\nFulano de Tal;Cidade Imaginária;1.234,56;=C2*2\nBeltrana Exemplo;Vila Teste;250,5;\"=SOMA(C2:C4;0,5)\"\nCiclano Fictício;Porto Modelo;75\n\"Fulana; com ponto e vírgula\"\n");
  await fecharAba(p);
  await abrir(p, "Planilhas/contatos-ficticios.csv");
  assert.equal(await exibido(p, "D2"), "2469,12");
  assert.deepEqual(p.erros, [], "erros no console");
});

await caso("csv: vírgula + BOM + CRLF + aspas e quebras de linha; Windows-1252", async () => {
  const p = pagina ??= await novaPagina();
  await fecharAba(p);
  await abrir(p, "Planilhas/virgulas-ficticio.csv");
  assert.equal(await exibido(p, "C3"), "Linha 1\nLinha 2");
  assert.equal(await ev(p, `return pasta.valor(f, 2, 3)`), 1234.75);
  await digitarEm(p, "D4", "4.5");
  await salvar(p);
  const bytes = fs.readFileSync(arquivo("virgulas-ficticio.csv"));
  const orig = ORIGINAIS["virgulas-ficticio.csv"];
  assert.deepEqual([...bytes.slice(0, 3)], [0xEF, 0xBB, 0xBF], "BOM mantido");
  const t = new TextDecoder().decode(bytes.slice(3)), to = new TextDecoder().decode(orig.slice(3));
  assert.equal(t, to.replace("Ciclano,Travessa C,,3", "Ciclano,Travessa C,,4.5"), "só a célula alterada mudou");
  await fecharAba(p);
  await abrir(p, "Planilhas/latin1-ficticio.csv");
  assert.equal(await exibido(p, "A2"), "São João Fictício");
  await digitarEm(p, "B3", "Concluído");
  await salvar(p);
  const b2 = fs.readFileSync(arquivo("latin1-ficticio.csv"));
  const txt = new TextDecoder("windows-1252").decode(b2);
  assert.equal(txt, "Município;Situação;Valor\r\nSão João Fictício;Ação concluída;1.234,56\r\nVila Imaginária;Concluído;99,9\r\n");
  assert.ok(!new Uint8Array(b2).includes(0xC3), "continua em Windows-1252 (sem UTF-8)");
  assert.deepEqual(p.erros, [], "erros no console");
});

await caso("somente leitura (histórico de versões)", async () => {
  const p = pagina ??= await novaPagina();
  await fecharAba(p);
  const versoes = await p.evaluate(() => tinteiro.backend.history("Planilhas/Orcamento ficticio.xlsx"));
  assert.ok(versoes.length >= 1);
  await p.evaluate(v => tinteiro.abrirVersao("Planilhas/Orcamento ficticio.xlsx", v), versoes[versoes.length - 1]);
  await p.waitForFunction(() => tinteiro.workspace.activeLeaf?.view?.interno?.grade, null, { timeout: 20000 });
  await p.waitForTimeout(300);
  const r = await p.evaluate(() => { const v = tinteiro.workspace.activeLeaf.view.interno; return { leitura: v.grade.somenteLeitura, barra: !!document.querySelector(".version-body .sheet-toolbar"), e6: v.pasta.exibir(v.grade.folha, 5, 4)?.texto }; });
  assert.deepEqual(r, { leitura: true, barra: false, e6: "R$ 1.647,30" });
  await p.keyboard.type("123");
  assert.equal(await p.evaluate(() => { const v = tinteiro.workspace.activeLeaf.view.interno; return v.pasta.exibir(v.grade.folha, 0, 0)?.texto; }), "Item");
  await p.screenshot({ path: path.join(FOTOS, "sheet-desktop-escuro-versao.png") });
  await abrir(p, "Planilhas/Orcamento ficticio.xlsx"); // substitui a aba da versão (não deixa o espaço de trabalho sem abas)
  assert.deepEqual(p.erros, [], "erros no console");
});

await caso("capturas de tela: claro, escuro e celular", async () => {
  // escuro e claro, planilha completa
  for (const tema of ["dark", "light"]) {
    const p = await novaPagina({ tema });
    await p.reload(); await esperarApp(p);
    await abrir(p, "Planilhas/Completa ficticia.xlsx");
    await clicar(p, "B2"); await clicar(p, "D5", { modifiers: ["Shift"] });
    await p.waitForTimeout(200);
    await p.screenshot({ path: path.join(FOTOS, `sheet-desktop-${tema === "dark" ? "escuro" : "claro"}.png`) });
    await fecharAba(p);
    await abrir(p, "Planilhas/Orcamento ficticio.xlsx");
    await clicar(p, "C4"); await p.keyboard.type("=SOMA(C2:");
    await p.waitForTimeout(150);
    await p.screenshot({ path: path.join(FOTOS, `sheet-desktop-${tema === "dark" ? "escuro" : "claro"}-formula.png`) });
    await p.keyboard.press("Escape");
    assert.deepEqual(p.erros, [], "erros no console (" + tema + ")");
    await p.context().close();
  }
  // celular
  const p = await novaPagina({ largura: 390, altura: 844, celular: true, tema: "light" });
  await p.reload(); await esperarApp(p);
  await abrir(p, "Planilhas/Completa ficticia.xlsx");
  const pt = await pontoCelula(p, "B3");
  await p.touchscreen.tap(pt.x, pt.y);
  await p.waitForTimeout(150);
  assert.deepEqual(await ev(p, `return [g.sel.ativa.r, g.sel.ativa.c]`), [2, 1], "toque seleciona");
  await p.screenshot({ path: path.join(FOTOS, "sheet-celular.png") });
  // tocar de novo edita
  await p.touchscreen.tap(pt.x, pt.y);
  await p.waitForTimeout(150);
  assert.equal(await ev(p, `return !!g.ed`), true, "segundo toque edita");
  await p.screenshot({ path: path.join(FOTOS, "sheet-celular-editando.png") });
  await p.keyboard.press("Escape");
  const tb = await ev(p, `return v.getMobileToolbar().map(x => x.icon)`);
  assert.ok(tb.includes("undo") && tb.includes("sigma") && tb.includes("rows"));
  // rolagem por toque
  await ev(p, `g.scroller.scrollTop = 200; g.scroller.dispatchEvent(new Event("scroll"));`);
  await p.waitForTimeout(100);
  assert.ok(await ev(p, `return g.medir().r0 > 0`), "rolou");
  const p2 = await novaPagina({ largura: 390, altura: 844, celular: true, tema: "dark" });
  await p2.reload(); await esperarApp(p2);
  await abrir(p2, "Planilhas/Orcamento ficticio.xlsx");
  await p2.screenshot({ path: path.join(FOTOS, "sheet-celular-escuro.png") });
  assert.deepEqual([...p.erros, ...p2.erros], [], "erros no console (celular)");
});

// ------------------------------------------------------------------ fim
await navegador.close();
servidor.kill();
console.log("\nResumo do teste de planilhas:\n" + resultados.join("\n"));
console.log(`\nLibreOffice: ${soffice ? "usado" : "não encontrado (verificações com ele puladas)"}`);
console.log(`Capturas em ${FOTOS}`);
if (falhas) { console.log(`\n${falhas} caso(s) falharam.`); process.exit(1); }
console.log("\nTudo certo.");
void os;
