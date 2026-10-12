"""Segmentação: descobre onde cada documento começa e termina dentro do lote, liga páginas
de continuação (mesmo fora de ordem) e separa o que não dá para atribuir com segurança."""
from __future__ import annotations

import re
from dataclasses import dataclass, field

import numpy as np

from .util import dobrar, faixas

MESES = "JANEIRO|FEVEREIRO|MARCO|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO"

CNJ_RE = re.compile(r"(\d{7})\s*-\s*(\d{2})\s*\.\s*(\d{4})\s*\.\s*(\d)\s*\.\s*(\d{2})\s*\.\s*(\d{4})")
MP_PROC_RE = re.compile(r"\b\d{3}\.\d\.\d{4,7}/\d{4}\b")
NUM_PAG = [
    re.compile(r"\bPAG(?:INA)?\.?\s*(\d{1,3})\s*(?:DE|/)\s*(\d{1,3})\b"),
    re.compile(r"\bPAGINA\s*(\d{1,3})\s*$"),
    re.compile(r"\b(?:FLS?|FOLHA)\.?\s*(\d{1,4})\b"),
]
REF_RE = re.compile(r"\b(\d{1,5})\s*/\s*(20\d\d)\b")

# (regex, peso) procurados nas linhas do TOPO (28% de cima da página)
CABECALHO = [
    (re.compile(r"ESTADO DA BAHIA"), 1.0),
    (re.compile(r"PREFEITURA (MUNICIPAL )?DE ILHEUS"), 1.5),
    (re.compile(r"SECRETARIA MUNICIPAL DE|PROCURADORIA|GABINETE D[OA]|CONTROLADORIA"), 1.0),
    (re.compile(r"MINISTERIO PUBLICO"), 2.5),
    (re.compile(r"PROMOTORIA"), 1.0),
    (re.compile(r"PODER JUDICIARIO|TRIBUNAL DE JUSTICA|JUSTICA FEDERAL"), 2.5),
    (re.compile(r"\bVARA\b|COMARCA|JUIZADO"), 1.0),
    (re.compile(r"CAMARA (MUNICIPAL|DE VEREADORES)"), 2.0),
    (re.compile(r"ASSOCIACAO|SINDICATO|COOPERATIVA|CONSELHO COMUNITARIO"), 2.0),
    (re.compile(r"\bLTDA\b|EIRELI|\bCNPJ\b|S/A\b"), 1.5),
]

# Títulos (devem estar no INÍCIO da linha). Ordem importa: o primeiro que bater vence.
TITULOS = [
    ("CI", re.compile(r"^\W*(COMUNICACAO INTERNA|C\.?I\.?\s*(N\W?O?|NO)\s*\d)")),
    ("OFICIO", re.compile(r"^\W*(OFICIO(\s+CIRCULAR)?|OF\.)\s*(N\W{0,2}O?\W{0,2}\s*)?\d")),
    ("OFICIO", re.compile(r"^\W*OFICIO(\s+CIRCULAR)?\s*$")),
    ("MEMORANDO", re.compile(r"^\W*MEMORANDO")),
    ("REQUERIMENTO", re.compile(r"^\W*REQUERIMENTO")),
    ("INDICACAO", re.compile(r"^\W*INDICACAO")),
    ("MOCAO", re.compile(r"^\W*MOCAO")),
    ("NOTIFICACAO", re.compile(r"^\W*NOTIFICACAO")),
    ("RECOMENDACAO", re.compile(r"^\W*RECOMENDACAO")),
    ("INTIMACAO", re.compile(r"^\W*INTIMACAO")),
    ("DECISAO", re.compile(r"^\W*DECISAO")),
    ("DESPACHO", re.compile(r"^\W*DESPACHO")),
    ("SENTENCA", re.compile(r"^\W*SENTENCA")),
    ("PORTARIA", re.compile(r"^\W*PORTARIA")),
    ("DECLARACAO", re.compile(r"^\W*DECLARACAO")),
    ("CERTIDAO", re.compile(r"^\W*CERTIDAO")),
    ("ATA", re.compile(r"^\W*ATA( DE REUNIAO)?\s*$")),
    ("PARECER", re.compile(r"^\W*PARECER")),
    ("RELATORIO", re.compile(r"^\W*RELATORIO")),
]

