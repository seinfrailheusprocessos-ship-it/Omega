"""--desfazer: reverte a última execução usando o manifesto (só apaga o que o pipeline criou)."""
from __future__ import annotations

import json
import os
import shutil

from .catalogo import Catalogo, exportar_tudo
from .config import Pastas, carregar_categorias
from .util import P, caminho_longo, sha256_arquivo


def desfazer(cfg, console=print) -> dict:
    pastas = Pastas(cfg, carregar_categorias(cfg))
    if not os.path.exists(P(pastas.db)):
        console("Não há nada para desfazer: o catálogo ainda não existe.")
        return {"ok": False, "removidos": 0}
    cat = Catalogo(pastas.db)
    run = cat.ultima_run_desfazivel()
    if not run:
        console("Não há nenhuma execução para desfazer.")
        return {"ok": False, "removidos": 0}
    man = run["manifesto"]
    removidos = mantidos = movidos = 0
    avisos = []
    linhas = []
    if man and os.path.exists(P(man)):
        with open(P(man), "r", encoding="utf-8") as f:
            linhas = [json.loads(l) for l in f if l.strip()]
    # primeiro devolve originais movidos
    for r in reversed(linhas):
        if r["tipo"] == "movido":
            try:
                if os.path.exists(P(r["para"])) and not os.path.exists(P(r["de"])):
                    shutil.move(caminho_longo(r["para"]), caminho_longo(r["de"]))
                    movidos += 1
            except OSError as e:
                avisos.append(f"não consegui devolver {r['para']}: {e}")
    for r in reversed(linhas):
        if r["tipo"] != "criado":
            continue
        c = r["caminho"]
        if not os.path.exists(P(c)):
            continue
        try:
            if r.get("sha256") and sha256_arquivo(c) != r["sha256"]:
                mantidos += 1
                avisos.append(f"mantido (foi alterado depois de criado): {c}")
                continue
            os.remove(P(c))
            removidos += 1
        except OSError as e:
            avisos.append(f"não consegui apagar {c}: {e}")
    # pastas vazias que sobraram nas saídas (nunca a raiz, nunca a entrada)
    for pasta in list(pastas.categorias.values()) + [pastas.soltos, pastas.originais_ocr, pastas.revisar, pastas.erros]:
        try:
            if os.path.isdir(P(pasta)) and not os.listdir(P(pasta)):
                os.rmdir(P(pasta))
        except OSError:
            pass
    cat.apagar_run(run["id"])
    exportar_tudo(cat, pastas)
    cat.fechar()
    console(f"Desfeita a execução nº {run['id']} ({run['inicio']}): {removidos} arquivo(s) removido(s), "
            f"{movidos} original(is) devolvido(s) à entrada, {mantidos} mantido(s).")
    for a in avisos:
        console("  aviso: " + a)
    return {"ok": True, "run": run["id"], "removidos": removidos, "mantidos": mantidos, "movidos": movidos, "avisos": avisos}
