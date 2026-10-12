"""Modo opcional: fica de olho na pasta de entrada e processa quando chegam arquivos novos."""
from __future__ import annotations

import os
import time

from .config import Pastas, carregar_categorias
from .run import executar, listar_entrada
from .util import caminho_longo, resolver_pasta


def vigiar(cfg, console=print):
    entrada = resolver_pasta(cfg["entrada"])
    intervalo = int(cfg.vigiar.intervalo_segundos)
    estab = int(cfg.vigiar.estabilidade_segundos)
    vistos: dict[str, tuple] = {}
    ja_tratados: dict[str, tuple] = {}
    console(f"Vigiando {entrada} a cada {intervalo}s. Para parar, feche a janela ou aperte Ctrl+C.")
    try:
        while True:
            atuais = {}
            for c in listar_entrada(entrada, cfg["extensoes"], cfg["pasta_processados"]):
                try:
                    st = os.stat(caminho_longo(c))
                    atuais[c] = (st.st_size, int(st.st_mtime))
                except OSError:
                    continue
            novos = [c for c, sig in atuais.items() if ja_tratados.get(c) != sig]
            if novos:
                estaveis = all(vistos.get(c, (None, 0))[0] == atuais[c] and time.time() - vistos[c][1] >= estab
                               for c in novos)
                for c in novos:
                    if vistos.get(c, (None,))[0] != atuais[c]:
                        vistos[c] = (atuais[c], time.time())
                if estaveis:
                    console(f"{len(novos)} arquivo(s) novo(s) estável(is): processando...")
                    r = executar(cfg, console=True)
                    if r.get("ok") or True:
                        ja_tratados.update({c: atuais[c] for c in novos})
            time.sleep(intervalo)
    except KeyboardInterrupt:
        console("Vigilância encerrada.")
