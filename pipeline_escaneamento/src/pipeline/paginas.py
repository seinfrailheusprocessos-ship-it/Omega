"""Processamento de UMA página (roda em processos paralelos): rasteriza, corrige, faz OCR
e grava no cache (JPEG corrigido + JSON com texto e posição das palavras)."""
from __future__ import annotations

import json
import os
import time
import traceback

import cv2
import numpy as np

from . import imaging
from .ocr import criar_motor, texto_linhas
from .util import P, caminho_longo, escrever_atomico

_MOTOR = None
_CFG = None


def iniciar_worker(cfg: dict, motor_nome: str | None = None):
    global _MOTOR, _CFG
    os.environ.setdefault("OMP_THREAD_LIMIT", "1")
    os.environ.setdefault("OPENCV_FOR_THREADS_NUM", "1")
    try:
        cv2.setNumThreads(1)
    except Exception:
        pass
    _CFG = cfg
    _MOTOR = criar_motor(cfg, motor_nome)


def caminhos_cache(cache_dir: str, hash_arq: str, idx: int):
    base = os.path.join(cache_dir, hash_arq[:16])
    return os.path.join(base, f"p{idx:04d}.json"), os.path.join(base, f"p{idx:04d}.jpg")


def ler_cache(cache_dir, hash_arq, idx) -> dict | None:
    pj, _ = caminhos_cache(cache_dir, hash_arq, idx)
    try:
        with open(caminho_longo(pj), "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def imagem_cache(cache_dir, hash_arq, idx) -> np.ndarray | None:
    _, pjpg = caminhos_cache(cache_dir, hash_arq, idx)
    try:
        with open(caminho_longo(pjpg), "rb") as f:
            return cv2.imdecode(np.frombuffer(f.read(), np.uint8), cv2.IMREAD_GRAYSCALE)
    except Exception:
        return None


def processar_pagina(tarefa: dict) -> dict:
    """tarefa: {path, hash, idx, cache}. Nunca levanta exceção: devolve {'erro': ...}."""
    t0 = time.time()
    pj, pjpg = caminhos_cache(tarefa["cache"], tarefa["hash"], tarefa["idx"])
    try:
        ja = ler_cache(tarefa["cache"], tarefa["hash"], tarefa["idx"])
        if ja and ja.get("motor") == _MOTOR.nome and not ja.get("erro"):
            ja["_do_cache"] = True
            return ja
        cfg = _CFG
        gray, dpi = imaging.rasterizar(tarefa["path"], tarefa["idx"], int(cfg["ocr"]["dpi"]))
        h0, w0 = gray.shape
        tinta = imaging.fracao_tinta(gray)
        res = {"idx": tarefa["idx"], "dpi": dpi, "ink": round(tinta, 5), "motor": _MOTOR.nome,
               "blank": bool(tinta < float(cfg.get("pagina_em_branco_tinta", 0.0006))),
               "rot": 0, "skew": 0.0, "lines": [], "erro": None}
        if res["blank"]:
            res.update(w=w0, h=h0)
        else:
            img, info = imaging.corrigir_pagina(gray, _MOTOR, cfg)
            res.update(w=img.shape[1], h=img.shape[0], rot=info["rotacao"], skew=info["inclinacao"])
            bin_ocr = imaging.preparar_para_ocr(img)
            res["lines"] = _MOTOR.reconhecer(bin_ocr)
            _refinar_numeracao(bin_ocr, res["lines"])
            if tinta < 0.02 and sum(len(l["p"]) for l in res["lines"]) < 2:
                res["blank"] = True       # quase só sujeira: sem texto nenhum
                res["lines"] = []
            ok, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, int(cfg["ocr"].get("qualidade_jpeg", 75))])
            escrever_atomico(pjpg, buf.tobytes())
            if res["blank"]:
                res["motivo_branca"] = "sem texto reconhecível"
                escrever_atomico(pj, json.dumps(res, ensure_ascii=False))
                return res
            confs = [p[5] for l in res["lines"] for p in l["p"] if p[5] >= 0]
            res["conf"] = round(float(np.mean(confs)), 1) if confs else 0.0
        res["ms"] = int((time.time() - t0) * 1000)
        escrever_atomico(pj, json.dumps(res, ensure_ascii=False))
        return res
    except Exception as e:  # erro numa página nunca derruba o lote
        return {"idx": tarefa["idx"], "erro": f"{type(e).__name__}: {e}", "tb": traceback.format_exc()[-600:],
                "blank": False, "lines": [], "motor": getattr(_MOTOR, "nome", "?")}


def _refinar_numeracao(img, linhas: list):
    """Relê isoladamente as linhas de numeração (Pág. X/Y, Fls. N) no rodapé/topo: erro aqui atrapalha
    a ligação das páginas de continuação."""
    if not hasattr(_MOTOR, "refinar_linha"):
        return
    import re
    from .util import dobrar
    H = img.shape[0]
    for l in linhas:
        d = dobrar(l["t"])
        yc = (l["b"][1] + l["b"][3]) / 2 / H
        if (yc > 0.82 or yc < 0.08) and len(d) <= 26 and re.match(r"^(PAG|PAGINA|FLS?|FOLHA)\b", d):
            novo = _MOTOR.refinar_linha(img, l["b"])
            if novo and re.search(r"\d", novo) and dobrar(novo)[:3] == d[:3] and len(novo) <= len(l["t"]) + 6:
                x0, y0, x1, y1 = l["b"]
                partes = novo.split()
                larg = (x1 - x0) / max(len(partes), 1)
                l["t"] = novo
                l["p"] = [[t, int(x0 + k * larg), y0, int(x0 + (k + 1) * larg), y1, 90.0] for k, t in enumerate(partes)]


def texto_pagina(res: dict) -> str:
    return texto_linhas(res.get("lines", []))
