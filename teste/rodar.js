/* Testes do Omega no Chromium (Playwright), com o simulador do banco (mock-claude.js).
   Uso:  node teste/rodar.js [testes|fotos|tudo]
   Variáveis: OMEGA_SAIDA (pasta das capturas), OMEGA_FONTES (pasta com os .woff2 da IBM Plex Mono, opcional). */
const fs = require("fs"), path = require("path"), http = require("http");
let playwright; try { playwright = require("playwright"); } catch (e) { playwright = require("/opt/node22/lib/node_modules/playwright"); }
const { semente } = require("./semente");
const RAIZ = path.resolve(__dirname, "..");
const SAIDA = process.env.OMEGA_SAIDA || path.join(RAIZ, "teste", "saida");
const FONTES = process.env.OMEGA_FONTES || "";
const MODO = process.argv[2] || "tudo";
fs.mkdirSync(SAIDA, { recursive: true });

const RESET = ':root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}html{scroll-padding-top:env(safe-area-inset-top,0px)}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#fff;color:#000}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}';
function pagina() {
  const corpo = fs.readFileSync(path.join(RAIZ, "index.html"), "utf8");
  return `<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>${RESET}</style><base href="/"></head><body><script src="/teste/mock-claude.js"></script>\n${corpo}</body></html>`;
}
const MIME = { ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".html": "text/html", ".woff2": "font/woff2", ".pdf": "application/pdf", ".png": "image/png" };
const pedidos = [];
const srv = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split("?")[0]);
  pedidos.push(u);
  if (u === "/" || u === "/teste/pagina.html") { r.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); r.end(pagina()); return; }
  if (u.startsWith("/__fontes/") && FONTES) { const f = path.join(FONTES, path.basename(u)); if (fs.existsSync(f)) { r.writeHead(200, { "Content-Type": "font/woff2" }); r.end(fs.readFileSync(f)); return; } }
  const f = path.join(RAIZ, path.normalize(u));
  if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end("404"); return; }
  r.writeHead(200, { "Content-Type": (MIME[path.extname(f)] || "application/octet-stream") + "; charset=utf-8" }); r.end(fs.readFileSync(f));
});
const FONT_CSS = [400, 500, 600].map(w => `@font-face{font-family:'IBM Plex Mono';font-style:normal;font-weight:${w};src:url(/__fontes/ibm-plex-mono-latin-${w}-normal.woff2) format('woff2')}`).join("") +
  `@font-face{font-family:'IBM Plex Mono';font-style:italic;font-weight:400;src:url(/__fontes/ibm-plex-mono-latin-400-normal.woff2) format('woff2')}`;

let BASE = "";
const RES = [];
function marca(n, ok, obs) { RES.push({ n, ok, obs: obs || "" }); console.log(`${ok === true ? "PASSOU " : ok === false ? "FALHOU " : "N/TEST "} ${n}${obs ? " — " + obs : ""}`); }
async function abrir(browser, opts) {
  opts = opts || {};
  const cel = !!opts.cel;
  const ctx = await browser.newContext(cel ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "pt-BR" } : { viewport: { width: 1440, height: 900 }, locale: "pt-BR" });
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
  await ctx.route(/fonts\.googleapis\.com/, rt => rt.fulfill({ status: 200, contentType: "text/css", body: FONTES ? FONT_CSS : "" }));
  await ctx.route(/fonts\.gstatic\.com/, rt => rt.fulfill({ status: 404, body: "" }));
  const sem = opts.semente || semente();
  await ctx.addInitScript(s => { window.__SEMENTE = s; }, sem);
  if (opts.pref) await ctx.addInitScript(p => { try { localStorage.setItem("omega.pref", JSON.stringify(p)); } catch (e) {} }, opts.pref);
  const page = await ctx.newPage();
  page.__erros = [];
  page.on("console", m => { if (m.type() === "error") page.__erros.push(m.text()); });
  page.on("pageerror", e => page.__erros.push(String(e)));
  const t0 = Date.now();
  await page.goto(BASE + "/teste/pagina.html" + (opts.query || ""));
  try { await page.waitForFunction(() => document.querySelector("#lat .lat-lista") && typeof REL !== "undefined", null, { timeout: 8000 }); }
  catch (e) { console.log("Não abriu. Erros:", page.__erros, (await page.content()).slice(0, 300)); throw e; }
  page.__t0 = t0;
  return { ctx, page };
}
const espera = ms => new Promise(r => setTimeout(r, ms));
async function abrirRel(page, id) { await page.waitForFunction(i => !!REL[i], id, { timeout: 5000 }); await page.evaluate(i => abrirRelatorio(i), id); await espera(150); }
async function abrirSecao(page, num) { await page.click(`section[data-sec="${num}"] .sec-h`); await espera(120); }
async function foto(page, nome) { await espera(250); await page.screenshot({ path: path.join(SAIDA, nome + ".png") }); }

