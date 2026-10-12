"""Junta as etapas de análise (sem gravar nada): páginas OCR -> documentos com campos e categoria."""
from __future__ import annotations

from dataclasses import dataclass, field

from .classify import classificar
from .extract import extrair_tudo
from .naming import montar_nome
from .segment import Pag, Resultado, construir_pagina, segmentar


@dataclass
class DocInfo:
    paginas: list                      # índices 0-based, na ordem final
    campos: dict
    categoria: str
    conf_categoria: float
    motivo_categoria: str
    conf_separacao: float
    motivo_separacao: str
    nome_base: str                     # sem extensão e sem sufixo _Vn
    orgao_novo: bool = False
    processo_tipo: str | None = None
    pontos: dict = field(default_factory=dict)
    faltam_paginas: bool = False
    texto: str = ""
    status: str = "AUTO"
    motivo_status: str = ""


@dataclass
class Analise:
    docs: list
    soltos: list          # segment.Solto
    brancas: list
    erros: list           # [(idx, msg)]
    paginas: list         # [Pag]


def analisar(resultados_paginas: list[dict], cfg, cat_cfg, orgaos_cfg, correcoes: dict | None = None,
             hash_origem: str = "") -> Analise:
    pags: list[Pag] = [construir_pagina(r["idx"], r) for r in resultados_paginas]
    por_idx = {p.idx: p for p in pags}
    seg: Resultado = segmentar(pags, cfg)
    docs = []
    lim = cfg["confianca"]
    for d in seg.docs:
        pgs = [por_idx[i] for i in d.paginas]
        ex = extrair_tudo(pgs, orgaos_cfg)
        campos = ex["campos"]
        cl = classificar(pgs, campos, cat_cfg, cfg)
        info = DocInfo(paginas=list(d.paginas), campos=campos, categoria=cl["categoria"],
                       conf_categoria=cl["conf"], motivo_categoria=cl["motivo"],
                       conf_separacao=d.conf_sep, motivo_separacao="; ".join(d.motivo),
                       nome_base="", orgao_novo=ex["orgao_novo"], processo_tipo=ex["processo_tipo"],
                       pontos=cl["pontos"], faltam_paginas=d.faltam,
                       texto="\n\n".join(f"--- página {p.idx + 1} ---\n{p.texto}" for p in pgs))
        if correcoes:
            _aplicar_correcoes(info, correcoes, hash_origem)
        info.nome_base = montar_nome(info.campos, cfg)
        motivos = []
        if info.conf_separacao < lim["minima_auto_separacao"]:
            motivos.append(f"separação duvidosa ({info.conf_separacao:.2f})")
        if info.conf_categoria < lim["minima_auto_categoria"]:
            motivos.append(f"categoria duvidosa ({info.conf_categoria:.2f})")
        if info.faltam_paginas:
            motivos.append("faltam páginas")
        info.status = "REVISAR" if motivos else "AUTO"
        info.motivo_status = "; ".join(motivos)
        docs.append(info)
    return Analise(docs=docs, soltos=seg.soltos, brancas=seg.brancas, erros=seg.erros, paginas=pags)


def _aplicar_correcoes(info: DocInfo, correcoes: dict, hash_origem: str):
    """correcoes: {(hash_origem, 'paginas'): {campo: valor_novo}} - feitas pelo usuário/Ômega."""
    from .util import faixas
    chave = (hash_origem, faixas([i + 1 for i in info.paginas]))
    for campo, novo in (correcoes.get(chave) or {}).items():
        if campo == "categoria":
            info.categoria, info.conf_categoria = novo, 1.0
            info.motivo_categoria += " | corrigida manualmente"
        elif campo in info.campos:
            info.campos[campo] = {"valor": novo, "conf": 1.0, "origem": "correção manual"}
