"""Motores de OCR (Tesseract e RapidOCR) com a mesma interface.

Cada motor devolve LINHAS: {"t": texto, "b": [x0,y0,x1,y1], "p": [[palavra,x0,y0,x1,y1,conf], ...]}
com coordenadas em pixels da imagem recebida.
"""
from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys

import numpy as np

from .config import RAIZ_PROJETO
from .util import dobrar

STOPWORDS = {"DE", "DA", "DO", "DAS", "DOS", "EM", "PARA", "COM", "QUE", "UMA", "POR", "NA", "NO",
             "AS", "OS", "AO", "SE", "UM", "NAO", "MAIS", "COMO", "SUA", "SEU", "ESTA", "ESTE"}


def pontuar_texto(texto: str) -> tuple[float, int]:
    """(fração de stopwords do português entre as palavras, quantidade) - usado para achar
    a orientação certa da página sem depender do Tesseract OSD."""
    toks = re.findall(r"[A-Za-zÀ-ÿ]{2,}", texto or "")
    if not toks:
        return 0.0, 0
    hits = sum(1 for t in toks if dobrar(t) in STOPWORDS)
    return hits / max(len(toks), 8), hits


def _png(img: np.ndarray) -> bytes:
    import cv2
    ok, buf = cv2.imencode(".png", img, [cv2.IMWRITE_PNG_COMPRESSION, 1])
    if not ok:
        raise RuntimeError("falha ao codificar imagem")
    return buf.tobytes()


# ------------------------------------------------------------------ Tesseract
def achar_tesseract(cfg=None) -> str | None:
    cand = []
    if cfg and cfg.get("ocr", {}).get("tesseract_caminho"):
        cand.append(cfg["ocr"]["tesseract_caminho"])
    exe = "tesseract.exe" if os.name == "nt" else "tesseract"
    cand.append(str(RAIZ_PROJETO / "tools" / "tesseract" / exe))
    w = shutil.which("tesseract")
    if w:
        cand.append(w)
    if os.name == "nt":
        for base in (os.environ.get("ProgramFiles"), os.environ.get("ProgramFiles(x86)"),
                     os.path.join(os.environ.get("LOCALAPPDATA", ""), "Programs")):
            if base:
                cand.append(os.path.join(base, "Tesseract-OCR", "tesseract.exe"))
    for c in cand:
        if c and os.path.isfile(c):
            return c
    return None


class MotorTesseract:
    nome = "tesseract"

    def __init__(self, exe: str, idioma: str = "por", psm: int = 3):
        self.exe, self.idioma, self.psm = exe, idioma, psm
        self.env = dict(os.environ)
        self.env["OMP_THREAD_LIMIT"] = "1"
        td = RAIZ_PROJETO / "tools" / "tessdata"
        if td.is_dir():
            self.env["TESSDATA_PREFIX"] = str(td)
        self._flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0

    def _rodar(self, img, *extra) -> str:
        cmd = [self.exe, "stdin", "stdout", "-l", self.idioma, "--psm", str(self.psm), *extra]
        r = subprocess.run(cmd, input=_png(img), capture_output=True, env=self.env,
                           creationflags=self._flags, timeout=300)
        if r.returncode != 0:
            raise RuntimeError("tesseract: " + r.stderr.decode("utf-8", "replace")[:300])
        return r.stdout.decode("utf-8", "replace")

    def texto_rapido(self, img) -> str:
        return self._rodar(img)

    def refinar_linha(self, img, box) -> str | None:
        """Relê uma linha curta (ex.: 'Pág. 3/3') isolada e ampliada: no meio da página o Tesseract
        costuma perder a barra e ler 'Pág. 33'."""
        import cv2
        x0, y0, x1, y1 = box
        crop = img[max(0, y0 - 10):y1 + 10, max(0, x0 - 20):x1 + 20]
        if crop.size == 0:
            return None
        antigo, self.psm = self.psm, 7
        melhor = None
        try:
            for f in (3, 2, 4):
                c = cv2.resize(crop, None, fx=f, fy=f, interpolation=cv2.INTER_CUBIC)
                c = cv2.copyMakeBorder(c, 30, 30, 30, 30, cv2.BORDER_CONSTANT, value=255)
                t = self._rodar(c).strip()
                melhor = melhor or t
                if re.search(r"\d\s*/\s*\d|\bDE\b|\bde\b", t):
                    return t
            return melhor
        except Exception:
            return None
        finally:
            self.psm = antigo

    def pontuar_orientacao(self, img) -> tuple[float, int]:
        """(qualidade, evidências) da orientação testada. Combina a fração de palavras comuns do
        português com a quantidade de letras reconhecidas com confiança (funciona também em páginas
        quase vazias, ex.: só a assinatura)."""
        tsv = self._rodar(img, "tsv")
        palavras, boas = [], 0
        for ln in tsv.splitlines()[1:]:
            c = ln.split("\t")
            if len(c) < 12 or c[0] != "5" or not c[11].strip():
                continue
            t = c[11].strip()
            palavras.append(t)
            try:
                conf = float(c[10])
            except ValueError:
                conf = 0.0
            letras = len(re.findall(r"[A-Za-z\u00c0-\u00ff]", t))
            if conf >= 70 and letras >= 3:
                boas += letras
        sc, n = pontuar_texto(" ".join(palavras))
        return sc + min(0.15, boas / 1000.0), n       # n = palavras comuns do português (evidência forte)

    def reconhecer(self, img) -> list[dict]:
        tsv = self._rodar(img, "tsv")
        linhas: dict[tuple, dict] = {}
        for ln in tsv.splitlines()[1:]:
            c = ln.split("\t")
            if len(c) < 12 or c[0] != "5":
                continue
            txt = c[11].strip()
            if not txt:
                continue
            try:
                conf = float(c[10])
            except ValueError:
                conf = -1.0
            x, y, w, h = int(c[6]), int(c[7]), int(c[8]), int(c[9])
            k = (c[2], c[3], c[4])
            L = linhas.setdefault(k, {"p": []})
            L["p"].append([txt, x, y, x + w, y + h, conf])
        out = []
        for L in linhas.values():
            ps = L["p"]
            out.append({"t": " ".join(p[0] for p in ps),
                        "b": [min(p[1] for p in ps), min(p[2] for p in ps),
                              max(p[3] for p in ps), max(p[4] for p in ps)], "p": ps})
        return out


