"""Testes das regras (segmentação, campos, classificação, nome) sem rodar OCR: textos prontos."""
from conftest import pagina_fake

from pipeline.analise import analisar
from pipeline.naming import montar_nome
from pipeline.segment import construir_pagina, segmentar

CI = ["ESTADO DA BAHIA", "PREFEITURA MUNICIPAL DE ILHÉUS", "SECRETARIA MUNICIPAL DE EDUCAÇÃO",
      "COMUNICAÇÃO INTERNA Nº 123/2026", "Ilhéus, 12 de outubro de 2026.",
      "De: Secretaria Municipal de Educação", "Para: Secretário Municipal de Infraestrutura",
      "Assunto: Solicitação de vistoria técnica na Escola Municipal Cidade Nova", "",
      "Senhor Secretário,", "Solicito vistoria técnica no prédio da escola, conforme demanda recebida.",
      "A situação foi constatada pelos técnicos e requer providências no menor prazo possível.",
      "Atenciosamente,", "", "Maria das Graças Oliveira", "Secretária Municipal de Educação"]


def _analisar(paginas, cfg, cat, org):
    return analisar(paginas, cfg, cat, org)


def test_ci_campos_categoria_e_nome(cfg_basica, cat_cfg, org_cfg):
    a = _analisar([pagina_fake(CI)], cfg_basica, cat_cfg, org_cfg)
    assert len(a.docs) == 1
    d = a.docs[0]
    c = {k: v["valor"] for k, v in d.campos.items()}
    assert c["tipo"] == "CI" and c["orgao"] == "SEDUC"
    assert c["numero"] == "123-2026" and c["data"] == "2026-10-12"
    assert "vistoria" in c["assunto"].lower()
    assert c["signatario_nome"] == "Maria das Graças Oliveira"
    assert "Secretária" in c["signatario_cargo"]
    assert d.categoria == "CI" and d.conf_categoria > 0.6
    assert d.nome_base == "CI_SEDUC_123-2026_12102026"


def test_campo_ausente_vira_sn_e_sd_e_nada_e_inventado(cfg_basica, cat_cfg, org_cfg):
    linhas = ["PREFEITURA MUNICIPAL DE ILHÉUS", "DECLARAÇÃO", "Declaramos que foi realizada a vistoria no local.",
              "Atenciosamente,", "", "José Carlos Andrade", "Secretário Municipal de Fazenda"]
    d = _analisar([pagina_fake(linhas)], cfg_basica, cat_cfg, org_cfg).docs[0]
    assert d.campos["numero"]["valor"] is None and d.campos["data"]["valor"] is None
    assert d.campos["processo"]["valor"] is None
    assert d.nome_base.endswith("_SN_SD")
    assert d.categoria == "OUTROS"


def test_cnj_e_justica(cfg_basica, cat_cfg, org_cfg):
    linhas = ["PODER JUDICIÁRIO DO ESTADO DA BAHIA", "COMARCA DE ILHÉUS", "2ª VARA DA FAZENDA PÚBLICA", "INTIMAÇÃO",
              "Processo nº 0001234-56.2026.8.05.0103", "Autor: Fulano de Tal", "Réu: MUNICÍPIO DE ILHÉUS", "",
              "Fica o Município de Ilhéus intimado para, no prazo de 15 dias, cumprir a determinação.",
              "Ilhéus, 3 de maio de 2026.", "Atenciosamente,", "", "Dr. Bruno Carvalho Lemos", "Juiz de Direito"]
    d = _analisar([pagina_fake(linhas)], cfg_basica, cat_cfg, org_cfg).docs[0]
    assert d.categoria == "JUSTICA"
    assert d.campos["processo"]["valor"] == "0001234-56.2026.8.05.0103"
    assert d.processo_tipo == "CNJ"
    assert d.nome_base == "INTIMACAO_TJBA_00012345620268050103_03052026"


