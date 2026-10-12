"""Nome final: TIPO_ORGAO_NUMERO_DATA.pdf (MAIÚSCULAS, sem acento, sem barra/ponto/parênteses)."""
from __future__ import annotations

import datetime as dt
import re

from .util import parte_nome


def montar_nome(campos: dict, cfg) -> str:
    n = cfg["nome"]
    tipo = parte_nome(campos["tipo"]["valor"] or "") or n["sem_tipo"]
    orgao = parte_nome(campos["orgao"]["valor"] or "") or n["sem_orgao"]
    numero = campos["numero"]["valor"]
    if not numero and n.get("usar_processo_como_numero") and campos["processo"]["valor"]:
        numero = re.sub(r"\D", "", campos["processo"]["valor"])
    numero = parte_nome((numero or "").replace("/", "-")) or n["sem_numero"]
    data = n["sem_data"]
    v = campos["data"]["valor"]
    if v:
        try:
            data = dt.date.fromisoformat(v).strftime(n["formato_data"])
        except ValueError:
            pass
    return "_".join([tipo, orgao, numero, data])
