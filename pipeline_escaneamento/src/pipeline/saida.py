"""Geração dos PDFs pesquisáveis (imagem + camada de texto invisível) a partir do cache."""
from __future__ import annotations

import os

import cv2
import numpy as np
import pymupdf as fitz

from . import imaging
from .paginas import imagem_cache, caminhos_cache
from .util import P, caminho_longo, escrever_atomico

_FONTE = None


def _fonte():
    global _FONTE
    if _FONTE is None:
        _FONTE = fitz.Font("helv")
    return _FONTE


def _limpo(t: str) -> str:
    return t.encode("cp1252", errors="replace").decode("cp1252").replace("�", "?")


def _jpeg_bytes_cache(cache, hash_, idx):
    _, pjpg = caminhos_cache(cache, hash_, idx)
    try:
        with open(caminho_longo(pjpg), "rb") as f:
            return f.read()
    except OSError:
        return None


def adicionar_pagina(doc, jpg: bytes | None, res: dict, caminho_origem: str, idx: int, qualidade: int = 60):
    """Acrescenta uma página ao PDF: imagem corrigida + palavras invisíveis nas posições do OCR."""
    dpi = res.get("dpi") or 300
    if jpg is None:   # página em branco/erro: rasteriza em baixa resolução só para manter o lote completo
        try:
            g, d2 = imaging.rasterizar(caminho_origem, idx, 100)
            ok, buf = cv2.imencode(".jpg", g, [cv2.IMWRITE_JPEG_QUALITY, 50])
            jpg, dpi = buf.tobytes(), d2
            w, h = g.shape[1], g.shape[0]
        except Exception:
            w, h = res.get("w", 827), res.get("h", 1169)
            dpi = 100
            ok, buf = cv2.imencode(".jpg", np.full((h, w), 255, np.uint8))
            jpg = buf.tobytes()
        linhas = []
    else:
        w, h = res["w"], res["h"]
        linhas = res.get("lines", [])
    esc = 72.0 / dpi
    pg = doc.new_page(width=w * esc, height=h * esc)
    pg.insert_image(pg.rect, stream=jpg)
    if linhas:
        tw = fitz.TextWriter(pg.rect)
        f = _fonte()
        for l in linhas:
            for palavra, x0, y0, x1, y1, _c in l["p"]:
                t = _limpo(palavra)
                if not t.strip():
                    continue
                alt = max((y1 - y0) * esc, 3.0)
                larg = max((x1 - x0) * esc, 1.0)
                comp1 = f.text_length(t, fontsize=1) or 1.0
                fs = min(max(larg / comp1, 2.0), alt * 1.4)
                try:
                    tw.append((x0 * esc, y1 * esc - alt * 0.2), t, font=f, fontsize=fs)
                except Exception:
                    continue
        try:
            tw.write_text(pg, render_mode=3)
        except TypeError:
            tw.write_text(pg)   # versões antigas: sem render_mode (texto visível) - não esperado


def montar_pdf_lote(path_origem, hash_, n_paginas, resultados: list[dict], cache, titulo: str, destino: str,
                    qualidade=60):
    doc = fitz.open()
    for i in range(n_paginas):
        res = resultados[i]
        jpg = None if (res.get("blank") or res.get("erro")) else _jpeg_bytes_cache(cache, hash_, i)
        adicionar_pagina(doc, jpg, res, path_origem, i, qualidade)
    doc.set_metadata({"title": titulo, "producer": "Pipeline de Escaneamento SEINFRA"})
    dados = doc.tobytes(garbage=3, deflate=True)
    escrever_atomico(destino, dados)
    return doc


def _salvar(doc, destino: str):
    """Grava pelo Python (aceita caminhos longos e com espaço no fim, no Windows)."""
    dados = doc.tobytes(garbage=3, deflate=True)
    doc.close()
    escrever_atomico(destino, dados)


def extrair_paginas(lote_doc, indices: list[int], destino: str, titulo: str, assunto: str = ""):
    """Novo PDF só com as páginas pedidas (0-based, na ordem dada), copiadas do PDF do lote em memória."""
    novo = fitz.open()
    for i in indices:
        novo.insert_pdf(lote_doc, from_page=i, to_page=i)
    novo.set_metadata({"title": titulo, "subject": assunto, "producer": "Pipeline de Escaneamento SEINFRA"})
    _salvar(novo, destino)
