"""Extração de campos do documento. Cada campo: {"valor", "conf", "origem"}.
Campo não encontrado fica vazio (valor None): nada é inventado."""
from __future__ import annotations

import datetime as dt
import re

from .segment import CARGO, CNJ_RE, DATA_LINHA, MESES, MP_PROC_RE, REF_RE, Pag
from .util import dobrar, parte_nome

MES_NUM = {m: i + 1 for i, m in enumerate(MESES.split("|"))}
NUM_TOK = r"N\W{0,2}[O0]?\W{0,2}\.?\s*"

ROTULO_ASSUNTO = re.compile(r"^(ASSUNTO|ASS|REFERENTE|REF|REFERENCIA|OBJETO)\s*[:.\-]\s*(.*)$")
ROTULO_DEST = re.compile(r"^(PARA|DESTINATARIO|A/C|AO\(A\))\s*[:.\-]\s*(.*)$")
INICIO_DEST = re.compile(r"^(AO|AOS|A|AS|A/C|A\(O\)|EXMO|EXMA|EXCELENTISSIM[OA]|ILMO|ILMA|ILUSTRISSIM[OA])\b")
SAUDACAO = re.compile(r"^(SENHOR|SENHORA|PREZAD|CARO|EXCELENTISSIM|ILUSTRISSIM|ILMO|EXMO)")
VERBOS_OBJETO = re.compile(r"\b(SOLICIT|REQUER|INFORM|ENCAMINH|NOTIFIC|RECOMEND|DETERMIN|INTIM|COMUNIC|"
                           r"VIMOS|PEDIMOS|PECO|REIVINDIC|INDICA|CUMPRIMENT|DECLARAMOS|DEFIRO|FICA O)")


def _campo(valor, conf, origem=""):
    return {"valor": valor, "conf": round(float(conf), 2) if valor else 0.0, "origem": origem if valor else ""}


def vazio():
    return _campo(None, 0)


def _data_iso(d: int, m: int, a: int):
    if a < 100:
        a += 2000
    try:
        return dt.date(a, m, d)
    except ValueError:
        return None


def extrair_data(pag1: Pag, ultima: Pag, todas: list[Pag]):
    """Prefere a data da linha 'Ilhéus, 12 de outubro de 2026'; depois DD/MM/AAAA perto do topo."""
    pats_ext = re.compile(rf"(\d{{1,2}})\s*(?:DE)?\s*({MESES})\s*(?:DE)?\s*(\d{{4}})")
    pats_num = re.compile(r"\b(\d{1,2})\s*[/.\-]\s*(\d{1,2})\s*[/.\-]\s*(\d{4}|\d{2})\b")
    cands = []
    for pg in [pag1] + [p for p in todas if p is not pag1]:
        for d, y, orig in pg.linhas:
            if CNJ_RE.search(d) and not DATA_LINHA.search(d):
                continue
            m = pats_ext.search(d)
            if m:
                dd = _data_iso(int(m.group(1)), MES_NUM[m.group(2)], int(m.group(3)))
                if dd and 2000 <= dd.year <= 2100:
                    pri = 3 if "ILHEUS" in d else 2
                    cands.append((pri + (0.5 if pg is pag1 else 0), -y if pg is pag1 else 0, dd, pri))
                    continue
            m = pats_num.search(d)
            if m and "PROCESSO" not in d and "/" in d or (m and "." in d and "ILHEUS" in d):
                dd = _data_iso(int(m.group(1)), int(m.group(2)), int(m.group(3)))
                if dd and 2000 <= dd.year <= 2100:
                    pri = 2 if "ILHEUS" in d else 1
                    cands.append((pri + (0.5 if pg is pag1 else 0), -y if pg is pag1 else 0, dd, pri))
    if not cands:
        return vazio()
    cands.sort(key=lambda c: (c[0], c[1]), reverse=True)
    pri = cands[0][3]
    return _campo(cands[0][2].isoformat(), {3: 0.9, 2: 0.7, 1: 0.5}[pri], "linha de data")


