"""status.json + progresso.txt atualizados a cada poucos segundos (e arquivo de trava)."""
from __future__ import annotations

import json
import os
import time

from . import VERSAO
from .util import P, escrever_atomico


class Status:
    def __init__(self, pastas, intervalo: float = 3.0, modo: str = "processar"):
        self.pastas = pastas
        self.intervalo = intervalo
        self.d = {"versao": VERSAO, "modo": modo, "etapa": "Preparando", "percentual": 0.0,
                  "paginas_total": 0, "paginas_feitas": 0, "arquivos_total": 0, "arquivos_feitos": 0,
                  "documentos": 0, "por_categoria": {}, "por_status": {}, "tempo_restante_s": None,
                  "iniciado_em": time.strftime("%Y-%m-%dT%H:%M:%S"), "atualizado_em": None,
                  "em_andamento": True, "arquivo_atual": "", "ultimos_erros": [], "run_id": None,
                  "pid": os.getpid()}
        self._t0 = time.time()
        self._ultimo = 0.0
        self._pg0 = 0

    def erro(self, msg: str):
        self.d["ultimos_erros"] = (self.d["ultimos_erros"] + [f"{time.strftime('%H:%M:%S')} {msg}"[:300]])[-10:]

    def set(self, forcar: bool = False, **kw):
        self.d.update(kw)
        tot, feitas = self.d["paginas_total"], self.d["paginas_feitas"]
        if tot:
            self.d["percentual"] = round(100.0 * feitas / tot, 1)
            dec = time.time() - self._t0
            if feitas > 0 and dec > 5:
                self.d["tempo_restante_s"] = int(dec / feitas * (tot - feitas))
        agora = time.time()
        if forcar or agora - self._ultimo >= self.intervalo:
            self._ultimo = agora
            self._gravar()

    def _gravar(self):
        self.d["atualizado_em"] = time.strftime("%Y-%m-%dT%H:%M:%S")
        try:
            escrever_atomico(self.pastas.status, json.dumps(self.d, ensure_ascii=False, indent=1))
            pct = self.d["percentual"]
            barra = "#" * int(pct / 5) + "-" * (20 - int(pct / 5))
            eta = self.d["tempo_restante_s"]
            eta_txt = f"{eta // 60} min {eta % 60} s" if eta is not None else "calculando"
            escrever_atomico(self.pastas.progresso,
                             f"[{barra}] {pct:.1f}%\nEtapa: {self.d['etapa']}\n"
                             f"Páginas: {self.d['paginas_feitas']} de {self.d['paginas_total']}\n"
                             f"Documentos gerados: {self.d['documentos']}\nTempo restante estimado: {eta_txt}\n"
                             f"Arquivo atual: {self.d['arquivo_atual']}\nAtualizado: {self.d['atualizado_em']}\n")
            tr = os.path.join(self.pastas.catalogo, ".trava")
            if os.path.exists(P(tr)):
                os.utime(P(tr))
        except OSError:
            pass

    def concluir(self, etapa="Concluído"):
        self.d["em_andamento"] = False
        self.d["etapa"] = etapa
        if self.d["paginas_total"]:
            self.d["percentual"] = 100.0 if etapa == "Concluído" else self.d["percentual"]
        self.d["tempo_restante_s"] = 0
        self._gravar()


class Trava:
    """Impede duas execuções ao mesmo tempo (ex.: agendador + duplo clique)."""

    def __init__(self, pastas, validade_s: int = 180):
        self.caminho = os.path.join(pastas.catalogo, ".trava")
        self.validade = validade_s
        self.minha = False

    def pegar(self) -> bool:
        P(self.caminho).parent.mkdir(parents=True, exist_ok=True)
        try:
            fd = os.open(P(self.caminho), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            os.write(fd, str(os.getpid()).encode())
            os.close(fd)
            self.minha = True
            return True
        except FileExistsError:
            try:
                if time.time() - os.path.getmtime(P(self.caminho)) > self.validade:
                    os.remove(P(self.caminho))        # trava velha: processo anterior morreu
                    return self.pegar()
            except OSError:
                pass
            return False

    def soltar(self):
        if self.minha:
            try:
                os.remove(P(self.caminho))
            except OSError:
                pass
