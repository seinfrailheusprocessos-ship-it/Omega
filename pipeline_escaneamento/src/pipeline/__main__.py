"""Linha de comando: python -m pipeline [opções]. Textos em português."""
from __future__ import annotations

import argparse
import multiprocessing
import sys

from . import VERSAO


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="pipeline", description="Pipeline de Escaneamento da SEINFRA (Ilhéus/BA)")
    ap.add_argument("--simular", action="store_true", help="gera o plano sem gravar nenhum documento")
    ap.add_argument("--desfazer", action="store_true", help="reverte a última execução (usa o manifesto)")
    ap.add_argument("--amostra", type=int, metavar="N", help="calibração: só as N primeiras páginas, sem mover nada")
    ap.add_argument("--vigiar", action="store_true", help="fica de olho na pasta de entrada")
    ap.add_argument("--reprocessar-erros", action="store_true", help="tenta de novo os arquivos que deram erro")
    ap.add_argument("--exportar", action="store_true", help="refaz CATALOGO.xlsx/csv/jsonl a partir do banco")
    ap.add_argument("--sugerir-regras", action="store_true", help="gera sugestões a partir de correcoes.csv")
    ap.add_argument("--autoteste", action="store_true", help="testa a instalação com documentos fictícios")
    ap.add_argument("--gerar-sinteticos", metavar="PASTA", help="gera documentos fictícios de demonstração")
    ap.add_argument("--config", metavar="ARQ", help="caminho do config.yaml")
    ap.add_argument("--entrada", metavar="PASTA", help="sobrescreve a pasta de entrada")
    ap.add_argument("--saida", metavar="PASTA", help="sobrescreve a pasta de saída")
    ap.add_argument("--motor", choices=["auto", "tesseract", "rapidocr"], help="motor de OCR")
    ap.add_argument("--versao", action="store_true")
    a = ap.parse_args(argv)
    if a.versao:
        print(VERSAO)
        return 0

    from .config import carregar_config
    sob = {}
    if a.entrada:
        sob["entrada"] = a.entrada
    if a.saida:
        sob["saida"] = a.saida
    if a.motor:
        sob["ocr"] = {"motor": a.motor}
    cfg = carregar_config(a.config, sob)

    if a.gerar_sinteticos:
        from .sinteticos import gerar_corpus
        v = gerar_corpus(a.gerar_sinteticos, n_docs=24, dpi=200)
        print(f"{len(v['documentos'])} documentos fictícios em {a.gerar_sinteticos}")
        return 0
    if a.autoteste:
        from .autoteste import autoteste
        return 0 if autoteste(cfg) else 1
    if a.desfazer:
        from .desfazer import desfazer
        return 0 if desfazer(cfg)["ok"] else 1
    if a.sugerir_regras:
        from .sugerir import sugerir
        sugerir(cfg)
        return 0
    if a.exportar:
        from .catalogo import Catalogo, exportar_tudo
        from .config import Pastas, carregar_categorias
        p = Pastas(cfg, carregar_categorias(cfg))
        c = Catalogo(p.db)
        exportar_tudo(c, p)
        c.fechar()
        print("Catálogo refeito em", p.catalogo)
        return 0
    if a.vigiar:
        from .vigiar import vigiar
        vigiar(cfg)
        return 0
    from .run import executar
    r = executar(cfg, simular=a.simular, amostra=a.amostra or 0, reprocessar_erros=a.reprocessar_erros)
    pass
    return 0 if r["ok"] else 1


if __name__ == "__main__":
    multiprocessing.freeze_support()
    sys.exit(main())
