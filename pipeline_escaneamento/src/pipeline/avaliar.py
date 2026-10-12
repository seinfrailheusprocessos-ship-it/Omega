"""Compara o resultado do pipeline com o gabarito (verdade.json) dos sintéticos."""
from __future__ import annotations

import json
import os


def avaliar(catalogo_itens: list[dict], verdade: dict) -> dict:
    """catalogo_itens: linhas do catálogo (dicts com arquivo_origem, paginas_origem, categoria, nome_final, status...)."""
    # monta, para cada documento verdadeiro, o conjunto de (arquivo, página) esperado
    esperado: dict[str, set] = {}
    for arq, pgs in verdade["arquivos"].items():
        for i, p in enumerate(pgs):
            if p["doc"]:
                esperado.setdefault(p["doc"], set()).add((arq, i + 1))
    # conjunto obtido por item de catálogo
    obtido = []
    for it in catalogo_itens:
        if it["status"] in ("AUTO", "REVISAR"):
            pgs = set()
            for faixa in str(it["paginas_origem"]).split(","):
                if not faixa:
                    continue
                a, _, b = faixa.partition("-")
                for k in range(int(a), int(b or a) + 1):
                    pgs.add((it["arquivo_origem"], k))
            obtido.append((pgs, it))
    r = {"docs_verdade": len(esperado), "sep_ok": 0, "cat_ok": 0, "nome_ok": 0, "campos": {}, "erros": []}
    verdadeiros = [frozenset(v) for v in esperado.values()]
    auto = [(p, it) for p, it in obtido if it["status"] == "AUTO"]
    r["auto_total"] = len(auto)
    r["revisar_total"] = len(obtido) - len(auto)
    r["auto_com_separacao_errada"] = sum(1 for p, it in auto if frozenset(p) not in verdadeiros)
    r["auto_com_categoria_errada"] = 0
    cat_por_pag = {}
    for doc_id, pgs in esperado.items():
        for pg in pgs:
            cat_por_pag[pg] = verdade["documentos"][doc_id]["categoria"]
    for p, it in auto:
        if frozenset(p) in verdadeiros and cat_por_pag.get(next(iter(p))) != it["categoria"]:
            r["auto_com_categoria_errada"] += 1
    campos_chaves = ["tipo", "orgao", "numero", "data", "signatario_nome", "signatario_cargo", "processo",
                     "assunto", "destinatario"]
    cont = {c: [0, 0] for c in campos_chaves}
    achados = 0
    for doc_id, pgs in esperado.items():
        v = verdade["documentos"][doc_id]
        m = next((it for s, it in obtido if s == pgs), None)
        if m is None:
            r["erros"].append(f"{doc_id}: separação errada ({v['categoria']}, {v['nome_final']})")
            continue
        r["sep_ok"] += 1
        if m["categoria"] == v["categoria"]:
            r["cat_ok"] += 1
        else:
            r["erros"].append(f"{doc_id}: categoria {m['categoria']} != {v['categoria']}")
        base = m["nome_final"].rsplit(".", 1)[0]
        esp = v["nome_final"].rsplit(".", 1)[0]
        ok_nome = base == esp or (not v["orgao_conhecido"] and _igual_sem_orgao(base, esp)) \
            or (base.rsplit("_V", 1)[0] == esp.rsplit("_V", 1)[0])
        if ok_nome:
            r["nome_ok"] += 1
        else:
            r["erros"].append(f"{doc_id}: nome {m['nome_final']} != {v['nome_final']}")
        for c in campos_chaves:
            ve = v.get(c if c != "signatario_nome" else "signatario_nome")
            if ve in (None, ""):
                continue
            cont[c][1] += 1
            va = m.get(c)
            if _norm(va) == _norm(ve) or (c in ("assunto", "destinatario") and _parecido(va, ve)) \
                    or (c == "orgao" and not v["orgao_conhecido"]) \
                    or (c == "numero" and _norm(va) == _norm(ve).replace("/", "-")) \
                    or (c == "data" and _data_ok(va, ve)):
                cont[c][0] += 1
    r["campos"] = {c: (a, b) for c, (a, b) in cont.items()}
    # páginas soltas esperadas
    solto_esp = {(arq, i + 1) for arq, pgs in verdade["arquivos"].items() for i, p in enumerate(pgs) if p["tipo"] == "solta"}
    solto_obt = set()
    for it in catalogo_itens:
        if it["status"] == "SOLTO":
            for faixa in str(it["paginas_origem"]).split(","):
                a, _, b = faixa.partition("-")
                for k in range(int(a), int(b or a) + 1):
                    solto_obt.add((it["arquivo_origem"], k))
    r["soltos_esperados"] = len(solto_esp)
    r["soltos_acertados"] = len(solto_esp & solto_obt)
    r["soltos_indevidos"] = len(solto_obt - solto_esp)   # páginas de documento que viraram solto
    brancas_esp = {(arq, i + 1) for arq, pgs in verdade["arquivos"].items() for i, p in enumerate(pgs) if p["tipo"] == "branca"}
    brancas_obt = set()
    for it in catalogo_itens:
        if it["status"] == "SOLTO" and "branco" in (it.get("motivo") or ""):
            for faixa in str(it["paginas_origem"]).split(","):
                a, _, b = faixa.partition("-")
                for k in range(int(a), int(b or a) + 1):
                    brancas_obt.add((it["arquivo_origem"], k))
    r["brancas_esperadas"], r["brancas_acertadas"] = len(brancas_esp), len(brancas_esp & brancas_obt)
    return r


def _norm(v):
    import re
    from .util import dobrar
    t = dobrar(str(v or ""))
    t = re.sub(r"[\u2013\u2014\u2012-]+", "-", t)
    return re.sub(r"[^A-Z0-9/-]", "", t)


def _parecido(a, b, lim=0.85):
    import difflib
    a, b = _norm(a), _norm(b)
    return bool(a and b) and (b in a or a in b or difflib.SequenceMatcher(None, a, b).ratio() >= lim)


def _data_ok(va, ve):
    # va: ISO (aaaa-mm-dd) ; ve: DDMMAAAA
    if not va:
        return False
    a, m, d = va.split("-")
    return f"{d}{m}{a}" == ve


def _igual_sem_orgao(a: str, b: str) -> bool:
    pa, pb = a.split("_"), b.split("_")
    return len(pa) == len(pb) and pa[0] == pb[0] and pa[2:] == pb[2:]


def formatar(r: dict) -> str:
    n = max(r["docs_verdade"], 1)
    linhas = [f"Documentos verdadeiros: {r['docs_verdade']}",
              f"Separação exata: {r['sep_ok']}/{n} ({100 * r['sep_ok'] / n:.0f}%)",
              f"Categoria correta: {r['cat_ok']}/{n} ({100 * r['cat_ok'] / n:.0f}%)",
              f"Nome final correto: {r['nome_ok']}/{n} ({100 * r['nome_ok'] / n:.0f}%)"]
    for c, (a, b) in r["campos"].items():
        linhas.append(f"  campo {c}: {a}/{b}")
    linhas.append(f"Soltos esperados: {r['soltos_esperados']}, acertados: {r['soltos_acertados']}, "
                  f"páginas de documento que viraram solto: {r['soltos_indevidos']}")
    linhas.append(f"Brancas: {r['brancas_acertadas']}/{r['brancas_esperadas']}")
    linhas += ["  ERRO " + e for e in r["erros"]]
    return "\n".join(linhas)