FECHO = re.compile(r"ATENCIOSAMENTE|RESPEITOSAMENTE|CORDIALMENTE|SAUDACOES|PEDE DEFERIMENTO|NESTES TERMOS|"
                   r"ASSINAD[OA] (ELETRONICAMENTE|DIGITALMENTE)|SEM MAIS PARA O MOMENTO")
DATA_LINHA = re.compile(rf"\b\d{{1,2}}\s*(DE)?\s*({MESES})\s*(DE)?\s*\d{{4}}")
CARGO = re.compile(r"\b(SECRETARI[OA]|PREFEIT[OA]|VEREADOR[A]?|PROMOTOR[A]?|JUIZ[A]?|PRESIDENTE|PROCURADOR[A]?|"
                   r"DIRETOR[A]?|CHEFE|REPRESENTANTE|COORDENADOR[A]?|SOCIO|ADMINISTRADOR[A]?)\b")
PROTOCOLO = re.compile(r"RECEBIDO EM|PROTOCOLAD[OA]|PROTOCOLO N")
NAO_ASSINATURA = re.compile(r"^(AO|AOS|A|AS|A/C|EXMO|EXMA|ILMO|ILMA|SENHOR|SENHORA|PARA|DE|PREZAD|CC)\b")


@dataclass
class Pag:
    idx: int
    blank: bool = False
    erro: str | None = None
    linhas: list = field(default_factory=list)      # (dobrada, y_rel, original)
    texto: str = ""
    topo: str = ""
    header_score: float = 0.0
    titulo: str | None = None
    titulo_forte: bool = False
    cnj_topo: bool = False
    meta: bool = False
    num: tuple | None = None            # (x, y|None)
    start_score: float = 0.0
    fim_score: float = 0.0
    fim: bool = False
    incompleta: bool = False
    minuscula: bool = False
    prosa: bool = False
    refs: set = field(default_factory=set)
    refs_topo: set = field(default_factory=set)
    palavras: set = field(default_factory=set)
    conf_ocr: float = 0.0
    titulo_y: float | None = None
    cab: str = ""                       # texto (dobrado) do cabeçalho, acima do título/endereçamento
    cab_tipo: str | None = None         # JUDICIARIO | MP | CAMARA | MUNICIPAL | ASSOC | EMPRESA
    cargo_tipo: str | None = None       # idem, deduzido da assinatura
    num_estilo: str | None = None
    alt: float = 0.0                    # altura mediana das palavras / altura da página
    larg: float = 0.0                   # largura mediana por caractere / altura da palavra (serifa x sem serifa, tamanho)
    marg: float = 0.0                   # margem esquerda típica / largura da página
    is_start: bool = False
    motivos_start: list = field(default_factory=list)


PARAR_CAB = re.compile(r"^(DE|PARA|ASSUNTO|REF|REFERENCIA|PROCESSO|PROCEDIMENTO|AUTOR|REU)\s*[:.]|"
                       r"^(AO|AOS|A|AS|A/C|EXMO|EXMA|EXCELENTISSIM[OA]|ILMO|ILMA|ILUSTRISSIM[OA]|SENHOR[A]?)\b|"
                       r"^ILHEUS\W")

