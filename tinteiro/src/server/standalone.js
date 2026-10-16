// Roda o servidor sem o Electron (testes ou uso pelo navegador).  node src/server/standalone.js --root PASTA [--port N] [--data PASTA]
"use strict";
const path = require("path");
const os = require("os");
const { Config } = require("./config");
const { criarServidor } = require("./server");

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf("--" + k); return i >= 0 ? args[i + 1] : d; };
const dataDir = arg("data", path.join(os.homedir(), ".tinteiro-servidor"));
const config = new Config(dataDir);
if (arg("root")) config.set("root", path.resolve(arg("root")));
if (arg("port")) config.set("port", Number(arg("port")));
if (arg("token")) config.set("token", arg("token"));
if (args.includes("--local")) config.set("lan", false);
const pkg = require("../../package.json");
const srv = criarServidor({
  config, webDir: arg("web") ? path.resolve(arg("web")) : path.resolve(__dirname, "../../dist/web"), versao: pkg.version,
  hooks: { openPath: async () => "indisponível fora do app", reveal: () => {} },
});
srv.iniciar().then(r => {
  console.log(`Tinteiro servidor em ${r.url}/#token=${r.token}`);
  console.log(`raiz: ${config.get("root")}`);
});
