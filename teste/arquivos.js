// Teste do gerenciador de arquivos / scripts / Mesa PDF (precisa de Node + playwright + pdf-lib instalados).
// Uso: PLAYWRIGHT_PATH=... node teste/arquivos.js
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const { spawn } = require("child_process"); const fs = require("fs"), path = require("path"), os = require("os");
const RAIZ = path.resolve(__dirname, ".."), PORTA = 8794, BASE = `http://localhost:${PORTA}/index.html`;
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK    " : "FALHA ") + m); if (!c) falhas++; };
(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "omega-")), raiz = path.join(tmp, "CL"); fs.mkdirSync(raiz);
  const cfg = path.join(RAIZ, "dados", "config.json"); const tinha = fs.existsSync(cfg); if (tinha) fs.renameSync(cfg, cfg + ".bak");
  fs.writeFileSync(cfg, JSON.stringify({ raizes: [raiz], scripts: [{ id: "ocr", nome: "OCR (teste)", aplicaA: "arquivo", extensoes: [".pdf"], comando: [process.execPath, "-e", "console.log('OCR rodou em ' + require('path').basename(process.argv[1]))", "{arquivo}"] }] }));
  // PDF de 5 páginas
  let PDFLib; try { PDFLib = require(process.env.PDFLIB_PATH || "pdf-lib"); } catch (e) { PDFLib = require(path.join(RAIZ, "node_modules/pdf-lib")); }
  const d = await PDFLib.PDFDocument.create(); for (let i = 1; i <= 5; i++) d.addPage([300, 200]).drawText("Pagina " + i, { x: 50, y: 100 });
  const pdf = path.join(tmp, "escaneado.pdf"); fs.writeFileSync(pdf, await d.save());
  const srv = spawn(process.execPath, [path.join(RAIZ, "servidor.js")], { env: { ...process.env, PORTA: String(PORTA) }, stdio: "ignore" });
  await new Promise(r => setTimeout(r, 1200));
  const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  try {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 850 }, permissions: ["clipboard-read", "clipboard-write"] });
    const p = await ctx.newPage(); const erros = []; p.on("pageerror", e => erros.push(e.message)); p.on("console", m => m.type() === "error" && !/Failed to load resource/.test(m.text()) && erros.push(m.text()));
    await p.goto(BASE + "?exemplo=1"); await p.waitForSelector(".chip"); await p.waitForTimeout(600);
    const texto = () => p.evaluate(() => navigator.clipboard.readText());
    // novo objeto
    await p.locator("#b-novo-obj").click(); await p.waitForSelector(".sobre .campo");
    const campos = p.locator(".sobre .campo input[type=text], .sobre .campo input[type=url]");
    await campos.nth(0).fill("Canal do Malhado"); await campos.nth(2).fill(path.join(raiz, "Canal do Malhado")); await campos.nth(3).fill("https://claude.ai/chat/abc-123");
    await p.locator("#obj-criar").click(); await p.waitForTimeout(500);
    ok(fs.existsSync(path.join(raiz, "Canal do Malhado")), "Novo objeto cria a pasta no computador");
    ok((await p.locator(".caixa-l .caixinha .n").allInnerTexts()).some(x => x === "2 Canal do Malhado"), "objeto aparece na lateral com número e nome");
    ok(await p.locator("h1", { hasText: "2 Canal do Malhado" }).count() === 1 && await p.getByText("Objeto novo.").count() === 1, "objeto novo mostra o id para o Claude");
    // upload
    await p.waitForSelector('[data-subir]');
    await p.locator('#sec-__arq input[type=file]').first().setInputFiles(pdf); await p.waitForSelector("table.arq td", { timeout: 5000 }); await p.waitForTimeout(400);
    ok(fs.existsSync(path.join(raiz, "Canal do Malhado", "escaneado.pdf")), "upload de PDF grava na pasta do objeto");
    ok(await p.locator("table.arq", { hasText: "escaneado.pdf" }).count() === 1, "arquivo aparece na lista");
    // renomear
    p.once("dialog", dl => dl.accept("oficio-123.pdf")); await p.locator("table.arq .mini", { hasText: "Renomear" }).click(); await p.waitForTimeout(500);
    ok(fs.existsSync(path.join(raiz, "Canal do Malhado", "oficio-123.pdf")) && !fs.existsSync(path.join(raiz, "Canal do Malhado", "escaneado.pdf")), "renomear arquivo pelo Omega");
    // executar script
    await p.locator("table.arq .mini", { hasText: "Executar" }).click(); await p.locator(".bal button", { hasText: "OCR (teste)" }).click();
    await p.waitForSelector(".sobre pre", { timeout: 5000 }); await p.waitForFunction(() => /Terminou/.test(document.querySelector(".sobre").innerText), null, { timeout: 8000 });
    ok((await p.locator(".sobre pre").innerText()).includes("OCR rodou em oficio-123.pdf"), "script do C: executa e mostra o resultado");
    await p.locator(".sobre button", { hasText: "Fechar" }).click();
    // Mesa PDF
    await p.locator("table.arq .mini", { hasText: "Mesa PDF" }).click(); await p.waitForFunction(() => /5 página/.test(document.querySelector("#mesa-info").innerText), null, { timeout: 8000 });
    ok(true, "Mesa PDF conta as páginas (5)");
    await p.fill("#mesa-pags", "2-3"); await p.locator("#mesa-extrair").click(); await p.waitForSelector("#mesa-ext b", { timeout: 8000 });
    ok((await p.locator("#mesa-ext").innerText()).includes("oficio-123_p2-3.pdf (2 página(s))"), "extrai só as páginas 2-3 num PDF novo");
    await p.locator("#mesa-salvar").click(); await p.waitForTimeout(600);
    const ext = path.join(raiz, "Canal do Malhado", "oficio-123_p2-3.pdf");
    ok(fs.existsSync(ext) && (await PDFLib.PDFDocument.load(fs.readFileSync(ext))).getPageCount() === 2, "salva o PDF extraído (2 páginas) na pasta do objeto");
    await p.locator("#mesa-obj").selectOption({ label: "2 Canal do Malhado" });
    await p.locator("#mesa-cadastrar").click(); await p.waitForTimeout(150);
    await p.getByText("← Voltar").click(); await p.waitForTimeout(200);
    await p.locator(".caixa-l .caixinha", { hasText: "Canal do Malhado" }).click(); await p.waitForSelector("table.rel");
    ok(await p.locator("h2", { hasText: "Recebidos (1)" }).count() === 1, "o PDF fica cadastrado em Recebidos (Pendente)");
    await p.locator('[data-chip^="E:"]').click(); await p.keyboard.type("anál"); await p.keyboard.press("Enter"); await p.waitForTimeout(150);
    ok((await p.locator('[data-chip^="E:"]').innerText()).trim() === "Em análise", "situação do recebido: Pendente → Em análise (caixinha)");
    await p.locator("#b-cop").click(); await p.waitForTimeout(200);
    const t = await texto(); ok(/## Recebidos\n\nR\w+ "oficio-123_p2-3.pdf" p\. 2-3 \[Em análise\]/.test(t), "Copiar relatório inclui os recebidos");
    // conversa
    const [pop] = await Promise.all([ctx.waitForEvent("page"), p.locator(".caixa-l .ico").nth(3).click()]);
    await p.waitForTimeout(500);
    const msg = await texto();
    ok(/^Leia o relatório de retorno do Omega do objeto 2 Canal do Malhado/.test(msg) && pop.url().startsWith("https://claude.ai/chat/abc-123"), "💬 abre a conversa e copia 'Leia o relatório de retorno…'");
    const retorno = path.join(raiz, "Canal do Malhado", "RETORNO_OMEGA_rev1.txt");
    ok(fs.existsSync(retorno) && fs.readFileSync(retorno, "utf8").includes("[OMEGA] 2 Canal do Malhado") && msg.includes(retorno), "salva o relatório de retorno na pasta e cita o caminho na mensagem");
    await pop.close();
    // Gmail
    await p.evaluate(() => { window.__abertas = []; window.open = u => { window.__abertas.push(u); }; }); await p.locator("#b-gmail").click(); ok((await p.evaluate(() => window.__abertas[0] || "")).startsWith("https://mail.google.com"), "atalho do Gmail");
    // segurança
    const seg = await p.evaluate(async () => [(await fetch("api/enviar?caminho=/etc&nome=x.txt", { method: "POST", body: "x" })).status, (await fetch("api/renomear", { method: "POST", body: JSON.stringify({ caminho: "/etc/hostname", novoNome: "y" }) })).status, (await fetch("api/executar", { method: "POST", body: JSON.stringify({ script: "ocr", caminho: "/etc/hostname" }) })).status, (await fetch("api/salvar", { method: "POST", body: JSON.stringify({ caminho: "/tmp", nome: "a.txt", texto: "x" }) })).status]);
    ok(seg.every(s => s === 403), "fora das pastas liberadas tudo é negado " + seg);
    ok(erros.length === 0, "sem erros no console " + erros.join(";"));
    // Mesa PDF sem servidor (file://) para o celular/GitHub Pages
    const p2 = await (await b.newContext({ viewport: { width: 400, height: 800 } })).newPage();
    await p2.goto("file://" + path.join(RAIZ, "index.html") + "?exemplo=1"); await p2.waitForSelector(".chip"); await p2.click("#b-lat"); 
    const [fc] = await Promise.all([p2.waitForEvent("filechooser"), p2.locator("#b-mesa").click()]); await fc.setFiles(pdf);
    await p2.waitForFunction(() => /5 página/.test(document.querySelector("#mesa-info").innerText), null, { timeout: 8000 });
    await p2.fill("#mesa-pags", "2-4"); await p2.locator("#mesa-extrair").click(); await p2.waitForSelector("#mesa-ext b", { timeout: 8000 });
    ok((await p2.locator("#mesa-ext").innerText()).includes("escaneado_p2-4.pdf (3 página(s))"), "Mesa PDF funciona sem servidor (celular): extrai 2-4");
    await p2.locator("#mesa-cadastrar").click(); await p2.waitForTimeout(150);
    ok(await p2.evaluate(() => (relAtual().entrada || []).length) === 1, "cadastro como recebido sem servidor");
  } finally {
    await b.close(); srv.kill(); fs.rmSync(cfg, { force: true }); if (tinha) fs.renameSync(cfg + ".bak", cfg); fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTUDO OK"); process.exit(falhas ? 1 : 0);
})();
