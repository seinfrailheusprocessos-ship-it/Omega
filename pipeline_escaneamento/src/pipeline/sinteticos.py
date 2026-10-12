"""Gerador de documentos SINTÉTICOS que imitam escaneamento (para testes e demonstração).

Tudo é inventado: nomes, números, empresas. Nenhum documento real é usado.
Gera PDFs rasterizados com ruído, inclinação, páginas viradas, páginas em branco,
documentos misturados e fora de ordem, mais um gabarito (verdade.json) para medir a qualidade.
"""
from __future__ import annotations

import json
import os
import random
import re
from dataclasses import dataclass, field

import numpy as np
from PIL import Image, ImageDraw, ImageFont

MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto",
         "setembro", "outubro", "novembro", "dezembro"]

FONTES_SERIF = ["/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf",
                "C:/Windows/Fonts/times.ttf"]
FONTES_SERIF_B = ["/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf",
                  "C:/Windows/Fonts/timesbd.ttf"]
FONTES_SANS = ["/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
               "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "C:/Windows/Fonts/arial.ttf"]
FONTES_SANS_B = ["/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
                 "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "C:/Windows/Fonts/arialbd.ttf"]


def _fonte(lista, tam):
    for c in lista:
        if os.path.exists(c):
            return ImageFont.truetype(c, tam)
    return ImageFont.load_default()


NOMES = ["Maria das Graças Oliveira", "José Carlos Andrade", "Ana Paula Ferreira", "Roberto Lima Santos",
         "Carla Mendes Pacheco", "Fernando Alves Brito", "Luciana Matos Souza", "Paulo Henrique Dias",
         "Sandra Regina Cavalcante", "Marcos Vinícius Rocha", "Tereza Cristina Nunes", "Antônio Sérgio Barreto",
         "Juliana Cardoso Meira", "Rafael Augusto Tavares", "Helena Maria Queiroz"]
SECRETARIAS = [  # (nome no cabeçalho, sigla, cargo do titular)
    ("SECRETARIA MUNICIPAL DE EDUCAÇÃO", "SEDUC", "Secretário(a) Municipal de Educação"),
    ("SECRETARIA MUNICIPAL DE SAÚDE", "SESAU", "Secretário(a) Municipal de Saúde"),
    ("SECRETARIA MUNICIPAL DE FAZENDA", "SEFAZ", "Secretário(a) Municipal de Fazenda"),
    ("SECRETARIA MUNICIPAL DE ADMINISTRAÇÃO", "SEAD", "Secretário(a) Municipal de Administração"),
    ("SECRETARIA MUNICIPAL DE MEIO AMBIENTE", "SEMAM", "Secretário(a) Municipal de Meio Ambiente"),
    ("SECRETARIA MUNICIPAL DE DESENVOLVIMENTO SOCIAL", "SEDES", "Secretário(a) Municipal de Desenvolvimento Social"),
    ("SECRETARIA MUNICIPAL DE INFRAESTRUTURA E DEFESA CIVIL", "SEINFRA", "Secretário(a) Municipal de Infraestrutura e Defesa Civil"),
    ("PROCURADORIA GERAL DO MUNICÍPIO", "PGM", "Procurador(a) Geral do Município"),
    ("GABINETE DO PREFEITO", "GAB", "Chefe de Gabinete"),
]
VEREADORES = ["Josenildo Batista", "Valdete Moreira", "Cláudio Ramos", "Edvaldo Pires", "Rita de Cássia Lopes"]
PROMOTORES = ["Dr. Alexandre Brandão Teles", "Dra. Mônica Freitas Aguiar", "Dr. Henrique Sales Cunha"]
JUIZES = ["Dr. Bruno Carvalho Lemos", "Dra. Patrícia Nogueira Veloso", "Dr. Ricardo Almeida Prado"]
EMPRESAS = ["CONSTRUTORA ALFA ENGENHARIA LTDA", "RIO CACAU SERVIÇOS URBANOS LTDA",
            "TERRAPLENAGEM SUL BAHIA EIRELI", "NORDESTE OBRAS E PAVIMENTAÇÃO LTDA", "GEOTEC CONSULTORIA LTDA"]
ASSOCIACOES = ["ASSOCIAÇÃO DE MORADORES DO BAIRRO CIDADE NOVA", "ASSOCIAÇÃO COMUNITÁRIA DO MALHADO",
               "ASSOCIAÇÃO DOS PESCADORES DE OLIVENÇA", "SINDICATO DOS TRABALHADORES RURAIS DE ILHÉUS"]
EXTERNOS = [("Companhia de Eletricidade do Estado da Bahia – COELBA", "Diretor Regional"),
            ("Empresa Baiana de Águas e Saneamento – EMBASA", "Gerente Regional"),
            ("Superintendência de Trânsito de Ilhéus", "Superintendente"),
            ("Instituto do Meio Ambiente e Recursos Hídricos – INEMA", "Diretor Geral")]
LOCAIS = ["Rua Dom Eduardo, no bairro Cidade Nova", "Avenida Soares Lopes, no Centro", "Rua Jorge Amado, no Pontal",
          "Travessa São Jorge, no Malhado", "Rua da Paz, em Olivença", "Avenida Lomanto Júnior, no Banco da Vitória",
          "Rua Bahia, no bairro São Domingos", "Estrada do Iguape, km 4"]
ACOES = ["a limpeza e desobstrução do canal de drenagem", "o reparo do pavimento danificado pelas chuvas",
         "a vistoria técnica da encosta com risco de deslizamento", "a troca de tubulação da rede pluvial",
         "a poda de árvores que atingem a fiação", "o nivelamento e cascalhamento da via",
         "a recomposição de calçada e meio-fio", "a instalação de bueiros e bocas de lobo"]
FRASES = [
    "Informamos que a demanda foi registrada em nosso sistema e aguarda a programação das equipes de campo.",
    "Solicitamos que sejam adotadas as providências cabíveis no menor prazo possível, dada a urgência do caso.",
    "A situação foi constatada pelos técnicos desta Secretaria, que elaboraram relatório com registro fotográfico.",
    "Ressaltamos que o período chuvoso agrava os riscos para os moradores e para o tráfego de veículos no local.",
    "Segue em anexo a documentação necessária para a instrução do processo e o devido acompanhamento.",
    "Tendo em vista as recentes ocorrências, pedimos atenção especial a esta solicitação e retorno sobre o andamento.",
    "A equipe responsável realizará nova visita ao local para avaliar a necessidade de materiais e maquinário.",
    "Esclarecemos que os recursos para a execução dos serviços dependem de disponibilidade orçamentária prevista.",
    "Os moradores da região vêm reclamando da situação há vários meses, conforme registros de atendimento.",
    "Permanecemos à disposição para quaisquer esclarecimentos adicionais que se façam necessários.",
    "O serviço deverá ser executado em conformidade com as normas técnicas e a legislação ambiental vigente.",
    "Solicitamos ainda que seja informado o nome do responsável técnico para fins de acompanhamento da obra.",
]


@dataclass
class DocSint:
    id: str
    categoria: str
    tipo: str
    orgao: str | None
    orgao_conhecido: bool
    numero: str | None          # "123-2026"
    data: str                   # "12102026"
    assunto: str
    destinatario: str
    sig_nome: str
    sig_cargo: str
    processo: str | None
    elementos: list = field(default_factory=list)   # [(estilo, texto)]
    numeracao: str = "pagina"   # pagina | pag | fls | nenhuma
    cabecalho_repetido: bool = False
    ref_corrente: str | None = None
    linhas_por_pagina: int = 38
    nome_final: str = ""
    paginas: list = field(default_factory=list)  # imagens PIL (ordem correta)


def _data_ext(rng, ano=2026):
    m = rng.randint(1, 12)
    d = rng.randint(1, 28)
    return f"Ilhéus, {d} de {MESES[m - 1]} de {ano}.", f"{d:02d}{m:02d}{ano}"


def _num(rng, ano=2026, pad=3):
    n = rng.randint(1, 480)
    return f"{n:0{pad}d}" if rng.random() < 0.4 else str(n), ano


def _paragrafos(rng, abertura: str, n=3):
    ps = [abertura]
    for _ in range(n):
        ps.append(" ".join(rng.sample(FRASES, rng.randint(2, 3))))
    return ps


def _cnj(rng):
    return (f"{rng.randint(1, 9999999):07d}-{rng.randint(10, 99)}.2026.8.05.0103")


def _proc_mp(rng):
    return f"003.0.{rng.randint(100000, 999999)}/2026"


def montar_documento(rng: random.Random, categoria: str, idx: int, tamanho: str = "auto") -> DocSint:
    """Cria o texto estruturado de um documento sintético da categoria pedida."""
    sec = rng.choice(SECRETARIAS)
    nome_sec, sigla_sec, cargo_sec = sec
    sig = rng.choice(NOMES)
    ext, ddmmaaaa = _data_ext(rng)
    n, ano = _num(rng)
    local = rng.choice(LOCAIS)
    acao = rng.choice(ACOES)
    d = DocSint(id=f"S{idx:03d}", categoria=categoria, tipo="", orgao=None, orgao_conhecido=True,
                numero=None, data=ddmmaaaa, assunto="", destinatario="", sig_nome=sig, sig_cargo="",
                processo=None)
    d.numeracao = rng.choices(["pagina", "pag", "nenhuma"], [0.6, 0.25, 0.15])[0]
    d.cabecalho_repetido = rng.random() < 0.2
    E = d.elementos
    cab_pref = [("cab", "ESTADO DA BAHIA"), ("cab", "PREFEITURA MUNICIPAL DE ILHÉUS")]
    n_par = {"curto": 1, "medio": 3, "longo": 6}.get(tamanho) or rng.choices([1, 3, 6], [0.4, 0.4, 0.2])[0]

    if categoria == "CI":
        d.tipo, d.orgao = "CI", sigla_sec
        d.numero = f"{int(n)}-{ano}"
        dest = rng.choice([s for s in SECRETARIAS if s[1] != sigla_sec])
        d.destinatario = dest[2]
        d.assunto = rng.choice(["Solicitação de vistoria técnica", "Pedido de manutenção de via pública",
                                "Encaminhamento de documentos para empenho", "Solicitação de equipe para limpeza de canal"]) + f" – {local}"
        d.sig_cargo = cargo_sec
        titulo = f"COMUNICAÇÃO INTERNA Nº {n}/{ano}" if rng.random() < 0.7 else f"COMUNICAÇÃO INTERNA – CI Nº {n}/{ano}"
        E += cab_pref + [("cab", nome_sec), ("tit", titulo), ("dir", ext),
                         ("txt", f"De: {nome_sec.title().replace(' De ', ' de ').replace(' E ', ' e ')}"),
                         ("txt", f"Para: {d.destinatario}"), ("txt", f"Assunto: {d.assunto}"), ("esp", "")]
        E += [("txt", f"Senhor(a) {dest[2]},"), ("esp", "")]
        E += [("par", p) for p in _paragrafos(rng, f"Solicito {acao} em {local}, conforme demanda recebida nesta Secretaria.", n_par)]
        E.append(("fecho", ""))
    elif categoria == "OFICIO_EXTERNO":
        ext_nome, ext_cargo = rng.choice(EXTERNOS)
        d.tipo, d.orgao = "OFICIO", sigla_sec
        d.numero = f"{int(n)}-{ano}"
        d.destinatario = f"{ext_cargo} – {ext_nome}"
        d.assunto = f"Solicitação de providências – {local}"
        d.sig_cargo = cargo_sec
        titulo = f"OFÍCIO Nº {n}/{ano}" if rng.random() < 0.7 else f"OFÍCIO Nº {n}/{ano} - {sigla_sec}"
        E += cab_pref + [("cab", nome_sec), ("tit", titulo), ("dir", ext), ("txt", f"Ao Ilustríssimo Senhor"),
                         ("txt", d.destinatario), ("txt", f"Assunto: {d.assunto}"), ("esp", ""),
                         ("txt", f"Senhor {ext_cargo},"), ("esp", "")]
        E += [("par", p) for p in _paragrafos(rng, f"Cumprimentando-o cordialmente, solicito {acao} em {local}.", n_par)]
        E.append(("fecho", ""))
    elif categoria == "OFICIO_MP":
        prom = rng.choice(PROMOTORES)
        d.tipo, d.orgao = "OFICIO", sigla_sec
        d.numero = f"{int(n)}-{ano}"
        d.processo = _proc_mp(rng)
        d.destinatario = f"{prom}, Promotor de Justiça"
        d.assunto = f"Resposta ao Ofício – Inquérito Civil nº {d.processo}"
        d.sig_cargo = cargo_sec
        E += cab_pref + [("cab", nome_sec), ("tit", f"OFÍCIO Nº {n}/{ano}"), ("dir", ext),
                         ("txt", "Ao Excelentíssimo Senhor"), ("txt", f"{prom}"),
                         ("txt", "Promotor de Justiça – Promotoria de Justiça de Ilhéus"),
                         ("txt", "Ministério Público do Estado da Bahia"),
                         ("txt", f"Assunto: {d.assunto}"), ("esp", ""),
                         ("txt", "Excelentíssimo Senhor Promotor de Justiça,"), ("esp", "")]
        E += [("par", p) for p in _paragrafos(rng, f"Em resposta à notificação recebida no Inquérito Civil nº {d.processo}, informo as providências adotadas em {local}.", n_par)]
        E.append(("fecho", ""))
    elif categoria == "OFICIO_JUSTICA":
        juiz = rng.choice(JUIZES)
        d.tipo, d.orgao = "OFICIO", sigla_sec
        d.numero = f"{int(n)}-{ano}"
        d.processo = _cnj(rng)
        d.destinatario = f"{juiz}, Juiz de Direito da 2ª Vara da Fazenda Pública"
        d.assunto = f"Informações – Processo nº {d.processo}"
        d.sig_cargo = cargo_sec
        E += cab_pref + [("cab", nome_sec), ("tit", f"OFÍCIO Nº {n}/{ano}"), ("dir", ext),
                         ("txt", "Ao Excelentíssimo Senhor"), ("txt", f"{juiz}"),
                         ("txt", "Juiz de Direito da 2ª Vara da Fazenda Pública da Comarca de Ilhéus"),
                         ("txt", f"Processo nº {d.processo}"), ("txt", f"Assunto: {d.assunto}"), ("esp", ""),
                         ("txt", "Excelentíssimo Senhor Juiz,"), ("esp", "")]
        E += [("par", p) for p in _paragrafos(rng, f"Em cumprimento à determinação exarada nos autos do processo nº {d.processo}, prestamos as informações sobre {local}.", n_par)]
        E.append(("fecho", ""))
    elif categoria == "PEDIDO_VEREADOR":
        ver = rng.choice(VEREADORES)
        d.tipo = rng.choice(["REQUERIMENTO", "INDICACAO"])
        d.orgao = "CMI"
        d.numero = f"{int(n)}-{ano}"
        d.destinatario = "Secretário(a) Municipal de Infraestrutura e Defesa Civil"
        d.assunto = f"Indica {acao} em {local}"
        d.sig_nome, d.sig_cargo = f"Vereador {ver}", "Vereador"
        rotulo = "REQUERIMENTO" if d.tipo == "REQUERIMENTO" else "INDICAÇÃO"
        E += [("cab", "ESTADO DA BAHIA"), ("cab", "CÂMARA MUNICIPAL DE ILHÉUS"), ("cab", f"GABINETE DO VEREADOR {ver.upper()}"),
              ("tit", f"{rotulo} Nº {n}/{ano}"), ("dir", ext), ("txt", "Ao Excelentíssimo Senhor"),
              ("txt", "Secretário(a) Municipal de Infraestrutura e Defesa Civil"), ("txt", f"Assunto: {d.assunto}"), ("esp", "")]
        E += [("par", p) for p in _paragrafos(rng, f"O Vereador que esta subscreve, no uso de suas atribuições regimentais, requer a Vossa Excelência {acao} em {local}, atendendo a pedido dos moradores.", n_par)]
        E.append(("fecho", ""))
    elif categoria == "MP":
        prom = rng.choice(PROMOTORES)
        d.tipo = rng.choice(["NOTIFICACAO", "OFICIO", "RECOMENDACAO"])
        d.orgao = "MPBA"
        d.numero = f"{int(n)}-{ano}"
        d.processo = _proc_mp(rng)
        d.destinatario = "Secretário(a) Municipal de Infraestrutura e Defesa Civil"
        d.assunto = f"Inquérito Civil nº {d.processo} – {local}"
        d.sig_nome, d.sig_cargo = prom, "Promotor de Justiça"
        rotulo = {"NOTIFICACAO": "NOTIFICAÇÃO RECOMENDATÓRIA", "OFICIO": "OFÍCIO", "RECOMENDACAO": "RECOMENDAÇÃO"}[d.tipo]
        E += [("cab", "MINISTÉRIO PÚBLICO DO ESTADO DA BAHIA"), ("cab", "PROMOTORIA DE JUSTIÇA DE ILHÉUS"),
              ("tit", f"{rotulo} Nº {n}/{ano}"), ("dir", ext),
              ("txt", f"Procedimento: Inquérito Civil nº {d.processo}"), ("txt", "Ao Senhor"),
              ("txt", "Secretário(a) Municipal de Infraestrutura e Defesa Civil"), ("esp", "")]
        E += [("par", p) for p in _paragrafos(rng, f"O MINISTÉRIO PÚBLICO DO ESTADO DA BAHIA, por intermédio da Promotoria de Justiça de Ilhéus, solicita informações sobre {acao} em {local}, no prazo de 10 (dez) dias.", n_par)]
        E.append(("fecho", ""))
    elif categoria == "JUSTICA":
        juiz = rng.choice(JUIZES)
        d.tipo = rng.choice(["INTIMACAO", "DECISAO", "DESPACHO"])
        d.orgao = "TJBA"
        d.numero = None
        d.processo = _cnj(rng)
        d.destinatario = "Município de Ilhéus"
        d.assunto = ""
        d.sig_nome, d.sig_cargo = juiz, "Juiz de Direito"
        d.numeracao = rng.choice(["fls", "pagina"])
        rotulo = {"INTIMACAO": "INTIMAÇÃO", "DECISAO": "DECISÃO", "DESPACHO": "DESPACHO"}[d.tipo]
        E += [("cab", "PODER JUDICIÁRIO DO ESTADO DA BAHIA"), ("cab", "COMARCA DE ILHÉUS"),
              ("cab", "2ª VARA DA FAZENDA PÚBLICA"), ("tit", rotulo),
              ("txt", f"Processo nº {d.processo}"), ("txt", f"Autor: {rng.choice(NOMES)}"),
              ("txt", "Réu: MUNICÍPIO DE ILHÉUS"), ("esp", "")]
        E += [("par", p) for p in _paragrafos(rng, f"Fica o Município de Ilhéus intimado para, no prazo de 15 (quinze) dias, cumprir a determinação referente a {acao} em {local}, sob pena de multa diária.", n_par)]
        E += [("dir", ext)]
        E.append(("fecho", ""))
    elif categoria == "AUTORIZACAO":
        emp = rng.choice(EMPRESAS)
        d.tipo, d.orgao, d.orgao_conhecido = "OFICIO", None, False
        d.numero = f"{int(n)}-{ano}"
        d.destinatario = "Secretário(a) Municipal de Infraestrutura e Defesa Civil"
        d.assunto = f"Solicitação de autorização para intervenção na rede de drenagem pluvial – {local}"
        d.sig_cargo = "Representante Legal"
        d.processo = None
        d.sig_nome = sig
        d.emp_nome = emp
        cnpj = f"{rng.randint(10, 99)}.{rng.randint(100, 999)}.{rng.randint(100, 999)}/0001-{rng.randint(10, 99)}"
        E += [("cab", emp), ("cab", f"CNPJ {cnpj}"), ("txt_c", f"{local}, Ilhéus – BA"),
              ("tit", f"OFÍCIO Nº {n}/{ano}"), ("dir", ext), ("txt", "Ao Senhor"),
              ("txt", "Secretário(a) Municipal de Infraestrutura e Defesa Civil – SEINFRA"),
              ("txt", f"Assunto: {d.assunto}"), ("esp", "")]
        E += [("par", p) for p in _paragrafos(rng, f"A empresa {emp}, inscrita no CNPJ {cnpj}, vem respeitosamente solicitar autorização para executar intervenção na rede de drenagem pluvial em {local}, conforme projeto em anexo.", n_par)]
        E.append(("fecho", ""))
    elif categoria == "ASSOCIACAO":
        ass = rng.choice(ASSOCIACOES)
        d.tipo, d.orgao, d.orgao_conhecido = "OFICIO", None, False
        d.numero = f"{int(n)}-{ano}"
        d.destinatario = "Secretário(a) Municipal de Infraestrutura e Defesa Civil"
        d.assunto = f"Reivindicação dos moradores – {local}"
        d.sig_cargo = "Presidente"
        d.emp_nome = ass
        E += [("cab", ass), ("txt_c", "CNPJ 12.345.678/0001-90 – Ilhéus – BA"),
              ("tit", f"OFÍCIO Nº {n}/{ano}"), ("dir", ext), ("txt", "Ao Senhor"),
              ("txt", "Secretário(a) Municipal de Infraestrutura e Defesa Civil"),
              ("txt", f"Assunto: {d.assunto}"), ("esp", "")]
        E += [("par", p) for p in _paragrafos(rng, f"Os moradores do bairro, representados por esta Associação, reivindicam {acao} em {local}, situação que se arrasta há meses.", n_par)]
        E.append(("fecho", ""))
    else:  # OUTROS
        d.tipo = rng.choice(["DECLARACAO", "ATA", "CERTIDAO"])
        d.orgao = sigla_sec
        d.numero = None
        d.destinatario = ""
        d.assunto = ""
        d.sig_cargo = cargo_sec
        rotulo = {"DECLARACAO": "DECLARAÇÃO", "ATA": "ATA DE REUNIÃO", "CERTIDAO": "CERTIDÃO"}[d.tipo]
        E += cab_pref + [("cab", nome_sec), ("tit", rotulo), ("esp", "")]
        E += [("par", p) for p in _paragrafos(rng, f"Declaramos, para os devidos fins, que foi realizada vistoria em {local}.", max(1, n_par - 1))]
        E += [("dir", ext)]
        E.append(("fecho", ""))

    d.linhas_por_pagina = rng.choice([17, 20, 24]) if n_par >= 3 else 40
    d.nome_final = _nome_esperado(d)
    return d


def _nome_esperado(d: DocSint) -> str:
    num = d.numero
    if not num and d.processo:
        num = re.sub(r"\D", "", d.processo)
    partes = [d.tipo, d.orgao or "?", num or "SN", d.data]
    return "_".join(partes) + ".pdf"


# --------------------------------------------------------------- renderização
class Pintor:
    def __init__(self, dpi: int, rng: random.Random):
        self.s = dpi / 300.0
        self.rng = rng
        serif = rng.random() < 0.6
        esc = rng.uniform(0.94, 1.08)      # cada documento vem de um modelo/emissor diferente
        self.f_txt = _fonte(FONTES_SERIF if serif else FONTES_SANS, int(44 * self.s * esc))
        self.f_b = _fonte(FONTES_SERIF_B if serif else FONTES_SANS_B, int(46 * self.s * esc))
        self.f_tit = _fonte(FONTES_SERIF_B if serif else FONTES_SANS_B, int(56 * self.s * esc))
        self.f_rod = _fonte(FONTES_SERIF if serif else FONTES_SANS, int(34 * self.s * esc))
        self.W, self.H = int(2480 * self.s), int(3508 * self.s)
        self.mx = int(rng.randint(230, 330) * self.s)
        self.my_top, self.my_bot = int(240 * self.s), int(300 * self.s)
        self.lh = int(68 * self.s)

    def quebrar(self, texto: str, fonte, largura: int) -> list[str]:
        out, cur = [], ""
        for w in texto.split():
            t = (cur + " " + w).strip()
            if fonte.getlength(t) <= largura:
                cur = t
            else:
                out.append(cur)
                cur = w
        if cur:
            out.append(cur)
        return out or [""]

    def linhas_do_doc(self, d: DocSint, pagina_um: bool = True):
        """Transforma elementos em linhas [(estilo, texto)] já quebradas."""
        L = []
        larg = self.W - 2 * self.mx
        for est, tx in d.elementos:
            if est in ("cab",):
                L.append(("cab", tx))
            elif est == "tit":
                L.append(("esp", ""))
                L.append(("tit", tx))
                L.append(("esp", ""))
            elif est == "dir":
                L.append(("dir", tx))
            elif est == "esp":
                L.append(("esp", ""))
            elif est == "txt_c":
                L.append(("cab_n", tx))
            elif est == "txt":
                for q in self.quebrar(tx, self.f_txt, larg):
                    L.append(("txt", q))
            elif est == "par":
                qs = self.quebrar("      " + tx, self.f_txt, larg)
                for q in qs:
                    L.append(("txt", q))
                L.append(("esp", ""))
            elif est == "fecho":
                L.append(("esp", ""))
                L.append(("txt", "Atenciosamente," if d.categoria not in ("JUSTICA",) else "Ilhéus, assinado eletronicamente."))
                L.append(("esp", ""))
                L.append(("esp", ""))
                L.append(("cab", d.sig_nome))
                L.append(("cab_n", d.sig_cargo))
        return L

    def paginar(self, d: DocSint) -> list[list]:
        L = self.linhas_do_doc(d)
        paginas, cur = [], []
        cap = d.linhas_por_pagina
        for item in L:
            if len(cur) >= cap:
                # evita página que comece com linha vazia
                paginas.append(cur)
                cur = []
            if not cur and item[0] == "esp":
                continue
            cur.append(item)
        if cur:
            paginas.append(cur)
        # fecho + assinatura nunca ficam sozinhos de forma estranha: aceitável
        return paginas

    def desenhar(self, d: DocSint, linhas: list, n: int, total: int) -> Image.Image:
        im = Image.new("L", (self.W, self.H), 255)
        dr = ImageDraw.Draw(im)
        y = self.my_top
        if n > 1 and d.cabecalho_repetido:
            dr.text((self.mx, y - int(110 * self.s)), f"PREFEITURA MUNICIPAL DE ILHÉUS – {d.orgao or ''}", font=self.f_rod, fill=0)
        if n > 1 and d.ref_corrente:
            dr.text((self.W - self.mx, y - int(110 * self.s)), d.ref_corrente, font=self.f_rod, fill=0, anchor="ra")
        for est, tx in linhas:
            if est == "cab":
                dr.text((self.W / 2, y), tx, font=self.f_b, fill=0, anchor="ma")
            elif est == "cab_n":
                dr.text((self.W / 2, y), tx, font=self.f_txt, fill=0, anchor="ma")
            elif est == "tit":
                dr.text((self.W / 2, y), tx, font=self.f_tit, fill=0, anchor="ma")
            elif est == "dir":
                dr.text((self.W - self.mx, y), tx, font=self.f_txt, fill=0, anchor="ra")
            elif est == "txt":
                dr.text((self.mx, y), tx, font=self.f_txt, fill=0)
            y += self.lh
        rod = None
        if d.numeracao == "pagina":
            rod = f"Página {n} de {total}"
        elif d.numeracao == "pag":
            rod = f"Pág. {n}/{total}"
        elif d.numeracao == "fls":
            rod = f"Fls. {n}"
        if rod:
            dr.text((self.W / 2, self.H - int(190 * self.s)), rod, font=self.f_rod, fill=0, anchor="ma")
        return im

    def pagina_solta(self, tipo: str, texto: str = "") -> Image.Image:
        im = Image.new("L", (self.W, self.H), 255)
        dr = ImageDraw.Draw(im)
        if tipo == "anexo":
            dr.text((self.W / 2, self.H * 0.35), "ANEXO I", font=self.f_tit, fill=0, anchor="ma")
            dr.text((self.W / 2, self.H * 0.40), "Croqui de localização – sem escala", font=self.f_txt, fill=0, anchor="ma")
            dr.rectangle([self.mx, self.H * 0.46, self.W - self.mx, self.H * 0.75], outline=0, width=4)
        elif tipo == "foto":
            rng = np.random.default_rng(self.rng.randint(0, 99999))
            ruido = (rng.normal(128, 55, (int(self.H * 0.4), int(self.W * 0.7)))).clip(0, 255).astype(np.uint8)
            im.paste(Image.fromarray(ruido), (int(self.W * 0.15), int(self.H * 0.2)))
        elif tipo == "texto":
            y = self.my_top + 300
            for q in self.quebrar(texto, self.f_txt, self.W - 2 * self.mx):
                dr.text((self.mx, y), q, font=self.f_txt, fill=0)
                y += self.lh
        return im


def degradar(im: Image.Image, rng: random.Random, forte: bool = False) -> Image.Image:
    """Efeito de scanner: inclinação, ruído, desfoque, sombra de fundo e (às vezes) página virada."""
    import cv2
    ang = rng.uniform(-1.8, 1.8)
    a = np.array(im.rotate(ang, resample=Image.BICUBIC, fillcolor=250), dtype=np.float32)
    h, w = a.shape
    g = np.linspace(rng.uniform(225, 248), rng.uniform(235, 255), w, dtype=np.float32)[None, :]
    a = a * (g / 255.0)
    nrng = np.random.default_rng(rng.randint(0, 10 ** 6))
    a += nrng.normal(0, 7 if not forte else 12, a.shape)
    n_pts = int(h * w * 0.0004)
    ys, xs = nrng.integers(0, h, n_pts), nrng.integers(0, w, n_pts)
    a[ys, xs] = nrng.choice([0, 255], n_pts)
    a = cv2.GaussianBlur(a, (0, 0), rng.uniform(0.7, 1.1))
    out = Image.fromarray(a.clip(0, 255).astype(np.uint8))
    giro = rng.choices([0, 180, 90, 270], [0.78, 0.14, 0.04, 0.04])[0]
    if giro:
        out = out.rotate(giro, expand=True)
    return out


def _png_para_pdf(imagens: list[Image.Image], destino: str, dpi: int, qualidade: int = 65, senha: str | None = None):
    import pymupdf as fitz
    doc = fitz.open()
    for im in imagens:
        w_pt, h_pt = im.width / dpi * 72, im.height / dpi * 72
        pg = doc.new_page(width=w_pt, height=h_pt)
        import io
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=qualidade)
        pg.insert_image(pg.rect, stream=buf.getvalue())
    if senha:
        doc.save(destino, encryption=fitz.PDF_ENCRYPT_AES_256, user_pw=senha, owner_pw=senha)
    else:
        doc.save(destino, deflate=True)
    doc.close()


# --------------------------------------------------------------- corpus completo
CATEGORIAS_PESOS = [("CI", 22), ("OFICIO_EXTERNO", 12), ("OFICIO_MP", 4), ("OFICIO_JUSTICA", 4),
                    ("PEDIDO_VEREADOR", 14), ("MP", 12), ("JUSTICA", 12), ("AUTORIZACAO", 8),
                    ("ASSOCIACAO", 6), ("OUTROS", 4)]


def gerar_corpus(destino: str, semente: int = 1, n_docs: int = 24, dpi: int = 200,
                 extras: bool = True) -> dict:
    """Gera lotes em `destino` e devolve (e grava) o gabarito."""
    rng = random.Random(semente)
    os.makedirs(destino, exist_ok=True)
    cats = [c for c, _ in CATEGORIAS_PESOS]
    pesos = [p for _, p in CATEGORIAS_PESOS]
    docs: list[DocSint] = []
    # garante pelo menos um de cada categoria
    seq = list(cats) + rng.choices(cats, pesos, k=max(0, n_docs - len(cats)))
    for i, c in enumerate(seq[:max(n_docs, len(cats))]):
        docs.append(montar_documento(rng, c, i + 1))
    # nomes repetidos dentro do gabarito: dois docs com o mesmo nome esperado ganham _V2 etc.
    usados: dict[str, int] = {}
    for d in docs:
        base = d.nome_final
        usados[base] = usados.get(base, 0) + 1
        if usados[base] > 1:
            d.nome_final = base.replace(".pdf", f"_V{usados[base]}.pdf")
        if d.numero and d.categoria != "JUSTICA":
            d.ref_corrente = f"{d.tipo} {d.numero.replace('-', '/')}" if rng.random() < 0.3 else None

    pint = Pintor(dpi, rng)   # usado para páginas soltas/brancas
    # renderiza páginas lógicas de cada documento (cada um com sua tipografia)
    for k, d in enumerate(docs):
        pd = Pintor(dpi, random.Random(semente * 7919 + k))
        pgs = pd.paginar(d)
        d.paginas = [pd.desenhar(d, p, i + 1, len(pgs)) for i, p in enumerate(pgs)]

    verdade = {"dpi": dpi, "documentos": {}, "arquivos": {}}
    for d in docs:
        verdade["documentos"][d.id] = {
            "categoria": d.categoria, "tipo": d.tipo, "orgao": d.orgao, "orgao_conhecido": d.orgao_conhecido,
            "numero": d.numero, "data": d.data, "assunto": d.assunto, "destinatario": d.destinatario,
            "signatario_nome": d.sig_nome, "signatario_cargo": d.sig_cargo, "processo": d.processo,
            "nome_final": d.nome_final, "n_paginas": len(d.paginas), "numeracao": d.numeracao}

    def _registrar(nome, itens):
        verdade["arquivos"][nome] = [{"doc": i[0], "n": i[1], "tipo": i[2]} for i in itens]

    # Divide documentos entre arquivos
    sequenciais = docs[: len(docs) // 3]
    misturados = docs[len(docs) // 3: 2 * len(docs) // 3]
    restantes = docs[2 * len(docs) // 3:]

    def pag(d, i):
        return (d.id, i + 1, "doc", d.paginas[i])

    # lote_01: em ordem, sem mistura
    itens = [pag(d, i) for d in sequenciais for i in range(len(d.paginas))]
    _gravar(destino, "lote_01_em_ordem.pdf", itens, rng, dpi, verdade)

    # lote_02: tudo embaralhado (fora de ordem + vários documentos misturados)
    itens = [pag(d, i) for d in misturados for i in range(len(d.paginas))]
    rng.shuffle(itens)
    _gravar(destino, "lote_02_fora_de_ordem.pdf", itens, rng, dpi, verdade)

    # lote_03: restantes + em branco + soltos + continuação órfã
    itens = [pag(d, i) for d in restantes for i in range(len(d.paginas))]
    if extras:
        itens.append((None, 0, "branca", Image.new("L", (pint.W, pint.H), 253)))
        itens.append((None, 0, "solta", pint.pagina_solta("anexo")))
        itens.append((None, 0, "solta", pint.pagina_solta("foto")))
        itens.append((None, 0, "branca", Image.new("L", (pint.W, pint.H), 250)))
        # continuação cujo documento NÃO está no lote
        orfao = montar_documento(rng, "CI", 900, "longo")
        orfao.numeracao = "pagina"
        orfao.linhas_por_pagina = 14
        pgs = pint.paginar(orfao)
        if len(pgs) >= 3:
            itens.append((None, 0, "solta", pint.desenhar(orfao, pgs[1], 2, len(pgs))))
    # embaralha só um pouco (blocos), preservando que o lote_03 é "quase em ordem"
    for _ in range(max(1, len(itens) // 6)):
        a, b = rng.randrange(len(itens)), rng.randrange(len(itens))
        itens[a], itens[b] = itens[b], itens[a]
    _gravar(destino, "lote_03_com_soltos_e_brancas.pdf", itens, rng, dpi, verdade)

    if extras and len(docs) >= 6:
        # um documento de 1 página como JPG, outro como PNG e um multipágina como TIFF
        extra = montar_documento(rng, "CI", 901, "curto")
        extra.nome_final = _nome_esperado(extra)
        verdade["documentos"][extra.id] = {
            "categoria": "CI", "tipo": extra.tipo, "orgao": extra.orgao, "orgao_conhecido": True,
            "numero": extra.numero, "data": extra.data, "assunto": extra.assunto,
            "destinatario": extra.destinatario, "signatario_nome": extra.sig_nome,
            "signatario_cargo": extra.sig_cargo, "processo": None,
            "nome_final": extra.nome_final, "n_paginas": 1, "numeracao": extra.numeracao}
        pg = pint.paginar(extra)
        img = degradar(pint.desenhar(extra, pg[0], 1, len(pg)), rng)
        img.save(os.path.join(destino, "foto_avulsa.jpg"), "JPEG", quality=75, dpi=(dpi, dpi))
        verdade["arquivos"]["foto_avulsa.jpg"] = [{"doc": extra.id, "n": 1, "tipo": "doc"}]
    with open(os.path.join(destino, "verdade.json"), "w", encoding="utf-8") as f:
        json.dump(verdade, f, ensure_ascii=False, indent=1)
    return verdade


def _gravar(destino, nome, itens, rng, dpi, verdade):
    imgs = [degradar(it[3], rng) for it in itens]
    _png_para_pdf(imgs, os.path.join(destino, nome), dpi)
    verdade["arquivos"][nome] = [{"doc": it[0], "n": it[1], "tipo": it[2]} for it in itens]


def gerar_arquivos_problema(destino: str):
    """PDF corrompido e PDF protegido por senha (para testar a pasta ERROS)."""
    os.makedirs(destino, exist_ok=True)
    with open(os.path.join(destino, "corrompido.pdf"), "wb") as f:
        f.write(b"%PDF-1.4\n" + os.urandom(2000))
    rng = random.Random(5)
    p = Pintor(100, rng)
    _png_para_pdf([p.pagina_solta("texto", "Documento protegido por senha de teste.")],
                  os.path.join(destino, "protegido.pdf"), 100, senha="segredo123")


if __name__ == "__main__":  # python -m pipeline.sinteticos PASTA [N_DOCS] [DPI]
    import sys
    pasta = sys.argv[1] if len(sys.argv) > 1 else "sinteticos"
    v = gerar_corpus(pasta, n_docs=int(sys.argv[2]) if len(sys.argv) > 2 else 24,
                     dpi=int(sys.argv[3]) if len(sys.argv) > 3 else 200)
    print(f"{len(v['documentos'])} documentos em {len(v['arquivos'])} arquivos -> {pasta}")
