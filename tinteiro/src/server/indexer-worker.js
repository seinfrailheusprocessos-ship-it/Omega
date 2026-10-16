// Worker: lê um arquivo e devolve o texto pesquisável.
"use strict";
const { parentPort } = require("worker_threads");
const fs = require("fs");
let libs = null;

async function carregarLibs() {
  if (libs) return libs;
  libs = { JSZip: require("jszip") };
  try { libs.pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs"); } catch (e) { libs.pdfjs = null; }
  return libs;
}

let extrairTexto = null;
parentPort.on("message", async ({ id, abs, rel }) => {
  let text = "";
  try {
    if (!extrairTexto) extrairTexto = (await import("../shared/text-extract.mjs")).extrairTexto;
    const dados = new Uint8Array(fs.readFileSync(abs));
    text = await extrairTexto(rel, dados, await carregarLibs());
  } catch (e) { text = ""; }
  parentPort.postMessage({ id, text });
});
