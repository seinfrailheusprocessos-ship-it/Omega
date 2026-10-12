"""Rasterização e pré-processamento de páginas (orientação, inclinação, página em branco)."""
from __future__ import annotations

import os

import cv2
import numpy as np
from PIL import Image

from .util import abrir_pdf, caminho_longo

Image.MAX_IMAGE_PIXELS = None


def eh_pdf(p) -> bool:
    return str(p).lower().endswith(".pdf")


def contar_paginas(path) -> int:
    if eh_pdf(path):
        with abrir_pdf(path) as d:
            if d.needs_pass:
                raise PermissionError("PDF protegido por senha")
            return d.page_count
    with Image.open(caminho_longo(path)) as im:
        return getattr(im, "n_frames", 1)


def rasterizar(path, idx: int, dpi: int = 300) -> tuple[np.ndarray, int]:
    """Devolve (imagem cinza uint8, dpi efetivo)."""
    if eh_pdf(path):
        import pymupdf as fitz
        with abrir_pdf(path) as d:
            pg = d[idx]
            eff = dpi
            try:
                imgs = pg.get_images(full=True)
                if len(imgs) == 1:
                    w_nat = imgs[0][2]
                    nat = w_nat / max(pg.rect.width / 72.0, 0.1)
                    if pg.rotation in (90, 270):
                        nat = imgs[0][2] / max(pg.rect.height / 72.0, 0.1)
                    if 100 <= nat < dpi:
                        eff = int(round(nat))
            except Exception:
                pass
            pix = pg.get_pixmap(dpi=eff, colorspace=fitz.csGRAY, alpha=False)
            arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width).copy()
            return arr, eff
    with Image.open(caminho_longo(path)) as im:
        im.seek(idx)
        info_dpi = im.info.get("dpi", (dpi, dpi))
        eff = int(round(info_dpi[0])) if info_dpi and info_dpi[0] else dpi
        if eff < 72 or eff > 1200:
            eff = dpi
        g = im.convert("L")
        return np.array(g, dtype=np.uint8), eff


# ---------------------------------------------------------------- análise
def _reduzir(gray: np.ndarray, largura: int = 900) -> np.ndarray:
    h, w = gray.shape
    f = largura / w
    if f >= 1:
        return gray
    return cv2.resize(gray, (largura, int(h * f)), interpolation=cv2.INTER_AREA)


