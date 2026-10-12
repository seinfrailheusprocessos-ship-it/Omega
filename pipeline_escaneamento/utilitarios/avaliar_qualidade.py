"""Mede a qualidade do pipeline com vários corpora sintéticos e compara os motores de OCR.
Uso:  python utilitarios/avaliar_qualidade.py [--motores tesseract rapidocr] [--sementes 1 2 3] [--docs 24] [--dpi 200]
Grava tests/metricas_qualidade.json (usado para preencher o QUALIDADE.md)."""
import argparse
import json
import os
import shutil
import sys
import tempfile
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
from pipeline import sinteticos  # noqa: E402
from pipeline.avaliar import avaliar, formatar  # noqa: E402
from pipeline.catalogo import Catalogo  # noqa: E402
from pipeline.config import Pastas, carregar_categorias, carregar_config  # noqa: E402
from pipeline.run import executar  # noqa: E402


def rodar(motor, semente, n_docs, dpi, verbose):
    tmp = tempfile.mkdtemp(prefix="qual_")
    try:
        ent, sai = os.path.join(tmp, "entrada"), os.path.join(tmp, "saida")
        verdade = sinteticos.gerar_corpus(ent, semente=semente, n_docs=n_docs, dpi=dpi)
        cfg = carregar_config(sobrescrever={"entrada": ent, "saida": sai, "ocr": {"dpi": dpi, "motor": motor}})
        t = time.time()
        r = executar(cfg, console=False)
        dt = time.time() - t
        cat = Catalogo(Pastas(cfg, carregar_categorias(cfg)).db)
        itens = cat.itens()
        cat.fechar()
        m = avaliar(itens, verdade)
        m.update(segundos=round(dt, 1), paginas=r["paginas"], motor=motor, semente=semente)
        if verbose:
            print(f"== motor={motor} semente={semente} ({dt:.0f}s, {r['paginas']} páginas)")
            print(formatar(m))
        return m
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--motores", nargs="+", default=["tesseract"])
    ap.add_argument("--sementes", nargs="+", type=int, default=[1, 2, 3])
    ap.add_argument("--docs", type=int, default=24)
    ap.add_argument("--dpi", type=int, default=200)
    ap.add_argument("--saida", default=os.path.join(os.path.dirname(__file__), "..", "tests", "metricas_qualidade.json"))
    ap.add_argument("-v", action="store_true")
    a = ap.parse_args()
    todas = []
    for motor in a.motores:
        for s in a.sementes:
            todas.append(rodar(motor, s, a.docs, a.dpi, a.v))
    resumo = {}
    for motor in a.motores:
        ms = [m for m in todas if m["motor"] == motor]
        n = sum(m["docs_verdade"] for m in ms)
        agg = {"docs": n, "paginas": sum(m["paginas"] for m in ms), "segundos": round(sum(m["segundos"] for m in ms), 1),
               "separacao_ok": sum(m["sep_ok"] for m in ms), "categoria_ok": sum(m["cat_ok"] for m in ms),
               "nome_ok": sum(m["nome_ok"] for m in ms),
               "soltos_esperados": sum(m["soltos_esperados"] for m in ms),
               "soltos_acertados": sum(m["soltos_acertados"] for m in ms),
               "paginas_de_documento_viraram_solto": sum(m["soltos_indevidos"] for m in ms),
               "brancas_esperadas": sum(m["brancas_esperadas"] for m in ms),
               "brancas_acertadas": sum(m["brancas_acertadas"] for m in ms), "campos": {},
               "auto_total": sum(m.get("auto_total", 0) for m in ms), "revisar_total": sum(m.get("revisar_total", 0) for m in ms),
               "auto_com_separacao_errada": sum(m.get("auto_com_separacao_errada", 0) for m in ms),
               "auto_com_categoria_errada": sum(m.get("auto_com_categoria_errada", 0) for m in ms)}
        for c in ms[0]["campos"]:
            agg["campos"][c] = [sum(m["campos"][c][0] for m in ms), sum(m["campos"][c][1] for m in ms)]
        agg["erros"] = [f"[semente {m['semente']}] {e}" for m in ms for e in m["erros"]]
        resumo[motor] = agg
        print(f"\n##### {motor}: {n} docs | separação {agg['separacao_ok']}/{n} | categoria {agg['categoria_ok']}/{n} | "
              f"nome {agg['nome_ok']}/{n} | {agg['paginas']} págs em {agg['segundos']} s")
        for c, (x, y) in agg["campos"].items():
            print(f"   {c}: {x}/{y}")
        for e in agg["erros"]:
            print("   ERRO", e)
    json.dump({"parametros": vars(a), "por_execucao": todas, "resumo": resumo}, open(a.saida, "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