KIND_CAB = [("JUDICIARIO", re.compile(r"PODER JUDICIARIO|TRIBUNAL DE JUSTICA|\bVARA\b|COMARCA")),
            ("MP", re.compile(r"MINISTERIO PUBLICO|PROMOTORIA")),
            ("CAMARA", re.compile(r"CAMARA (MUNICIPAL|DE VEREADORES)|GABINETE DO VEREADOR")),
            ("ASSOC", re.compile(r"ASSOCIACAO|SINDICATO|COOPERATIVA|CONSELHO COMUNITARIO")),
            ("EMPRESA", re.compile(r"\bLTDA\b|EIRELI|\bCNPJ\b|S/A\b")),
            ("MUNICIPAL", re.compile(r"PREFEITURA|SECRETARIA MUNICIPAL|PROCURADORIA|GABINETE DO PREFEITO|CONTROLADORIA"))]
KIND_CARGO = [("JUDICIARIO", re.compile(r"\bJUIZ[A]?\b")), ("MP", re.compile(r"\bPROMOTOR[A]?\b")),
              ("CAMARA", re.compile(r"\bVEREADOR[A]?\b")), ("ASSOC", re.compile(r"\bPRESIDENTE\b")),
              ("EMPRESA", re.compile(r"REPRESENTANTE|\bSOCIO|ADMINISTRADOR")),
              ("MUNICIPAL", re.compile(r"\bSECRETARI[OA]|PROCURADOR|CHEFE DE GABINETE|\bPREFEIT"))]


def _palavras(texto_dobrado: str) -> set:
    return {w for w in re.findall(r"[A-Z]{5,}", texto_dobrado)}