async function testes(browser) {
  /* 1. abre rápido, sem erro, sem servidor local */
  for (const cel of [false, true]) {
    pedidos.length = 0;
    const { ctx, page } = await abrir(browser, { cel });
    await page.waitForFunction(() => document.querySelectorAll("#lat .row").length > 3, null, { timeout: 5000 });
    const ms = Date.now() - page.__t0;
    marca(`1 Abre em até 3 s (${cel ? "celular" : "computador"})`, ms < 3000, `${ms} ms no Chromium local`);
    const ruins = pedidos.filter(u => /\/(api|dados)\//.test(u) || /sw\.js|servidor/.test(u));
    const dic = pedidos.some(u => /dicionario/.test(u)), mesa = pedidos.some(u => /pdf-mesa|pdf-lib/.test(u));
    marca(`10 Nenhuma requisição a servidor local nem erro no console (${cel ? "celular" : "computador"})`, !ruins.length && !page.__erros.length, (ruins.join(", ") || "") + (page.__erros.join(" | ") || ""));
    marca(`11a Dicionário e bibliotecas de PDF não carregam na abertura (${cel ? "celular" : "computador"})`, !dic && !mesa);
    await ctx.close();
  }
  /* 2, 3, 7. chip: escolher, valor muda, painel fecha, grava no banco */
  for (const cel of [false, true]) {
    const { ctx, page } = await abrir(browser, { cel });
    await abrirRel(page, "canal-malhado-mp");
    const abertas = await page.$$eval(".sec-h", b => b.filter(x => x.getAttribute("aria-expanded") === "true").length);
    marca(`7 Todas as seções abrem recolhidas (${cel ? "celular" : "computador"})`, abertas === 0);
    await abrirSecao(page, "2");
    await page.click('[data-chip="I:2.2"]'); await espera(400);
    const aberto = await page.$(cel ? ".sheet" : ".pop");
    await page.click((cel ? ".sheet" : ".pop") + ' .o:has-text("Ofício")'); await espera(250);
    const txt = await page.textContent('[data-chip="I:2.2"]'), fechado = !(await page.$(cel ? ".sheet" : ".pop"));
    marca(`2 Chip abre, escolhe, muda e fecha (${cel ? "celular" : "computador"})`, !!aberto && /Ofício/.test(txt) && fechado, `chip: ${txt.trim()}`);
    await espera(3000);
    const d = await page.evaluate(() => window.__mock.ler("decisoes/canal-malhado-mp"));
    const ok3 = d && d.st && d.st["I:2.2"] && d.st["I:2.2"].v === "Ofício" && /2\.2 \[Escolheu\] opção A/.test(d.texto);
    marca(`3 Decisão gravada em decisoes/<id> (st e texto) após 3 s (${cel ? "celular" : "computador"})`, !!ok3, d ? `foco=${JSON.stringify(d.foco)}` : "documento não existe");
    if (!cel) {
      /* 4. outro aparelho: banco com a decisão, navegador zerado */
      const dump = await page.evaluate(() => window.__mock.dump());
      const b = await abrir(browser, { cel: true, semente: dump });
      await abrirRel(b.page, "canal-malhado-mp"); await abrirSecao(b.page, "2");
      const t2 = await b.page.textContent('[data-chip="I:2.2"]');
      marca("4 Reabrir em outro aparelho mantém as decisões", /Ofício/.test(t2), `chip no celular: ${t2.trim()}`);
      /* outro aparelho com estado antigo não apaga o que foi decidido (causa do problema 3.3) */
      await b.page.click('[data-chip="I:2.1"]'); await espera(450); await b.page.click('.sheet .o:has-text("Feito")'); await espera(2600);
      const d2 = await b.page.evaluate(() => window.__mock.ler("decisoes/canal-malhado-mp"));
      marca("3b Gravar no celular não apaga a decisão do computador", d2.st["I:2.2"].v === "Ofício" && d2.st["I:2.1"].v === "Feito");
      await b.ctx.close();
      /* 8. copiar */
      await page.click('[data-fk="I:2.2"] .it-t'); await espera(200);
      const saida = await page.evaluate(() => montarSaida(relAtual(), false)), item = await page.evaluate(() => montarSaida(relAtual(), true));
      await page.click('button.tb:has-text("Copiar item")'); await espera(300);
      const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ""));
      marca("8 Copiar relatório e Copiar item em foco produzem o texto certo", /^\[OMEGA\] 3\.1\.1 Canal do Malhado – MP · relatório canal-malhado-mp rev 4/.test(saida) && /2\.2 \[Escolheu\] opção A: "ofício"/.test(saida) && /2\.2 \[Escolheu\]/.test(item) && !/2\.1/.test(item) && clip.includes("2.2 [Escolheu]"), item.split("\n").slice(2, 3).join(" "));
      /* 5. Claude grava rev maior */
      await page.evaluate(() => { const r = JSON.parse(window.__mock.ler("relatorios/canal-malhado-mp").json); r.rev = 5; r.secoes[1].itens[0].titulo = "Anexar laudo de vistoria ao ofício (rev 5)"; window.__mock.escreverComoClaude("relatorios/canal-malhado-mp", { json: JSON.stringify(r), rev: 5 }); });
      await espera(600);
      const meta = await page.textContent("#cab-rel .meta"); const t3 = await page.textContent('[data-chip="I:2.2"]');
      marca("5 Nova revisão (rev maior) aparece sem apagar o que foi decidido", /rev 5/.test(meta) && /Ofício/.test(t3), `${meta.replace(/\s+/g, " ").slice(0, 60)} · chip ${t3.trim()}`);
    }
    await ctx.close();
  }
  /* 6. bolinhas e edição por toque duplo */
  for (const cel of [false, true]) {
    const { ctx, page } = await abrir(browser, { cel });
    await abrirRel(page, "canal-malhado-mp"); await abrirSecao(page, "4");
    const cor = async id => page.$eval(`[data-fk="P:4:${id}"] .dotb`, e => e.className.replace("dotb ", ""));
    const c0 = await cor("4.1"); await page.click('[data-fk="P:4:4.1"] .bol'); await espera(150); const c1 = await cor("4.1");
    await page.click('[data-fk="P:4:4.1"] .bol'); await espera(150); const c2 = await cor("4.1");
    await page.click('[data-fk="P:4:4.1"] .bol'); await espera(150); const c3 = await cor("4.1");
    const teclado = await page.evaluate(() => document.activeElement && /TEXTAREA|INPUT/.test(document.activeElement.tagName));
    if (cel) { const b = await page.$('[data-pt="P:4:4.3"]'); const bb = await b.boundingBox(); await page.touchscreen.tap(bb.x + 20, bb.y + 8); await espera(90); await page.touchscreen.tap(bb.x + 20, bb.y + 8); }
    else await page.dblclick('[data-pt="P:4:4.3"]');
    await espera(250);
    const editando = await page.$('section[data-sec="4"] textarea');
    if (editando) { await editando.fill("Solicitamos a prorrogação do prazo por mais dez dias úteis, para juntada de laudo complementar."); await page.click("h1.rt, #topo .ttl"); await espera(400); }
    const alt = await page.evaluate(() => { const r = relAtual(); return r.st["P:4:4.3"] && r.st["P:4:4.3"].alterado && r.st["P:4:4.3"].sit; });
    /* todas verdes = documento verde */
    for (const id of ["4.1", "4.3"]) { let k = 0; while ((await cor(id)) !== "verde" && k++ < 3) { await page.click(`[data-fk="P:4:${id}"] .bol`); await espera(120); } }
    const verde = await page.evaluate(() => { const r = relAtual(), s = secDe(r, "4"); return s.capitulos.every(c => statusCap(r, s, c).cor === "verde"); });
    marca(`6 Bolinhas trocam no toque, toque duplo edita, documento verde só com tudo verde (${cel ? "celular" : "computador"})`, c0 === "vermelho" && c1 === "verde" && c2 === "azul" && c3 === "vermelho" && !teclado && !!editando && alt === "azul" && verde, `${c0}→${c1}→${c2}→${c3}; editou=${!!editando}`);
    await ctx.close();
  }
  /* 9. prévia oficial e PDF */
  {
    const { ctx, page } = await abrir(browser, {});
    await abrirRel(page, "canal-malhado-mp");
    await page.evaluate(() => previaSecao(relAtual(), secDe(relAtual(), "4"))); await espera(400);
    const papel = await page.$(".paper"); const htmlP = papel ? await papel.innerHTML() : "";
    await page.click('button.tb:has-text("Salvar PDF")'); await page.waitForFunction(() => window.__downloads.length > 0, null, { timeout: 15000 }).catch(() => {});
    const dl = await page.evaluate(() => window.__downloads[0] || null);
    let info = "", texto = "";
    if (dl) { const f = path.join(SAIDA, dl.filename); fs.writeFileSync(f, Buffer.from(dl.b64, "base64")); try { info = require("child_process").execFileSync("pdfinfo", [f]).toString(); texto = require("child_process").execFileSync("pdftotext", ["-layout", f, "-"]).toString(); } catch (e) { info = String(e); } }
    const a4 = /Page size:\s+595\.2\d? x 841\.8\d? pts \(A4\)/.test(info);
    marca("9 Prévia no padrão oficial e PDF baixado", !!papel && /ESTADO DA BAHIA/.test(htmlP) && /OFÍCIO N\. ___\/\d{4} – SEINFRA/.test(htmlP) && a4 && /Ilhéus, data da assinatura\./.test(texto) && /Nome do Signatário/.test(texto), dl ? `${dl.filename} · ${a4 ? "A4" : "tamanho?"}` : "sem download");
    const r = await page.evaluate(async () => { const b = gerarDOCX(montarBlocos(cfgDaSecao(relAtual(), secDe(relAtual(), "4")), { numerar: true, processo: false }, null), { timbre: true, carimbo: true }); return b.size; });
    marca("9b Word gerado", r > 1000, `${r} bytes`);
    fs.writeFileSync(path.join(SAIDA, "previa-texto.txt"), texto);
    await ctx.close();
  }
  /* 11. revisor só ao tocar */
  {
    pedidos.length = 0;
    const { ctx, page } = await abrir(browser, {});
    await page.evaluate(() => ir("revisor")); await espera(200);
    const antes = pedidos.some(u => /dicionario/.test(u));
    await page.fill("#rev-livre", "O pagamento será efetuado após o atesto da fiscalizção."); await page.waitForSelector(".err", { timeout: 25000 }).catch(() => {});
    const sub = await page.$$eval(".err", e => e.map(x => x.textContent));
    marca("11 Revisor de português carrega só ao tocar e sublinha erros", !antes && pedidos.some(u => /dicionario/.test(u)) && sub.includes("fiscalizção"), `sublinhou: ${sub.join(", ")}`);
    await ctx.close();
  }
  /* 3.2 cliques: tocar no chip no celular não abre o teclado; toque duplo rápido não escolhe sem querer; tela não pula */
  {
    const { ctx, page } = await abrir(browser, { cel: true });
    await abrirRel(page, "canal-malhado-mp"); await abrirSecao(page, "2");
    await page.evaluate(() => scrollTo(0, 200)); await espera(100);
    const chip = await page.$('[data-chip="I:2.2"]'); const bb = await chip.boundingBox();
    await page.touchscreen.tap(bb.x + 10, bb.y + 8); await espera(60); await page.touchscreen.tap(bb.x + 10, bb.y + 8); await espera(400);
    const teclado = await page.evaluate(() => document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName));
    const valor = await page.evaluate(() => valorItem(relAtual(), achar(relAtual(), "2.2")));
    const folha = !!(await page.$(".sheet"));
    if (folha) { await page.click('.sheet .o:has-text("Reunião")'); await espera(300); }
    const y0 = await page.evaluate(() => document.querySelector('[data-fk="I:2.3"]').getBoundingClientRect().top);
    await page.click('[data-fk="I:2.3"] .it-t'); await espera(250);
    const y1 = await page.evaluate(() => document.querySelector('[data-fk="I:2.3"]').getBoundingClientRect().top);
    marca("3.2 Cliques no celular: folha abre sem teclado, toque duplo não escolhe sozinho, item tocado não pula", folha && !teclado && valor === "Aguardando" && Math.abs(y1 - y0) < 3, `teclado=${teclado} valor após toque duplo=${valor} deslocamento=${Math.round(y1 - y0)}px`);
    /* desfazer */
    await page.click('[data-chip="I:2.1"]'); await espera(450); await page.click('.sheet .o:has-text("Feito")'); await espera(200);
    await page.click('.toast button'); await espera(250);
    const volta = await page.evaluate(() => valorItem(relAtual(), achar(relAtual(), "2.1")));
    marca("Desfazer devolve a escolha anterior", volta === "A fazer", volta);
    await ctx.close();
  }
  /* ditado: sem microfone no painel, avisa e abre o teclado; Ctrl+Shift+M no item em foco */
  {
    const { ctx, page } = await abrir(browser, {});
    await abrirRel(page, "canal-malhado-mp"); await abrirSecao(page, "2");
    await page.click('[data-fk="I:2.2"] .it-t'); await espera(150);
    await page.keyboard.press("Control+Shift+M"); await espera(1500);
    const emCampo = await page.evaluate(() => document.activeElement && document.activeElement.tagName === "TEXTAREA" && !!document.activeElement.closest('[data-cm="I:2.2"]'));
    const toast = await page.evaluate(() => (document.querySelector(".toast") || {}).textContent || "");
    const vivo = await page.evaluate(() => Ditado.ativo);
    marca("Ditado: Ctrl+Shift+M abre a caixa do item em foco e começa (ou avisa o caminho sem microfone)", emCampo && (vivo || /Win\+H|Gboard|microfone/i.test(toast)), vivo ? "reconhecimento ligado" : toast);
    await page.evaluate(() => Ditado.parar());
    await page.keyboard.type(" Isso é infra vai responder");
    await page.evaluate(() => { const t = document.activeElement; t.value = corrigirSiglas(t.value); });
    const v = await page.evaluate(() => document.activeElement.value);
    marca("Correção de SEINFRA no texto ditado", /SEINFRA vai responder/.test(v), v.trim());
    await ctx.close();
  }
  /* enviar ao Claude: com link guardado abre a conversa e copia a mensagem; sem link pede o endereço */
  {
    const { ctx, page } = await abrir(browser, {});
    await abrirRel(page, "canal-malhado-mp");
    await page.click('button.tb:has-text("Copiar relatório")'); await espera(200);
    await page.click('.pop .o:has-text("Enviar ao Claude")'); await espera(400);
    const dlg = await page.$(".dlg");
    await page.fill(".dlg input[type=url]", "https://claude.ai/chat/00000000-teste");
    const [pop] = await Promise.all([ctx.waitForEvent("page", { timeout: 4000 }).catch(() => null), page.click('.dlg a:has-text("Salvar e abrir")')]);
    await espera(1800);
    const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ""));
    const d = await page.evaluate(() => window.__mock.ler("decisoes/canal-malhado-mp"));
    marca("Enviar ao Claude: copia a mensagem, guarda o link no objeto e abre a conversa", !!dlg && /Leia o relatório de retorno do Omega do objeto 3\.1\.1/.test(clip) && d && d.conversa === "https://claude.ai/chat/00000000-teste" && !!pop, `${clip.slice(0, 70)} · aba nova=${!!pop}`);
    await ctx.close();
  }
  /* Mesa PDF: segurar seleciona, arrastar para a direita extrai, renomeia, escolhe destino e baixa */
  {
    const { ctx, page } = await abrir(browser, { cel: true });
    await abrirRel(page, "canal-malhado-mp");
    await page.evaluate(() => ir("mesa"));
    const b64 = await page.evaluate(async () => { await carregarPDFLib(); const d = await PDFLib.PDFDocument.create(); for (let i = 1; i <= 8; i++) { const p = d.addPage([595, 842]); p.drawText("pagina " + i, { x: 60, y: 760, size: 22 }); } const u = await d.save(); let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); });
    const [fc] = await Promise.all([page.waitForEvent("filechooser"), page.evaluate(() => escolherPDF())]);
    await fc.setFiles({ name: "bloco.pdf", mimeType: "application/pdf", buffer: Buffer.from(b64, "base64") });
    await page.waitForSelector('.th[data-p="3"] canvas', { timeout: 20000 }).catch(() => {});
    const cdp = await ctx.newCDPSession(page);
    const toque = async (tipo, x, y) => cdp.send("Input.dispatchTouchEvent", { type: tipo, touchPoints: tipo === "touchEnd" ? [] : [{ x, y }] });
    let r = await (await page.$('.th[data-p="2"]')).boundingBox();
    await toque("touchStart", r.x + 40, r.y + 60); await espera(700); await toque("touchEnd", r.x + 40, r.y + 60); await espera(200);
    const sel1 = await page.evaluate(() => [...MESA.sel]);
    r = await (await page.$('.th[data-p="3"]')).boundingBox();
    await page.touchscreen.tap(r.x + 40, r.y + 60); await espera(250);
    const sel2 = await page.evaluate(() => [...MESA.sel].sort());
    await page.evaluate(() => pararRolagemMesa());
    r = await (await page.$('.th[data-p="3"]')).boundingBox();
    await toque("touchStart", r.x + 30, r.y + 60); for (let k = 1; k <= 8; k++) { await toque("touchMove", r.x + 30 + k * 16, r.y + 60); await espera(16); } await toque("touchEnd", r.x + 150, r.y + 60); await espera(300);
    const renomear = await page.$('.dlg h3:has-text("Renomear")');
    if (renomear) { await page.fill(".dlg input", "3.1.1-laudo-teste.pdf"); await page.click('.dlg button:has-text("Continuar")'); await espera(250); await page.click('.dlg .o:has-text("Criar resposta")'); }
    await page.waitForFunction(() => window.__downloads.length > 0, null, { timeout: 15000 }).catch(() => {});
    const dl = await page.evaluate(() => window.__downloads[0] || null);
    let pags = 0; if (dl) { const f = path.join(SAIDA, dl.filename); fs.writeFileSync(f, Buffer.from(dl.b64, "base64")); try { pags = +(/Pages:\s+(\d+)/.exec(require("child_process").execFileSync("pdfinfo", [f]).toString()) || [])[1]; } catch (e) {} }
    const ext = await page.evaluate(() => { const k = Object.keys(window.__mock.dump()).find(x => x.startsWith("extracoes/")); return k ? window.__mock.ler(k) : null; });
    marca("Mesa PDF por gesto: segurar seleciona, toque marca outra, arrastar para a direita extrai, renomeia, destino e download", sel1.includes(2) && sel2.join() === "2,3" && !!renomear && dl && dl.filename === "3.1.1-laudo-teste.pdf" && pags === 2 && ext && ext.destino.tipo === "resposta", `seleção ${sel2.join(",")} · ${dl ? dl.filename + " (" + pags + " págs)" : "sem download"} · destino ${ext ? ext.destino.descricao : "-"}`);
    await ctx.close();
  }
  /* revisão da separação: aprovar grava no banco */
  {
    const { ctx, page } = await abrir(browser, {});
    await page.waitForFunction(() => Object.keys(PIPE).length > 0, null, { timeout: 5000 }).catch(() => {});
    await page.evaluate(() => ir("revisao")); await espera(200);
    await page.click('button:has-text("Aprovar os que estão OK")'); await espera(600);
    const rv = await page.evaluate(() => window.__mock.ler("revisao/malhado-bloco-1"));
    marca("Revisão da separação: Aprovar os que estão OK grava no banco", rv && rv.itens && rv.itens[0] && rv.itens[0].acao === "aprovado" && rv.itens[1].acao === "aprovado" && !rv.itens[2], JSON.stringify(Object.keys((rv || {}).itens || {})));
    await ctx.close();
  }
  /* busca e rolagem automática */
  {
    const { ctx, page } = await abrir(browser, {});
    await page.waitForFunction(() => !!REL["canal-malhado-mp"]);
    await page.fill("#busca-lat", "prorroga"); await espera(200);
    const res = await page.$$eval("#lat .lat-lista .row", e => e.map(x => x.textContent));
    await page.click('#lat .lat-lista .row:has-text("4.3")'); await espera(900);
    const foco = await page.evaluate(() => relAtual() && relAtual().foco && chave(relAtual().foco));
    marca("Busca da lateral acha itens e abre no lugar certo", res.some(t => /4\.3/.test(t)) && foco === "P:4:4.3", `${res.length} resultado(s); foco ${foco}`);
    await page.evaluate(() => { const ab = ABERTAS[relAtual().id] = {}; relAtual().dados.secoes.forEach(s => { ab[s.num] = true; }); redesenharTudo(); scrollTo({ top: 0, behavior: "instant" }); }); await espera(800);
    await page.evaluate(() => { scrollTo({ top: 0, behavior: "instant" }); Rolagem.alternar(); });
    await espera(1500); const y = await page.evaluate(() => scrollY); await page.evaluate(() => Rolagem.parar());
    marca("Rolagem automática do relatório", y > 20, `${Math.round(y)} px em 1,5 s`);
    await ctx.close();
  }
  /* sem banco: avisa e guarda no aparelho */
  {
    const { ctx, page } = await abrir(browser, { query: "?semdb" });
    await espera(400);
    const av = await page.evaluate(() => Banco.estado);
    marca("Sem banco (fora do Claude): avisa e guarda só no aparelho", av === "local");
    await ctx.close();
  }
}

