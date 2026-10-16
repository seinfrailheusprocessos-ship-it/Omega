// Teste da interface no computador: explorador, abas, divisão, paleta, troca rápida, busca, notas, histórico.
// node test/ui.test.mjs
import { chromium } from "playwright";
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const S = "/tmp/claude-0/-home-user-Omega/4509f1ec-d4e5-56fb-8705-e64f53ecd3fa/scratchpad";
const cofre = path.join(S, "cofre-ui");
const shots = path.join(S, "shots");
const PORTA = 27195, TOKEN = "TESTE123TESTE123TESTE123";
fs.rmSync(cofre, { recursive: true, force: true });
fs.rmSync(path.join(S, "srvdata-ui"), { recursive: true, force: true });
fs.mkdirSync(shots, { recursive: true });
execFileSync("python3", [path.join(raiz, "test/fixtures/gerar.py"), cofre]);
const srv = spawn("node", [path.join(raiz, "src/server/standalone.js"), "--root", cofre, "--data", path.join(S, "srvdata-ui"), "--port", String(PORTA), "--token", TOKEN, "--local"], { stdio: "ignore" });
await new Promise(r => setTimeout(r, 1500));
const falhas = [];
const ok = (c, m) => { console.log((c ? "ok   " : "FALHA ") + m); if (!c) falhas.push(m); };
const espera = ms => new Promise(r => setTimeout(r, ms));

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
try {
  const ctx = await b.newContext({ viewport: { width: 1400, height: 860 }, colorScheme: "dark", locale: "pt-BR" });
  const p = await ctx.newPage();
  const erros = [];
  p.on("pageerror", e => erros.push(e.message));
  p.on("console", m => { if (m.type() === "error") erros.push(m.text()); });
  await p.goto(`http://127.0.0.1:${PORTA}/#token=${TOKEN}`);
  await p.waitForFunction(() => window.tinteiro && document.body.classList.contains("is-ready"));
  await espera(500);
  // explorador
  ok(await p.locator(".nav-folder-title", { hasText: "Documentos" }).count() === 1, "explorador mostra as pastas");
  await p.locator(".nav-folder-title", { hasText: "Notas" }).click();
  await p.locator(".nav-file-title", { hasText: "Lista de tarefas" }).click();
  await p.waitForSelector(".cm-content");
  ok((await p.locator(".view-header-title").first().innerText()).includes("Lista de tarefas"), "clique no arquivo abre na aba");
  // editar nota (salva sozinho)
  await p.locator(".cm-content").click();
  await p.keyboard.press("Control+End");
  await p.keyboard.type("\n- [ ] Nova tarefa digitada");
  await espera(2000);
  ok(fs.readFileSync(path.join(cofre, "Notas/Lista de tarefas.md"), "utf8").includes("Nova tarefa digitada"), "nota salva sozinha no disco");
  // link interno abre a outra nota
  await p.locator(".cm-wikilink", { hasText: "Bem-vindo" }).first().click();
  await espera(800);
  ok((await p.locator(".view-header-title").first().innerText()).includes("Bem-vindo"), "link [[interno]] abre a nota");
  ok(await p.locator(".outline-item").count() >= 2, "painel Estrutura mostra os títulos");
  await p.screenshot({ path: path.join(shots, "ui-nota-escuro.png") });
  // voltar
  await p.keyboard.press("Control+Alt+ArrowLeft");
  await espera(600);
  ok((await p.locator(".view-header-title").first().innerText()).includes("Lista de tarefas"), "voltar (Ctrl+Alt+←)");
  // troca rápida
  await p.keyboard.press("Control+o");
  await p.waitForSelector(".prompt-input");
  await p.keyboard.type("orcam");
  await espera(300);
  await p.screenshot({ path: path.join(shots, "ui-troca-rapida.png") });
  await p.keyboard.press("Control+Enter");
  await espera(1500);
  ok((await p.locator(".workspace-tab-header").count()) >= 2, "troca rápida abre em nova aba (Ctrl+Enter)");
  // paleta de comandos: dividir à direita
  await p.keyboard.press("Control+p");
  await p.waitForSelector(".prompt-input");
  await p.keyboard.type("dividir dir");
  await espera(200);
  await p.screenshot({ path: path.join(shots, "ui-paleta.png") });
  await p.keyboard.press("Enter");
  await espera(1200);
  ok((await p.locator(".workspace-split.mod-root .workspace-tabs").count()) === 2, "paleta → dividir à direita cria 2 painéis");
  // abre um Word no painel da direita
  await p.evaluate(() => tinteiro.abrirArquivo("Documentos/Oficio teste.docx"));
  await p.waitForSelector("article p");
  await espera(800);
  await p.screenshot({ path: path.join(shots, "ui-dividido.png") });
  // busca global
  await p.keyboard.press("Control+Shift+F");
  await p.keyboard.type("abacaxi");
  await espera(1200);
  const resultados = await p.locator(".search-result").count();
  ok(resultados >= 2, `busca em todos os arquivos acha md e docx (${resultados})`);
  await p.screenshot({ path: path.join(shots, "ui-busca.png") });
  // HTML e imagem
  await p.evaluate(() => tinteiro.abrirArquivo("Relatorios/Relatorio exemplo.html"));
  await espera(1500);
  const frame = p.frameLocator("iframe.html-frame");
  ok((await frame.locator("h1").innerText()).includes("Relatório fictício"), "relatório HTML renderizado");
  ok(await frame.locator("img").evaluate(i => i.naturalWidth > 0), "HTML carrega imagem vizinha");
  await p.evaluate(() => tinteiro.abrirArquivo("Imagens/paisagem.jpg"));
  await espera(800);
  ok(await p.locator(".image-container img").evaluate(i => i.naturalWidth === 900), "imagem aberta");
  await p.evaluate(() => tinteiro.abrirArquivo("Outros/apresentacao-ficticia.pptx"));
  await espera(500);
  const nBotao = await p.locator(".workspace-leaf:not(.is-hidden-tab) button", { hasText: "Abrir no programa padrão" }).count();
  ok(nBotao >= 1, "outros formatos: botão abrir no programa padrão (" + nBotao + ")");
  // criar, renomear, excluir nota
  await p.evaluate(() => tinteiro.novaNota(""));
  await espera(800);
  await p.keyboard.type("Nota de teste");
  await p.keyboard.press("Enter");
  await p.keyboard.type("conteúdo novo");
  await espera(2500);
  ok(fs.existsSync(path.join(cofre, "Nota de teste.md")), "nova nota criada e renomeada pelo título");
  // histórico de versões: salva duas vezes e restaura
  await p.evaluate(async () => { await tinteiro.vault.write("Notas/Rascunho.txt", "versão 2", { explicit: true }); await tinteiro.vault.write("Notas/Rascunho.txt", "versão 3", { explicit: true }); });
  const vs = await p.evaluate(() => tinteiro.backend.history("Notas/Rascunho.txt"));
  ok(vs.length >= 2, `histórico guarda versões anteriores (${vs.length})`);
  await p.evaluate(async () => { const vs = await tinteiro.backend.history("Notas/Rascunho.txt"); await tinteiro.backend.restore("Notas/Rascunho.txt", vs[vs.length - 1].id); });
  ok(fs.readFileSync(path.join(cofre, "Notas/Rascunho.txt"), "utf8").startsWith("Rascunho em texto puro"), "restaurar versão antiga");
  await p.evaluate(() => tinteiro.abrirArquivo("Notas/Rascunho.txt"));
  await p.evaluate(() => tinteiro.mostrarHistorico());
  await espera(800);
  await p.screenshot({ path: path.join(shots, "ui-historico.png") });
  // configurações e tema claro
  await p.evaluate(() => tinteiro.abrirConfiguracoes("sincronizacao"));
  await espera(1000);
  await p.screenshot({ path: path.join(shots, "ui-config-sincronizacao.png") });
  await p.keyboard.press("Escape");
  await p.evaluate(() => { tinteiro.config.tema = "claro"; tinteiro.aplicarTema(); tinteiro.abrirArquivo("Bem-vindo.md"); });
  await espera(800);
  await p.screenshot({ path: path.join(shots, "ui-nota-claro.png") });
  await p.evaluate(() => tinteiro.abrirConfiguracoes("aparencia"));
  await espera(600);
  await p.screenshot({ path: path.join(shots, "ui-config-claro.png") });
  await p.keyboard.press("Escape");
  // persistência do layout
  await espera(1200);
  await p.reload();
  await p.waitForFunction(() => window.tinteiro && document.body.classList.contains("is-ready"));
  await espera(1000);
  ok((await p.locator(".workspace-split.mod-root .workspace-tabs").count()) === 2, "layout (painéis e abas) volta ao reabrir");
  ok(erros.length === 0, "sem erros no console: " + erros.join(" | "));
} finally {
  await b.close();
  srv.kill();
}
console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : "\nTODOS OS TESTES DA INTERFACE PASSARAM");
process.exit(falhas.length ? 1 : 0);