def construir_pagina(idx: int, res: dict, limiar_start: float = 2.0) -> Pag:
    p = Pag(idx=idx)
    if res.get("erro"):
        p.erro = res["erro"]
        return p
    if res.get("blank"):
        p.blank = True
        return p
    H = max(res.get("h", 1), 1)
    for l in res["lines"]:
        t = l["t"].strip()
        if not t:
            continue
        y = ((l["b"][1] + l["b"][3]) / 2) / H
        p.linhas.append((dobrar(t), y, t))
    p.linhas.sort(key=lambda x: x[1])
    p.texto = "\n".join(l[2] for l in p.linhas)
    p.conf_ocr = res.get("conf", 0.0)
    if not p.linhas:
        return p
    D = [l[0] for l in p.linhas]
    p.topo = "\n".join(l[0] for l in p.linhas if l[1] < 0.28)
    topo_linhas = [l for l in p.linhas if l[1] < 0.28]

    # ---- numeração (topo 12% ou rodapé 82%+; senão em qualquer lugar, só o formato "Página X de Y")
    for rgx_i, rgx in enumerate(NUM_PAG):
        achou = None
        for d, y, _ in p.linhas:
            if y < 0.12 or y > 0.80:
                m = rgx.search(d)
                if m:
                    achou = m
                    break
        if achou is None and rgx_i == 0:
            for d, y, _ in p.linhas:
                m = rgx.search(d)
                if m:
                    achou = m
                    break
        if achou:
            x = int(achou.group(1))
            yv = int(achou.group(2)) if achou.lastindex and achou.lastindex >= 2 else None
            if yv is not None and not (1 <= x <= yv <= 300):
                continue
            if yv is None and not (1 <= x <= 2000):
                continue
            p.num = (x, yv)
            p.num_estilo = ("PAGINA_DE" if rgx_i == 0 and "PAGINA" in achou.group(0) else
                            "PAG_BARRA" if rgx_i == 0 else "FLS" if rgx_i == 2 else "PAGINA")
            break

    # ---- cabeçalho institucional
    hs = 0.0
    for rgx, peso in CABECALHO:
        if rgx.search(p.topo):
            hs += peso
    p.header_score = min(hs, 3.5)

    # ---- título: no início de uma linha, até 50% da página
    for d, y, orig in p.linhas:
        if y > 0.50:
            break
        if len(d) > 90:
            continue
        for tipo, rgx in TITULOS:
            if rgx.search(d):
                letras = [c for c in orig if c.isalpha()]
                maius = sum(c.isupper() for c in letras) / max(len(letras), 1)
                forte = maius >= 0.7
                if not forte and not re.search(r"\d", d):
                    continue  # título em minúsculas sem número é frase do texto
                p.titulo, p.titulo_forte = tipo, forte
                break
        if p.titulo:
            break

    for d, y, orig in p.linhas:
        if p.titulo and y <= 0.50 and any(rg.search(d) for t, rg in TITULOS if t == p.titulo) and len(d) <= 90:
            p.titulo_y = y
            break
    cab = []
    for d, y, orig in p.linhas:
        if y >= 0.30 or (p.titulo_y is not None and y >= p.titulo_y - 0.004) or PARAR_CAB.search(d):
            break
        cab.append(d)
    p.cab = "\n".join(cab)
    for nome_k, rg in KIND_CAB:
        if rg.search(p.cab):
            p.cab_tipo = nome_k
            break

    # ---- CNJ no começo, meta (De:/Para:/Assunto:)
    for d, y, _ in p.linhas:
        if y < 0.5 and CNJ_RE.search(d):
            p.cnj_topo = True
        if y < 0.55 and re.match(r"^(DE|PARA|ASSUNTO|REF|REFERENCIA|PROCESSO|PROCEDIMENTO)\s*:", d):
            p.meta = True

    # ---- referências (para ligar continuação ao documento)
    for d, y, _ in p.linhas:
        for m in REF_RE.finditer(d):
            r = f"{int(m.group(1))}/{m.group(2)}"
            p.refs.add(r)
            if y < 0.13:
                p.refs_topo.add(r)
        m = CNJ_RE.search(d)
        if m:
            r = "".join(m.groups())
            p.refs.add(r)
            if y < 0.13:
                p.refs_topo.add(r)
        for m in MP_PROC_RE.finditer(d):
            p.refs.add(m.group(0))
            if y < 0.13:
                p.refs_topo.add(m.group(0))

    # ---- fecho / assinatura
    fs = 0.0
    for d, y, orig in p.linhas:
        if FECHO.search(d):
            fs = max(fs, 0.5)        # só o cumprimento ("Atenciosamente"): ainda falta a assinatura
        if y > 0.45 and DATA_LINHA.search(d) and "ILHEUS" in d:
            fs += 1.0
        if (y > 0.35 or len(p.linhas) <= 10) and CARGO.search(d) and len(d) < 75 and not d.rstrip().endswith(",") \
                and ":" not in d and not NAO_ASSINATURA.search(d):
            fs += 1.0
            k = [l[0] for l in p.linhas].index(d)
            if k > 0:
                ant = p.linhas[k - 1][2].split()
                if 2 <= len(ant) <= 7 and not re.search(r"\d|:", p.linhas[k - 1][2]) \
                        and not p.linhas[k - 1][2].rstrip().endswith((".", ",")) \
                        and not NAO_ASSINATURA.search(p.linhas[k - 1][0]):
                    fs += 0.6      # nome logo acima do cargo = bloco de assinatura
        if PROTOCOLO.search(d):
            fs += 1.0
    p.fim_score = fs
    p.fim = fs >= 1.5

    # ---- continuidade de texto
    corpo = [l for l in p.linhas if not (any(r.search(l[0]) for r in NUM_PAG) and (l[1] < 0.12 or l[1] > 0.8))]
    if corpo:
        ultima = corpo[-1][2].rstrip()
        p.incompleta = (not p.fim) and (not ultima or ultima[-1] not in '.!?:;)"”')
        for d, y, orig in corpo:
            if y < 0.09 and (REF_RE.search(d) or "PREFEITURA" in d or CNJ_RE.search(d)):
                continue   # cabeçalho corrente
            letras = [c for c in orig if c.isalpha()]
            if letras:
                p.minuscula = letras[0].islower()
            break
    p.prosa = sum(1 for d in D if len(d) >= 40) >= 6
    p.palavras = _palavras(" ".join(D))

    # ---- tipografia (mesmo documento = mesma fonte e mesma margem) e cargo do assinante
    alts = [(pp[4] - pp[2]) / H for l in res["lines"] for pp in l["p"] if len(pp[0]) >= 3]
    if alts:
        p.alt = float(np.median(alts))
        lg = [((pp[3] - pp[1]) / len(pp[0])) / max(pp[4] - pp[2], 1) for l in res["lines"] for pp in l["p"]
              if len(pp[0]) >= 5 and pp[3] - pp[1] > 0]
        if lg:
            p.larg = float(np.median(lg))
    W = max(res.get("w", 1), 1)
    xs = sorted(l["b"][0] / W for l in res["lines"] if len(l["t"]) > 20)
    if len(xs) >= 6:     # página quase vazia (só assinatura centralizada) não serve de referência
        p.marg = xs[max(0, int(len(xs) * 0.15) - 1)]
    for d, y, orig in p.linhas:
        if (y > 0.35 or len(p.linhas) <= 10) and len(d) < 90 and not d.rstrip().endswith(",") and ":" not in d \
                and not NAO_ASSINATURA.search(d):
            for nome_k, rg in KIND_CARGO:
                if rg.search(d):
                    p.cargo_tipo = nome_k
                    break

    # ---- pontuação de início
    s, mot = 0.0, []
    if p.header_score:
        s += p.header_score
        mot.append(f"cabeçalho institucional ({p.header_score:.1f})")
    if p.titulo:
        v = 2.0 if p.titulo_forte else 1.2
        s += v
        mot.append(f"título {p.titulo} ({v:.1f})")
    if p.cnj_topo:
        s += 1.0
        mot.append("nº CNJ no começo (1.0)")
    if p.meta:
        s += 0.6
        mot.append("campos De/Para/Assunto (0.6)")
    if p.num:
        if p.num[0] == 1:
            s += 0.5
            mot.append("numeração página 1 (0.5)")
        else:
            s -= 3.0
            mot.append(f"numeração página {p.num[0]} (-3.0)")
    p.start_score = s
    p.motivos_start = mot
    p.is_start = s >= limiar_start
    return p


