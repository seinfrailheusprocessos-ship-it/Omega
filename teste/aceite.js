// Teste automático de aceite do Ômega (precisa de playwright instalado).
// Uso: node teste/aceite.js            (usa file://)  — veja SCHEMA.md / COMO_USAR.md
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const path = require("path");
const URL = process.env.OMEGA_URL || "file://" + path.resolve(__dirname, "../index.html");
let falhas = 0;
const ok = (c, m) => { console.log((c ? "OK    " : "FALHA ") + m); if (!c) falhas++; };
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  for (const [nome, vp] of [["celular", { width: 400, height: 800 }], ["computador", { width: 1280, height: 800 }]]) {
    console.log("\n=== " + nome + " ===");
    const ctx = await b.newContext({ viewport: vp, permissions: ["clipboard-read", "clipboard-write"], hasTouch: nome === "celular" });
    const p = await ctx.newPage(); const erros = [];
    p.on("pageerror", e => erros.push(e.message)); p.on("console", m => m.type() === "error" && !/Failed to load resource/.test(m.text()) && erros.push(m.text()));
    await p.goto(URL + "?exemplo=1");
    await p.waitForSelector(".item");
    const mobile = nome === "celular";
    const latAberta = () => p.evaluate(() => document.body.classList.contains("lat"));
    const lat = async () => { if (mobile && !(await latAberta())) { await p.click("#b-lat"); await p.waitForTimeout(250); } };
    const fechaLat = async () => { if (mobile && (await latAberta())) { await p.click("#fundo", { position: { x: 380, y: 400 } }); await p.waitForTimeout(250); } };
    ok(await p.locator(".sec-h").count() >= 4, "seções aparecem");
    // recolher/expandir
    await p.locator(".sec-h").first().click(); ok(await p.locator(".sec:not(.bloco-feito).rec").count() === 1, "seção recolhe");
    await p.locator(".sec-h").first().click(); ok(await p.locator(".sec:not(.bloco-feito).rec").count() === 0, "seção expande");
    // Depende de rola até item
    await p.locator("#it-1_7 .rel-l a").first().click();
    ok(await p.locator("#it-1_6.alvo").count() === 1, "'Depende de' leva ao item e destaca");
    ok(await p.locator("#it-1_7.bloq").count() === 1, "item bloqueado fica esmaecido");
    // chip abre painel com opções visíveis
    await p.locator("#it-1_6 .chip").click();
    ok(await p.locator("#painel.aberto .op").count() >= 4, "chip abre painel com as opções já visíveis");
    const caixa = await p.locator("#painel").boundingBox();
    ok(nome === "celular" ? caixa.y > 300 && caixa.width >= 390 : caixa.x > 800, "painel fica no lugar fixo (" + (nome === "celular" ? "folha inferior" : "borda direita") + ")");
    const alt = await p.locator("#painel .op").first().boundingBox(); ok(alt.height >= 48, "botões com 48px ou mais");
    // tecla 2 = Feito; avança
    await p.keyboard.press("2");
    await p.waitForTimeout(200);
    ok(await p.locator("#it-1_6").count() === 1 && (await p.locator(".bloco-feito .item").count()) >= 1, "Feito leva o item para 'Já feito'");
    ok(await p.locator("#it-1_7.bloq").count() === 0, "pré-requisito feito desbloqueia");
    ok(await p.locator("#painel.aberto").count() === 1, "painel avançou para o próximo pendente");
    await p.keyboard.press("n"); await p.waitForTimeout(100);
    await p.keyboard.press("Escape");
    // decisão com opções
    await p.locator("#it-2_1 .chip").click(); await p.locator("#painel .op", { hasText: "Adotar 24" }).click(); await p.waitForTimeout(200); await p.keyboard.press("Escape");
    // Não consegui (item 1.9) + nota por "Outro…"
    await p.locator("#it-1_9 .chip").click(); await p.locator("#painel .op", { hasText: "Não consegui" }).click(); await p.waitForTimeout(150); await p.keyboard.press("Escape");
    // tabela: alinhamento por coluna
    await p.locator("#it-3_1 .alins button").nth(2).click(); // coluna 0, direita
    const al = await p.locator("#it-3_1 tbody tr").first().locator("td").first().evaluate(e => getComputedStyle(e).textAlign);
    ok(al === "right", "alinhamento da coluna muda (direita) — " + al);
    if (nome === "computador") ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "sem rolagem horizontal");
    if (nome === "celular") ok(await p.locator("#it-3_1 table.tab.cartoes").count() === 1, "tabela vira cartões no celular");
    // chip dentro de tabela abre o mesmo painel
    await p.locator("#it-2_3 td .chip").first().click();
    ok(await p.locator("#painel.aberto .op").count() >= 4, "chip de tabela abre o painel fixo");
    await p.keyboard.press("Escape");
    // modo Texto
    const dots = p.locator("table.tex .dot");
    const n0 = await dots.count(); ok(n0 === 5, "5 parágrafos com bolinha");
    await dots.first().click(); await p.waitForTimeout(100);
    ok(await p.locator("table.tex .dot.verde").count() === 2, "um toque: vermelho → verde");
    await p.locator("table.tex .dot").first().click(); await p.waitForTimeout(100);
    ok(await p.locator("table.tex .dot.azul").count() === 1, "segundo toque: verde → azul");
    await p.locator("table.tex .dot").first().click(); await p.waitForTimeout(100);
    ok(await p.locator("table.tex .dot.vermelho").count() === 4, "terceiro toque: azul → vermelho");
    // capítulo 3: marcar 3.2 verde → capítulo verde
    await p.locator("table.tex .dot").nth(4).click(); await p.waitForTimeout(100);
    ok(await p.locator(".capitulo").nth(1).locator(".cap-h .bola.verde").count() === 1, "capítulo só fica verde com todos verdes");
    // um toque simples nunca abre teclado
    await p.locator("table.tex .ptexto").first().click(); await p.waitForTimeout(100);
    ok(await p.locator("[contenteditable]").count() === 0, "toque simples não abre edição");
    await p.locator("table.tex .ptexto").first().dblclick(); await p.waitForTimeout(100);
    ok(await p.locator(".ptexto[contenteditable]").count() === 1, "duplo toque abre edição");
    await p.keyboard.press("End"); await p.keyboard.type(" Acrescentei isto.");
    await p.locator("h1").click(); await p.waitForTimeout(150);
    ok(await p.locator(".alt").count() === 1, "parágrafo alterado fica marcado");
    ok(await p.locator("table.tex .dot.azul").count() === 1, "parágrafo alterado fica azul");
    // revisor: palavra errada sublinhada
    await p.waitForSelector(".err", { timeout: 90000 });
    ok(await p.locator(".err").count() >= 2, "revisor sublinha erros (" + (await p.locator(".err").allInnerTexts()).join(" | ") + ")");
    // persistência
    await p.reload(); await p.waitForSelector(".item");
    ok(await p.locator(".bloco-feito .item").count() >= 1 && await p.locator(".alt").count() === 1, "fechar e abrir mantém as escolhas");
    // ---- v3: lateral no lugar da barra de cima ----
    ok(await p.locator("#barra").count() === 0, "não há barra superior (tudo foi para a lateral)");
    await lat();
    ok((await p.locator(".caixa-l .caixinha .n").first().innerText()) === "1 Exemplo Geral", "lateral lista só relatórios: número e rótulo da pasta");
    ok(await p.locator(".caixa-l .ico").count() === 2, "dois atalhos por relatório (arquivos e conversa)");
    let todas = true; for (const x of ["Claude", "Gemini", "Revisar texto", "Áudio", "Copiar relatório (decisões)", "Copiar item em foco", "Copiar relatório inteiro", "Copiar tudo e enviar"]) if (!(await p.locator("#lateral .lat-bt", { hasText: x }).count())) { todas = false; console.log("  falta: " + x); }
    ok(todas, "opções da antiga barra de cima estão na lateral");
    ok(await p.locator("#lateral .seg button").count() === 3 && (await p.locator("#cont").innerText()).includes("pendentes"), "tema e contador estão na lateral");
    await p.fill("#in-conv", "https://claude.ai/chat/exemplo-123"); await p.press("#in-conv", "Enter"); await p.waitForTimeout(150);
    ok((await p.evaluate(() => relAtual().conversa)) === "https://claude.ai/chat/exemplo-123", "link da conversa fica salvo");
    await p.locator(".caixa-l .ico").first().click(); await p.waitForTimeout(250);
    ok(/C:\\Exemplo/.test(await p.evaluate(() => navigator.clipboard.readText())), "atalho de arquivos (sem servidor): copia o caminho da pasta");
    { const [pop] = await Promise.all([ctx.waitForEvent("page"), p.locator(".caixa-l .ico").nth(1).click()]); ok(pop.url().startsWith("https://claude.ai/chat/exemplo-123") || pop.url().startsWith("chrome-error"), "atalho da conversa abre o link salvo (" + pop.url().slice(0, 40) + ")"); await pop.close(); }
    await fechaLat();
    // copiar em partes
    const par = p.locator("table.tex tbody tr").first();
    await par.getByText("Copiar parágrafo").click(); await p.waitForTimeout(150);
    ok((await p.evaluate(() => navigator.clipboard.readText())).includes("Acrescentei isto."), "copiar parágrafo");
    await p.getByText("Copiar capítulo").first().click(); await p.waitForTimeout(150);
    ok((await p.evaluate(() => navigator.clipboard.readText())).startsWith("2 Descrição da necessidade da contratação\n\n"), "copiar capítulo");
    await p.getByText("Copiar texto inteiro").click(); await p.waitForTimeout(150);
    { const tx = await p.evaluate(() => navigator.clipboard.readText()); ok(tx.startsWith("DFD (exemplo)\n\n2 Descrição") && tx.includes("3 Requisitos"), "copiar texto inteiro"); }
    await lat(); await p.locator("#lateral .lat-bt", { hasText: "Copiar relatório inteiro" }).click(); await p.waitForTimeout(150);
    { const tx = await p.evaluate(() => navigator.clipboard.readText()); ok(tx.startsWith("Relatório de exemplo") && tx.includes("1.6") && tx.includes("T1 DFD"), "copiar relatório inteiro"); }
    await lat();
    { const [pop] = await Promise.all([ctx.waitForEvent("page"), p.locator("#b-env").click()]); await p.waitForTimeout(200);
      const tx = await p.evaluate(() => navigator.clipboard.readText()); ok(tx.startsWith("[ÔMEGA]") && tx.includes("RELATÓRIO COMPLETO") && (pop.url().startsWith("https://claude.ai/chat/exemplo-123") || pop.url().startsWith("chrome-error")), "copiar tudo e enviar: copia e abre a conversa"); await pop.close(); }
    await fechaLat();
    ok(await p.locator("#it-2_3 tbody tr").first().locator("td").nth(1).evaluate(e => getComputedStyle(e).textAlign) === "left", "células de texto das tabelas ficam alinhadas à esquerda");
    ok(await p.locator(".item .tx").first().evaluate(e => getComputedStyle(e).textAlign) === "justify", "parágrafos continuam justificados");
    if (mobile) {
      const cdp = await ctx.newCDPSession(p);
      const arrasta = async (x0, x1) => { await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y: 400 }] }); for (let x = x0; Math.abs(x - x1) > 5; x += (x1 > x0 ? 12 : -12)) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: 400 }] }); await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await p.waitForTimeout(250); };
      ok(!(await latAberta()), "lateral fechada antes do gesto");
      await arrasta(5, 150); ok(await latAberta(), "deslizar da borda esquerda para a direita abre a lateral");
      await arrasta(200, 40); ok(!(await latAberta()), "deslizar para a esquerda fecha e volta ao relatório");
    }
    // saída
    await p.evaluate(() => { const r = relAtual(); r.foco = { t: "I", num: "1.9" }; });
    await lat(); await p.locator("#b-cop").click(); await p.waitForTimeout(200);
    const txt = await p.evaluate(() => navigator.clipboard.readText());
    console.log("----- texto copiado -----\n" + txt + "-------------------------");
    ok(/^\[ÔMEGA\] relatório exemplo-geral rev 1 \| \d\d\/\d\d\/\d{4} \d\d:\d\d\n\n## 1 Layout\n\n1\.6 \[Feito\]\n\n1\.9 \[Não consegui\]/.test(txt), "formato da saída (cabeçalho e seção)");
    ok(/2\.1 \[Escolheu\] opção B: "adotar 24 meses"/.test(txt), "decisão com opção sai como [Escolheu] opção B");
    ok(/## Texto: DFD \(exemplo\), capítulo 2\n\n2\.1 \[azul\] texto alterado: "/.test(txt), "parágrafo alterado sai com o texto novo");
    ok(!/1\.7/.test(txt), "itens não tocados não aparecem");
    await lat(); await p.locator("#b-copf").click(); await p.waitForTimeout(150);
    ok(/1\.9 \[Não consegui\]/.test(await p.evaluate(() => navigator.clipboard.readText())), "Copiar item em foco");
    // temas
    for (const t of ["claro", "escuro", "maisescuro"]) { await lat(); await p.click(`.seg button[data-tema=${t}]`); await fechaLat(); const bg = await p.evaluate(() => getComputedStyle(document.body).backgroundColor); console.log("tema " + t + ": " + bg); await p.screenshot({ path: `/tmp/omega-${nome}-${t}.png` }); }
    await lat(); await p.click(".seg button[data-tema=claro]"); await fechaLat();
    // sem rolagem horizontal
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "sem rolagem horizontal da página");
    ok(erros.length === 0, "sem erros no console " + erros.join(";"));
    await ctx.close();
  }
  await b.close();
  console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTUDO OK"); process.exit(falhas ? 1 : 0);
})();
