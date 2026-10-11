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
    const abrirLateral = async () => { if (nome === "celular") await p.click("#b-lat"); };
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
    // saída
    await p.evaluate(() => { const r = relAtual(); r.foco = { t: "I", num: "1.9" }; });
    await p.locator("#b-cop").click(); await p.waitForTimeout(200);
    const txt = await p.evaluate(() => navigator.clipboard.readText());
    console.log("----- texto copiado -----\n" + txt + "-------------------------");
    ok(/^\[ÔMEGA\] relatório exemplo-geral rev 1 \| \d\d\/\d\d\/\d{4} \d\d:\d\d\n\n## 1 Layout\n\n1\.6 \[Feito\]\n\n1\.9 \[Não consegui\]/.test(txt), "formato da saída (cabeçalho e seção)");
    ok(/2\.1 \[Escolheu\] opção B: "adotar 24 meses"/.test(txt), "decisão com opção sai como [Escolheu] opção B");
    ok(/## Texto: DFD \(exemplo\), capítulo 2\n\n2\.1 \[azul\] texto alterado: "/.test(txt), "parágrafo alterado sai com o texto novo");
    ok(!/1\.7/.test(txt), "itens não tocados não aparecem");
    await p.locator("#b-copf").click(); await p.waitForTimeout(150);
    ok(/1\.9 \[Não consegui\]/.test(await p.evaluate(() => navigator.clipboard.readText())), "Copiar item em foco");
    // temas
    for (const t of ["claro", "escuro", "maisescuro"]) { await p.selectOption("#tema", t); const bg = await p.evaluate(() => getComputedStyle(document.body).backgroundColor); console.log("tema " + t + ": " + bg); await p.screenshot({ path: `/tmp/omega-${nome}-${t}.png` }); }
    await p.selectOption("#tema", "claro");
    // sem rolagem horizontal
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "sem rolagem horizontal da página");
    ok(erros.length === 0, "sem erros no console " + erros.join(";"));
    await ctx.close();
  }
  await b.close();
  console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTUDO OK"); process.exit(falhas ? 1 : 0);
})();