# ====================================================================== segmentação
@dataclass
class Doc:
    anchor: int
    paginas: list
    total: int | None
    refs: set
    palavras: set
    alturas: list = field(default_factory=list)
    largs: list = field(default_factory=list)
    margens: list = field(default_factory=list)
    scores: dict = field(default_factory=dict)       # idx página -> pontuação de anexação
    motivo: list = field(default_factory=list)
    conf_sep: float = 0.0
    faltam: bool = False
    ordem_por_numeracao: bool = False
    ambiguo_com: list = field(default_factory=list)


@dataclass
class Solto:
    paginas: list
    motivo: str
    candidatos: list = field(default_factory=list)


@dataclass
class Resultado:
    docs: list
    soltos: list
    brancas: list
    erros: list
    diag: dict = field(default_factory=dict)


def segmentar(paginas: list[Pag], cfg) -> Resultado:
    minima = float(cfg.get("confianca", {}).get("minima_anexar_pagina", 0.55))
    por_idx = {p.idx: p for p in paginas}
    uteis = [p for p in paginas if not p.blank and not p.erro and p.linhas]
    util_pos = {p.idx: i for i, p in enumerate(uteis)}
    brancas = [p.idx for p in paginas if p.blank]
    erros = [(p.idx, p.erro) for p in paginas if p.erro]
    vazias = [p.idx for p in paginas if not p.blank and not p.erro and not p.linhas]

    docs: list[Doc] = []
    for p in uteis:
        if p.is_start:
            total = p.num[1] if (p.num and p.num[1]) else None
            docs.append(Doc(anchor=p.idx, paginas=[p.idx], total=total,
                            refs=set(p.refs_topo or p.refs), palavras=set(p.palavras),
                            alturas=[p.alt] if p.alt else [], margens=[p.marg] if p.marg else [],
                            largs=[p.larg] if p.larg else []))
    cont = [p for p in uteis if not p.is_start]
    if not docs or not cont:
        soltos = [Solto([p.idx], _motivo_solto_sem_doc(p)) for p in cont]
        soltos += [Solto([i], "página com ruído, sem texto reconhecível") for i in vazias]
        return _fechar(paginas, docs, soltos, brancas, erros, por_idx)

    D, Pn = len(docs), len(cont)

    def prev_util(idx):
        i = util_pos.get(idx)
        return uteis[i - 1].idx if i is not None and i > 0 else None

    def next_util(idx):
        i = util_pos.get(idx)
        return uteis[i + 1].idx if i is not None and i + 1 < len(uteis) else None

    def pontuar(p: Pag, d: Doc) -> tuple[float, list]:
        s, why = 0.0, []
        conjunto = set(d.paginas)
        # numeração
        if p.num:
            x, y = p.num
            usados = {por_idx[q].num[0] for q in d.paginas if por_idx[q].num}
            if y:
                if d.total and y != d.total:
                    s -= 0.8
                    why.append("total diferente")
                elif d.total and y == d.total:
                    s += 0.35
                    why.append(f"mesmo total ({y})")
                if x in usados:
                    s -= 0.6
                    why.append("número já ocupado")
                elif d.total and x <= y:
                    s += 0.2
                    why.append(f"ocupa a vaga {x}")
            else:
                if x in usados:
                    s -= 0.5
                elif usados and x == max(usados) + 1:
                    s += 0.25
                    why.append(f"fls. {x} segue {max(usados)}")
        if d.total and len(d.paginas) >= d.total:
            s -= 0.7
            why.append("documento já completo")
        # referências
        if p.refs_topo and d.refs:
            if p.refs_topo & d.refs:
                s += 0.5
                why.append("mesma referência")
            else:
                s -= 0.4
                why.append("referência diferente")
        # vizinhança no arquivo
        pu = prev_util(p.idx)
        nu = next_util(p.idx)
        if pu is not None and pu in conjunto:
            pp = por_idx[pu]
            if not pp.fim:
                s += 0.45 * (0.5 if (p.num and p.num[1]) else 1.0)
                why.append("vem logo após página sem fecho")
                if p.minuscula and pp.incompleta:
                    s += 0.2
                    why.append("frase continua")
            else:
                s += 0.05
        elif nu is not None and nu in conjunto and not p.is_start:
            s += 0.05
        if p.prosa:
            s += 0.1
        # estilo de numeração, remetente x cargo do assinante, fecho complementar, tipografia
        if p.num_estilo and any(por_idx[q].num_estilo for q in d.paginas):
            ref = next(por_idx[q].num_estilo for q in d.paginas if por_idx[q].num_estilo)
            if ref != p.num_estilo and not ({ref, p.num_estilo} <= {"PAGINA", "PAGINA_DE", "PAG_BARRA"}):
                s -= 0.5
                why.append("estilo de numeração diferente")
            elif ref != p.num_estilo:
                s -= 0.2
        anc = por_idx[d.anchor]
        if p.cargo_tipo and anc.cab_tipo:
            if p.cargo_tipo == anc.cab_tipo:
                s += 0.3
                why.append("assinante compatível com o cabeçalho")
            elif not (anc.cab_tipo in ("EMPRESA", "ASSOC") and p.cargo_tipo in ("EMPRESA", "ASSOC")):
                s -= 0.5
                why.append("assinante incompatível com o cabeçalho")
        d_tem_fim = any(por_idx[q].fim for q in d.paginas)
        if p.fim and not d_tem_fim:
            s += 0.35
            why.append("traz o fecho que falta ao documento")
        elif p.fim and d_tem_fim and not (p.num and p.num[1] and p.num[1] == d.total):
            s -= 0.3
            why.append("documento já tem fecho")
        if p.num and p.num[1] and not any(por_idx[q].num for q in d.paginas):
            s -= 0.25
            why.append("documento sem numeração nas outras páginas")
        if p.alt and d.alturas:
            r = abs(p.alt - float(np.median(d.alturas))) / max(p.alt, 1e-6)
            s += 0.3 if r <= 0.02 else (0.1 if r <= 0.04 else (-0.1 if r <= 0.08 else -0.3))
        if p.larg and d.largs:
            r = abs(p.larg - float(np.median(d.largs))) / max(p.larg, 1e-6)
            s += 0.2 if r <= 0.03 else (0.0 if r <= 0.07 else -0.3)
        if p.marg and d.margens:
            dm = abs(p.marg - float(np.median(d.margens)))
            s += 0.1 if dm <= 0.01 else (0.0 if dm <= 0.03 else -0.2)
        # similaridade lexical
        if p.palavras:
            ov = len(p.palavras & d.palavras) / len(p.palavras)
            s += 0.25 * ov
        # distância
        dist = min(abs(util_pos[q] - util_pos[p.idx]) for q in d.paginas if q in util_pos)
        s -= min(0.3, 0.004 * dist)
        return s, why

    S = np.full((Pn, D), -9.0)
    W = {}
    for i, p in enumerate(cont):
        for j, d in enumerate(docs):
            S[i, j], W[(i, j)] = pontuar(p, d)

    atribuida = {}
    livres = set(range(Pn))
    while livres:
        melhor = None
        for i in livres:
            linha = S[i]
            j1 = int(np.argmax(linha))
            v1 = linha[j1]
            v2 = float(np.partition(linha, -2)[-2]) if D > 1 else -9.0
            if v1 >= minima and (v1 - v2) >= 0.15:
                m = v1 - v2 + v1
                if melhor is None or m > melhor[0]:
                    melhor = (m, i, j1, v1)
        if melhor is None:
            break
        _, i, j, v = melhor
        p, d = cont[i], docs[j]
        d.paginas.append(p.idx)
        d.scores[p.idx] = v
        d.palavras |= p.palavras
        if p.alt:
            d.alturas.append(p.alt)
        if p.larg:
            d.largs.append(p.larg)
        if p.marg:
            d.margens.append(p.marg)
        d.refs |= p.refs_topo
        if not d.total and p.num and p.num[1]:
            d.total = p.num[1]
        atribuida[i] = j
        livres.discard(i)
        S[i, :] = -9.0
        for k in livres:   # só a coluna do documento alterado muda
            S[k, j], W[(k, j)] = pontuar(cont[k], d)

    soltos = []
    for i in sorted(livres):
        p = cont[i]
        ordem = np.argsort(-S[i])
        cands = [(docs[int(j)].anchor, round(float(S[i, j]), 2)) for j in ordem[:3] if S[i, j] >= 0.3]
        if p.num and p.num[0] > 1:
            mot = (f"continuação (página {p.num[0]}" + (f" de {p.num[1]}" if p.num[1] else "") + ") ")
            if len(cands) >= 2 and cands[0][1] - cands[1][1] < 0.15:
                mot += "com mais de um documento possível no lote"
            elif not cands:
                mot += "sem documento correspondente no lote"
            else:
                mot += "com ligação fraca"
        else:
            mot = _motivo_solto_sem_doc(p)
            if cands:
                mot += "; ligação fraca com algum documento" if len(cands) == 1 else "; mais de um documento possível"
        soltos.append(Solto([p.idx], mot, [c[0] for c in cands]))
    for i in vazias:
        soltos.append(Solto([i], "página com ruído, sem texto reconhecível"))
    r = _fechar(paginas, docs, soltos, brancas, erros, por_idx)
    r.diag = {"cont": [p.idx for p in cont], "S": S, "W": W}
    return r


