// Teste automático de aceite do Omega (precisa de Node + playwright; pdf-lib para o teste da Mesa PDF).
// Uso: node teste/aceite.js      |  OMEGA_URL=http://localhost:8765/index.html node teste/aceite.js
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const path = require("path"), fs = require("fs"), os = require("os");
const URL = process.env.OMEGA_URL || "file://" + path.resolve(__dirname, "../index.html");
let falhas = 0;
const ok = (c, m) => { console.log((c ? "OK    " : "FALHA ") + m); if (!c) falhas++; };
const ativo = p => p.evaluate(() => document.activeElement && (document.activeElement.dataset.chip || document.activeElement.dataset.pf || document.activeElement.id || document.activeElement.tagName));
const FAKE_SR = () => { window.SpeechRecognition = class { constructor() { window.__sr = this; this.starts = 0; } start() { this.starts++; } stop() { this.onend && this.onend(); }
  emit(txt, final) { const r = Object.assign([{ transcript: txt }], { isFinal: !!final }); this.onresult({ resultIndex: 0, results: [r] }); } }; };
(async () => {
  let PDFLib; try { PDFLib = require(process.env.PDFLIB_PATH || "pdf-lib"); } catch (e) { try { PDFLib = require(path.resolve(__dirname, "../node_modules/pdf-lib")); } catch (e2) {} }
  let pdf60 = null;
  if (PDFLib) { const d = await PDFLib.PDFDocument.create(); for (let i = 1; i <= 60; i++) d.addPage([300, 400]).drawText("Pagina " + i, { x: 40, y: 200, size: 24 }); pdf60 = path.join(os.tmpdir(), "escaneado.pdf"); fs.writeFileSync(pdf60, await d.save()); }
  const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  for (const [nome, vp] of [["computador", { width: 1920, height: 1080 }], ["celular", { width: 400, height: 800 }]]) {
    console.log("\n=== " + nome + " ===");
    const mobile = nome === "celular";
    const ctx = await b.newContext({ viewport: vp, permissions: ["clipboard-read", "clipboard-write"], hasTouch: mobile, acceptDownloads: true });
    await ctx.addInitScript(FAKE_SR);
    const p = await ctx.newPage(); const erros = [];
    p.on("pageerror", e => erros.push(e.message)); p.on("console", m => m.type() === "error" && !/Failed to load resource/.test(m.text()) && erros.push(m.text()));
    await p.goto(URL + "?exemplo=1"); await p.waitForSelector(".chip");
    const latAberta = () => p.evaluate(() => document.body.classList.contains("lat"));
    const lat = async () => { if (mobile && !(await latAberta())) { await p.click("#b-lat"); await p.waitForTimeout(250); } };
    const fechaLat = async () => { if (mobile && (await latAberta())) { await p.click("#fundo", { position: { x: 380, y: 400 } }); await p.waitForTimeout(250); } };
    const mais = async () => { if (await p.locator("#mais.oculto").count()) await p.click("#b-mais"); await p.waitForTimeout(100); };
    const chip = k => p.locator(`[data-chip="${k}"]`);
    const texto = () => p.evaluate(() => navigator.clipboard.readText());
    const cor = (sel, prop) => p.locator(sel).first().evaluate((e, pr) => getComputedStyle(e)[pr], prop);

    // ---- visual: proporções, cores, fonte ----
    ok((await p.title()) === "Omega" && !/Ômega|ÔMEGA/.test(await p.evaluate(() => document.body.innerText + document.title)), "nome 'Omega' sem acento");
    ok(await p.evaluate(() => document.fonts.check('16px "IBM Plex Mono"')) && /IBM Plex Mono/.test(await cor("body", "fontFamily")), "fonte IBM Plex Mono");
    ok((await p.locator("#barra").boundingBox()).height === 56, "barra de título com 56 px");
    if (!mobile) {
      const w = (await p.locator("#lateral").boundingBox()).width; ok(Math.abs(w - 375) <= 2, "lateral com 19,5% da largura (" + Math.round(w) + " de 1920)");
      const mw = (await p.locator("#main").boundingBox()).width, tot = 1920 - w; ok(Math.abs(mw / tot - 0.73) < 0.01, "coluna de leitura com 73% (" + (mw / tot).toFixed(3) + ")");
      await p.locator("#busca").focus(); await p.keyboard.type("1.7"); await p.waitForTimeout(100); const li = p.locator("#busca-res .lat-bt").first(); ok((await li.boundingBox()).height <= 44, "linha da lateral com altura de item (~43 px)"); await p.fill("#busca", "");
    }
    for (const [t, lat0, bg0] of [["escuro", "rgb(17, 17, 17)", "rgb(21, 21, 21)"], ["maisescuro", "rgb(7, 7, 8)", "rgb(11, 11, 12)"], ["claro", "rgb(240, 240, 242)", "rgb(251, 251, 252)"]]) {
      await p.evaluate(t2 => { DB.ui.tema = t2; salvar(); aplicarTema(); }, t);
      ok((await cor("#lateral", "backgroundColor")) === lat0 && (await cor("body", "backgroundColor")) === bg0, `tema ${t}: cores medidas (${lat0} / ${bg0})`);
      await p.screenshot({ path: `/tmp/omega-${nome}-${t}.png` });
    }
    await p.evaluate(() => { DB.ui.tema = "escuro"; salvar(); aplicarTema(); });
    ok(/rgb\(240, 239, 236\)/.test(await cor("body", "color")), "tema escuro: texto #F0EFEC");

    // ---- barra superior congelada ----
    await p.evaluate(() => scrollTo(0, 800)); await p.waitForTimeout(150);
    ok((await p.locator("#barra").boundingBox()).y === 0 && (await p.locator("#b-pdf").isVisible()), "barra congelada: fica no topo com o relatório rolado");
    await p.evaluate(() => scrollTo(0, 0));
    for (const id of ["b-pdf", "b-doc", "b-resp", "b-ci", "b-cop", "b-copf", "b-foco", "b-pasta", "b-conv", "b-aud", "b-mais"]) if (!(await p.locator("#" + id).count())) { ok(false, "falta botão na barra: " + id); }
    await p.locator("#b-pdf").click(); await p.waitForSelector("#impressao .folha");
    ok((await p.locator("#impressao .f-tit").innerText()).includes("Relatório de exemplo"), "Relatório (PDF): folha A4 do relatório");
    await p.locator("#impressao button", { hasText: "Fechar" }).click();
    await p.locator("#b-doc").click(); await p.waitForTimeout(150);
    ok(await p.locator("#impressao .folha .f-par").count() >= 5, "Documento: visualiza o texto (folha A4)");
    await p.locator("#impressao button", { hasText: "Fechar" }).click();
    await p.locator("#b-resp").click(); await p.waitForTimeout(100); ok((await p.locator(".toast").innerText()).includes("Ainda não há resposta"), "Resposta: avisa quando ainda não existe");
    await p.locator("#b-ci").click(); await p.waitForTimeout(100); ok((await p.locator(".toast").innerText()).includes("Nenhuma CI"), "CI: avisa quando não existe");

    // ---- lateral enxuta: pastas numeradas, organização, busca, recolher ----
    await lat();
    ok((await p.locator("#lateral .li[data-grupo]").first().innerText()).includes("Licitações") && (await p.locator('#lateral .li[data-pasta]').first().innerText()).includes("1.7"), "lateral: categoria '1 Licitações' > '1.7 Exemplo Geral'");
    ok(await p.locator("#ord-num.on, #ord-rec").count() >= 1 && await p.locator("#lateral .busca-caixa").count() === 1, "lateral só tem busca, organização e pastas");
    await p.click("#ord-rec"); await p.waitForTimeout(100); ok((await p.locator("#lat-lista .li").first().innerText()).includes("1.7"), "'Últimos trabalhados' lista as pastas por data");
    await p.click("#ord-num");
    await p.fill("#busca", "1.7"); await p.waitForTimeout(100); ok(await p.locator("#busca-res .res").count() >= 1, "busca por número");
    await p.fill("#busca", "exemplo geral"); await p.waitForTimeout(100); ok(await p.locator("#busca-res .res").count() >= 5, "busca pelo nome mostra o relatório e os pendentes");
    await p.fill("#busca", "");
    if (!mobile) { await p.locator("#lateral [data-lat]").click(); await p.waitForTimeout(250); ok(!(await latAberta()) && (await p.locator("#main").boundingBox()).width > 1300 * 0.73, "lateral recolhe e o relatório ocupa a tela"); await p.locator("#b-lat").click(); await p.waitForTimeout(250); }
    await fechaLat();

    if (!mobile) {
      // ---- teclado: Tab, Espaço, setas, comentário ----
      await p.reload(); await p.waitForSelector(".chip"); await p.waitForTimeout(300);
      await p.keyboard.press("Tab"); ok((await ativo(p)) === "I:1.6", "Tab chega na primeira caixinha");
      await p.keyboard.press("Space"); await p.waitForTimeout(100);
      ok(await p.locator("#painel.aberto .pop-op").count() === 4 && (await ativo(p)) === "pop-q", "Espaço abre as opções");
      await p.keyboard.press("ArrowDown"); await p.keyboard.press("Enter"); await p.waitForTimeout(150);
      ok((await chip("I:1.6").innerText()).trim() === "Feito" && (await ativo(p)) === "I:1.6", "seta + Enter escolhe e o foco volta");
      await p.keyboard.press("Tab"); ok((await ativo(p)) === "I:1.7", "Tab segue para a próxima caixinha");
      await chip("I:1.9").click(); await p.fill("#pop-com", "não achei a pasta antiga"); await p.locator(".pop-op", { hasText: "Não consegui" }).click(); await p.waitForTimeout(150);
      ok((await p.locator("#it-1_9 .comentario").innerText()).includes("não achei a pasta antiga"), "escolha + comentário");
      await chip("I:2.0").click(); await p.keyboard.type("Responder por telefone"); await p.keyboard.press("Enter"); await p.waitForTimeout(150);
      ok((await chip("I:2.0").innerText()).trim() === "Responder por telefone", "opção própria (procurar ou adicionar)");
      await chip("I:2.1").click(); await p.keyboard.type("24"); await p.keyboard.press("Enter"); await p.waitForTimeout(150);
      ok((await chip("I:2.1").innerText()).trim() === "Adotar 24 meses", "digitar filtra a lista");
      // caixa de comentário na base (caixa de entrada arredondada)
      await chip("I:2.2").focus(); await p.waitForTimeout(100);
      const eb = await p.locator(".ent-caixa").boundingBox(); ok(eb && eb.y + eb.height > 1000 && (await cor(".ent-caixa", "borderTopLeftRadius")) === "22px", "caixa de comentário arredondada na base");
      await p.locator("#ent-ta").click(); await p.keyboard.type("falta conferir"); await p.keyboard.press("Enter"); await p.waitForTimeout(200);
      ok((await p.locator("#it-2_2 .comentario").innerText()).includes("falta conferir"), "comentário do item em foco pela caixa da base");
      // ---- ditado contínuo em qualquer caixa ----
      await p.locator("#ent-ta").click(); await p.keyboard.press("Control+Shift+Space"); await p.waitForTimeout(100);
      ok(await p.evaluate(() => audioOn) && await p.evaluate(() => window.__sr.starts) === 1, "Ctrl+Shift+Espaço liga o ditado no campo onde está o cursor");
      await p.evaluate(() => window.__sr.emit("teste de", false)); await p.waitForTimeout(50);
      ok((await p.inputValue("#ent-ta")).includes("teste de"), "o texto aparece enquanto fala");
      await p.evaluate(() => window.__sr.emit("teste de ditado", true));
      await p.evaluate(() => window.__sr.onend()); await p.waitForTimeout(700);
      ok(await p.evaluate(() => window.__sr.starts) >= 2, "na pausa o ditado religa sozinho (não para)");
      await p.evaluate(() => window.__sr.emit("continua depois da pausa", true)); await p.waitForTimeout(50);
      ok(/teste de ditado.*continua depois da pausa/.test(await p.inputValue("#ent-ta")), "o texto continua depois da pausa, sem sumir");
      ok(await p.locator("#mic-flut").isVisible(), "microfone flutuante junto da caixa de texto");
      await p.keyboard.press("Control+Shift+Space"); await p.waitForTimeout(100); ok(!(await p.evaluate(() => audioOn)), "o atalho também para o ditado");
      await p.fill("#ent-ta", "falta conferir"); await p.keyboard.press("Escape"); await p.locator("body").click({ position: { x: 5, y: 600 } });
      // ---- documento em campos ----
      await p.focus('[data-pf="P:T1:2.1"]'); await p.keyboard.press("Enter"); await p.waitForTimeout(80);
      ok(await p.locator('.ptexto[contenteditable]').count() === 1, "Enter reescreve o parágrafo");
      await p.keyboard.press("End"); await p.keyboard.press("Control+Shift+Space"); await p.waitForTimeout(80);
      await p.evaluate(() => window.__sr.emit("ditado dentro do parágrafo", true)); await p.waitForTimeout(80);
      await p.keyboard.press("Control+Shift+Space"); await p.keyboard.press("Control+Enter"); await p.waitForTimeout(200);
      ok((await p.locator('[data-pf="P:T1:2.1"]').innerText()).includes("ditado dentro do parágrafo") && await p.locator(".alt").count() === 1, "ditado escreve dentro do parágrafo, no cursor");
      await chip("P:T1:2.2").click(); await p.fill("#pop-com", "trocar deverá por poderá"); await p.locator(".pop-op", { hasText: "Ajustar" }).click(); await p.waitForTimeout(120);
      await chip("K:T1:3").click(); await p.keyboard.press("Enter"); await p.waitForTimeout(150);
      ok(await p.locator('[data-fk="P:T1:3.1"] .chip.ok, [data-fk="P:T1:3.2"] .chip.ok').count() === 2, "aprovar capítulo inteiro");
      await p.getByText("Revisar tudo").click(); await p.waitForSelector(".sobre .achado", { timeout: 90000 }); ok(await p.locator(".sobre .achado").count() >= 2, "Revisar tudo lista os problemas");
      await p.locator(".sobre button", { hasText: "Fechar" }).click();
      // ---- saída ----
      await p.locator("#b-cop").click(); await p.waitForTimeout(200);
      const t = await texto(); console.log("----- texto copiado -----\n" + t + "-------------------------");
      ok(/^\[OMEGA\] 1\.7 Exemplo Geral · relatório exemplo-geral rev 1 \| \d\d\/\d\d\/\d{4} \d\d:\d\d\n\n## 1 Layout\n\n1\.6 \[Feito\]\n\n1\.9 \[Não consegui\] — comentário: não achei a pasta antiga/.test(t), "Copiar relatório: formato e comentários");
      ok(/2\.0 \[Escolheu\] outro: "Responder por telefone"/.test(t) && /2\.1 \[Escolheu\] opção B: "adotar 24 meses"/.test(t) && /2\.2 \[Aguardando\] — comentário: falta conferir/.test(t), "decisões, opção livre e comentário");
      ok(/2\.1 \[Ajustar\] texto alterado: ".*ditado dentro do parágrafo/.test(t) && /Todo o capítulo \[Aprovado\]/.test(t), "texto alterado por ditado e capítulo aprovado");
      ok(!/1\.8/.test(t), "itens não tocados não aparecem");
      // novo documento e novo objeto (código numérico)
      await mais(); await p.locator("#m-novo-doc").click(); await p.locator(".sobre .op", { hasText: "Ofício" }).click(); await p.waitForTimeout(150);
      ok(await p.locator("[data-pf]").count() === 7 && /^1\.7\.1 /.test(await p.locator("h1").innerText()), "Novo documento: ofício em campos, com código 1.7.1");
      await p.locator('#lateral .li[data-pasta]').first().click(); await p.waitForTimeout(150);
      await mais(); await p.locator("#m-novo-obj").click(); await p.waitForSelector("#obj-cod");
      ok((await p.inputValue("#obj-cod")) === "1.8", "Novo objeto: o código vem pronto (1.8)");
      await p.fill("#obj-nome", "Canal do Malhado"); await p.locator("#obj-criar").click(); await p.waitForTimeout(200);
      ok((await p.locator("h1").innerText()).startsWith("1.8 Canal do Malhado"), "objeto criado na categoria 1");
      ok(await p.evaluate(() => nomeArquivo(["CI", "SEDUC", "Nº 45/2026", "12/10/2026"]) === "CI_SEDUC_45-2026_12-10-2026"), "nome automático: MAIÚSCULAS_COM_UNDERLINE, sem 'N.' nem barra");
    }
    if (mobile) {
      await p.locator('[data-chip="I:1.6"]').click(); await p.waitForTimeout(150);
      const bx = await p.locator("#painel").boundingBox();
      ok(bx && bx.width >= 395 && bx.y + bx.height >= 790 && bx.y > 150, "no celular as opções abrem de baixo (folha)");
      ok((await p.locator(".pop-op").first().boundingBox()).height >= 44, "botões com 44px ou mais");
      await p.locator(".pop-op", { hasText: "Feito" }).click(); await p.waitForTimeout(150);
      ok((await p.locator('[data-chip="I:1.6"]').innerText()).trim() === "Feito", "escolha por toque");
      const cdp = await ctx.newCDPSession(p);
      const arrasta = async (x0, x1) => { await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y: 400 }] }); for (let x = x0; Math.abs(x - x1) > 5; x += (x1 > x0 ? 12 : -12)) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: 400 }] }); await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await p.waitForTimeout(250); };
      ok(!(await latAberta()), "lateral fechada antes do gesto");
      await arrasta(5, 150); ok(await latAberta(), "deslizar da borda esquerda abre a lateral");
      await arrasta(200, 40); ok(!(await latAberta()), "deslizar para a esquerda fecha e volta ao relatório");
      ok(await p.locator("table.rel > thead").first().evaluate(e => getComputedStyle(e).display) === "none", "no celular as linhas viram cartões");
      ok((await p.locator("#barra .tx:visible").count()) === 0, "barra compacta no celular (só ícones)");
    }
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "sem rolagem horizontal da página");
    ok(erros.length === 0, "sem erros no console " + erros.join(";"));
    await ctx.close();
  }
  // ---- Mesa PDF por gesto (computador) ----
  if (pdf60) {
    console.log("\n=== Mesa PDF por gesto ===");
    const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, permissions: ["clipboard-read", "clipboard-write"], acceptDownloads: true });
    const p = await ctx.newPage(); const erros = []; p.on("pageerror", e => erros.push(e.message));
    await p.goto(URL + "?exemplo=1"); await p.waitForSelector(".chip");
    await p.evaluate(() => { document.getElementById("b-mais").click(); }); await p.waitForTimeout(100);
    const [fc] = await Promise.all([p.waitForEvent("filechooser"), p.locator("#m-mesa").click()]); await fc.setFiles(pdf60);
    await p.waitForFunction(() => /60 página/.test(document.querySelector("#mesa-info").innerText), null, { timeout: 15000 });
    await p.waitForSelector("#grade .pg canvas"); await p.waitForTimeout(800);
    ok(await p.evaluate(() => document.querySelector('#grade .pg[data-n="1"] canvas').width > 100), "miniaturas das páginas desenhadas");
    // arrastar para a direita extrai e pergunta o nome
    let bx = await p.locator('#grade .pg[data-n="2"]').boundingBox();
    await p.mouse.move(bx.x + 20, bx.y + 20); await p.mouse.down(); await p.mouse.move(bx.x + 220, bx.y + 24, { steps: 8 }); await p.mouse.up(); await p.waitForSelector("#mesa-nome");
    ok((await p.inputValue("#mesa-nome")) === "1.7.1_ESCANEADO_P2", "arrastar a página 2 para a direita abre 'Renomear' com nome em maiúsculas e código (" + (await p.inputValue("#mesa-nome")) + ")");
    await p.fill("#mesa-nome", "oficio sedue nº 12/2026"); await p.locator("#mesa-continuar").click(); await p.waitForSelector("#dest-baixar");
    ok(await p.locator("#dest-aqui[disabled]").count() === 1 && await p.locator("#dest-resposta").count() === 1, "depois do nome: opções de onde salvar (as de pasta só com o servidor)");
    const [dl] = await Promise.all([p.waitForEvent("download"), p.locator("#dest-baixar").click()]);
    ok(dl.suggestedFilename() === "OFICIO_SEDUE_12-2026.pdf", "nome final normalizado: " + dl.suggestedFilename());
    ok(await p.evaluate(() => (relAtual().entrada || []).length) === 1 && await p.evaluate(() => relAtual().entrada[0].codigo) === "1.7.1", "extraído vira 'recebido' com código 1.7.1");
    // segurar seleciona; rolagem automática; pular para a próxima; arrastar a barra extrai
    await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(200);
    bx = await p.locator('#grade .pg[data-n="4"]').boundingBox();
    await p.mouse.move(bx.x + 20, bx.y + 20); await p.mouse.down(); await p.waitForTimeout(700); await p.mouse.up();
    ok(await p.locator("#faixa:not(.oculto)").count() === 1 && await p.locator('#grade .pg[data-n="4"].sel').count() === 1, "segurar a página liga a seleção");
    const y0 = await p.evaluate(() => scrollY); await p.waitForTimeout(700); ok(await p.evaluate(() => scrollY) > y0, "a lista rola sozinha na seleção");
    await p.evaluate(() => document.querySelector('#grade .pg[data-n="5"]').scrollIntoView({ block: "center" })); await p.waitForTimeout(200);
    await p.locator('#grade .pg[data-n="5"]').click(); await p.waitForTimeout(150);
    ok(await p.locator('#grade .pg[data-n="5"].sel').count() === 1 && await p.locator('#grade .pg[data-n="6"].prox').count() === 1, "marcar uma página destaca/pula para a próxima");
    await p.locator("#faixa-pausa").click(); await p.waitForTimeout(100); const y1 = await p.evaluate(() => scrollY); await p.waitForTimeout(400); ok(await p.evaluate(() => scrollY) === y1, "pausar a rolagem");
    const kb = await p.locator("#knob").boundingBox(), tr = await p.locator("#trilho").boundingBox();
    await p.mouse.move(kb.x + 20, kb.y + 20); await p.mouse.down(); await p.mouse.move(tr.x + tr.width - 10, kb.y + 20, { steps: 8 }); await p.mouse.up(); await p.waitForSelector("#mesa-nome");
    ok((await p.inputValue("#mesa-nome")).endsWith("_P4-5"), "arrastar a barra extrai as selecionadas (P4-5)");
    await p.keyboard.press("Escape");
    ok(erros.length === 0, "sem erros na Mesa PDF " + erros.join(";"));
    await ctx.close();
  }
  await b.close();
  console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTUDO OK"); process.exit(falhas ? 1 : 0);
})();
