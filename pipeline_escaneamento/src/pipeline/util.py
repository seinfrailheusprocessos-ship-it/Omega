"""Utilitários: texto sem acento, caminhos longos/com espaço no fim, hash, escrita atômica."""
from __future__ import annotations

import hashlib
import os
import re
import shutil
import unicodedata
from pathlib import Path


# ---------------------------------------------------------------- texto
def sem_acento(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "")
    return "".join(c for c in s if not unicodedata.combining(c))


def dobrar(s: str) -> str:
    """MAIÚSCULAS, sem acento, espaços colapsados. Base de todas as comparações."""
    s = sem_acento(s).upper().replace("\u00ba", "O").replace("\u00b0", "O")
    return re.sub(r"[ \t\u00a0]+", " ", s).strip()


def parte_nome(s: str) -> str:
    """Parte de nome de arquivo: MAIÚSCULAS, sem acento, só A-Z 0-9 e hífen."""
    s = dobrar(s)
    s = re.sub(r"\s+", "-", s)
    s = re.sub(r"[^A-Z0-9\-]", "", s)
    return re.sub(r"-{2,}", "-", s).strip("-")


# ---------------------------------------------------------------- caminhos
def caminho_longo(p: str | os.PathLike) -> str:
    """No Windows devolve o caminho com prefixo \\\\?\\ (aceita >260 caracteres e
    nomes de pasta terminando em espaço ou ponto). Nos demais sistemas, o próprio caminho."""
    s = os.fspath(p)
    if os.name != "nt":
        return s
    if s.startswith("\\\\?\\"):
        return s
    s = os.path.normpath(s)
    if not os.path.isabs(s):
        s = os.path.abspath(s)
    if s.startswith("\\\\"):
        return "\\\\?\\UNC\\" + s[2:]
    return "\\\\?\\" + s


def P(p) -> Path:
    return Path(caminho_longo(p))


def resolver_pasta(p: str) -> str:
    """Se a pasta configurada não existe, tenta achar uma irmã igual ignorando espaços
    nas pontas e maiúsculas (caso real: pasta chamada 'ESCANEADOS ' com espaço no fim)."""
    if os.path.exists(caminho_longo(p)):
        return p
    pai, nome = os.path.split(os.path.normpath(p))
    alvo = nome.strip().lower()
    try:
        for e in os.listdir(caminho_longo(pai) if pai else "."):
            if e.strip().lower() == alvo:
                return os.path.join(pai, e)
    except OSError:
        pass
    return p


def sha256_arquivo(p, bloco: int = 1 << 20) -> str:
    h = hashlib.sha256()
    with open(caminho_longo(p), "rb") as f:
        while True:
            b = f.read(bloco)
            if not b:
                break
            h.update(b)
    return h.hexdigest()


def sha256_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def garantir_pasta(p) -> Path:
    d = P(p)
    d.mkdir(parents=True, exist_ok=True)
    return d


def escrever_atomico(destino, dados: bytes | str, encoding: str = "utf-8"):
    """Grava em arquivo temporário na mesma pasta e troca no final."""
    d = P(destino)
    d.parent.mkdir(parents=True, exist_ok=True)
    tmp = d.with_name(d.name + ".tmp")
    if isinstance(dados, str):
        dados = dados.encode(encoding)
    with open(tmp, "wb") as f:
        f.write(dados)
    os.replace(tmp, d)


def nome_livre(pasta, nome: str, reservados: set[str] | None = None) -> str:
    """Devolve nome (com extensão) que não exista na pasta: NOME.pdf, NOME_V2.pdf, ..."""
    base, ext = os.path.splitext(nome)
    reservados = reservados or set()
    n = 1
    cand = nome
    while (P(os.path.join(pasta, cand)).exists()) or cand.lower() in reservados:
        n += 1
        cand = f"{base}_V{n}{ext}"
    return cand


def copiar(origem, destino):
    P(destino).parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(caminho_longo(origem), caminho_longo(destino))


def faixas(paginas: list[int]) -> str:
    """[12,13,14,17] -> '12-14,17' (páginas 1-based)."""
    if not paginas:
        return ""
    ps = sorted(set(paginas))
    out, ini, ant = [], ps[0], ps[0]
    for x in ps[1:]:
        if x == ant + 1:
            ant = x
            continue
        out.append(f"{ini}-{ant}" if ant != ini else f"{ini}")
        ini = ant = x
    out.append(f"{ini}-{ant}" if ant != ini else f"{ini}")
    return ",".join(out)


def limpar_nome_arquivo(s: str, maximo: int = 60) -> str:
    s = sem_acento(s)
    s = re.sub(r"[^A-Za-z0-9._-]+", "_", s).strip("._")
    return s[:maximo] or "arquivo"


def _caminho_simples(s: str) -> bool:
    """Caminho que o MuPDF abre direto: curto e sem segmentos terminando em espaço/ponto."""
    if len(s) > 240:
        return False
    return not any(seg != seg.rstrip(" .") for seg in re.split(r"[\\/]", s) if seg not in ("", ".", ".."))


def abrir_pdf(path):
    """Abre PDF com PyMuPDF; em caminhos 'difíceis' (Windows: espaço no fim, >240 caracteres)
    lê os bytes pelo Python (que aceita o prefixo \\\\?\\) e abre da memória."""
    import pymupdf
    s = os.fspath(path)
    if os.name != "nt" or _caminho_simples(s):
        return pymupdf.open(s)
    with open(caminho_longo(s), "rb") as f:
        return pymupdf.open(stream=f.read(), filetype="pdf")
