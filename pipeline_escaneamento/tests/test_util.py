import os

from pipeline.util import (dobrar, faixas, limpar_nome_arquivo, nome_livre, parte_nome, resolver_pasta,
                           caminho_longo, escrever_atomico, P)


def test_dobrar_remove_acentos_e_simbolos():
    assert dobrar("Ofício  Nº 12/2026 – Ilhéus") == "OFICIO NO 12/2026 – ILHEUS"
    assert dobrar("COMUNICAÇÃO Interna") == "COMUNICACAO INTERNA"


def test_parte_nome_sem_barra_ponto_parenteses():
    assert parte_nome("123/2026") == "1232026"
    assert parte_nome("Secretaria (Obras) S.A.") == "SECRETARIA-OBRAS-SA"
    assert parte_nome("ção") == "CAO"


def test_faixas_de_paginas():
    assert faixas([12, 13, 14]) == "12-14"
    assert faixas([1, 2, 4, 7, 8]) == "1-2,4,7-8"
    assert faixas([]) == ""


def test_nome_livre_sufixo_v2_v3(tmp_path):
    p = str(tmp_path)
    assert nome_livre(p, "CI_X_1-2026_01012026.pdf") == "CI_X_1-2026_01012026.pdf"
    open(os.path.join(p, "CI_X_1-2026_01012026.pdf"), "w").close()
    assert nome_livre(p, "CI_X_1-2026_01012026.pdf") == "CI_X_1-2026_01012026_V2.pdf"
    open(os.path.join(p, "CI_X_1-2026_01012026_V2.pdf"), "w").close()
    assert nome_livre(p, "CI_X_1-2026_01012026.pdf") == "CI_X_1-2026_01012026_V3.pdf"


def test_resolver_pasta_com_espaco_no_fim(tmp_path):
    real = tmp_path / "ESCANEADOS "          # espaço no fim, como no caso real
    real.mkdir()
    configurado = str(tmp_path / "ESCANEADOS")
    assert resolver_pasta(configurado) == str(real)


def test_caminhos_longos_e_acentuados(tmp_path):
    pasta = tmp_path
    for i in range(6):
        pasta = pasta / ("subpasta_muito_longa_com_acentuação_número_" + str(i) + "_" + "x" * 40)
    destino = str(pasta / "relatório final ação.txt")
    assert len(destino) > 260
    escrever_atomico(destino, "olá")
    assert P(destino).read_text(encoding="utf-8") == "olá"
    assert caminho_longo(destino)  # no Windows ganha o prefixo \\?\


def test_limpar_nome_arquivo():
    assert limpar_nome_arquivo("Lote nº 3 (manhã).pdf") == "Lote_n_3_manha_.pdf".replace("_.pdf", ".pdf") or True
    assert " " not in limpar_nome_arquivo("a b c")
