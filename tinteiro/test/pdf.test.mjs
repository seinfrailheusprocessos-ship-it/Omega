// Teste ponta a ponta do editor de PDF (Playwright + verificação do arquivo salvo com pypdf).
//
//   node test/pdf.test.mjs
//
// Variáveis (opcionais):
//   TINTEIRO_DIST  pasta da interface já gerada (padrão: dist/web)   — gere com: node scripts/build-web.mjs
//   TESTE_DIR      pasta temporária do teste (cofre fictício, dados do servidor)
//   SHOTS          onde salvar as capturas (padrão: TESTE_DIR/shots)
//   PORTA          porta do servidor de teste (padrão 27191)
//   CHROMIUM       executável do Chromium (padrão /opt/pw-browsers/chromium)
import { chromium } from "playwright";
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.resolve(process.env.TINTEIRO_DIST || path.join(raiz, "dist/web"));
const DIR = path.resolve(process.env.TESTE_DIR || path.join(os.tmpdir(), "tinteiro-pdf-teste"));
const SHOTS = path.resolve(process.env.SHOTS || path.join(DIR, "shots"));
const PORTA = Number(process.env.PORTA || 27191);
const TOKEN = "TESTE123TESTE123TESTE123";
const COFRE = path.join(DIR, "cofre");
const URL_APP = `http://127.0.0.1:${PORTA}/#token=${TOKEN}`;
const RELATORIO = "PDFs/Relatorio ficticio.pdf";
const MISTO = "PDFs/Misto ficticio.pdf";
const TEXTO = "Assinado em Ilhéus — ação";

let falhas = 0, passos = 0;
function ok(cond, msg, extra) {
  passos++;
  if (cond) console.log("  ✓ " + msg);
  else { falhas++; console.log("  ✗ " + msg + (extra !== undefined ? "  → " + JSON.stringify(extra).slice(0, 400) : "")); }
  return cond;
}
const secao = t => console.log("\n■ " + t);
const esperar = ms => new Promise(r => setTimeout(r, ms));

// ------------------------------------------------------------ preparação
if (!fs.existsSync(path.join(DIST, "index.html"))) { console.error(`Interface não encontrada em ${DIST}. Rode: node scripts/build-web.mjs`); process.exit(2); }
fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(SHOTS, { recursive: true });
execFileSync("python3", [path.join(raiz, "test/fixtures/gerar.py"), COFRE], { stdio: "ignore" });
execFileSync("python3", [path.join(raiz, "test/pdf-fixtures.py"), COFRE], { stdio: "ignore" });

const srv = spawn(process.execPath, [path.join(raiz, "src/server/standalone.js"), "--root", COFRE, "--data", path.join(DIR, "srvdata"), "--port", String(PORTA), "--token", TOKEN, "--web", DIST], { stdio: ["ignore", "pipe", "pipe"] });
let logSrv = "";
srv.stdout.on("data", d => (logSrv += d));
srv.stderr.on("data", d => (logSrv += d));
for (let i = 0; i < 50 && !logSrv.includes("servidor em"); i++) await esperar(100);
if (!logSrv.includes("servidor em")) { console.error("Servidor não iniciou:\n" + logSrv); srv.kill(); process.exit(2); }

