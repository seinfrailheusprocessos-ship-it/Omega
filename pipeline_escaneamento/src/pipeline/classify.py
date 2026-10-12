"""Classificação por regras ponderadas (determinística e auditável) + gancho opcional de LLM."""
from __future__ import annotations

import json
import os
import re
import subprocess

from .segment import CNJ_RE, Pag
from .util import dobrar

_CACHE_RGX: dict[str, re.Pattern] = {}


def _rgx(expr: str) -> re.Pattern:
    r = _CACHE_RGX.get(expr)
    if r is None:
        r = _CACHE_RGX[expr] = re.compile(expr, re.MULTILINE)
    return r


def zonas(paginas: list[Pag], campos: dict) -> dict[str, str]:
    p1, ult = paginas[0], paginas[-1]
    titulo = "\n".join(d for d, y, _ in p1.linhas if y < 0.45)
    topo = "\n".join(d for d, y, _ in p1.linhas if y < 0.28)
    pagina1 = "\n".join(d for d, _, _ in p1.linhas)
    ultima = "\n".join(d for d, _, _ in ult.linhas)
    doc = "\n".join(d for p in paginas for d, _, _ in p.linhas)
    dest = dobrar(campos.get("destinatario", {}).get("valor") or "")
    if not dest:
        # tenta as linhas de endereçamento brutas (Ao Senhor / Exmo.)
        achados = [d for d, y, _ in p1.linhas if y < 0.5 and re.match(r"^(AO|A|AOS|EXMO|EXCELENTISSIM|ILMO|ILUSTRISSIM|PARA)\b", d)]
        dest = "\n".join(achados)
    # o destinatário inclui as duas linhas seguintes ao "Ao Senhor" (cargo/instituição)
    bloco = []
    capt = 0
    for d, y, _ in p1.linhas:
        if y > 0.5:
            break
        if re.match(r"^(AO|AOS|A|EXMO|EXCELENTISSIM|ILMO|ILUSTRISSIM|PARA)\b", d):
            capt = 4
        if capt:
            if d.startswith("ASSUNTO") or d.startswith("SENHOR") or d.endswith(","):
                capt = 0
                continue
            bloco.append(d)
            capt -= 1
    dest = dest + "\n" + "\n".join(bloco)
    return {"cabecalho": p1.cab or topo, "titulo": titulo, "topo": topo, "pagina1": pagina1, "ultima": ultima, "doc": doc, "destinatario": dest}


def classificar_regras(paginas: list[Pag], campos: dict, cat_cfg: dict) -> dict:
    z = zonas(paginas, campos)
    minimo = float(cat_cfg.get("minimo", 3.0))
    ref = float(cat_cfg.get("margem_referencia", 6))
    pontos: dict[str, float] = {}
    detalhes: dict[str, list] = {}
    for nome, dados in cat_cfg["categorias"].items():
        tot, det = 0.0, []
        for r in dados.get("regras") or []:
            zona = z.get(r.get("onde", "doc"), "")
            exprs = [r["regex"]] if r.get("regex") else [re.escape(dobrar(w)) for w in r.get("palavras", [])]
            if any(_rgx(e).search(zona) for e in exprs):
                tot += float(r["peso"])
                det.append((r.get("nome", "regra"), float(r["peso"])))
        pontos[nome] = tot
        detalhes[nome] = det
    ordem = sorted(pontos.items(), key=lambda kv: kv[1], reverse=True)
    melhor, v1 = ordem[0]
    v2 = ordem[1][1] if len(ordem) > 1 else 0.0
    if v1 < minimo or melhor == "OUTROS":
        escolhida = "OUTROS"
        conf = 0.5 if v1 < minimo else 0.5
        # documento sem nenhuma pista mas com título/tipo reconhecidos: confiança um pouco maior
        motivo = f"nenhuma categoria atingiu {minimo:g} pontos (melhor: {ordem[0][0]} com {v1:g})"
    else:
        escolhida = melhor
        forca = min(1.0, v1 / ref)
        margem = min(1.0, max(0.0, (v1 - v2) / max(v1, 1e-9)))
        conf = round(0.55 * forca + 0.45 * margem, 3)
        det = "; ".join(f"{n} (+{p:g})" for n, p in sorted(detalhes[melhor], key=lambda x: -x[1])[:4])
        motivo = f"{melhor}={v1:g} pontos [{det}]; 2º lugar: {ordem[1][0]}={v2:g}"
    return {"categoria": escolhida, "conf": round(conf, 3), "motivo": motivo,
            "pontos": {k: round(v, 2) for k, v in pontos.items()}}


def classificar_llm(texto_inicio: str, categorias: list[str]) -> dict | None:
    """Gancho OPCIONAL (desligado por padrão). Se PIPELINE_LLM_CMD estiver definida, o comando
    recebe JSON no stdin {"texto":..., "categorias":[...]} e deve responder JSON
    {"categoria":..., "confianca":0-1}. Só os 1500 primeiros caracteres da 1ª página são enviados."""
    cmd = os.environ.get("PIPELINE_LLM_CMD")
    if not cmd:
        return None
    try:
        entrada = json.dumps({"texto": texto_inicio[:1500], "categorias": categorias}, ensure_ascii=False)
        r = subprocess.run(cmd, input=entrada.encode("utf-8"), capture_output=True, shell=True, timeout=120)
        if r.returncode != 0:
            return None
        out = json.loads(r.stdout.decode("utf-8"))
        if out.get("categoria") in categorias:
            return {"categoria": out["categoria"], "conf": float(out.get("confianca", 0.5))}
    except Exception:
        return None
    return None


def classificar(paginas, campos, cat_cfg, cfg) -> dict:
    res = classificar_regras(paginas, campos, cat_cfg)
    llm_cfg = cfg.get("llm", {})
    if llm_cfg.get("ativo") and os.environ.get("PIPELINE_LLM_CMD") \
            and res["conf"] < float(llm_cfg.get("confianca_minima_para_chamar", 0.6)):
        r = classificar_llm(paginas[0].texto, list(cat_cfg["categorias"].keys()))
        if r:
            res["motivo"] += f" | LLM sugeriu {r['categoria']} ({r['conf']:.2f})"
            res["categoria"], res["conf"] = r["categoria"], round(min(r["conf"], 0.9), 3)
            res["origem"] = "llm"
    res.setdefault("origem", "regras")
    return res
