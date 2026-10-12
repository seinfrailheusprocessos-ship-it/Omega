// Teste do gerenciador de arquivos, scripts, hierarquia, README, Mesa PDF e revisão (precisa de Node + playwright + pdf-lib).
// Uso: PLAYWRIGHT_PATH=... PDFLIB_PATH=... node teste/arquivos.js
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const { spawn } = require("child_process"); const fs = require("fs"), path = require("path"), os = require("os");
const RAIZ = path.resolve(__dirname, ".."), PORTA = 8794, BASE = `http://localhost:${PORTA}/index.html`;
let falhas = 0; const ok = (c, m) => { console.log((c ? "OK    " : "FALHA ") + m); if (!c) falhas++; };
(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "omega-")), raiz = path.join(tmp, "CL"); fs.mkdirSync(raiz);
  const cfg = path.join(RAIZ, "dados", "config.json"); const tinha = fs.existsSync(cfg); if (tinha) fs.renameSync(cfg, cfg + ".bak");
  fs.writeFileSync(cfg, JSON.stringify({ raizes: [raiz], scripts: [{ id: "ocr", nome: "OCR (teste)", aplicaA: "arquivo", extensoes: [".pdf"], comando: [process.execPath, "-e", "console.log('OCR rodou em ' + require('path').basename(process.argv[1]))", "{arquivo}"] }] }));
  let PDFLib; try { PDFLib = require(process.env.PDFLIB_PATH || "pdf-lib"); } catch (e) { PDFLib = require(path.join(RAIZ, "node_modules/pdf-lib")); }
  const d = await PDFLib.PDFDocument.create(); for (let i = 1; i <= 8; i++) d.addPage([300, 400]).drawText("Pagina " + i, { x: 40, y: 200, size: 24 });
  const pdf = path.join(tmp, "escaneado.pdf"); fs.writeFileSync(pdf, await d.save());
  const srv = spawn(process.execPath, [path.join(RAIZ, "servidor.js")], { env: { ...process.env, PORTA: String(PORTA) }, stdio: "ignore" });
  await new Promise(r => setTimeout(r, 1200));
  const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  try {
    const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, permissions: ["clipboard-read", "clipboard-write"] });
    const p = await ctx.newPage(); const erros = []; p.on("pageerror", e => erros.push(e.message)); p.on("console", m => m.type() === "error" && !/Failed to load resource/.test(m.text()) && erros.push(m.text()));
    await p.goto(BASE + "?exemplo=1"); await p.waitForSelector(".chip"); await p.waitForTimeout(600);
    const texto = () => p.evaluate(() => navigator.clipboard.readText());
    const mais = async () => { if (await p.locator("#mais.oculto").count()) await p.click("#b-mais"); await p.waitForTimeout(100); };
    // hierarquia base
    await mais(); await p.locator("#m-hier").click(); await p.waitForSelector("#hier-criar"); await p.locator("#hier-criar").click(); await p.waitForTimeout(700);
    ok(fs.existsSync(path.join(raiz, "1_LICITACOES", "README.md")) && fs.existsSync(path.join(raiz, "4_COMUNICACOES", "README.md")), "hierarquia base: pastas numeradas das categorias, cada uma com README");
    // novo objeto: código, pasta e README
    await mais(); await p.locator("#m-novo-obj").click(); await p.waitForSelector("#obj-cod");
    ok((await p.inputValue("#obj-cod")) === "1.8", "Novo objeto: código sugerido 1.8");
    await p.fill("#obj-nome", "Canal do Malhado"); await p.fill("#obj-conv", "https://claude.ai/chat/abc-123");
    ok((await p.inputValue("#obj-cam")) === path.join(raiz, "1_LICITACOES", "1.8_CANAL_DO_MALHADO"), "pasta sugerida dentro da categoria: " + (await p.inputValue("#obj-cam")));
    await p.locator("#obj-criar").click(); await p.waitForTimeout(700);
    const pastaObj = path.join(raiz, "1_LICITACOES", "1.8_CANAL_DO_MALHADO");
    ok(fs.existsSync(path.join(pastaObj, "README.md")) && fs.readFileSync(path.join(pastaObj, "README.md"), "utf8").includes("# 1.8 Canal do Malhado"), "pasta criada com README (memorial/ficha)");
    ok((await p.locator("#lateral .li[data-pasta]").allInnerTexts()).some(x => /1\.8\s+Canal do Malhado/.test(x)), "aparece na lateral, na categoria 1");
    // upload, renomear, script
    await p.waitForSelector('[data-subir]');
    await p.locator('#sec-__arq input[type=file]').first().setInputFiles(pdf); await p.waitForSelector("table.arq td", { timeout: 5000 }); await p.waitForTimeout(400);
    ok(fs.existsSync(path.join(pastaObj, "escaneado.pdf")), "upload de PDF grava na pasta do objeto");
    p.once("dialog", dl => dl.accept("bloco-1.pdf")); await p.locator("table.arq tr", { hasText: "escaneado.pdf" }).locator(".mini", { hasText: "Renomear" }).click(); await p.waitForTimeout(500);
    ok(fs.existsSync(path.join(pastaObj, "bloco-1.pdf")), "renomear arquivo pelo Omega");
    await p.locator("table.arq tr", { hasText: "bloco-1.pdf" }).locator(".mini", { hasText: "Executar" }).click(); await p.locator(".bal button", { hasText: "OCR (teste)" }).click();
    await p.waitForFunction(() => /Terminou/.test((document.querySelector(".sobre") || {}).innerText || ""), null, { timeout: 8000 });
    ok((await p.locator(".sobre pre").innerText()).includes("OCR rodou em bloco-1.pdf"), "script do C: executa e mostra o resultado");
    await p.locator(".sobre button", { hasText: "Fechar" }).click();
    // Mesa PDF com servidor: extrair → renomear → criar resposta (pasta com o nome do arquivo)
    await p.locator("table.arq tr", { hasText: "bloco-1.pdf" }).locator(".mini", { hasText: "Mesa PDF" }).click(); await p.waitForFunction(() => /8 página/.test(document.querySelector("#mesa-info").innerText), null, { timeout: 15000 });
    await p.waitForSelector("#grade .pg canvas"); await p.waitForTimeout(500);
    await p.locator("#mesa-obj").selectOption({ label: "1.8 Canal do Malhado" });
    const bx = await p.locator('#grade .pg[data-n="3"]').boundingBox();
    await p.mouse.move(bx.x + 20, bx.y + 20); await p.mouse.down(); await p.mouse.move(bx.x + 230, bx.y + 24, { steps: 8 }); await p.mouse.up(); await p.waitForSelector("#mesa-nome");
    ok((await p.inputValue("#mesa-nome")) === "1.8.1_BLOCO-1_P3", "nome sugerido com código do objeto: " + (await p.inputValue("#mesa-nome")));
    await p.locator("#mesa-continuar").click(); await p.waitForSelector("#dest-resposta"); ok(await p.locator("#dest-aqui:not([disabled])").count() === 1, "com servidor: salvar na mesma pasta / outra / nova / criar resposta");
    await p.locator("#dest-resposta").click(); await p.waitForTimeout(900);
    const pastaResp = path.join(pastaObj, "1.8.1_BLOCO-1_P3");
    ok(fs.existsSync(path.join(pastaResp, "README.md")) && fs.existsSync(path.join(pastaResp, "1.8.1_BLOCO-1_P3.pdf")), "'Criar resposta' cria a pasta com o nome do arquivo e salva o PDF dentro");
    const pdfSalvo = await PDFLib.PDFDocument.load(fs.readFileSync(path.join(pastaResp, "1.8.1_BLOCO-1_P3.pdf"))); ok(pdfSalvo.getPageCount() === 1, "PDF extraído com 1 página");
    await p.locator(".sobre .op", { hasText: "Ofício" }).click(); await p.waitForSelector("[data-pf]"); ok(/^1\.8\.2 /.test(await p.locator("h1").innerText()) || /^1\.8\.\d /.test(await p.locator("h1").innerText()), "abre a resposta (documento novo) com código dentro do objeto: " + (await p.locator("h1").innerText()));
    // outra pasta já existente
    await p.locator('#lateral .li[data-pasta]', { hasText: "Canal do Malhado" }).first().click(); await p.waitForTimeout(200);
    ok(await p.locator("h2", { hasText: "Recebidos (1)" }).count() === 1, "o extraído está em Recebidos do objeto");
    // revisão do pipeline (_pipeline.json + subpastas por tipo)
    const rev = path.join(pastaObj, "RECEBIDOS"); fs.mkdirSync(path.join(rev, "CI"), { recursive: true }); fs.mkdirSync(path.join(rev, "SOLTOS"), { recursive: true });
    fs.copyFileSync(pdf, path.join(rev, "CI", "CI_SEDUC_045-2026_12-10-2026.pdf")); fs.copyFileSync(pdf, path.join(rev, "SOLTOS", "SOLTO_P7.pdf"));
    fs.writeFileSync(path.join(rev, "_pipeline.json"), JSON.stringify({ docs: [{ arquivo: "CI_SEDUC_045-2026_12-10-2026.pdf", tipo: "CI", paginas: "2-3", titulo: "COMUNICAÇÃO INTERNA", fecho: "Cargo do Signatário, 12/10" }] }));
    await p.evaluate(p0 => abrirRevisao(p0), rev); await p.waitForSelector("#tb-revi tbody tr[data-fk]");
    ok(await p.locator("#tb-revi tbody tr[data-fk]").count() === 2 && (await p.locator("#tb-revi").innerText()).includes("COMUNICAÇÃO INTERNA → Cargo do Signatário"), "revisão lista os PDFs separados com tipo, páginas e título→fecho do script");
    await p.locator('#tb-revi [data-chip]').first().click(); await p.locator(".pop-op", { hasText: "Arquivado" }).click(); await p.waitForTimeout(200);
    await p.locator('#tb-revi [data-chip]').nth(1).click(); await p.locator(".pop-op", { hasText: "Corrigir" }).click(); await p.waitForTimeout(200);
    await p.locator('#tb-revi input[type=text]').fill("oficio pgm nº 118/2026 10/10/2026"); await p.locator('#tb-revi input[type=text]').press("Enter"); await p.waitForTimeout(700);
    ok(fs.existsSync(path.join(rev, "SOLTOS", "OFICIO_PGM_118-2026_10-10-2026.pdf")), "Corrigir: renomeia o arquivo no padrão MAIÚSCULAS_COM_UNDERLINE");
    await p.locator("#tb-revi >> text=Voltar").first().click().catch(() => {}); await p.getByText("← Voltar").first().click(); await p.waitForTimeout(200);
    await p.locator("#b-cop").click(); await p.waitForTimeout(200);
    const t = await texto(); ok(/## Revisão de arquivos[\s\S]*CI_SEDUC_045-2026_12-10-2026\.pdf \[Arquivado\]/.test(t) && /## Recebidos/.test(t), "Copiar relatório inclui a revisão de arquivos e os recebidos");
    // últimos trabalhados: data de modificação da pasta
    const velho = new Date(Date.now() - 20 * 86400000); fs.utimesSync(pastaObj, velho, velho);
    await p.evaluate(() => { mtimesEm = 0; DB.ui.ordem = "rec"; }); await p.evaluate(async () => { await carregarMtimes(); desenharLateral(); }); await p.waitForTimeout(300);
    ok((await p.locator("#lat-lista .li").allInnerTexts()).length >= 2, "'Últimos trabalhados' usa a data da pasta (servidor)");
    // conversa: salva retorno na pasta e copia a mensagem
    await p.evaluate(() => { DB.ui.ordem = "num"; }); 
    const [pop] = await Promise.all([ctx.waitForEvent("page"), p.locator("#b-conv").click()]); await p.waitForTimeout(600);
    const msg = await texto(); const retorno = path.join(pastaObj, "RETORNO_OMEGA_rev1.txt");
    ok(/^Leia o relatório de retorno do Omega do objeto 1\.8 Canal do Malhado/.test(msg) && pop.url().startsWith("https://claude.ai/chat/abc-123") && fs.existsSync(retorno) && msg.includes(retorno), "Conversa: abre o link, salva o retorno na pasta e copia 'Leia o relatório de retorno…'");
    await pop.close();
    // segurança
    const seg = await p.evaluate(async () => [(await fetch("api/enviar?caminho=/etc&nome=x.txt", { method: "POST", body: "x" })).status, (await fetch("api/renomear", { method: "POST", body: JSON.stringify({ caminho: "/etc/hostname", novoNome: "y" }) })).status, (await fetch("api/executar", { method: "POST", body: JSON.stringify({ script: "ocr", caminho: "/etc/hostname" }) })).status, (await fetch("api/salvar", { method: "POST", body: JSON.stringify({ caminho: "/tmp", nome: "a.txt", texto: "x" }) })).status, (await fetch("api/listar-tudo?caminho=/etc")).status]);
    ok(seg.every(s => s === 403), "fora das pastas liberadas tudo é negado " + seg);
    ok(erros.length === 0, "sem erros no console " + erros.join(";"));
  } finally {
    await b.close(); srv.kill(); fs.rmSync(cfg, { force: true }); if (tinha) fs.renameSync(cfg + ".bak", cfg); fs.rmSync(path.join(RAIZ, "dados", "estado.json"), { force: true }); fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTUDO OK"); process.exit(falhas ? 1 : 0);
})();
