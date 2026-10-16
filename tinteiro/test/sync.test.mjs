// Teste da versão de celular (cópia local + sincronização com o computador).  node test/sync.test.mjs
import { chromium } from "playwright";
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const S = "/tmp/claude-0/-home-user-Omega/4509f1ec-d4e5-56fb-8705-e64f53ecd3fa/scratchpad";
const cofre = path.join(S, "cofre-sync");
const shots = path.join(S, "shots");
const PORTA = 27194, TOKEN = "TESTE123TESTE123TESTE123";
fs.rmSync(cofre, { recursive: true, force: true });
fs.rmSync(path.join(S, "srvdata-sync"), { recursive: true, force: true });
fs.mkdirSync(shots, { recursive: true });
execFileSync("python3", [path.join(raiz, "test/fixtures/gerar.py"), cofre]);
const srv = spawn("node", [path.join(raiz, "src/server/standalone.js"), "--root", cofre, "--data", path.join(S, "srvdata-sync"), "--port", String(PORTA), "--token", TOKEN], { stdio: "ignore" });
await new Promise(r => setTimeout(r, 1500));
const falhas = [];
const ok = (c, m) => { console.log((c ? "ok   " : "FALHA ") + m); if (!c) falhas.push(m); };
const ler = p => fs.readFileSync(path.join(cofre, p), "utf8");
const espera = ms => new Promise(r => setTimeout(r, ms));

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
try {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, colorScheme: "dark", locale: "pt-BR" });
  const p = await ctx.newPage();
  const erros = [];
  p.on("pageerror", e => erros.push(e.message));
  p.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) erros.push(m.text()); });
  await p.goto(`http://127.0.0.1:${PORTA}/?modo=local#pair=${TOKEN}`);
  await p.waitForFunction(() => window.tinteiro && document.body.classList.contains("is-ready"), null, { timeout: 15000 });
  ok(await p.evaluate(() => document.body.classList.contains("is-mobile")), "layout de celular ativo");
  const sync = () => p.evaluate(async () => { const r = await tinteiro.backend.sync.sincronizar(); await tinteiro.vault.refresh(); return r; });
  ok(await sync(), "primeira sincronização");
  const lista = await p.evaluate(() => tinteiro.vault.files().map(f => f.path));
  ok(lista.includes("Documentos/Termo de Referencia ficticio.docx") && lista.includes("Bem-vindo.md"), `arquivos do computador chegaram (${lista.length})`);
  ok(await p.evaluate(async () => (await tinteiro.backend.banco.all("arquivos")).filter(r => r.type === "file").every(r => r.temDados)), "todos disponíveis offline");

  // celular → computador
  await p.evaluate(() => tinteiro.backend.write("Bem-vindo.md", "# Editado no celular\n\nTexto novo.\n", { explicit: true }));
  await sync();
  ok(ler("Bem-vindo.md").includes("Editado no celular"), "edição do celular chegou no computador");
  ok(fs.existsSync(path.join(cofre, ".tinteiro/historico/Bem-vindo.md")), "computador guardou a versão anterior");

  // computador → celular
  fs.writeFileSync(path.join(cofre, "Notas/Rascunho.txt"), "Mudado no computador.\n");
  await espera(50);
  await sync();
  ok((await p.evaluate(() => tinteiro.backend.readText("Notas/Rascunho.txt"))).includes("Mudado no computador"), "edição do computador chegou no celular");

  // criado no celular (com pasta nova)
  await p.evaluate(async () => { await tinteiro.backend.mkdir("Celular"); await tinteiro.backend.create("Celular/Nota do celular.md", "Criada no celular"); });
  await sync();
  ok(fs.existsSync(path.join(cofre, "Celular/Nota do celular.md")), "arquivo criado no celular foi para o computador");

  // conflito: os dois lados mudam
  await p.evaluate(() => tinteiro.backend.write("Notas/Lista de tarefas.md", "versão do celular", { explicit: true }));
  fs.writeFileSync(path.join(cofre, "Notas/Lista de tarefas.md"), "versão do computador");
  await espera(50);
  await sync();
  const notas = fs.readdirSync(path.join(cofre, "Notas"));
  ok(ler("Notas/Lista de tarefas.md") === "versão do computador", "no conflito, o computador mantém a sua versão");
  ok(notas.some(n => n.includes("conflito celular")), "no conflito, a versão do celular virou cópia no computador");
  ok((await p.evaluate(() => tinteiro.backend.readText("Notas/Lista de tarefas.md"))) === "versão do computador", "celular recebeu a versão do computador");

  // renomear e apagar no celular
  await p.evaluate(() => tinteiro.vault.rename("Relatorios/Relatorio exemplo.html", "Relatorios/Relatorio renomeado.html"));
  await p.evaluate(() => tinteiro.vault.remove("Outros/apresentacao-ficticia.pptx"));
  await sync();
  ok(fs.existsSync(path.join(cofre, "Relatorios/Relatorio renomeado.html")) && !fs.existsSync(path.join(cofre, "Relatorios/Relatorio exemplo.html")), "renomeado no celular → renomeado no computador");
  ok(!fs.existsSync(path.join(cofre, "Outros/apresentacao-ficticia.pptx")), "apagado no celular → foi para a lixeira do computador");

  // apagar no computador
  fs.rmSync(path.join(cofre, "Imagens/paisagem.jpg"));
  await sync();
  ok(!(await p.evaluate(() => tinteiro.vault.exists("Imagens/paisagem.jpg"))), "apagado no computador → some do celular");

  // offline: servidor desligado, abrir e editar continua funcionando (interface vem do cache do service worker)
  await p.evaluate(async () => { const reg = await navigator.serviceWorker.ready; await new Promise(r => setTimeout(r, 1500)); return !!reg.active; });
  srv.kill(); await espera(500);
  await p.reload();
  await p.waitForFunction(() => window.tinteiro && document.body.classList.contains("is-ready"), null, { timeout: 15000 });
  ok((await p.evaluate(() => tinteiro.vault.files().length)) > 5, "app abre sem o computador (offline) com os arquivos");
  await p.evaluate(() => tinteiro.abrirArquivo("Documentos/Termo de Referencia ficticio.docx"));
  await p.waitForSelector("article p", { timeout: 15000 });
  ok(true, "abre documento sem o computador (offline)");
  const r = await p.evaluate(async () => tinteiro.backend.sync.sincronizar());
  ok(r === false && (await p.evaluate(() => tinteiro.backend.sync.estado)) === "sem-conexao", "sem o computador: avisa sem travar");
  await p.screenshot({ path: path.join(shots, "celular-docx.png") });
  // telas do celular
  await p.evaluate(() => tinteiro.abrirArquivo("Bem-vindo.md"));
  await espera(800);
  await p.screenshot({ path: path.join(shots, "celular-nota.png") });
  await p.evaluate(() => tinteiro.mobile.abrirGaveta("left"));
  await espera(500);
  await p.screenshot({ path: path.join(shots, "celular-gaveta.png") });
  await p.evaluate(() => tinteiro.mobile.fecharGavetas());
  await espera(400);
  await p.evaluate(() => tinteiro.abrirConfiguracoes("sincronizacao"));
  await espera(800);
  await p.screenshot({ path: path.join(shots, "celular-sincronizacao.png") });
  ok(erros.length === 0, "sem erros no console: " + erros.join(" | "));
} finally {
  await b.close();
  try { srv.kill(); } catch (e) {}
}
console.log(falhas.length ? `\n${falhas.length} FALHA(S)` : "\nTODOS OS TESTES DE SINCRONIZAÇÃO PASSARAM");
process.exit(falhas.length ? 1 : 0);
