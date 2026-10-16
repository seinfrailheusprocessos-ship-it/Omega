// Gera o PDF final com o pdf-lib: ordem/rotação/exclusão/inserção de páginas e anotações
// "achatadas" no conteúdo da página. O documento original é alterado no lugar (mantém sumário,
// formulários e metadados); objetos que ficaram sem uso (páginas excluídas) são descartados.
import {
  PDFDocument, PDFName, PDFDict, PDFArray, PDFRef, PDFStream, StandardFonts, BlendMode, rgb, degrees,
  pushGraphicsState, popGraphicsState, setLineWidth, setLineCap, setLineJoin, LineCapStyle, LineJoinStyle, setStrokingColor,
  moveTo, lineTo, appendBezierCurve, stroke,
} from "pdf-lib";
import { layoutTexto, pontoDaCaixa, BASE_LINHA, MARGEM_TEXTO } from "./anotacoes.js";

export function corRgb(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(hex || "#000000") || [0, "00", "00", "00"];
  return rgb(parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255);
}

const OPCOES_LEITURA = { updateMetadata: false, ignoreEncryption: false, throwOnInvalidObject: false };

/**
 * fontes: [{ id, bytes }]   (a primeira é o arquivo aberto)
 * paginas: [{ fonte, indice, rot, anots }]   na ordem final
 * info(p): { view: [x0, y0, x1, y1], rotate }   (dados da página original, vindos do pdf.js)
 * imagens: Map(id → { bytes, tipo: "png"|"jpg" })
 */
export async function gerarPdf({ fontes, paginas, info, imagens }) {
  const principal = fontes[0];
  const doc = await PDFDocument.load(principal.bytes, OPCOES_LEITURA);
  const originais = doc.getPages();
  const usadasPrincipal = new Set();

  // 1) páginas que vêm de outros arquivos (ou repetidas) são copiadas de uma vez por arquivo
  const pedidos = new Map();
  for (const p of paginas) {
    if (p.fonte === principal.id && !usadasPrincipal.has(p.indice)) { usadasPrincipal.add(p.indice); continue; }
    if (!pedidos.has(p.fonte)) pedidos.set(p.fonte, []);
    pedidos.get(p.fonte).push(p.indice);
  }
  const filas = new Map();
  for (const [fid, indices] of pedidos) {
    const f = fontes.find(x => x.id === fid);
    const src = await PDFDocument.load(f.bytes, OPCOES_LEITURA);
    const copiadas = await doc.copyPages(src, indices);
    const m = new Map();
    indices.forEach((i, k) => { if (!m.has(i)) m.set(i, []); m.get(i).push(copiadas[k]); });
    filas.set(fid, m);
  }
  const usadas = new Set();
  const ordem = paginas.map(p => {
    if (p.fonte === principal.id && !usadas.has(p.indice)) { usadas.add(p.indice); return [p, originais[p.indice]]; }
    return [p, filas.get(p.fonte).get(p.indice).shift()];
  });

  // 2) rotação e anotações
  let fonte = null;
  const embutidas = new Map();
  for (const [p, pg] of ordem) {
    const inf = info(p);
    pg.setRotation(degrees((((inf.rotate || 0) + (p.rot || 0)) % 360 + 360) % 360));
    if (!p.anots?.length) continue;
    if (!fonte && p.anots.some(a => a.tipo === "texto")) fonte = await doc.embedFont(StandardFonts.Helvetica);
    for (const a of p.anots) {
      if (a.tipo === "imagem" && !embutidas.has(a.img)) {
        const im = imagens.get(a.img);
        if (!im) continue;
        embutidas.set(a.img, im.tipo === "jpg" ? await doc.embedJpg(im.bytes) : await doc.embedPng(im.bytes));
      }
    }
    desenharNaPagina(pg, p.anots, inf.view, fonte, embutidas);
  }

  // 3) nova árvore de páginas, na ordem final (herdando atributos dos nós antigos)
  const ctx = doc.context;
  const herdaveis = ["Resources", "MediaBox", "CropBox", "Rotate"].map(n => PDFName.of(n));
  for (const [, pg] of ordem) {
    for (const n of herdaveis) {
      if (!pg.node.get(n)) { const v = pg.node.getInheritableAttribute(n); if (v) pg.node.set(n, v); }
    }
  }
  const arvoreRef = ctx.register(ctx.obj({ Type: "Pages", Kids: ordem.map(([, pg]) => pg.ref), Count: ordem.length }));
  for (const [, pg] of ordem) pg.node.set(PDFName.of("Parent"), arvoreRef);
  doc.catalog.set(PDFName.of("Pages"), arvoreRef);

  // 4) descarta o que ficou sem uso (inclusive o conteúdo das páginas excluídas)
  const excluidas = new Set();
  originais.forEach((pg, i) => { if (!usadas.has(i)) excluidas.add(pg.ref.toString()); });
  coletarLixo(doc, excluidas);

  doc.setModificationDate(new Date());
  return await doc.save({ addDefaultPage: false, useObjectStreams: true, updateFieldAppearances: false });
}

