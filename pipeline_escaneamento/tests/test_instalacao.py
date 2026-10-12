import os

RAIZ = os.path.join(os.path.dirname(__file__), "..")


def test_arquivos_de_entrega_existem():
    for f in ["INSTALAR.bat", "PROCESSAR.bat", "SIMULAR.bat", "DESFAZER.bat", "AGENDAR_DIARIO.bat", "LEIA-ME.md",
              "CONTRATO_OMEGA.md", "DECISOES.md", "QUALIDADE.md", "config/config.yaml", "config/categorias.yaml",
              "config/orgaos.yaml", "requirements.txt", "instalar.ps1"]:
        assert os.path.exists(os.path.join(RAIZ, f)), f


def test_bats_com_quebra_de_linha_windows():
    for f in os.listdir(RAIZ):
        if f.endswith((".bat", ".ps1")):
            b = open(os.path.join(RAIZ, f), "rb").read()
            assert b"\r\n" in b and b"\n" not in b.replace(b"\r\n", b""), f


def test_ps1_com_bom_utf8():
    assert open(os.path.join(RAIZ, "instalar.ps1"), "rb").read().startswith(b"\xef\xbb\xbf")


def test_categorias_e_config_validos(cfg_basica, cat_cfg, org_cfg):
    exigidas = {"CI", "OFICIO_EXTERNO", "OFICIO_MP", "OFICIO_JUSTICA", "PEDIDO_VEREADOR", "MP", "JUSTICA", "AUTORIZACAO",
                "ASSOCIACAO", "OUTROS"}
    assert exigidas <= set(cat_cfg["categorias"])
    assert cfg_basica.ocr.dpi == 300 and cfg_basica.mover_para_processados is False
    assert cfg_basica.entrada.endswith("ESCANEADOS") and cfg_basica.saida.endswith("6_Pipeline")
    assert any(o["sigla"] == "SEINFRA" for o in org_cfg["orgaos"])