def _binaria_invertida(gray: np.ndarray) -> np.ndarray:
    """Texto = 255. Tira o ruído de sal-e-pimenta com mediana."""
    g = cv2.medianBlur(gray, 3)
    _, b = cv2.threshold(g, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    return b


def fracao_tinta(gray: np.ndarray) -> float:
    """Fração da página coberta por 'tinta' (pixels bem mais escuros que o papel).
    Robusto a ruído/sombra de scanner: o limiar é relativo ao tom do papel."""
    p = _reduzir(gray, 900)
    h, w = p.shape
    m = int(min(h, w) * 0.04)
    p = p[m:h - m, m:w - m]
    if p.size == 0:
        return 0.0
    p = cv2.medianBlur(p, 3)
    papel = float(np.percentile(p, 70))
    b = (p < papel - 55).astype(np.uint8)
    b = cv2.morphologyEx(b, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
    return float(b.mean())


def esta_deitada(gray: np.ndarray) -> bool:
    """True se as linhas de texto parecem verticais (página girada 90/270)."""
    b = _binaria_invertida(_reduzir(gray, 700)).astype(np.float32)
    return float(b.sum(axis=0).std()) > 1.15 * float(b.sum(axis=1).std())


def estimar_inclinacao(gray: np.ndarray, limite: float = 6.0) -> float:
    """Ângulo (graus) que maximiza a nitidez das linhas de texto (perfil de projeção)."""
    b = _binaria_invertida(_reduzir(gray, 800))
    h, w = b.shape
    c = (w / 2, h / 2)

    def pontuar(a):
        M = cv2.getRotationMatrix2D(c, a, 1.0)
        r = cv2.warpAffine(b, M, (w, h), flags=cv2.INTER_NEAREST)
        s = r.sum(axis=1, dtype=np.float64)
        return float(((s[1:] - s[:-1]) ** 2).sum())

    melhor, ma = -1.0, 0.0
    for a in np.arange(-limite, limite + 0.01, 0.5):
        v = pontuar(a)
        if v > melhor:
            melhor, ma = v, a
    for a in np.arange(ma - 0.4, ma + 0.41, 0.1):
        v = pontuar(a)
        if v > melhor:
            melhor, ma = v, a
    return float(round(ma, 2))


def girar(gray: np.ndarray, graus: float, fundo: int | None = None) -> np.ndarray:
    h, w = gray.shape
    if fundo is None:
        fundo = int(np.percentile(gray, 90))
    M = cv2.getRotationMatrix2D((w / 2, h / 2), graus, 1.0)
    return cv2.warpAffine(gray, M, (w, h), flags=cv2.INTER_LINEAR, borderValue=fundo)


def _rot90(gray: np.ndarray, k: int) -> np.ndarray:
    return np.ascontiguousarray(np.rot90(gray, k % 4))


def preparar_para_ocr(gray: np.ndarray) -> np.ndarray:
    """Achata o fundo (sombra, gradiente de iluminação do scanner) dividindo a imagem pelo próprio
    fundo estimado. Sem isto o Tesseract binariza mal páginas com pouca tinta (ex.: só a assinatura)
    e devolve lixo; em páginas densas o resultado é idêntico."""
    h, w = gray.shape
    peq = cv2.resize(gray, None, fx=0.25, fy=0.25, interpolation=cv2.INTER_AREA)
    fundo = cv2.medianBlur(peq, 31)
    fundo = cv2.resize(fundo, (w, h), interpolation=cv2.INTER_LINEAR)
    return cv2.divide(gray, fundo, scale=255)


def _reduzir_lado(gray: np.ndarray, lado: int = 2000) -> np.ndarray:
    h, w = gray.shape
    f = lado / max(h, w)
    return gray if f >= 1 else cv2.resize(gray, (int(w * f), int(h * f)), interpolation=cv2.INTER_AREA)


def escolher_rotacao(img: np.ndarray, motor, dica_deitada: bool) -> int:
    """Descobre quantos quartos de volta (0-3, anti-horário) deixam o texto em pé, testando o OCR
    nas orientações candidatas. A projeção só dá a ordem de tentativa: em página quase vazia ela erra."""
    pequena = preparar_para_ocr(_reduzir_lado(img, 2000))
    ordem = [1, 3, 0, 2] if dica_deitada else [0, 2, 1, 3]
    melhor, melhor_k, vistos = -1.0, ordem[0], 0
    for k in ordem:
        try:
            r = _rot90(pequena, k)
            sc, n = motor.pontuar_orientacao(r[: int(r.shape[0] * 0.42)])
            if n < 6:   # pouco texto no topo: olha a página inteira
                sc, n = motor.pontuar_orientacao(r)
        except Exception:
            sc, n = 0.0, 0
        valor = sc if n >= 4 else sc * 0.5
        if valor > melhor + 1e-9:
            melhor, melhor_k = valor, k
        vistos += 1
        if sc >= 0.15 and n >= 6:
            break
        if vistos == 2 and melhor >= 0.12:
            break      # as duas primeiras já dão uma leitura boa; não precisa testar as outras
    return melhor_k


def corrigir_pagina(gray: np.ndarray, motor, cfg) -> tuple[np.ndarray, dict]:
    """Corrige orientação (0/90/180/270) e inclinação. Devolve (imagem, info)."""
    info = {"rotacao": 0, "inclinacao": 0.0}
    ocr = cfg["ocr"]
    img = gray
    if ocr.get("corrigir_orientacao", True):
        k = escolher_rotacao(img, motor, esta_deitada(img))
        img = _rot90(img, k)
        info["rotacao"] = (k % 4) * 90   # graus anti-horários aplicados
    if ocr.get("corrigir_inclinacao", True):
        ang = estimar_inclinacao(img)
        if abs(ang) >= 0.3:
            img = girar(img, ang)
            info["inclinacao"] = ang
    return img, info