# ------------------------------------------------------------------ RapidOCR
class MotorRapid:
    nome = "rapidocr"

    def __init__(self):
        from rapidocr_onnxruntime import RapidOCR
        self.eng = RapidOCR()

    def _bruto(self, img):
        import cv2
        bgr = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR) if img.ndim == 2 else img
        res, _ = self.eng(bgr)
        return res or []

    def texto_rapido(self, img) -> str:
        return "\n".join(l["t"] for l in self.reconhecer(img))

    def pontuar_orientacao(self, img) -> tuple[float, int]:
        """RapidOCR perde os espaços; usa a confiança média do reconhecedor (texto de
        cabeça para baixo reconhece muito pior) e a quantidade de segmentos."""
        bruto = self._bruto(img)
        if not bruto:
            return 0.0, 0
        confs = [float(sc) for _, _, sc in bruto]
        return float(np.mean(confs)) * 0.4, len(confs) if np.mean(confs) > 0.85 else 0

    def reconhecer(self, img) -> list[dict]:
        segs = []
        for box, txt, sc in self._bruto(img):
            xs = [p[0] for p in box]
            ys = [p[1] for p in box]
            segs.append([str(txt), min(xs), min(ys), max(xs), max(ys), float(sc) * 100])
        segs.sort(key=lambda s: ((s[2] + s[4]) / 2, s[1]))
        linhas: list[list] = []
        for s in segs:
            if linhas:
                u = linhas[-1]
                ymin, ymax = max(u[0][2], s[2]), min(u[0][4], s[4])
                alt = min(u[0][4] - u[0][2], s[4] - s[2])
                if alt > 0 and (ymax - ymin) / alt > 0.5:
                    u.append(s)
                    continue
            linhas.append([s])
        out = []
        for grupo in linhas:
            grupo.sort(key=lambda s: s[1])
            palavras = []
            for t, x0, y0, x1, y1, cf in grupo:
                partes = t.split()
                tot = sum(len(p) for p in partes) or 1
                cur = x0
                for p in partes:
                    w = (x1 - x0) * len(p) / tot
                    palavras.append([p, int(cur), int(y0), int(cur + w), int(y1), cf])
                    cur += w
            if not palavras:
                continue
            out.append({"t": " ".join(p[0] for p in palavras),
                        "b": [min(p[1] for p in palavras), min(p[2] for p in palavras),
                              max(p[3] for p in palavras), max(p[4] for p in palavras)],
                        "p": palavras})
        return out


def criar_motor(cfg, preferido: str | None = None):
    """Devolve o motor escolhido (config ocr.motor: auto|tesseract|rapidocr)."""
    escolha = (preferido or cfg["ocr"].get("motor", "auto")).lower()
    idioma = cfg["ocr"].get("idioma", "por")
    if escolha in ("auto", "tesseract"):
        exe = achar_tesseract(cfg)
        if exe:
            return MotorTesseract(exe, idioma)
        if escolha == "tesseract":
            raise RuntimeError("Tesseract não encontrado. Rode INSTALAR.bat de novo.")
    return MotorRapid()


def texto_linhas(linhas: list[dict]) -> str:
    return "\n".join(l["t"] for l in linhas)
