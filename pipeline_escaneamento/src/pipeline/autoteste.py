"""Autoteste: gera poucos documentos sintéticos, processa e confere. Usado pelo instalador."""
from __future__ import annotations

import json
import os
import shutil
import tempfile

from . import sinteticos
from .avaliar import avaliar, formatar
from .config import carregar_config
from .catalogo import Catalogo
from .run import executar


def autoteste(cfg_base=None, console=print, n_docs: int = 10, dpi: int = 150) -> bool:
    tmp = tempfile.mkdtemp(prefix="pipeline_autoteste_")
    try:
        ent = os.path.join(tmp, "entrada")
        sai = os.path.join(tmp, "saida")
        console("Gerando documentos de teste (fictícios)...")
        verdade = sinteticos.gerar_corpus(ent, semente=3, n_docs=n_docs, dpi=dpi, extras=False)
        cfg = carregar_config(sobrescrever={"entrada": ent, "saida": sai, "ocr": {"dpi": dpi}})
        if cfg_base:
            cfg["ocr"]["motor"] = cfg_base["ocr"]["motor"]
            cfg["ocr"]["tesseract_caminho"] = cfg_base["ocr"].get("tesseract_caminho", "")
        console("Processando o teste (leva cerca de um minuto)...")
        r = executar(cfg, console=False)
        if not r["ok"]:
            console("FALHOU: " + r["mensagem"])
            return False
        from .config import Pastas, carregar_categorias
        cat = Catalogo(Pastas(cfg, carregar_categorias(cfg)).db)
        itens = cat.itens()
        m = avaliar(itens, verdade)
        cat.fechar()
        console(formatar(m))
        from .ocr import achar_tesseract
        reserva = cfg["ocr"].get("motor", "auto") == "rapidocr" or not achar_tesseract(cfg)
        if reserva:
            console("")
            console("*" * 70)
            console("ATENCAO: o Tesseract NAO esta instalado; sera usado o leitor RESERVA (RapidOCR).")
            console("Ele e ~8 vezes mais LENTO, perde acentos no texto pesquisavel e ACERTA MUITO MENOS")
            console("(nos testes sinteticos: separacao ~50% contra ~88% do Tesseract).")
            console("Instale o Tesseract (veja o LEIA-ME, item 'Tesseract') e rode INSTALAR.bat de novo.")
            console("*" * 70)
        ok = m["sep_ok"] >= (0.3 if reserva else 0.6) * m["docs_verdade"] and m["cat_ok"] >= (0.2 if reserva else 0.5) * m["docs_verdade"]
        console("AUTOTESTE " + ("OK: o pipeline está funcionando neste computador." if ok else "COM PROBLEMAS: veja acima."))
        return ok
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