async function fotos(browser) {
  const pdfAmostra = async page => {
    const b64 = await page.evaluate(async () => { await carregarPDFLib(); const d = await PDFLib.PDFDocument.create(); const f = await d.embedFont(PDFLib.StandardFonts.Helvetica); const tipos = ["OFÍCIO", "LAUDO", "FOTO", "PARECER"]; for (let i = 1; i <= 12; i++) { const p = d.addPage([595, 842]); p.drawText(`${tipos[i % 4]} – página ${i}`, { x: 60, y: 760, size: 22, font: f }); for (let l = 0; l < 22; l++) p.drawRectangle({ x: 60, y: 700 - l * 26, width: 300 + (l * 37) % 170, height: 8, color: PDFLib.rgb(.8, .8, .8) }); } const u = await d.save(); let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); });
    return Buffer.from(b64, "base64");
  };
  for (const cel of [false, true]) {
    const pfx = cel ? "cel" : "desk";
    for (const tema of ["maisescuro", "escuro", "claro"]) {
      const { ctx, page } = await abrir(browser, { cel, pref: { tema } });
      await abrirRel(page, "canal-malhado-mp"); await abrirSecao(page, "2");
      await page.click('[data-fk="I:2.2"] .it-t'); await espera(200);
      await page.evaluate(() => scrollTo(0, 0));
      await foto(page, `${pfx}-relatorio-${tema}`);
      await ctx.close();
      if (tema !== "maisescuro") continue;
      const { ctx: c2, page: p } = await abrir(browser, { cel, pref: { tema } });
      await espera(300); await foto(p, `${pfx}-01-inicio`);
      if (cel) { await p.click("#topo .ib"); await espera(300); await foto(p, `${pfx}-02-pastas`); await p.click("#scrim-lat", { position: { x: 360, y: 400 } }); await espera(200); }
      await abrirRel(p, "canal-malhado-mp"); await abrirSecao(p, "2");
      await p.click('[data-fk="I:2.2"] .it-t'); await espera(200);
      await p.click('[data-chip="I:2.2"]'); await espera(450); await foto(p, `${pfx}-03-chip-aberto`);
      await p.keyboard.press("Escape"); if (cel) { const s = await p.$(".scrim"); if (s) await s.click(); } await espera(200);
      await p.click('section[data-sec="2"] .sec-h'); await abrirSecao(p, "3"); await p.evaluate(() => scrollTo(0, 0)); await foto(p, `${pfx}-04-tabela`);
      await p.click('section[data-sec="3"] .sec-h'); await abrirSecao(p, "4"); await p.evaluate(() => scrollTo(0, 0)); await foto(p, `${pfx}-05-texto-bolinhas`);
      await p.click('section[data-sec="4"] .sec-h'); await abrirSecao(p, "2"); await p.click('[data-fk="I:2.2"] .it-t'); await espera(150);
      if (cel) await p.click("#topo .ib:nth-of-type(4)"); else await p.click('button.tb:has-text("Copiar relatório")');
      await espera(350); await foto(p, `${pfx}-07-menu-enviar`);
      await p.keyboard.press("Escape"); if (cel) { const s = await p.$(".scrim"); if (s) await s.click(); } await espera(150);
      await p.evaluate(() => ir("resposta")); await foto(p, `${pfx}-08-resposta`);
      await p.evaluate(() => previaSecao(relAtual(), secDe(relAtual(), "4"))); await espera(500); await foto(p, `${pfx}-09-previa-oficial`);
      await p.evaluate(() => ir("mesa")); await espera(200);
      const buf = await pdfAmostra(p);
      const [fc] = await Promise.all([p.waitForEvent("filechooser"), p.evaluate(() => escolherPDF())]);
      await fc.setFiles({ name: "processo_malhado_completo.pdf", mimeType: "application/pdf", buffer: buf });
      await p.waitForSelector(".th canvas", { timeout: 20000 }).catch(() => {});
      await p.evaluate(() => { [4, 5, 6].forEach(n => MESA.sel.add(n)); MESA.modoSel = true; atualizarSelecao(); });
      await espera(800); await foto(p, `${pfx}-10-mesa-pdf`);
      await p.evaluate(() => { MESA.sel.clear(); atualizarSelecao(); ir("revisao"); }); await foto(p, `${pfx}-11-revisao-pipeline`);
      await p.evaluate(() => { AV = Object.assign(avNovo(), { assunto: "Resposta ao Ofício nº 114/2026", destinatario: "Promotoria de Justiça de Ilhéus", corpo: "Considerando o recebimento do Ofício nº 114/2026, informamos que esta Secretaria apura as condições do canal do Malhado." }); ir("avulso"); }); await foto(p, `${pfx}-12-documento-avulso`);
      if (p.__erros.length) console.log("erros no console:", p.__erros);
      await c2.close();
    }
  }
}

(async () => {
  await new Promise(r => srv.listen(0, "127.0.0.1", r));
  BASE = "http://127.0.0.1:" + srv.address().port;
  const browser = await playwright.chromium.launch({ executablePath: fs.existsSync("/opt/pw-browsers/chromium") ? undefined : undefined });
  try {
    if (MODO === "testes" || MODO === "tudo") await testes(browser);
    if (MODO === "fotos" || MODO === "tudo") await fotos(browser);
  } catch (e) { console.error("ERRO NO ROTEIRO:", e); process.exitCode = 1; }
  await browser.close(); srv.close();
  fs.writeFileSync(path.join(SAIDA, "resultado.json"), JSON.stringify(RES, null, 1));
  const falhas = RES.filter(r => r.ok === false).length;
  console.log(`\n${RES.length} verificações, ${falhas} falha(s). Capturas em ${SAIDA}`);
  if (falhas) process.exitCode = 1;
})();