def _motivo_solto_sem_doc(p: Pag) -> str:
    if not p.linhas:
        return "página sem texto reconhecível"
    if p.num and p.num[0] > 1:
        return f"continuação (página {p.num[0]}) sem documento correspondente"
    return "sem cabeçalho, título nem numeração: não dá para ligar a um documento"


def _fechar(paginas, docs, soltos, brancas, erros, por_idx) -> Resultado:
    for d in docs:
        _ordenar_e_pontuar(d, por_idx)
    return Resultado(docs=docs, soltos=_agrupar_soltos(soltos), brancas=brancas, erros=erros)


def _ordenar_e_pontuar(d: Doc, por_idx):
    pgs = d.paginas
    ancora = por_idx[d.anchor]
    nums = {q: por_idx[q].num[0] for q in pgs if por_idx[q].num}
    if len(nums) >= 2:
        # ordena pela numeração; páginas sem número ficam logo após a vizinha anterior no arquivo
        chave = {}
        for q in sorted(pgs):
            if q in nums:
                chave[q] = float(nums[q])
        for q in sorted(pgs):
            if q not in nums:
                ant = [r for r in sorted(pgs) if r < q and r in nums]
                chave[q] = (chave[ant[-1]] + 0.5) if ant else 0.5
        d.paginas = sorted(pgs, key=lambda q: (chave[q], q))
        d.ordem_por_numeracao = True
        if d.anchor in d.paginas and d.paginas[0] != d.anchor and nums.get(d.anchor, 1) == 1:
            d.paginas.remove(d.anchor)
            d.paginas.insert(0, d.anchor)
    else:
        d.paginas = [d.anchor] + sorted(q for q in pgs if q != d.anchor)
    ultima = por_idx[d.paginas[-1]]
    c_start = min(1.0, ancora.start_score / 4.0)
    c_pag = min([min(1.0, v / 1.2) for v in d.scores.values()] or [1.0])
    mot = [f"início: {', '.join(ancora.motivos_start) or 'sem marcadores'}"]
    comp = 0.85
    if d.total:
        nv = list(nums.values())
        completo = len(d.paginas) == d.total and len(set(nv)) == len(nv) and all(1 <= x <= d.total for x in nv)
        if completo:
            comp = 1.0
            mot.append(f"{d.total} de {d.total} páginas conferidas pela numeração")
        elif len(d.paginas) < d.total:
            comp = 0.5
            d.faltam = True
            mot.append(f"FALTAM PÁGINAS: numeração indica {d.total}, achadas {len(d.paginas)}")
        else:
            comp = 0.7
            mot.append(f"mais páginas ({len(d.paginas)}) que o total declarado ({d.total})")
    elif ultima.fim:
        comp = 1.0
        mot.append("fecho/assinatura na última página")
    else:
        mot.append("sem total declarado e sem fecho na última página")
    if len(d.paginas) > 1:
        mot.append(f"páginas anexadas: {faixas([q + 1 for q in d.paginas])}"
                   + (" (ordenadas pela numeração)" if d.ordem_por_numeracao else " (ordem do arquivo)"))
    d.conf_sep = round(max(0.0, min(1.0, (0.5 * c_start + 0.5 * c_pag) * comp)), 3)
    d.motivo = mot


def _agrupar_soltos(soltos: list[Solto]) -> list[Solto]:
    """Junta soltos consecutivos com o mesmo motivo-base em blocos (para gerar um PDF só)."""
    soltos = sorted(soltos, key=lambda s: s.paginas[0])
    out: list[Solto] = []
    for s in soltos:
        if out and s.paginas[0] == out[-1].paginas[-1] + 1 and s.motivo == out[-1].motivo:
            out[-1].paginas += s.paginas
        else:
            out.append(Solto(list(s.paginas), s.motivo, list(s.candidatos)))
    return out
