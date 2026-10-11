// Servidor local do Ômega: serve esta pasta e guarda dados/estado.json.
// Uso:  node servidor.js        (depois abra http://localhost:8765)
// Não precisa instalar nada além do Node. Só aceita gravar dados/estado.json.
const http = require("http"), fs = require("fs"), path = require("path"), os = require("os");
const RAIZ = __dirname, PORTA = Number(process.env.PORTA) || 8765;
const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json" };
http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || "/").split("?")[0]);
  const rel = url === "/" ? "/index.html" : url;
  const arq = path.normalize(path.join(RAIZ, rel));
  if (!arq.startsWith(RAIZ)) { res.writeHead(403); return res.end(); }
  if (req.method === "PUT") {
    if (rel !== "/dados/estado.json") { res.writeHead(403); return res.end(); }
    let n = 0; const partes = [];
    req.on("data", c => { n += c.length; if (n > 20e6) { res.writeHead(413); res.end(); req.destroy(); } else partes.push(c); });
    req.on("end", () => { try { fs.mkdirSync(path.join(RAIZ, "dados"), { recursive: true }); fs.writeFileSync(arq, Buffer.concat(partes)); res.writeHead(204); } catch (e) { res.writeHead(500); } res.end(); });
    return;
  }
  if (req.method !== "GET") { res.writeHead(405); return res.end(); }
  fs.readFile(arq, (e, dados) => {
    if (e) { res.writeHead(404); return res.end("Não encontrado"); }
    res.writeHead(200, { "Content-Type": TIPOS[path.extname(arq)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(dados);
  });
}).listen(PORTA, "0.0.0.0", () => {
  console.log("Ômega no ar.\n  No computador:  http://localhost:" + PORTA);
  Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === "IPv4" && !i.internal).forEach(i => console.log("  No celular (mesma rede Wi-Fi):  http://" + i.address + ":" + PORTA));
  console.log("Deixe esta janela aberta. Para parar, feche a janela (ou Ctrl+C).");
});