def extrair_numero(pag1: Pag, titulo_tipo: str | None):
    """Número do documento: perto do título, nunca de linhas de 'Processo'."""
    alvo = []
    for d, y, orig in pag1.linhas:
        if y > 0.45:
            break
        if re.search(r"PROCESSO|PROCEDIMENTO|INQUERITO|AUTOS|CNPJ|CPF", d):
            continue
        alvo.append(d)
    rgx = re.compile(rf"(?:{NUM_TOK}|\b)(\d{{1,6}})\s*[/\-]\s*(20\d\d|\d{{2}})(?!\d)")
    rgx_so_num = re.compile(rf"\b(?:OFICIO|CI|COMUNICACAO INTERNA|REQUERIMENTO|INDICACAO|NOTIFICACAO|MEMORANDO)\s*(?:CIRCULAR)?\s*{NUM_TOK}(\d{{1,6}})\b")
    for d in alvo:
        # título com número
        if titulo_tipo or re.search(r"\bC\.?I\.?\b|OFICIO|REQUERIMENTO|INDICACAO|NOTIFICACAO|COMUNICACAO|RECOMENDACAO|MEMORANDO", d):
            m = rgx.search(d)
            if m and re.search(r"OFICIO|\bCI\b|C\.I\.|COMUNICACAO|REQUERIMENTO|INDICACAO|NOTIFICACAO|RECOMENDACAO|MEMORANDO|DESPACHO|DECISAO|PORTARIA", d):
                ano = int(m.group(2))
                ano = ano + 2000 if ano < 100 else ano
                return _campo(f"{int(m.group(1))}-{ano}", 0.92, "linha do título")
            m = rgx_so_num.search(d)
            if m:
                return _campo(str(int(m.group(1))), 0.6, "título, sem ano")
    # número solto no topo (cabeçalho corrente)
    for d in alvo:
        m = re.search(rf"{NUM_TOK}(\d{{1,6}})\s*[/\-]\s*(20\d\d)", d)
        if m:
            return _campo(f"{int(m.group(1))}-{m.group(2)}", 0.5, "topo da página")
    return vazio()


def extrair_processo(todas: list[Pag]):
    """Devolve (campo, tipo). CNJ > MP > administrativo."""
    for pg in todas:
        for d, y, orig in pg.linhas:
            m = CNJ_RE.search(d)
            if m:
                a, b, c, e, f, g = m.groups()
                return _campo(f"{a}-{b}.{c}.{e}.{f}.{g}", 0.95, f"pág. {pg.idx + 1}"), "CNJ"
    for pg in todas:
        for d, y, orig in pg.linhas:
            m = MP_PROC_RE.search(d)
            if m:
                return _campo(m.group(0), 0.85, f"pág. {pg.idx + 1}"), "MP"
            m = re.search(r"(?:INQUERITO CIVIL|PROCEDIMENTO (?:PREPARATORIO|ADMINISTRATIVO)?|NOTICIA DE FATO|\bIC\b|\bNF\b)\s*"
                          rf"(?:{NUM_TOK})?[:]?\s*([0-9][0-9./\-]{{3,}})", d)
            if m:
                return _campo(m.group(1).rstrip(".-/"), 0.7, f"pág. {pg.idx + 1}"), "MP"
    for pg in todas:
        for d, y, orig in pg.linhas:
            m = re.search(rf"PROCESSO\s*(?:ADMINISTRATIVO\s*)?(?:{NUM_TOK})?[:]?\s*([0-9][0-9./\-]{{3,}})", d)
            if m:
                return _campo(m.group(1).rstrip(".-/"), 0.7, f"pág. {pg.idx + 1}"), "ADMINISTRATIVO"
    return vazio(), None


def _linhas_pag1(pag1: Pag):
    return [(d, y, o) for d, y, o in pag1.linhas]


def extrair_assunto(pag1: Pag):
    L = _linhas_pag1(pag1)
    for i, (d, y, o) in enumerate(L):
        m = ROTULO_ASSUNTO.match(d)
        if m and y < 0.65:
            val = o.split(":", 1)[1].strip() if ":" in o else m.group(2)
            if i + 1 < len(L):
                prox_d, prox_y, prox_o = L[i + 1]
                if val and val[-1] not in ".!?" and len(val) > 45 and prox_o and prox_o[0].islower() \
                        and ":" not in prox_o and len(prox_o) < 100:
                    val += " " + prox_o.strip()
            val = val.strip(" .")
            if val:
                return _campo(val, 0.85, f"rótulo '{o.split(':')[0]}'")
    return vazio()


def extrair_destinatario(pag1: Pag):
    L = _linhas_pag1(pag1)
    for i, (d, y, o) in enumerate(L):
        if y > 0.60:
            break
        m = ROTULO_DEST.match(d)
        if m:
            val = o.split(":", 1)[1].strip() if ":" in o else m.group(2)
            if val:
                return _campo(val, 0.9, "rótulo 'Para'")
    for i, (d, y, o) in enumerate(L):
        if y > 0.50:
            break
        if INICIO_DEST.match(d) and len(d) < 80 and not d.endswith(","):
            partes = [o.strip()]
            for d2, y2, o2 in L[i + 1:i + 4]:
                if ROTULO_ASSUNTO.match(d2) or SAUDACAO.match(d2) or d2.startswith("PROCESSO") \
                        or ":" in d2 or d2.endswith(","):
                    break
                partes.append(o2.strip())
            val = " – ".join(p for p in partes[1:] if p) if len(partes) > 1 and len(partes[0]) < 28 else " – ".join(partes)
            if len(partes) > 1 and len(partes[0]) < 28:
                val = " – ".join(partes[1:])
            return _campo(val.strip(), 0.6, "linha de endereçamento (Ao/À/Exmo.)")
    return vazio()


