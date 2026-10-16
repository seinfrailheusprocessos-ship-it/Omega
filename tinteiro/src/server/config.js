// Configuração do app no computador (fora do cofre): pasta raiz, porta, código de pareamento.
"use strict";
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

function raizPadrao() {
  if (process.platform === "win32") return "C:\\CL";
  return path.join(os.homedir(), "CL");
}

function novoCodigo() { return crypto.randomBytes(18).toString("base64url"); }

class Config {
  constructor(dir) {
    this.dir = dir;
    this.arquivo = path.join(dir, "config.json");
    this.dados = {};
    try { this.dados = JSON.parse(fs.readFileSync(this.arquivo, "utf8")); } catch (e) {}
    let mudou = false;
    const pad = { root: raizPadrao(), port: 27182, lan: true, token: null, deviceName: os.hostname() };
    for (const [k, v] of Object.entries(pad)) if (this.dados[k] === undefined || this.dados[k] === null) { this.dados[k] = v; mudou = true; }
    if (!this.dados.token) { this.dados.token = novoCodigo(); mudou = true; }
    if (mudou) this.salvar();
  }
  get(k) { return this.dados[k]; }
  set(k, v) { this.dados[k] = v; this.salvar(); }
  novoToken() { this.dados.token = novoCodigo(); this.salvar(); return this.dados.token; }
  salvar() {
    fs.mkdirSync(this.dir, { recursive: true });
    fs.writeFileSync(this.arquivo, JSON.stringify(this.dados, null, 2));
  }
}

module.exports = { Config, raizPadrao };