def test_oficio_para_mp_nao_e_mp(cfg_basica, cat_cfg, org_cfg):
    linhas = ["ESTADO DA BAHIA", "PREFEITURA MUNICIPAL DE ILHÉUS", "SECRETARIA MUNICIPAL DE INFRAESTRUTURA E DEFESA CIVIL",
              "OFÍCIO Nº 45/2026", "Ilhéus, 5 de junho de 2026.", "Ao Excelentíssimo Senhor", "Dr. Alexandre Brandão Teles",
              "Promotor de Justiça – Ministério Público do Estado da Bahia", "Assunto: Resposta ao Inquérito Civil nº 003.0.123456/2026", "",
              "Em resposta à notificação recebida, informo as providências adotadas.", "Atenciosamente,", "",
              "Roberto Lima Santos", "Secretário Municipal de Infraestrutura e Defesa Civil"]
    d = _analisar([pagina_fake(linhas)], cfg_basica, cat_cfg, org_cfg).docs[0]
    assert d.categoria == "OFICIO_MP", d.motivo_categoria
    assert d.campos["orgao"]["valor"] == "SEINFRA"


def test_mp_emissor(cfg_basica, cat_cfg, org_cfg):
    linhas = ["MINISTÉRIO PÚBLICO DO ESTADO DA BAHIA", "PROMOTORIA DE JUSTIÇA DE ILHÉUS", "NOTIFICAÇÃO RECOMENDATÓRIA Nº 12/2026",
              "Ilhéus, 5 de junho de 2026.", "Procedimento: Inquérito Civil nº 003.0.123456/2026", "Ao Senhor",
              "Secretário Municipal de Infraestrutura e Defesa Civil", "",
              "O MINISTÉRIO PÚBLICO DO ESTADO DA BAHIA solicita informações, no prazo de 10 dias.", "Atenciosamente,", "",
              "Dra. Mônica Freitas Aguiar", "Promotora de Justiça"]
    d = _analisar([pagina_fake(linhas)], cfg_basica, cat_cfg, org_cfg).docs[0]
    assert d.categoria == "MP" and d.campos["orgao"]["valor"] == "MPBA"
    assert d.campos["processo"]["valor"] == "003.0.123456/2026"


def test_sigla_nova_e_registrada_para_revisao(cfg_basica, cat_cfg, org_cfg):
    linhas = ["CONSTRUTORA ALFA ENGENHARIA LTDA", "CNPJ 12.345.678/0001-90", "OFÍCIO Nº 7/2026",
              "Ilhéus, 1 de março de 2026.", "Ao Senhor", "Secretário Municipal de Infraestrutura e Defesa Civil",
              "Assunto: Solicitação de autorização para intervenção na rede de drenagem pluvial", "",
              "A empresa vem solicitar autorização para executar intervenção na rede de drenagem pluvial.",
              "Atenciosamente,", "", "Paulo Henrique Dias", "Representante Legal"]
    d = _analisar([pagina_fake(linhas)], cfg_basica, cat_cfg, org_cfg).docs[0]
    assert d.orgao_novo and d.campos["orgao"]["valor"] == "CONSTRUTORA-ALFA"
    assert d.categoria == "AUTORIZACAO"


def _doc3(cabecalho_tit, total=3):
    corpo = ["Texto de continuação do documento número um com várias palavras para parecer prosa de verdade."] * 7
    p1 = pagina_fake(cabecalho_tit + corpo, idx=0, num=f"Página 1 de {total}")
    p2 = pagina_fake(corpo + ["a frase continua aqui e segue por mais algumas linhas de texto corrido."], idx=1, num=f"Página 2 de {total}")
    p3 = pagina_fake(corpo + ["Atenciosamente,", "", "Fulano de Tal", "Secretário Municipal de Fazenda"], idx=2, num=f"Página 3 de {total}")
    return p1, p2, p3