def extrair_signatario(ultima: Pag, pag1: Pag):
    """Procura, de baixo para cima, uma linha de cargo e a linha de nome logo acima."""
    for pg in (ultima, pag1):
        L = [l for l in pg.linhas if not any(r.search(l[0]) for r in
             (re.compile(r"^PAG(INA)?\.? ?\d"), re.compile(r"^FLS?\.? ?\d")))]
        for i in range(len(L) - 1, 0, -1):
            d, y, o = L[i]
            if CARGO.search(d) and len(d) < 90 and not d.rstrip().endswith(",") and ":" not in d \
                    and not re.match(r"^(AO|A|PARA|SENHOR|EXCELENTISSIMO)\b", d) and y > 0.15:
                nome = None
                dn, yn, on = L[i - 1]
                palavras = on.split()
                if 2 <= len(palavras) <= 7 and not re.search(r"\d|:", on) and not FECHO_LIKE(dn) \
                        and sum(1 for w in palavras if w[:1].isupper()) >= max(2, len(palavras) - 2):
                    nome = on.strip(" ,.")
                if nome:
                    return _campo(nome, 0.8, "acima do cargo"), _campo(o.strip(" ,."), 0.85, "linha de cargo")
                return vazio(), _campo(o.strip(" ,."), 0.6, "linha de cargo (sem nome)")
    return vazio(), vazio()


def FECHO_LIKE(d: str) -> bool:
    return bool(re.search(r"ATENCIOSAMENTE|RESPEITOSAMENTE|CORDIALMENTE|ILHEUS,", d))


def extrair_objeto(pag1: Pag):
    """Primeira frase do corpo que tem verbo de pedido/informação (limitada a 300 caracteres)."""
    corpo = []
    for d, y, o in pag1.linhas:
        if y < 0.18 or ROTULO_ASSUNTO.match(d) or ROTULO_DEST.match(d) or d.startswith("DE:") or SAUDACAO.match(d) \
                or INICIO_DEST.match(d) and len(d) < 80 or d.startswith("PROCESSO") or d.startswith("PROCEDIMENTO"):
            continue
        if re.match(r"^PAG(INA)?\.? ?\d|^FLS", d):
            continue
        if len(d) < 25:
            continue
        corpo.append(o.strip())
    texto = " ".join(corpo)
    if not texto:
        return vazio()
    frases = re.split(r"(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])", texto)
    for f in frases[:6]:
        if VERBOS_OBJETO.search(dobrar(f)):
            return _campo(f[:300].strip(), 0.55, "primeira frase com verbo de pedido/informação")
    return _campo(frases[0][:300].strip(), 0.3, "primeira frase do corpo")


def extrair_tipo(pag1: Pag):
    if pag1.titulo:
        return _campo(pag1.titulo, 0.95 if pag1.titulo_forte else 0.7, "título")
    return vazio()


def _sigla_provisoria(nome: str, orgaos_cfg: dict) -> str:
    ign = set(orgaos_cfg.get("palavras_ignoradas_sigla", []))
    palavras = [w for w in re.findall(r"[A-Z0-9]+", dobrar(nome)) if w not in ign]
    return parte_nome("-".join(palavras[:2]))[:16]


def extrair_orgao(pag1: Pag, orgaos_cfg: dict):
    """Sigla pelo cabeçalho (orgaos.yaml). Entidade desconhecida ganha sigla provisória
    e é marcada como NOVA (vai para orgaos_novos.csv)."""
    n_cab = len(pag1.cab.split("\n")) if pag1.cab else 0
    topo_linhas = [(d, o) for d, y, o in pag1.linhas if y < 0.30][:max(n_cab, 0)] if n_cab else \
        [(d, o) for d, y, o in pag1.linhas if y < 0.12]
    topo = "\n".join(d for d, _ in topo_linhas)
    for item in orgaos_cfg.get("orgaos", []):
        if re.search(item["padrao"], topo):
            return _campo(item["sigla"], 0.9, f"cabeçalho: {item['padrao'][:30]}"), False
    ind = orgaos_cfg.get("indicadores_entidade", [])
    for d, o in topo_linhas[:8]:
        if any(i in d for i in ind) and len(o) > 8:
            return _campo(_sigla_provisoria(o, orgaos_cfg), 0.4, f"sigla provisória de: {o.strip()}"), True
    return vazio(), False


def extrair_tudo(paginas_doc: list[Pag], orgaos_cfg: dict) -> dict:
    pag1, ultima = paginas_doc[0], paginas_doc[-1]
    campos = {}
    campos["tipo"] = extrair_tipo(pag1)
    campos["orgao"], nova = extrair_orgao(pag1, orgaos_cfg)
    campos["numero"] = extrair_numero(pag1, campos["tipo"]["valor"])
    campos["data"] = extrair_data(pag1, ultima, paginas_doc)
    campos["assunto"] = extrair_assunto(pag1)
    campos["destinatario"] = extrair_destinatario(pag1)
    campos["signatario_nome"], campos["signatario_cargo"] = extrair_signatario(ultima, pag1)
    campos["processo"], tp = extrair_processo(paginas_doc)
    campos["objeto"] = extrair_objeto(pag1)
    return {"campos": campos, "orgao_novo": nova, "processo_tipo": tp}
