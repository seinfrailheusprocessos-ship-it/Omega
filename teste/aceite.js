// Teste automático de aceite do Omega (precisa de playwright instalado).
// Uso: node teste/aceite.js        (usa file://)   |  OMEGA_URL=http://localhost:8765/index.html node teste/aceite.js
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const path = require("path");
const URL = process.env.OMEGA_URL || "file://" + path.resolve(__dirname, "../index.html");
let falhas = 0;
const ok = (c, m) => { console.log((c ? "OK    " : "FALHA ") + m); if (!c) falhas++; };
const ativo = p => p.evaluate(() => document.activeElement && (document.activeElement.dataset.chip || document.activeElement.dataset.pf || document.activeElement.id || document.activeElement.tagName));
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  for (const [nome, vp] of [["computador", { width: 1280, height: 850 }], ["celular", { width: 400, height: 800 }]]) {
    console.log("\n=== " + nome + " ===");
    const mobile = nome === "celular";
    const ctx = await b.newContext({ viewport: vp, permissions: ["clipboard-read", "clipboard-write"], hasTouch: mobile });
    const p = await ctx.newPage(); const erros = [];
    p.on("pageerror", e => erros.push(e.message)); p.on("console", m => m.type() === "error" && !/Failed to load resource/.test(m.text()) && erros.push(m.text()));
    await p.goto(URL + "?exemplo=1"); await p.waitForSelector(".chip");
    const latAberta = () => p.evaluate(() => document.body.classList.contains("lat"));
    const lat = async () => { if (mobile && !(await latAberta())) { await p.click("#b-lat"); await p.waitForTimeout(250); } };
    const fechaLat = async () => { if (mobile && (await latAberta())) { await p.click("#fundo", { position: { x: 380, y: 400 } }); await p.waitForTimeout(250); } };
    const chip = k => p.locator(`[data-chip="${k}"]`);
    const texto = () => p.evaluate(() => navigator.clipboard.readText());

    // ---- visual e estrutura ----
    ok((await p.title()) === "Omega", "título sem acento: Omega");
    ok(!/Ômega|ÔMEGA/.test(await p.evaluate(() => document.body.innerText + document.title)), "nenhum 'Ômega' com acento na tela");
    ok(await p.locator("table.rel").count() >= 3, "o relatório é uma tabela (Item | O que fazer | Depende de | Bloqueia | Escolha)");
    const bc = await p.locator("table.rel td").first().evaluate(e => getComputedStyle(e).borderTopColor);
    ok(/rgba\(0, 0, 0, 0\)|transparent/.test(bc), "linhas do relatório transparentes (" + bc + ")");
    const bt = await p.locator("table.tab td").first().evaluate(e => getComputedStyle(e).borderTopColor);
    ok(!/rgba\(0, 0, 0, 0\)|transparent/.test(bt), "tabelas reais e de texto têm linhas visíveis");
    ok(await p.locator("table.rel td.c-texto .just").first().evaluate(e => getComputedStyle(e).textAlign) === "justify", "texto do relatório justificado");
    if (mobile) ok(await p.locator("table.rel > thead").first().evaluate(e => getComputedStyle(e).display) === "none" && await p.locator("table.rel tr.item").first().evaluate(e => getComputedStyle(e).display) === "block", "no celular as linhas viram cartões");

    if (!mobile) {
      // ---- Tab, Espaço, setas ----
      await p.keyboard.press("Tab");
      ok((await ativo(p)) === "I:1.6", "Tab chega na primeira caixinha (A fazer)");
      await p.keyboard.press("Space"); await p.waitForTimeout(100);
      ok(await p.locator("#painel.aberto .pop-op").count() === 4 && (await ativo(p)) === "pop-q", "Espaço abre as opções (A fazer, Feito, Ignorar, Não consegui)");
      await p.keyboard.press("ArrowDown"); await p.keyboard.press("Enter"); await p.waitForTimeout(150);
      ok((await chip("I:1.6").innerText()).trim() === "Feito", "seta + Enter escolhe 'Feito'");
      ok((await ativo(p)) === "I:1.6", "o foco volta para a caixinha");
      await p.keyboard.press("Tab");
      ok((await ativo(p)) === "I:1.7", "Tab segue para a próxima caixinha");
      await p.keyboard.press("Enter"); await p.waitForTimeout(100);
      ok(await p.locator("#painel.aberto").count() === 1, "Enter também abre");
      await p.keyboard.press("Escape"); await p.waitForTimeout(80);
      ok(await p.locator("#painel.aberto").count() === 0 && (await ativo(p)) === "I:1.7", "Esc fecha e devolve o foco");
      // ---- comentário junto com a escolha ----
      await chip("I:1.9").click(); await p.fill("#pop-com", "não achei a pasta antiga"); await p.locator(".pop-op", { hasText: "Não consegui" }).click(); await p.waitForTimeout(150);
      ok((await chip("I:1.9").innerText()).trim() === "Não consegui" && (await p.locator("#it-1_9 .comentario").innerText()).includes("não achei a pasta antiga"), "escolha + comentário ao mesmo tempo");
      // ---- opção livre ("procurar ou adicionar") ----
      await chip("I:2.0").click(); await p.keyboard.type("Responder por telefone"); await p.keyboard.press("Enter"); await p.waitForTimeout(150);
      ok((await chip("I:2.0").innerText()).trim() === "Responder por telefone", "digitar e Enter adiciona uma opção própria");
      // ---- filtrar opções digitando ----
      await chip("I:2.1").click(); await p.keyboard.type("24"); await p.keyboard.press("Enter"); await p.waitForTimeout(150);
      ok((await chip("I:2.1").innerText()).trim() === "Adotar 24 meses", "digitar filtra a lista; Enter escolhe");
      // só comentário (Enter no campo de comentário)
      await chip("I:2.2").click(); await p.keyboard.press("Tab"); await p.keyboard.type("falta conferir"); await p.keyboard.press("Enter"); await p.waitForTimeout(150);
      ok((await chip("I:2.2").innerText()).trim() === "Aguardando" && (await p.locator("#it-2_2 .comentario").innerText()).includes("falta conferir"), "dá para comentar sem escolher");
      // tabela com chips
      await chip("C:2.3:0:3").click(); await p.keyboard.press("ArrowDown"); await p.keyboard.press("Enter"); await p.waitForTimeout(120);
      ok((await chip("C:2.3:0:3").innerText()).trim() === "Feito", "caixinha dentro de tabela também funciona");
      // ---- documento em campos ----
      await p.focus('[data-pf="P:T1:2.1"]'); await p.keyboard.press("Enter"); await p.waitForTimeout(80);
      ok(await p.locator('.ptexto[contenteditable]').count() === 1, "Enter num parágrafo permite reescrever (campo de formulário)");
      await p.keyboard.press("End"); await p.keyboard.type(" Acrescentei isto."); await p.keyboard.press("Control+Enter"); await p.waitForTimeout(150);
      ok(await p.locator(".alt").count() === 1 && (await ativo(p)) === "P:T1:2.1", "parágrafo alterado fica marcado e o foco continua nele");
      await p.keyboard.press("Tab"); ok((await ativo(p)) === "P:T1:2.1" && (await p.evaluate(() => document.activeElement.tagName)) === "BUTTON", "Tab do parágrafo vai para a caixinha de situação");
      await p.keyboard.press("Space"); await p.keyboard.press("ArrowDown"); await p.keyboard.press("ArrowDown"); await p.keyboard.press("Enter"); await p.waitForTimeout(120);
      ok((await chip("P:T1:2.1").innerText()).includes("Ajustar"), "parágrafo: Pendente → Aprovado → Ajustar");
      await p.fill("#it-x", "").catch(() => {});
      await chip("P:T1:2.2").click(); await p.fill("#pop-com", "trocar deverá por poderá"); await p.locator(".pop-op", { hasText: "Ajustar" }).click(); await p.waitForTimeout(120);
      ok((await p.locator('[data-fk="P:T1:2.2"] .comentario').innerText()).includes("trocar deverá"), "ajuste com comentário no parágrafo");
      await chip("K:T1:3").click(); await p.keyboard.press("Enter"); await p.waitForTimeout(150);
      ok(await p.locator('[data-fk="P:T1:3.1"] .chip.ok, [data-fk="P:T1:3.2"] .chip.ok').count() === 2 && (await chip("K:T1:3").innerText()).includes("Aprovado"), "'Aprovar capítulo inteiro' aprova todos os parágrafos");
      // ---- busca ----
      await p.keyboard.press("Escape");
      await p.locator("body").click({ position: { x: 5, y: 5 } }); await p.keyboard.press("/"); await p.waitForTimeout(100);
      ok((await ativo(p)) === "busca", "tecla / vai para a busca da lateral");
      await p.keyboard.type("1.7"); await p.waitForTimeout(100);
      ok((await p.locator("#busca-res .res").first().innerText()).includes("Reiniciar"), "buscar pelo número mostra o item");
      await p.fill("#busca", "exemplo geral"); await p.waitForTimeout(100);
      ok(await p.locator("#busca-res .res").count() >= 5, "buscar pelo nome do objeto lista o relatório e tudo que está pendente (" + (await p.locator("#busca-res .res").count()) + ")");
      await p.fill("#busca", ""); await p.waitForTimeout(80);
      // ---- saída ----
      await p.locator("#b-cop").click(); await p.waitForTimeout(200);
      const t = await texto(); console.log("----- texto copiado -----\n" + t + "-------------------------");
      ok(/^\[OMEGA\] 1 Exemplo Geral · relatório exemplo-geral rev 1 \| \d\d\/\d\d\/\d{4} \d\d:\d\d\n\n## 1 Layout\n\n1\.6 \[Feito\]\n\n1\.9 \[Não consegui\] — comentário: não achei a pasta antiga/.test(t), "formato do Copiar relatório (só decisões e comentários)");
      ok(/2\.0 \[Escolheu\] outro: "Responder por telefone"/.test(t) && /2\.1 \[Escolheu\] opção B: "adotar 24 meses"/.test(t) && /2\.2 \[Aguardando\] — comentário: falta conferir/.test(t), "decisões, opção livre e comentário sem escolha");
      ok(/2\.3 \(linha 1, Situação\) \[Feito\]/.test(t), "decisão dentro de tabela");
      ok(/## Texto: DFD \(exemplo\), capítulo 2\n\n2\.1 \[Ajustar\] texto alterado: ".*Acrescentei isto\."/.test(t) && /2\.2 \[Ajustar\] — comentário: trocar deverá por poderá/.test(t), "parágrafos: texto alterado e comentário");
      ok(/## Texto: DFD \(exemplo\), capítulo 3\n\nTodo o capítulo \[Aprovado\]/.test(t) && !/3\.1/.test(t), "capítulo aprovado inteiro sai numa linha só");
      ok(!/1\.8|3\.1 /.test(t) && !/EXEMPLO FICT/.test(t.split("## Texto")[0]), "não leva o texto do relatório, só as decisões");
      // ---- visualização de impressão, revisar tudo, novo documento ----
      await p.getByText("Visualizar impressão").click(); await p.waitForTimeout(100);
      ok(await p.locator("#impressao .folha .f-par").count() >= 5 && (await p.locator("#impressao .folha").evaluate(e => getComputedStyle(e).textAlign)) === "justify", "visualização de impressão (folha A4, texto justificado)");
      await p.locator("#impressao button", { hasText: "Fechar" }).click();
      await p.getByText("Revisar tudo").click(); await p.waitForSelector(".sobre .achado", { timeout: 90000 });
      ok(await p.locator(".sobre .achado").count() >= 2, "Revisar tudo lista os problemas do documento inteiro");
      await p.locator(".sobre button", { hasText: "Corrigir espaços e pontuação" }).click(); await p.waitForTimeout(200);
      await p.locator(".sobre button", { hasText: "Fechar" }).click();
      ok(!/relatório mensal  das/.test(await p.locator('[data-pf="P:T1:2.2"]').innerText()), "corrigir espaços e pontuação em tudo");
      await p.locator("#lateral .lat-bt", { hasText: "Novo documento" }).click(); await p.locator(".sobre .op", { hasText: "Ofício" }).click(); await p.waitForTimeout(150);
      ok(await p.locator("[data-pf]").count() === 7 && (await p.locator(".caixa-l .caixinha .n").allInnerTexts()).some(x => /^2 Ofício/.test(x)), "Novo documento: ofício em campos (7 campos) e novo item na lateral");
    }
    if (mobile) {
      await p.locator('[data-chip="I:1.6"]').click(); await p.waitForTimeout(150);
      const bx = await p.locator("#painel").boundingBox();
      ok(bx && bx.width >= 395 && bx.y + bx.height >= 790 && bx.y > 150, "no celular as opções abrem de baixo (folha)");
      const alt = await p.locator(".pop-op").first().boundingBox(); ok(alt.height >= 44, "botões com 44px ou mais");
      await p.locator(".pop-op", { hasText: "Feito" }).click(); await p.waitForTimeout(150);
      ok((await p.locator('[data-chip="I:1.6"]').innerText()).trim() === "Feito", "escolha por toque");
      const cdp = await ctx.newCDPSession(p);
      const arrasta = async (x0, x1) => { await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y: 400 }] }); for (let x = x0; Math.abs(x - x1) > 5; x += (x1 > x0 ? 12 : -12)) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: 400 }] }); await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await p.waitForTimeout(250); };
      ok(!(await latAberta()), "lateral fechada antes do gesto");
      await arrasta(5, 150); ok(await latAberta(), "deslizar da borda esquerda abre a lateral");
      await arrasta(200, 40); ok(!(await latAberta()), "deslizar para a esquerda fecha e volta ao relatório");
    }
    // temas
    for (const t of ["claro", "escuro", "maisescuro"]) { await lat(); await p.click(`.seg button[data-tema=${t}]`); await fechaLat(); const bg = await p.evaluate(() => getComputedStyle(document.body).backgroundColor); console.log("tema " + t + ": " + bg); await p.screenshot({ path: `/tmp/omega-${nome}-${t}.png` }); }
    ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "sem rolagem horizontal da página");
    ok(erros.length === 0, "sem erros no console " + erros.join(";"));
    await ctx.close();
  }
  await b.close();
  console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTUDO OK"); process.exit(falhas ? 1 : 0);
})();
