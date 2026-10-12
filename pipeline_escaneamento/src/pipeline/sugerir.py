"""Gancho da fase 2: lê correcoes.csv e sugere ajustes de regras (nada é alterado sozinho)."""
from __future__ import annotations

import collections
import csv
import json
import os
import re

from .catalogo import Catalogo
from .config import Pastas, carregar_categorias
from .util import P, dobrar, escrever_atomico


def sugerir(cfg, console=print) -> str | None:
    pastas = Pastas(cfg, carregar_categorias(cfg))
    caminho = os.path.join(pastas.catalogo, "correcoes.csv")
    if not os.path.exists(P(caminho)) or not os.path.exists(P(pastas.db)):
        console("Ainda não há correções registradas em _CATALOGO\\correcoes.csv.")
        return None
    cat = Catalogo(pastas.db)
    por_cat: dict[str, list] = collections.defaultdict(list)
    with open(P(caminho), "r", encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f, delimiter=";"):
            if r.get("campo") != "categoria":
                continue
            itens = cat.itens("hash_origem=? AND paginas_origem=?", (r["hash_origem"], r["paginas_origem"]))
            for it in itens:
                por_cat[r["valor_novo"]].append(it)
    L = ["# Sugestões de regras (a partir das correções)", "",
         "Revise e copie para `config\\categorias.yaml` o que fizer sentido. Nada foi alterado automaticamente.", ""]
    for categoria, itens in por_cat.items():
        cont = collections.Counter()
        for it in itens:
            txt = ""
            if it.get("caminho_texto") and os.path.exists(P(it["caminho_texto"])):
                with open(P(it["caminho_texto"]), "r", encoding="utf-8") as fh:
                    txt = fh.read()
            linhas = [dobrar(l) for l in txt.splitlines()[:25] if l.strip() and not l.startswith("---")]
            for l in linhas[:12]:
                if 6 <= len(l) <= 70:
                    cont[l] += 1
        L.append(f"## {categoria} ({len(itens)} correção(ões))")
        for linha, n in cont.most_common(8):
            if n >= 1:
                L.append(f"- linha frequente no topo ({n}x): `{linha}` → sugestão de regra: "
                         f"`{{nome: sugerida, peso: 3, onde: cabecalho, regex: '{re.escape(linha)}'}}`")
        L.append("")
    destino = os.path.join(pastas.catalogo, "sugestoes_regras.md")
    escrever_atomico(destino, "\n".join(L))
    cat.fechar()
    console(f"Sugestões gravadas em {destino}")
    return destino
