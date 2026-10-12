"""Carregamento das configurações (config.yaml, categorias.yaml, orgaos.yaml)."""
from __future__ import annotations

import copy
import os
from pathlib import Path

import yaml

RAIZ_PROJETO = Path(__file__).resolve().parents[2]


def _mesclar(base: dict, novo: dict) -> dict:
    for k, v in (novo or {}).items():
        if isinstance(v, dict) and isinstance(base.get(k), dict):
            _mesclar(base[k], v)
        else:
            base[k] = v
    return base


class Cfg(dict):
    """dict com acesso por ponto: cfg.ocr.dpi"""

    def __getattr__(self, k):
        try:
            v = self[k]
        except KeyError as e:
            raise AttributeError(k) from e
        return Cfg(v) if isinstance(v, dict) else v


def carregar_yaml(caminho) -> dict:
    with open(caminho, "r", encoding="utf-8-sig") as f:
        return yaml.safe_load(f) or {}


def pasta_config() -> Path:
    return Path(os.environ.get("PIPELINE_CONFIG_DIR", RAIZ_PROJETO / "config"))


def carregar_config(arquivo: str | None = None, sobrescrever: dict | None = None) -> Cfg:
    """config.yaml do projeto serve de base; um arquivo indicado (ou valores avulsos) é mesclado por cima."""
    base = pasta_config() / "config.yaml"
    cfg = carregar_yaml(base)
    arq = Path(arquivo) if arquivo else base
    if arquivo:
        _mesclar(cfg, carregar_yaml(arq))
    if sobrescrever:
        _mesclar(cfg, sobrescrever)
    cfg["_arquivo"] = str(arq)
    pasta = arq.parent if (arq.parent / "categorias.yaml").exists() else pasta_config()
    cfg["_pasta_config"] = str(pasta)
    return Cfg(cfg)


def carregar_categorias(cfg) -> dict:
    return carregar_yaml(Path(cfg["_pasta_config"]) / "categorias.yaml")


def carregar_orgaos(cfg) -> dict:
    return carregar_yaml(Path(cfg["_pasta_config"]) / "orgaos.yaml")


class Pastas:
    """Todas as pastas de saída derivadas da raiz."""

    def __init__(self, cfg, categorias: dict):
        self.raiz = cfg["saida"]
        j = lambda *p: os.path.join(self.raiz, *p)
        self.soltos = j("SOLTOS")
        self.originais_ocr = j("ORIGINAIS_OCR")
        self.revisar = j("REVISAR")
        self.erros = j("ERROS")
        self.catalogo = j("_CATALOGO")
        self.logs = j("_CATALOGO", "logs")
        self.manifestos = j("_CATALOGO", "manifestos")
        self.textos = j("_CATALOGO", "textos")
        self.cache = j("_CATALOGO", "cache")
        self.simulacao = j("_CATALOGO", "simulacao")
        self.calibracao = j("_CATALOGO", "calibracao")
        self.categorias = {
            nome: j(dados.get("pasta") or f"SAIDA{nome}")
            for nome, dados in categorias["categorias"].items()
        }
        self.db = j("_CATALOGO", "catalogo.sqlite")
        self.status = j("_CATALOGO", "status.json")
        self.progresso = j("_CATALOGO", "progresso.txt")
        self.jsonl = j("_CATALOGO", "catalogo.jsonl")
        self.csv = j("_CATALOGO", "catalogo.csv")
        self.xlsx = j("_CATALOGO", "CATALOGO.xlsx")
        self.orgaos_novos = j("_CATALOGO", "orgaos_novos.csv")