def test_fora_de_ordem_e_misturado_reordena_por_numeracao(cfg_basica):
    cab = ["PREFEITURA MUNICIPAL DE ILHÉUS", "OFÍCIO Nº 1/2026", "Assunto: um"]
    a1, a2, a3 = _doc3(cab)
    b = pagina_fake(["PREFEITURA MUNICIPAL DE ILHÉUS", "OFÍCIO Nº 2/2026", "Assunto: dois",
                     "Texto curto do documento dois.", "Atenciosamente,", "", "Beltrano", "Secretário Municipal de Fazenda"],
                    idx=0, num="Página 1 de 1")
    # embaralha: a3, b, a1, a2
    pgs = []
    for i, p in enumerate([a3, b, a1, a2]):
        p = dict(p)
        p["idx"] = i
        pgs.append(construir_pagina(i, p))
    r = segmentar(pgs, cfg_basica)
    assert sorted(d.paginas for d in r.docs) == [[1], [2, 3, 0]]     # a página 2 (idx 3) e a 3 (idx 0) vão para o doc que começa em idx 2
    d3 = next(d for d in r.docs if len(d.paginas) == 3)
    assert d3.paginas == [2, 3, 0]          # reordenado pela numeração: 1, 2, 3
    assert d3.conf_sep > 0.7
    assert not r.soltos


def test_continuacao_orfa_vai_para_soltos(cfg_basica):
    cab = ["PREFEITURA MUNICIPAL DE ILHÉUS", "OFÍCIO Nº 1/2026", "Assunto: um"]
    a1, a2, a3 = _doc3(cab, total=3)
    orfa = dict(pagina_fake(["texto de uma página dois de outro documento qualquer " * 2] * 8, num="Página 2 de 5"))
    pgs = []
    for i, p in enumerate([a1, a2, a3, orfa]):
        p = dict(p)
        p["idx"] = i
        pgs.append(construir_pagina(i, p))
    r = segmentar(pgs, cfg_basica)
    assert [s.paginas for s in r.soltos] == [[3]]
    assert "continuação" in r.soltos[0].motivo
    assert len(r.docs) == 1 and r.docs[0].paginas == [0, 1, 2]


def test_pagina_em_branco_e_registrada(cfg_basica):
    cab = ["PREFEITURA MUNICIPAL DE ILHÉUS", "OFÍCIO Nº 1/2026", "Assunto: um", "Texto.", "Atenciosamente,", "", "Fulano de Tal",
           "Secretário Municipal de Fazenda"]
    pgs = [construir_pagina(0, pagina_fake(cab, idx=0)), construir_pagina(1, {"idx": 1, "blank": True, "w": 1000, "h": 1400, "lines": []})]
    r = segmentar(pgs, cfg_basica)
    assert r.brancas == [1] and len(r.docs) == 1


def test_faltam_paginas_vai_para_revisar(cfg_basica, cat_cfg, org_cfg):
    cab = ["PREFEITURA MUNICIPAL DE ILHÉUS", "OFÍCIO Nº 1/2026", "Assunto: um"]
    a1, a2, a3 = _doc3(cab, total=3)
    a = analisar([a1, a2], cfg_basica, cat_cfg, org_cfg)
    assert a.docs[0].status == "REVISAR" and a.docs[0].faltam_paginas


def test_colisao_de_nome_gera_v2(tmp_path):
    from pipeline.run import _escolher_nome
    usados = set()
    pasta = str(tmp_path)
    n1 = _escolher_nome(pasta, "CI_SEDUC_1-2026_01012026", ".pdf", usados)
    n2 = _escolher_nome(pasta, "CI_SEDUC_1-2026_01012026", ".pdf", usados)
    n3 = _escolher_nome(pasta, "CI_SEDUC_1-2026_01012026", ".pdf", usados)
    assert (n1, n2, n3) == ("CI_SEDUC_1-2026_01012026.pdf", "CI_SEDUC_1-2026_01012026_V2.pdf", "CI_SEDUC_1-2026_01012026_V3.pdf")


def test_correcao_manual_sobrepoe_categoria(cfg_basica, cat_cfg, org_cfg):
    from pipeline.util import faixas
    corr = {("HASHX", "1"): {"categoria": "OFICIO_EXTERNO", "orgao": "SEFAZ"}}
    a = analisar([pagina_fake(CI)], cfg_basica, cat_cfg, org_cfg, corr, "HASHX")
    assert a.docs[0].categoria == "OFICIO_EXTERNO" and a.docs[0].campos["orgao"]["valor"] == "SEFAZ"
    assert a.docs[0].nome_base == "CI_SEFAZ_123-2026_12102026"