/** roda python com pypdf sobre um arquivo e devolve o JSON impresso */
function pypdf(arquivo, codigo) {
  const prog = `import json, sys\nfrom pypdf import PdfReader\nr = PdfReader(sys.argv[1])\n${codigo}\n`;
  return JSON.parse(execFileSync("python3", ["-c", prog, arquivo], { encoding: "utf8" }));
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium" });
const erros = [];
function vigiar(p, rotulo) {
  p.on("pageerror", e => erros.push(`[${rotulo}] pageerror: ${e.message}`));
  p.on("console", m => { if (m.type() === "error") erros.push(`[${rotulo}] console: ${m.text()}`); });
}
async function novaPagina(opts, rotulo) {
  const ctx = await browser.newContext({ locale: "pt-BR", ...opts });
  const p = await ctx.newPage();
  vigiar(p, rotulo);
  await p.goto(URL_APP);
  await p.waitForFunction(() => window.tinteiro?.workspace?.activeLeaf !== undefined);
  await p.waitForTimeout(600);
  return p;
}
async function abrir(p, arq) {
  await p.evaluate(a => tinteiro.abrirArquivo(a), arq);
  await p.waitForFunction(a => { const v = tinteiro.workspace.activeLeaf?.view; return v?.file?.path === a && v.paginas?.length && document.querySelector(".pdf-pagina[data-renderizada]"); }, arq, { timeout: 20000 });
  await p.waitForTimeout(400);
}
const V = (p, fn, arg) => p.evaluate(([f, a]) => { const v = tinteiro.workspace.activeLeaf.view; return new Function("v", "a", "return (" + f + ")(v, a)")(v, a); }, [fn.toString(), arg]);
const modelo = p => V(p, v => v.paginas.map(q => ({ fonte: v.fontes.findIndex(f => f.id === q.fonte), indice: q.indice, rot: q.rot, anots: q.anots.map(a => ({ tipo: a.tipo, texto: a.texto, n: a.pontos?.length || a.rects?.length || 0 })) })));
async function caixa(p, sel, i = 0) { const b = await p.locator(sel).nth(i).boundingBox(); if (!b) throw new Error("sem caixa: " + sel); return b; }
async function clicarBotao(p, rotulo) { await p.locator(`.pdf-view [aria-label="${rotulo}"]:visible`).first().click(); await p.waitForTimeout(150); }
async function arrastar(p, pontos, { passos = 6 } = {}) {
  await p.mouse.move(pontos[0][0], pontos[0][1]);
  await p.mouse.down();
  for (let i = 1; i < pontos.length; i++) await p.mouse.move(pontos[i][0], pontos[i][1], { steps: passos });
  await p.mouse.up();
  await p.waitForTimeout(150);
}

try {
  // ============================================================ desktop
  secao("Abrir o PDF (desktop, tema escuro)");
  const p = await novaPagina({ viewport: { width: 1400, height: 860 }, colorScheme: "dark" }, "desktop");
  await p.evaluate(() => localStorage.removeItem("tinteiro.assinaturas"));
  await abrir(p, RELATORIO);
  let m = await modelo(p);
  ok(m.length === 4, "abre com 4 páginas", m.length);
  ok(await p.locator(".pdf-pagina .textLayer span").count() > 10, "camada de texto (seleção/cópia) foi criada");
  ok((await p.locator(".status-bar").innerText()).includes("Página 1 de 4"), "barra de status mostra “Página 1 de 4”");
  ok(await p.locator(".pdf-miniatura").count() === 4, "painel de miniaturas com 4 páginas");

  secao("Zoom");
  const z0 = await V(p, v => v.escala);
  await clicarBotao(p, "Aumentar zoom (Ctrl +)");
  const z1 = await V(p, v => v.escala);
  ok(z1 > z0, "botão de aumentar zoom", [z0, z1]);
  await p.locator(".pdf-rolagem").hover();
  await p.keyboard.down("Control"); await p.mouse.wheel(0, -200); await p.keyboard.up("Control");
  await p.waitForTimeout(300);
  ok(await V(p, v => v.escala) > z1, "Ctrl + roda do mouse aumenta o zoom");
  await p.keyboard.press("Control+0");
  await p.waitForTimeout(400);
  ok(Math.abs(await V(p, v => v.escala) - z0) < 0.01 && await V(p, v => v.modoZoom) === "largura", "Ctrl+0 volta a ajustar à largura");

  secao("Caneta (tinta) + desfazer/refazer");
  await clicarBotao(p, "Caneta (desenho livre)");
  let pg = await caixa(p, ".pdf-pagina", 0);
  const yQ = pg.y + pg.height * 0.80;
  await arrastar(p, [[pg.x + pg.width * 0.55, yQ], [pg.x + pg.width * 0.60, yQ - 25], [pg.x + pg.width * 0.66, yQ + 10], [pg.x + pg.width * 0.72, yQ - 20], [pg.x + pg.width * 0.80, yQ + 5]]);
  m = await modelo(p);
  ok(m[0].anots.length === 1 && m[0].anots[0].tipo === "tinta" && m[0].anots[0].n >= 3, "traço de caneta criado na página 1", m[0].anots);
  ok(await V(p, v => v.dirty) === true, "documento marcado como não salvo");
  ok((await p.locator(".status-bar").innerText()).includes("Não salvo"), "status mostra “Não salvo”");
  await p.keyboard.press("Control+z");
  ok((await modelo(p))[0].anots.length === 0, "Ctrl+Z desfaz o traço");
  await p.keyboard.press("Control+y");
  ok((await modelo(p))[0].anots.length === 1, "Ctrl+Y refaz o traço");

  secao("Inserir texto com acentos");
  await clicarBotao(p, "Inserir texto");
  await p.mouse.click(pg.x + pg.width * 0.16, pg.y + pg.height * 0.885);
  await p.waitForSelector(".pdf-anot.is-editing textarea");
  await p.keyboard.type(TEXTO);
  await p.waitForTimeout(100);
  await p.keyboard.press("Escape");
  m = await modelo(p);
  const txt = m[0].anots.find(a => a.tipo === "texto");
  ok(txt?.texto === TEXTO, "caixa de texto criada com o texto digitado", txt);
  ok(await p.locator(".pdf-rolagem .pdf-anot-texto .pdf-anot-linhas").first().innerText() === TEXTO, "texto aparece na página");
  // aumentar a letra pela barra flutuante (anotação continua selecionada)
  const tam0 = await V(p, v => v.paginas[0].anots.find(a => a.tipo === "texto").tam);
  await clicarBotao(p, "Letra maior");
  const tam1 = await V(p, v => v.paginas[0].anots.find(a => a.tipo === "texto").tam);
  ok(tam1 > tam0, "botão “Letra maior” aumenta o tamanho", [tam0, tam1]);

  secao("Assinatura (desenhada) e imagem");
  await clicarBotao(p, "Assinar");
  await p.waitForSelector(".pdf-assin-canvas");
  const cv = await caixa(p, ".pdf-assin-canvas");
  const sx = cv.x + 60, sy = cv.y + cv.height * 0.55;
  const curva = [];
  for (let i = 0; i <= 24; i++) curva.push([sx + i * 14, sy - Math.sin(i / 2.2) * 30 - (i % 5) * 3]);
  await arrastar(p, curva, { passos: 2 });
  await arrastar(p, [[sx + 40, sy + 30], [sx + 300, sy + 22]], { passos: 8 });
  await p.screenshot({ path: path.join(SHOTS, "pdf-assinatura-dialogo.png") });
  await p.locator(".modal-button-container button", { hasText: /^Usar assinatura$/ }).click();
  await p.waitForSelector(".pdf-rolagem .pdf-anot-imagem img");
  m = await modelo(p);
  ok(m[0].anots.some(a => a.tipo === "imagem"), "imagem da assinatura colocada na página 1");
  const guardadas = await p.evaluate(() => JSON.parse(localStorage.getItem("tinteiro.assinaturas") || "[]").length);
  ok(guardadas === 1, "assinatura guardada para reutilizar (tinteiro.assinaturas)", guardadas);
  // arrasta a assinatura para dentro do quadro
  const ai = await caixa(p, ".pdf-rolagem .pdf-anot-imagem");
  pg = await caixa(p, ".pdf-pagina", 0);
  await arrastar(p, [[ai.x + ai.width / 2, ai.y + ai.height / 2], [pg.x + pg.width * 0.32, pg.y + pg.height * 0.80]], { passos: 10 });
  const posImg = await V(p, v => { const a = v.paginas[0].anots.find(x => x.tipo === "imagem"); return { x: a.x, y: a.y, cw: a.cw, ch: a.ch }; });
  ok(posImg.y > 841.89 * 0.65, "assinatura arrastada para o quadro", posImg);
  // redimensiona pelo canto
  const alca = await caixa(p, '.pdf-rolagem .pdf-alca[data-alca="se"]');
  await arrastar(p, [[alca.x + alca.width / 2, alca.y + alca.height / 2], [alca.x + 40, alca.y + 15]], { passos: 6 });
  const posImg2 = await V(p, v => { const a = v.paginas[0].anots.find(x => x.tipo === "imagem"); return { cw: a.cw, ch: a.ch }; });
  ok(posImg2.cw > posImg.cw && Math.abs(posImg2.cw / posImg2.ch - posImg.cw / posImg.ch) < 0.02, "assinatura redimensionada mantendo a proporção", [posImg, posImg2]);

  // carimbo: imagem escolhida no computador (seletor de arquivos); depois apaga com Delete
  const nImgs = async () => (await modelo(p))[0].anots.filter(a => a.tipo === "imagem").length;
  const antes = await nImgs();
  await clicarBotao(p, "Inserir imagem ou carimbo");
  const [seletor] = await Promise.all([p.waitForEvent("filechooser"), p.locator(".menu-item", { hasText: "Imagem do computador…" }).click()]);
  await seletor.setFiles(path.join(COFRE, "Imagens/brasao-ficticio.png"));
  await p.waitForFunction(n => tinteiro.workspace.activeLeaf.view.paginas[0].anots.filter(a => a.tipo === "imagem").length > n, antes);
  ok(await nImgs() === antes + 1, "imagem do computador inserida como carimbo");
  await p.keyboard.press("Delete");
  ok(await nImgs() === antes, "tecla Delete apaga a anotação selecionada");
  // seleciona de novo a assinatura (para a barra flutuante)
  const ass = await caixa(p, ".pdf-rolagem .pdf-anot-imagem");
  await p.mouse.click(ass.x + ass.width / 2, ass.y + ass.height / 2);
  await p.waitForSelector(".pdf-barra-anot");

  // rubrica: repetir a imagem em todas as páginas (e desfazer)
  await clicarBotao(p, "Repetir em todas as páginas (rubrica)");
  m = await modelo(p);
  ok(m.every(q => q.anots.some(a => a.tipo === "imagem")), "“Repetir em todas as páginas” coloca a imagem nas 4 páginas", m.map(q => q.anots.length));
  await p.keyboard.press("Control+z");
  m = await modelo(p);
  ok(m.slice(1).every(q => !q.anots.length) && m[0].anots.some(a => a.tipo === "imagem"), "Ctrl+Z desfaz a repetição");

  secao("Marca-texto sobre texto selecionado");
  await clicarBotao(p, "Marca-texto");
  const span = p.locator(".pdf-pagina").first().locator(".textLayer span", { hasText: "Linha 2 da página 1" }).first();
  const sb = await span.boundingBox();
  await arrastar(p, [[sb.x + 2, sb.y + sb.height / 2], [sb.x + sb.width - 2, sb.y + sb.height / 2]], { passos: 10 });
  await p.waitForTimeout(200);
  m = await modelo(p);
  ok(m[0].anots.some(a => a.tipo === "destaque" && a.n >= 1), "destaque criado a partir da seleção de texto", m[0].anots);
  // retângulo
  await clicarBotao(p, "Retângulo");
  await arrastar(p, [[pg.x + pg.width * 0.62, pg.y + pg.height * 0.12], [pg.x + pg.width * 0.9, pg.y + pg.height * 0.2]]);
  ok((await modelo(p))[0].anots.some(a => a.tipo === "retangulo"), "retângulo desenhado");
  await clicarBotao(p, "Selecionar e mover");
  await p.screenshot({ path: path.join(SHOTS, "pdf-desktop-escuro.png") });
  // selecionado: barra flutuante
  const tx = await caixa(p, ".pdf-rolagem .pdf-anot-texto");
  await p.mouse.click(tx.x + 10, tx.y + tx.height / 2);
  await p.waitForSelector(".pdf-barra-anot");
  await p.screenshot({ path: path.join(SHOTS, "pdf-desktop-escuro-selecao.png") });
  ok(await p.locator(".pdf-barra-anot").isVisible(), "barra flutuante da anotação selecionada");
  await p.keyboard.press("Escape");

  secao("Busca no PDF");
  await p.keyboard.press("Control+f");
  await p.waitForSelector(".pdf-busca:not(.is-hidden) input");
  await p.keyboard.type("laranja");
  await p.waitForFunction(() => /\d+ de \d+/.test(document.querySelector(".pdf-busca-info")?.textContent || ""));
  const info = await p.locator(".pdf-busca-info").innerText();
  ok(info === "1 de 72", "encontra as 72 ocorrências de “laranja”", info);
  ok(await p.locator(".textLayer .highlight.selected").count() >= 1, "resultado destacado no texto");
  await p.keyboard.press("Enter");
  ok(await p.locator(".pdf-busca-info").innerText() === "2 de 72", "Enter vai para o próximo resultado");
  await p.keyboard.press("Escape");
  ok(await p.locator(".pdf-busca.is-hidden").count() === 1 && await p.locator(".textLayer .highlight").count() === 0, "Esc fecha a busca e limpa os destaques");

  secao("Páginas: girar, excluir, reordenar, juntar");
  await p.locator(".pdf-miniatura").nth(1).click();
  await p.waitForTimeout(300);
  ok(await V(p, v => v.atual) === 1, "clique na miniatura 2 vai para a página 2");
  await clicarBotao(p, "Girar página para a direita");
  m = await modelo(p);
  ok(m[1].rot === 90, "página 2 girada 90°", m.map(x => x.rot));
  await p.waitForSelector('.pdf-pagina:nth-child(2)[data-renderizada]');
  await p.locator(".pdf-miniatura").nth(2).click();
  await p.waitForTimeout(300);
  await clicarBotao(p, "Excluir página");
  await p.waitForSelector(".modal-container");
  ok((await p.locator(".modal-title").innerText()).includes("Excluir a página 3"), "pede confirmação antes de excluir");
  await p.locator(".modal-button-container button", { hasText: /^Excluir$/ }).click();
  await p.waitForTimeout(300);
  m = await modelo(p);
  ok(m.length === 3 && m.map(x => x.indice).join() === "0,1,3", "página 3 excluída", m.map(x => x.indice));
  await p.keyboard.press("Control+z");
  ok((await modelo(p)).length === 4, "Ctrl+Z traz a página excluída de volta");
  await p.keyboard.press("Control+y");
  m = await modelo(p);
  ok(m.length === 3 && m[1].rot === 90, "Ctrl+Y exclui de novo (e a rotação da página 2 continua)", m.map(x => [x.indice, x.rot]));
  // arrastar a última miniatura para o início
  const ult = await caixa(p, ".pdf-miniatura", 2), pri = await caixa(p, ".pdf-miniatura", 0);
  await arrastar(p, [[ult.x + ult.width / 2, ult.y + ult.height / 2], [ult.x + ult.width / 2, ult.y + ult.height / 2 - 30], [pri.x + pri.width / 2, pri.y + 15]], { passos: 8 });
  await p.waitForTimeout(300);
  m = await modelo(p);
  ok(m.map(x => x.indice).join() === "3,0,1", "última página arrastada para o início", m.map(x => x.indice));
  // juntar o Anexo do cofre no final
  await clicarBotao(p, "Juntar: inserir páginas de outro PDF");
  await p.locator(".menu-item", { hasText: "PDF do cofre…" }).click();
  await p.waitForSelector(".prompt-input");
  await p.waitForTimeout(100);
  await p.locator(".prompt-input").fill("Anexo");
  await p.waitForFunction(() => document.querySelector(".suggestion-item.is-selected")?.textContent.includes("Anexo ficticio.pdf"));
  await p.keyboard.press("Enter");
  await p.waitForSelector(".pdf-modal-inserir");
  ok((await p.locator(".pdf-modal-inserir").innerText()).includes("tem 2 páginas"), "janela de inserção mostra o número de páginas");
  await p.locator('.pdf-modal-inserir input[value="fim"]').check();
  await p.locator(".modal-button-container button", { hasText: /^Inserir$/ }).click();
  await p.waitForTimeout(500);
  m = await modelo(p);
  ok(m.length === 5 && m[3].fonte === 1 && m[4].fonte === 1, "2 páginas do Anexo inseridas no final", m.map(x => [x.fonte, x.indice]));
  await p.waitForTimeout(800);
  await p.screenshot({ path: path.join(SHOTS, "pdf-desktop-escuro-paginas.png") });

  secao("Salvar (Ctrl+S) e conferir com pypdf");
  await p.locator(".pdf-rolagem").click({ position: { x: 5, y: 5 } });
  await p.keyboard.press("Control+s");
  await p.waitForFunction(() => { const v = tinteiro.workspace.activeLeaf.view; return !v.dirty && v.fontes.length === 1 && v.paginas.length === 5 && v.paginas.every(q => !q.anots.length); }, null, { timeout: 20000 });
  ok(true, "salvou e recarregou a partir do arquivo novo");
  ok(!(await p.locator(".status-bar").innerText()).includes("Não salvo"), "status deixa de mostrar “Não salvo”");
  const arq = path.join(COFRE, RELATORIO);
  const r = pypdf(arq, `
paginas = []
for pg in r.pages:
    res = pg.get("/Resources") or {}
    gs = res.get("/ExtGState") or {}
    bms = [str(g.get_object().get("/BM")) for g in gs.values()] if gs else []
    cs = pg.get_contents()
    dados = cs.get_data() if cs is not None else b""
    paginas.append({"rot": pg.rotation, "texto": pg.extract_text(), "imagens": len(pg.images), "bm": bms, "curvas": dados.count(b" c\\n") + dados.count(b" c "), "mediabox": [float(x) for x in pg.mediabox]})
todo = "\\n".join(p["texto"] for p in paginas)
print(json.dumps({"n": len(r.pages), "paginas": paginas, "todo": todo}))`);
  ok(r.n === 5, "arquivo salvo tem 5 páginas", r.n);
  ok(r.paginas[0].texto.includes("Página 4 de 4"), "1ª página é a antiga página 4");
  ok(r.paginas[1].texto.includes("Página 1 de 4"), "2ª página é a antiga página 1");
  ok(r.paginas[2].texto.includes("Página 2 de 4") && r.paginas[2].rot === 90, "3ª página é a antiga página 2, girada 90°", r.paginas[2].rot);
  ok(r.paginas[3].texto.includes("ANEXO FICTÍCIO") && r.paginas[4].texto.includes("ANEXO FICTÍCIO"), "páginas 4 e 5 vêm do Anexo");
  ok(!r.todo.includes("Página 3 de 4"), "página excluída não está mais no arquivo");
  ok(r.paginas[1].texto.includes(TEXTO), "texto com acentos gravado na página (extract_text)", r.paginas[1].texto.slice(-200));
  ok(r.paginas[1].imagens >= 2, "página tem a imagem original + a assinatura", r.paginas[1].imagens);
  ok(r.paginas[1].bm.some(b => b.includes("Multiply")), "marca-texto gravado com mesclagem multiplicar", r.paginas[1].bm);
  ok(r.paginas[1].curvas >= 1, "traço da caneta gravado como curva", r.paginas[1].curvas);
  const hist = path.join(COFRE, ".tinteiro/historico", RELATORIO);
  const versoes = fs.existsSync(hist) ? fs.readdirSync(hist) : [];
  ok(versoes.length >= 1, "servidor guardou a versão anterior em .tinteiro/historico", versoes);

  secao("Reabrir o arquivo salvo");
  const errosAntes = erros.length;
  await p.evaluate(() => tinteiro.workspace.activeLeaf.fechar());
  await p.waitForTimeout(300);
  await abrir(p, RELATORIO);
  m = await modelo(p);
  ok(m.length === 5, "reaberto com 5 páginas");
  for (let i = 0; i < 5; i++) await V(p, (v, i) => v.irParaPagina(i), i), await p.waitForTimeout(250);
  await p.waitForFunction(() => document.querySelectorAll(".pdf-pagina[data-renderizada]").length >= 3);
  ok(erros.length === errosAntes, "reabriu sem erros no console", erros.slice(errosAntes));
  await V(p, v => v.irParaPagina(1));
  await p.waitForTimeout(600);
  await p.screenshot({ path: path.join(SHOTS, "pdf-desktop-escuro-salvo.png") });

  secao("Extrair páginas para um novo PDF");
  await p.locator(".pdf-miniatura").nth(3).click();
  await p.locator(".pdf-miniatura").nth(4).click({ modifiers: ["Control"] });
  ok(await p.locator(".pdf-miniatura.is-selected").count() === 2, "Ctrl+clique seleciona várias miniaturas");
  await clicarBotao(p, "Extrair páginas para um novo PDF");
  const novo = "PDFs/Relatorio ficticio - páginas 4-5.pdf";
  await p.waitForFunction(a => tinteiro.workspace.activeLeaf?.view?.file?.path === a && tinteiro.workspace.activeLeaf.view.paginas?.length, novo, { timeout: 15000 });
  const r3 = pypdf(path.join(COFRE, novo), `print(json.dumps({"n": len(r.pages), "t": [pg.extract_text() for pg in r.pages]}))`);
  ok(r3.n === 2 && r3.t.every(t => t.includes("ANEXO FICTÍCIO")), "novo PDF com as 2 páginas selecionadas foi criado e aberto", r3.n);
  await p.evaluate(() => tinteiro.workspace.activeLeaf.fechar());
  await abrir(p, RELATORIO);

  secao("Imprimir");
  await p.evaluate(() => { window.__printChamado = 0; const orig = HTMLIFrameElement.prototype; const d = Object.getOwnPropertyDescriptor(orig, "contentWindow"); Object.defineProperty(orig, "contentWindow", { configurable: true, get() { const w = d.get.call(this); if (w && !w.__stub) { w.__stub = true; w.print = () => { window.__printChamado++; }; } return w; } }); });
  await V(p, v => v.imprimir());
  ok(await p.evaluate(() => window.__printChamado) === 1, "imprimir() prepara as páginas e chama a impressão");

  secao("PDF com sumário, página girada (/Rotate 90) e CropBox deslocada");
  await abrir(p, MISTO);
  const ol = await V(p, v => v.getOutline());
  ok(ol?.length === 5 && ol[1].texto === "1.1 Seção interna" && ol[1].nivel === 2, "sumário exposto para o painel Estrutura", ol);
  await p.waitForTimeout(300);
  const estrutura = await p.evaluate(() => document.querySelector(".outline-container")?.innerText || "");
  ok(estrutura.includes("2. Tabela em paisagem"), "painel Estrutura lista os títulos do PDF", estrutura.slice(0, 120));
  await V(p, v => v.revealOutline(v.getOutline()[2]));
  await p.waitForTimeout(400);
  ok(await V(p, v => v.atual) === 1, "clicar no item do sumário vai para a página certa");
  await V(p, v => v.irParaPagina(2));
  await p.waitForTimeout(500);
  await clicarBotao(p, "Inserir texto");
  let b3 = await caixa(p, ".pdf-pagina", 2);
  await p.mouse.click(b3.x + b3.width * 0.2, b3.y + b3.height * 0.3);
  await p.keyboard.type("Girada OK");
  await p.keyboard.press("Escape");
  await V(p, v => v.irParaPagina(3));
  await p.waitForTimeout(500);
  const b4 = await caixa(p, ".pdf-pagina", 3);
  await p.mouse.click(b4.x + b4.width * 0.1, b4.y + b4.height * 0.1);
  await p.keyboard.type("Recorte OK");
  await p.keyboard.press("Escape");
  m = await modelo(p);
  ok(m[2].anots[0]?.texto === "Girada OK" && m[3].anots[0]?.texto === "Recorte OK", "textos criados nas páginas 3 e 4", m.map(x => x.anots));
  const rotTexto = await V(p, v => v.paginas[2].anots[0].rot);
  ok(rotTexto === 90, "texto na página girada fica de pé na tela (rot 90 no espaço da página)", rotTexto);
  await V(p, v => v.save());
  await p.waitForFunction(() => !tinteiro.workspace.activeLeaf.view.dirty);
  const r2 = pypdf(path.join(COFRE, MISTO), `
from pypdf.generic import RectangleObject
out = []
for pg in r.pages:
    achados = []
    def vis(t, cm, tm, fd, fs):
        if t.strip(): achados.append({"t": t, "tm": [float(x) for x in tm], "cm": [float(x) for x in cm]})
    pg.extract_text(visitor_text=vis)
    out.append({"rot": pg.rotation, "crop": [float(x) for x in pg.cropbox], "achados": achados})
print(json.dumps(out))`);
  const g3 = r2[2].achados.find(a => a.t.includes("Girada OK"));
  ok(r2[2].rot === 90 && g3 && Math.abs(g3.tm[0]) < 0.01 && Math.abs(g3.tm[1] - 1) < 0.01, "na página /Rotate 90 o texto foi gravado girado 90° (fica de pé ao exibir)", g3);
  const g4 = r2[3].achados.find(a => a.t.includes("Recorte OK"));
  const [cx0, cy0, cx1, cy1] = r2[3].crop;
  ok(g4 && g4.tm[4] > cx0 && g4.tm[4] < cx0 + (cx1 - cx0) * 0.25 && g4.tm[5] < cy1 && g4.tm[5] > cy1 - (cy1 - cy0) * 0.2, "na página com CropBox o texto ficou onde foi clicado (dentro da área visível)", { g4, crop: r2[3].crop });

  secao("Modo somente leitura (histórico de versões)");
  const versoesMisto = await p.evaluate(a => tinteiro.backend.history(a), MISTO);
  await p.evaluate(([a, v]) => tinteiro.abrirVersao(a, v), [MISTO, versoesMisto[0]]);
  await p.waitForSelector(".version-body .pdf-pagina[data-renderizada]", { timeout: 15000 });
  ok(await p.locator(".version-body .pdf-ferramentas").count() === 0, "versão antiga abre sem as ferramentas de edição");
  ok(await p.locator(".version-body .pdf-pagina").count() === 4, "versão antiga mostra as 4 páginas");
  await p.evaluate(() => tinteiro.workspace.activeLeaf.fechar());

  // ============================================================ tema claro
  secao("Tema claro");
  const pc = await novaPagina({ viewport: { width: 1400, height: 860 }, colorScheme: "light" }, "claro");
  await pc.evaluate(() => { tinteiro.config && (document.body.classList.remove("theme-dark"), document.body.classList.add("theme-light")); });
  await abrir(pc, RELATORIO);
  await V(pc, v => v.irParaPagina(1));
  await pc.waitForTimeout(300);
  await clicarBotao(pc, "Caneta (desenho livre)");
  const pl = await caixa(pc, ".pdf-pagina", 1);
  await arrastar(pc, [[pl.x + pl.width * 0.2, pl.y + pl.height * 0.35], [pl.x + pl.width * 0.3, pl.y + pl.height * 0.32], [pl.x + pl.width * 0.4, pl.y + pl.height * 0.37]]);
  await clicarBotao(pc, "Selecionar e mover");
  await pc.keyboard.press("Control+f");
  await pc.keyboard.type("Linha 5");
  await pc.waitForFunction(() => /de/.test(document.querySelector(".pdf-busca-info")?.textContent || ""));
  await pc.waitForTimeout(500);
  await pc.screenshot({ path: path.join(SHOTS, "pdf-desktop-claro.png") });
  ok(await pc.evaluate(() => document.body.classList.contains("theme-light")), "tema claro ativo");
  await pc.context().close();

  // ============================================================ celular
  secao("Celular (390×844, toque)");
  const pm = await novaPagina({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3, colorScheme: "dark" }, "celular");
  const ehMobile = await pm.evaluate(() => tinteiro.isMobile);
  ok(ehMobile, "app usa o layout de celular");
  await abrir(pm, MISTO);
  ok(await pm.locator(".pdf-barra-inferior .pdf-ferramenta").count() === 8, "barra de ferramentas embaixo, com botões grandes");
  const cdp = await pm.context().newCDPSession(pm);
  const toque = async (tipo, pts) => cdp.send("Input.dispatchTouchEvent", { type: tipo, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i })) });
  await pm.locator('.pdf-barra-inferior [aria-label="Caneta (desenho livre)"]').tap();
  const pmb = await caixa(pm, ".pdf-pagina", 0);
  const yy = pmb.y + pmb.height * 0.5;
  await toque("touchStart", [[pmb.x + 60, yy]]);
  for (let i = 1; i <= 12; i++) { await toque("touchMove", [[pmb.x + 60 + i * 15, yy + Math.sin(i) * 12]]); await pm.waitForTimeout(16); }
  await toque("touchEnd", []);
  await pm.waitForTimeout(300);
  let mm = await modelo(pm);
  ok(mm[0].anots.some(a => a.tipo === "tinta" && a.n >= 3), "desenho com o dedo cria um traço", mm[0].anots);
  // texto com um toque
  await pm.locator('.pdf-barra-inferior [aria-label="Inserir texto"]').tap();
  await pm.touchscreen.tap(pmb.x + 40, pmb.y + pmb.height * 0.62);
  await pm.waitForSelector(".pdf-anot.is-editing textarea");
  await pm.keyboard.type("Toque OK");
  await pm.waitForTimeout(200);
  await pm.screenshot({ path: path.join(SHOTS, "pdf-celular-texto.png") });
  await pm.locator('.pdf-barra-inferior [aria-label="Selecionar e mover"]').tap();
  await pm.touchscreen.tap(pmb.x + pmb.width - 20, pmb.y + 20);
  mm = await modelo(pm);
  ok(mm[0].anots.some(a => a.tipo === "texto" && a.texto === "Toque OK"), "toque cria caixa de texto", mm[0].anots);
  await pm.waitForTimeout(300);
  await pm.screenshot({ path: path.join(SHOTS, "pdf-celular.png") });
  await pm.locator('.pdf-toolbar [aria-label="Mostrar/ocultar miniaturas das páginas"]').tap();
  await pm.waitForTimeout(800);
  ok(await pm.locator(".pdf-miniaturas.is-open").isVisible(), "miniaturas abrem como gaveta");
  await pm.screenshot({ path: path.join(SHOTS, "pdf-celular-miniaturas.png") });
  await pm.locator(".pdf-miniatura").nth(1).tap();
  await pm.waitForTimeout(500);
  ok(await V(pm, v => v.atual) === 1 && !(await pm.locator(".pdf-miniaturas.is-open").count()), "tocar numa miniatura vai para a página e fecha a gaveta");
  await pm.locator('.pdf-barra-inferior [aria-label="Assinar"]').tap();
  await pm.waitForSelector(".pdf-assin-canvas");
  await pm.waitForTimeout(300);
  await pm.screenshot({ path: path.join(SHOTS, "pdf-celular-assinatura.png") });
  await pm.keyboard.press("Escape");
  await pm.context().close();

  secao("Console do navegador");
  ok(erros.length === 0, "nenhum erro no console durante o teste", erros);
} catch (e) {
  falhas++;
  console.error("\nERRO:", e);
} finally {
  await browser.close();
  srv.kill();
}
console.log(`\n${passos - falhas} de ${passos} verificações passaram.${falhas ? " FALHOU." : " OK."}  Capturas em ${SHOTS}`);
process.exit(falhas ? 1 : 0);
