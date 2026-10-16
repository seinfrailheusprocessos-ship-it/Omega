// Tailscale (opcional, gratuito): dá ao computador um endereço seguro (https) que o celular alcança de qualquer lugar.
"use strict";
const { execFile } = require("child_process");
const fs = require("fs");

function binario() {
  if (process.platform === "win32") {
    for (const p of ["C:\\Program Files\\Tailscale\\tailscale.exe", "C:\\Program Files (x86)\\Tailscale\\tailscale.exe"]) if (fs.existsSync(p)) return p;
    return null;
  }
  for (const p of ["/usr/bin/tailscale", "/usr/local/bin/tailscale", "/Applications/Tailscale.app/Contents/MacOS/Tailscale"]) if (fs.existsSync(p)) return p;
  return null;
}

function rodar(args, timeout = 15000) {
  const b = binario();
  if (!b) return Promise.reject(new Error("Tailscale não instalado"));
  return new Promise((resolve) => {
    execFile(b, args, { timeout, windowsHide: true }, (err, stdout, stderr) => resolve({ ok: !err, out: String(stdout || ""), err: String(stderr || (err && err.message) || "") }));
  });
}

async function status() {
  if (!binario()) return { installed: false };
  const r = await rodar(["status", "--json"]);
  if (!r.ok) return { installed: true, running: false, error: r.err.slice(0, 300) };
  let j; try { j = JSON.parse(r.out); } catch (e) { return { installed: true, running: false }; }
  const self = j.Self || {};
  const dns = (self.DNSName || "").replace(/\.$/, "");
  const serve = await rodar(["serve", "status", "--json"]).catch(() => ({ ok: false, out: "" }));
  let servindo = false;
  try { const sj = JSON.parse(serve.out || "{}"); servindo = !!(sj.TCP && (sj.TCP["443"] || sj.TCP[443])); } catch (e) {}
  return { installed: true, running: j.BackendState === "Running", dnsName: dns, ip: (self.TailscaleIPs || [])[0] || null, httpsUrl: dns ? `https://${dns}` : null, serving: servindo };
}

async function serve(porta) {
  const r = await rodar(["serve", "--bg", "--https=443", `http://127.0.0.1:${porta}`], 30000);
  const texto = (r.out + "\n" + r.err).trim();
  const link = (texto.match(/https:\/\/login\.tailscale\.com\/\S+/) || [])[0] || null;
  return { ok: r.ok, message: texto.slice(0, 600), enableUrl: link, status: await status().catch(() => null) };
}

module.exports = { status, serve, binario };