/** apaga objetos que não são mais alcançáveis a partir do catálogo/informações */
function coletarLixo(doc, excluidas) {
  const ctx = doc.context;
  const vistos = new Set();
  const pilha = [ctx.trailerInfo.Root, ctx.trailerInfo.Info].filter(Boolean);
  while (pilha.length) {
    const o = pilha.pop();
    if (o instanceof PDFRef) {
      const k = o.toString();
      if (vistos.has(k) || excluidas.has(k)) continue;
      vistos.add(k);
      const alvo = ctx.lookup(o);
      if (alvo) pilha.push(alvo);
    } else if (o instanceof PDFDict) {
      for (const [, v] of o.entries()) pilha.push(v);
    } else if (o instanceof PDFArray) {
      for (let i = 0; i < o.size(); i++) pilha.push(o.get(i));
    } else if (o instanceof PDFStream) {
      pilha.push(o.dict);
    }
  }
  for (const [ref] of ctx.enumerateIndirectObjects()) if (!vistos.has(ref.toString())) ctx.delete(ref);
}

function desenharNaPagina(pg, anots, view, fonte, embutidas) {
  const [x0, , , y1] = view;
  const P = (x, y) => [x0 + x, y1 - y];
  for (const a of anots) {
    switch (a.tipo) {
      case "destaque":
        for (const r of a.rects) pg.drawRectangle({ x: x0 + r.x, y: y1 - r.y - r.h, width: r.w, height: r.h, color: corRgb(a.cor), opacity: 0.4, blendMode: BlendMode.Multiply });
        break;
      case "retangulo":
        pg.drawRectangle({ x: x0 + a.x, y: y1 - a.y - a.h, width: a.w, height: a.h, borderColor: corRgb(a.cor), borderWidth: a.esp });
        break;
      case "tinta": {
        const pts = a.pontos.map(([x, y]) => P(x, y));
        if (!pts.length) break;
        const ops = [pushGraphicsState(), setStrokingColor(corRgb(a.cor)), setLineWidth(a.esp), setLineCap(LineCapStyle.Round), setLineJoin(LineJoinStyle.Round), moveTo(...pts[0])];
        if (pts.length === 1) ops.push(lineTo(pts[0][0] + 0.01, pts[0][1]));
        else if (pts.length === 2) ops.push(lineTo(...pts[1]));
        else {
          let [sx, sy] = pts[0];
          for (let i = 1; i < pts.length - 1; i++) {
            const [cx, cy] = pts[i];
            const ex = (pts[i][0] + pts[i + 1][0]) / 2, ey = (pts[i][1] + pts[i + 1][1]) / 2;
            ops.push(appendBezierCurve(sx + (cx - sx) * 2 / 3, sy + (cy - sy) * 2 / 3, ex + (cx - ex) * 2 / 3, ey + (cy - ey) * 2 / 3, ex, ey));
            sx = ex; sy = ey;
          }
          ops.push(lineTo(...pts[pts.length - 1]));
        }
        ops.push(stroke(), popGraphicsState());
        pg.pushOperators(...ops);
        break;
      }
      case "texto": {
        if (!fonte) break;
        const { linhas, lh } = layoutTexto(a);
        linhas.forEach((linha, i) => {
          if (!linha.trim()) return;
          const [px, py] = P(...pontoDaCaixa(a, MARGEM_TEXTO, MARGEM_TEXTO + i * lh + a.tam * BASE_LINHA));
          pg.drawText(linha, { x: px, y: py, size: a.tam, font: fonte, color: corRgb(a.cor), rotate: degrees(a.rot || 0) });
        });
        break;
      }
      case "imagem": {
        const im = embutidas.get(a.img);
        if (!im) break;
        const [px, py] = P(...pontoDaCaixa(a, 0, a.ch));
        pg.drawImage(im, { x: px, y: py, width: a.cw, height: a.ch, rotate: degrees(a.rot || 0) });
        break;
      }
    }
  }
}

/** só para descobrir rapidamente se o arquivo é protegido/assinado (sem carregar tudo) */
export function examinarBytes(bytes) {
  const n = bytes.length;
  // procura no texto "cru" (objetos de dicionário costumam estar descomprimidos)
  const dec = new TextDecoder("latin1");
  const passo = 4 * 1024 * 1024;
  let protegido = false, assinado = false;
  for (let i = 0; i < n; i += passo - 32) {
    const t = dec.decode(bytes.subarray(i, Math.min(n, i + passo)));
    if (!protegido && /\/Encrypt\s*(\d+\s+\d+\s+R|<<)/.test(t)) protegido = true;
    if (!assinado && /\/ByteRange\s*\[/.test(t) && /\/Sig\b/.test(t)) assinado = true;
    if (protegido && assinado) break;
  }
  return { protegido, assinado };
}

