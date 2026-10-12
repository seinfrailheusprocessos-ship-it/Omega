"""Simular, amostra, desfazer, mover para PROCESSADOS, caminhos difíceis."""
import os
import shutil

import pytest
from conftest import precisa_ocr

from pipeline import sinteticos
from pipeline.catalogo import Catalogo
from pipeline.config import Pastas, carregar_categorias, carregar_config
from pipeline.desfazer import desfazer
from pipeline.run import executar
from pipeline.util import P, sha256_arquivo

pytestmark = precisa_ocr


def _montar(tmp_path, nome_ent="Entrada ", nome_sai="Saída", mover=False, n_docs=5):
    ent = os.path.join(str(tmp_path), nome_ent)
    sai = os.path.join(str(tmp_path), nome_sai)
    sinteticos.gerar_corpus(ent, semente=21, n_docs=n_docs, dpi=150, extras=False)
    os.remove(os.path.join(ent, "verdade.json"))
    cfg = carregar_config(sobrescrever={"entrada": ent, "saida": sai, "ocr": {"dpi": 150},
                                        "mover_para_processados": mover})
    return cfg, ent, sai


def _arquivos(raiz):
    out = []
    for r, _, fs in os.walk(P(raiz)):
        out += [os.path.join(r, f) for f in fs]
    return out


def test_simular_nao_grava_documentos(tmp_path):
    cfg, ent, sai = _montar(tmp_path, n_docs=4)
    r = executar(cfg, simular=True, console=False)
    assert r["ok"] and r["documentos"] >= 3
    assert os.path.exists(r["plano"])
    for pasta in ("SAIDACI", "SOLTOS", "ORIGINAIS_OCR", "REVISAR", "ERROS"):
        assert not os.path.exists(P(os.path.join(sai, pasta))), pasta
    pdfs = [f for f in _arquivos(sai) if f.endswith(".pdf")]
    assert pdfs == []
    # nada ficou registrado: um processamento real depois ainda faz o trabalho
    r2 = executar(cfg, console=False)
    assert r2["documentos"] >= 3


def test_amostra_gera_relatorio_sem_mover(tmp_path):
    cfg, ent, sai = _montar(tmp_path, n_docs=4)
    r = executar(cfg, amostra=4, console=False)
    assert r["ok"] and os.path.exists(r["relatorio"])
    assert "Relatório de calibração" in open(r["relatorio"], encoding="utf-8").read()
    assert not [f for f in _arquivos(sai) if f.endswith(".pdf")]


def test_desfazer_volta_ao_estado_anterior(tmp_path):
    cfg, ent, sai = _montar(tmp_path, n_docs=4)
    hashes = {f: sha256_arquivo(os.path.join(ent, f)) for f in os.listdir(ent)}
    r = executar(cfg, console=False)
    assert r["documentos"] >= 3
    pastas = Pastas(cfg, carregar_categorias(cfg))
    assert [f for f in _arquivos(sai) if f.endswith(".pdf")]
    d = desfazer(cfg, console=lambda *_: None)
    assert d["ok"] and d["removidos"] > 5
    assert not [f for f in _arquivos(sai) if f.endswith((".pdf", ".json")) and "_CATALOGO" not in f.replace("\\", "/")]
    cat = Catalogo(pastas.db)
    assert cat.itens() == []
    cat.fechar()
    for f, h in hashes.items():
        assert sha256_arquivo(os.path.join(ent, f)) == h
    # e dá para processar de novo (o desfazer libera os arquivos)
    r2 = executar(cfg, console=False)
    assert r2["documentos"] == r["documentos"]


def test_desfazer_preserva_arquivo_alterado_pelo_usuario(tmp_path):
    cfg, ent, sai = _montar(tmp_path, n_docs=3)
    executar(cfg, console=False)
    pastas = Pastas(cfg, carregar_categorias(cfg))
    cat = Catalogo(pastas.db)
    it = next(i for i in cat.itens() if i["status"] in ("AUTO", "REVISAR"))
    cat.fechar()
    with open(P(it["caminho_final"]), "ab") as f:
        f.write(b"edicao do usuario")
    d = desfazer(cfg, console=lambda *_: None)
    assert d["mantidos"] >= 1 and os.path.exists(P(it["caminho_final"]))


def test_mover_para_processados_e_desfazer_devolve(tmp_path):
    cfg, ent, sai = _montar(tmp_path, mover=True, n_docs=3)
    nomes = sorted(f for f in os.listdir(ent) if f.endswith(".pdf"))
    executar(cfg, console=False)
    assert not [f for f in os.listdir(ent) if f.endswith(".pdf")]
    assert sorted(os.listdir(os.path.join(ent, "PROCESSADOS"))) == nomes
    desfazer(cfg, console=lambda *_: None)
    assert sorted(f for f in os.listdir(ent) if f.endswith(".pdf")) == nomes


def test_entrada_configurada_sem_o_espaco_final(tmp_path):
    """O usuário digita C:\\CL_ENTRADA\\ESCANEADOS mas a pasta real tem espaço no fim."""
    cfg, ent, sai = _montar(tmp_path, nome_ent="ESCANEADOS ", n_docs=3)
    cfg["entrada"] = ent.rstrip()
    r = executar(cfg, console=False)
    assert r["ok"] and r["documentos"] >= 2


def test_caminho_de_saida_muito_longo(tmp_path):
    profundo = str(tmp_path)
    for i in range(5):
        profundo = os.path.join(profundo, f"pasta_longa_número_{i}_" + "y" * 45)
    cfg, ent, _ = _montar(tmp_path, n_docs=3)
    cfg["saida"] = os.path.join(profundo, "Saída")
    assert len(cfg["saida"]) > 260
    r = executar(cfg, console=False)
    assert r["ok"] and r["documentos"] >= 2


def test_erro_em_uma_pagina_nao_derruba_o_lote(tmp_path, monkeypatch):
    from pipeline import paginas as pg
    cfg, ent, sai = _montar(tmp_path, n_docs=3)
    original = pg.processar_pagina

    def falha(tarefa):
        if tarefa["idx"] == 1:
            return {"idx": 1, "erro": "falha simulada", "blank": False, "lines": []}
        return original(tarefa)
    monkeypatch.setattr(pg, "processar_pagina", falha)
    # força execução sem multiprocessamento real: o executor usa a função importada em run
    from pipeline import run
    monkeypatch.setattr(run.pgmod, "processar_pagina", falha)
    cfg["processos"] = 1
    r = executar(cfg, console=False)
    assert r["ok"]
