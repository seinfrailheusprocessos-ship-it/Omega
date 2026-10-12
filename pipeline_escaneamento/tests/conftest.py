import json
import os
import shutil
import sys
import tempfile

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from pipeline import sinteticos  # noqa: E402
from pipeline.config import Pastas, carregar_categorias, carregar_config, carregar_orgaos  # noqa: E402
from pipeline.ocr import achar_tesseract  # noqa: E402


def pagina_fake(linhas, idx=0, num=None, w=1000, h=1400, y0=0.06, passo=0.027):
    """Monta o resultado de OCR de uma página a partir de linhas de texto (sem rodar OCR)."""
    L = []
    for i, t in enumerate(linhas):
        y = int((y0 + i * passo) * h)
        palavras = [[p, 100 + 60 * k, y, 150 + 60 * k, y + 22, 90.0] for k, p in enumerate(t.split())]
        if palavras:
            L.append({"t": t, "b": [100, y, 900, y + 22], "p": palavras})
    if num:
        y = int(0.93 * h)
        L.append({"t": num, "b": [400, y, 600, y + 20], "p": [[num, 400, y, 600, y + 20, 90.0]]})
    return {"idx": idx, "w": w, "h": h, "lines": L, "blank": False, "conf": 90.0, "erro": None}


@pytest.fixture(scope="session")
def cfg_basica():
    return carregar_config()


@pytest.fixture(scope="session")
def cat_cfg(cfg_basica):
    return carregar_categorias(cfg_basica)


@pytest.fixture(scope="session")
def org_cfg(cfg_basica):
    return carregar_orgaos(cfg_basica)


def tem_ocr():
    if achar_tesseract(None):
        return True
    try:
        import rapidocr_onnxruntime  # noqa: F401
        return True
    except Exception:
        return False


precisa_ocr = pytest.mark.skipif(not tem_ocr(), reason="nenhum motor de OCR instalado")


@pytest.fixture(scope="session")
def e2e(tmp_path_factory):
    """Gera um corpus sintético, roda o pipeline inteiro numa pasta com ACENTO e ESPAÇO NO FIM e devolve tudo."""
    from pipeline.catalogo import Catalogo
    from pipeline.run import executar
    base = tmp_path_factory.mktemp("e2e")
    entrada = os.path.join(str(base), "Entrada Escaneados ")      # espaço no fim, de propósito
    saida = os.path.join(str(base), "Saída Pipeline ção")
    verdade = sinteticos.gerar_corpus(entrada, semente=11, n_docs=14, dpi=200)
    sinteticos.gerar_arquivos_problema(entrada)
    hashes_antes = {f: _h(os.path.join(entrada, f)) for f in os.listdir(entrada)}
    cfg = carregar_config(sobrescrever={"entrada": entrada.rstrip(), "saida": saida, "ocr": {"dpi": 200}})
    r = executar(cfg, console=False)
    pastas = Pastas(cfg, carregar_categorias(cfg))
    cat = Catalogo(pastas.db)
    itens = cat.itens()
    cat.fechar()
    return {"cfg": cfg, "pastas": pastas, "itens": itens, "verdade": verdade, "entrada": entrada,
            "resumo": r, "hashes_antes": hashes_antes, "base": str(base)}


def _h(p):
    from pipeline.util import sha256_arquivo
    return sha256_arquivo(p)
