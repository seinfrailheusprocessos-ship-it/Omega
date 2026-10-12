"""Orquestração: ingestão -> OCR paralelo -> segmentação -> campos -> categoria -> saída -> catálogo."""
from __future__ import annotations

import csv
import json
import logging
import os
import shutil
import tempfile
import time
import traceback
import multiprocessing
from concurrent.futures import ProcessPoolExecutor, as_completed
from dataclasses import dataclass, field

from . import VERSAO, imaging, paginas as pgmod, saida
from .analise import analisar
from .catalogo import Catalogo, exportar_tudo, agora
from .config import Pastas, carregar_categorias, carregar_orgaos
from .status import Status, Trava
from .util import (P, caminho_longo, faixas, garantir_pasta, limpar_nome_arquivo, resolver_pasta,
                   sha256_arquivo, sha256_bytes, escrever_atomico)

log = logging.getLogger("pipeline")

IGNORAR_NOMES = ("thumbs.db", "desktop.ini", ".ds_store")


@dataclass
class Arq:
    caminho: str
    rel: str
    hash: str
    tamanho: int
    n_paginas: int
    usar: int = 0                       # páginas a processar (amostra)
    resultados: dict = field(default_factory=dict)


class Manifesto:
    """Registro linha a linha (JSONL) de tudo o que a execução criou/moveu: base do --desfazer."""

    def __init__(self, caminho: str | None):
        self.caminho = caminho
        if caminho:
            P(caminho).parent.mkdir(parents=True, exist_ok=True)
            self.f = open(P(caminho), "a", encoding="utf-8")
        else:
            self.f = None

    def add(self, tipo: str, **kw):
        if self.f:
            self.f.write(json.dumps({"tipo": tipo, **kw}, ensure_ascii=False) + "\n")
            self.f.flush()
            os.fsync(self.f.fileno())

    def arquivo(self, caminho: str):
        try:
            self.add("criado", caminho=caminho, sha256=sha256_arquivo(caminho))
        except OSError:
            self.add("criado", caminho=caminho, sha256=None)

    def fechar(self):
        if self.f:
            self.f.close()


# ------------------------------------------------------------------ utilidades
def configurar_log(pastas: Pastas, console: bool = True):
    garantir_pasta(pastas.logs)
    nome = os.path.join(pastas.logs, f"pipeline_{time.strftime('%Y%m%d_%H%M%S')}.log")
    log.setLevel(logging.INFO)
    for h in list(log.handlers):
        log.removeHandler(h)
    fh = logging.FileHandler(P(nome), encoding="utf-8")
    fh.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    log.addHandler(fh)
    if console:
        ch = logging.StreamHandler()
        ch.setFormatter(logging.Formatter("%(message)s"))
        log.addHandler(ch)
    return nome


def listar_entrada(entrada: str, exts: list[str], processados: str) -> list[str]:
    exts = tuple(e.lower() for e in exts)
    out = []
    proc_abs = os.path.normcase(os.path.normpath(os.path.join(entrada, processados)))
    for raiz, dirs, arqs in os.walk(caminho_longo(entrada)):
        r_norm = os.path.normcase(os.path.normpath(raiz.replace("\\\\?\\", "", 1) if raiz.startswith("\\\\?\\") else raiz))
        dirs[:] = [d for d in dirs if os.path.normcase(os.path.normpath(os.path.join(r_norm, d))) != proc_abs
                   and not d.startswith(".")]
        for a in arqs:
            if a.lower() in IGNORAR_NOMES or a.startswith("~$") or a.startswith("."):
                continue
            if a.lower().endswith(exts):
                bruto = os.path.join(raiz, a)
                out.append(bruto[4:] if bruto.startswith("\\\\?\\") else bruto)
    return sorted(out, key=lambda x: x.lower())


def carregar_correcoes(pastas: Pastas) -> dict:
    caminho = os.path.join(pastas.catalogo, "correcoes.csv")
    out: dict = {}
    if not os.path.exists(P(caminho)):
        return out
    try:
        with open(P(caminho), "r", encoding="utf-8-sig", newline="") as f:
            for r in csv.DictReader(f, delimiter=";"):
                if not r.get("hash_origem") or not r.get("campo"):
                    continue
                out.setdefault((r["hash_origem"], r["paginas_origem"]), {})[r["campo"]] = r["valor_novo"]
    except Exception as e:
        log.warning("correcoes.csv ilegível (%s); ignorado", e)
    return out


def garantir_correcoes_csv(pastas: Pastas):
    caminho = os.path.join(pastas.catalogo, "correcoes.csv")
    if not os.path.exists(P(caminho)):
        escrever_atomico(caminho, "﻿id;hash_origem;paginas_origem;campo;valor_antigo;valor_novo;data;usuario\n")


def _pasta_destino(pastas: Pastas, categoria: str, status: str) -> str:
    if status == "REVISAR":
        return pastas.revisar
    return pastas.categorias.get(categoria) or os.path.join(pastas.raiz, f"SAIDA{categoria}")


def _escolher_nome(pasta: str, base: str, ext: str, usados: set[str]) -> str:
    n, cand = 1, f"{base}{ext}"
    while os.path.join(pasta, cand).lower() in usados or os.path.exists(P(os.path.join(pasta, cand))):
        n += 1
        cand = f"{base}_V{n}{ext}"
    usados.add(os.path.join(pasta, cand).lower())
    return cand


# ------------------------------------------------------------------ execução principal
def executar(cfg, simular: bool = False, amostra: int = 0, reprocessar_erros: bool = False,
             console: bool = True, modo_nome: str | None = None) -> dict:
    cat_cfg = carregar_categorias(cfg)
    org_cfg = carregar_orgaos(cfg)
    pastas = Pastas(cfg, cat_cfg)
    real = not simular and not amostra
    modo = modo_nome or ("simular" if simular else "amostra" if amostra else "processar")
    entrada = resolver_pasta(cfg["entrada"])
    resumo = {"modo": modo, "documentos": 0, "soltos": 0, "erros": 0, "revisar": 0, "paginas": 0, "arquivos": 0,
              "ignorados": 0, "ok": True, "mensagem": ""}
    if not os.path.isdir(caminho_longo(entrada)):
        resumo.update(ok=False, mensagem=f"A pasta de entrada não existe: {entrada}")
        print(resumo["mensagem"])
        return resumo

    garantir_pasta(pastas.catalogo)
    trava = Trava(pastas)
    if real and not trava.pegar():
        resumo.update(ok=False, mensagem="Já existe outro processamento em andamento (veja _CATALOGO\\progresso.txt). "
                                         "Aguarde ele terminar.")
        print(resumo["mensagem"])
        return resumo
    manifesto = None
    status = None
    tmp_cache = None
    try:
        configurar_log(pastas, console)
        log.info("Pipeline de Escaneamento SEINFRA v%s - modo %s", VERSAO, modo)
        log.info("Entrada: %s | Saída: %s", entrada, pastas.raiz)
        if real:
            for p in (pastas.soltos, pastas.originais_ocr, pastas.revisar, pastas.erros, pastas.manifestos, pastas.textos):
                garantir_pasta(p)
            garantir_correcoes_csv(pastas)
        db = Catalogo(pastas.db if (real or os.path.exists(P(pastas.db))) else ":memory:")
        run_id = None
        if real:
            ts = time.strftime("%Y%m%d_%H%M%S")
            mpath = os.path.join(pastas.manifestos, f"run_{ts}.jsonl")
            run_id = db.nova_run("processar", mpath)
            manifesto = Manifesto(mpath)
        else:
            manifesto = Manifesto(None)
        if not real:
            tmp_cache = tempfile.mkdtemp(prefix="pipeline_cache_")
            cache = tmp_cache
        else:
            cache = pastas.cache
            garantir_pasta(cache)
        status = Status(pastas, float(cfg.status.intervalo_segundos), modo)
        status.set(run_id=run_id, etapa="Procurando arquivos novos", forcar=True)

        # ---------------- 1) ingestão
        arquivos = listar_entrada(entrada, cfg["extensoes"], cfg["pasta_processados"])
        log.info("%d arquivo(s) encontrado(s) na entrada.", len(arquivos))
        pendentes: list[Arq] = []
        for c in arquivos:
            rel = os.path.relpath(c, entrada)
            try:
                tam = os.path.getsize(caminho_longo(c))
                with open(caminho_longo(c), "rb") as f:     # falha se estiver aberto/travado por outro programa
                    f.read(1)
                h = sha256_arquivo(c)
            except OSError as e:
                motivo = f"arquivo em uso ou ilegível ({e.__class__.__name__}); será tentado de novo na próxima rodada"
                _erro_arquivo(db, pastas, manifesto, run_id, rel, c, None, motivo, real, copiar=False, status=status)
                resumo["erros"] += 1
                continue
            reg = db.arquivo(h)
            if reg and (reg["status"] == "CONCLUIDO" or (reg["status"] == "ERRO" and not reprocessar_erros)):
                log.info("Pulando (já tratado): %s", rel)
                resumo["ignorados"] += 1
                continue
            try:
                n = imaging.contar_paginas(c)
            except PermissionError:
                _erro_arquivo(db, pastas, manifesto, run_id, rel, c, h, "PDF protegido por senha", real, status=status, tam=tam)
                resumo["erros"] += 1
                continue
            except Exception as e:
                _erro_arquivo(db, pastas, manifesto, run_id, rel, c, h, f"arquivo corrompido ou formato não reconhecido ({e})"[:200],
                              real, status=status, tam=tam)
                resumo["erros"] += 1
                continue
            if n == 0:
                _erro_arquivo(db, pastas, manifesto, run_id, rel, c, h, "arquivo sem páginas", real, status=status, tam=tam)
                resumo["erros"] += 1
                continue
            pendentes.append(Arq(c, rel, h, tam, n, usar=n))
        if real:
            db.commit()

        restante = amostra if amostra else None
        for a in pendentes:
            if restante is not None:
                a.usar = min(a.n_paginas, restante)
                restante -= a.usar
                if restante <= 0:
                    pendentes = pendentes[:pendentes.index(a) + 1]
                    break
        total_pag = sum(a.usar for a in pendentes)
        status.set(arquivos_total=len(pendentes), paginas_total=total_pag, etapa="Lendo páginas (OCR)", forcar=True)
        log.info("%d arquivo(s) novo(s), %d página(s) a processar.", len(pendentes), total_pag)
        plano: list[dict] = []
        if pendentes:
            _processar(cfg, cat_cfg, org_cfg, pastas, db, run_id, manifesto, status, pendentes, cache, real, resumo, plano)
        if real:
            status.set(etapa="Gerando catálogo (xlsx, csv, jsonl)", forcar=True)
            exportar_tudo(db, pastas)
            db.fechar_run(run_id, resumo)
            db.commit()
        else:
            _gravar_plano(pastas, plano, modo, amostra, resumo)
        status.concluir()
        resumo["mensagem"] = _mensagem_final(resumo, pastas, real)
        log.info(resumo["mensagem"])
        if real:
            db.fechar()
        return resumo
    except Exception as e:
        log.error("Erro fatal: %s\n%s", e, traceback.format_exc())
        if status:
            status.erro(f"Erro fatal: {e}")
            status.concluir("Interrompido por erro")
        resumo.update(ok=False, mensagem=f"Erro: {e}. Veja o log em _CATALOGO\\logs. Rode de novo: o que já foi lido não se perde.")
        return resumo
    finally:
        if manifesto:
            manifesto.fechar()
        trava.soltar()
        if tmp_cache:
            shutil.rmtree(tmp_cache, ignore_errors=True)


def _mensagem_final(r: dict, pastas: Pastas, real: bool) -> str:
    if not real:
        return (f"Simulação/calibração concluída: {r['documentos']} documento(s), {r['soltos']} solto(s), "
                f"{r['revisar']} para revisar. Nada foi movido nem gravado fora de _CATALOGO\\simulacao ou \\calibracao.")
    return (f"Concluído: {r['documentos']} documento(s) ({r['revisar']} para REVISAR), {r['soltos']} solto(s)/branca(s), "
            f"{r['erros']} erro(s), {r['ignorados']} arquivo(s) já processado(s) pulado(s). "
            f"Catálogo: {pastas.xlsx}")


def _erro_arquivo(db, pastas, manifesto, run_id, rel, caminho, hash_, motivo, real, copiar=True, status=None, tam=0):
    log.warning("ERRO em %s: %s", rel, motivo)
    if status:
        status.erro(f"{rel}: {motivo}")
    if not real:
        return
    destino = ""
    if copiar:
        base = os.path.basename(caminho)
        usados: set = set()
        nome = _escolher_nome(pastas.erros, os.path.splitext(base)[0], os.path.splitext(base)[1], usados)
        destino = os.path.join(pastas.erros, nome)
        try:
            P(pastas.erros).mkdir(parents=True, exist_ok=True)
            shutil.copy2(caminho_longo(caminho), caminho_longo(destino))
            manifesto.arquivo(destino)
            escrever_atomico(destino + ".motivo.txt", f"Arquivo: {rel}\nMotivo: {motivo}\nData: {agora()}\n")
            manifesto.arquivo(destino + ".motivo.txt")
        except OSError as e:
            log.warning("não consegui copiar para ERROS: %s", e)
    if hash_:
        db.registrar_arquivo(hash_, caminho, rel, tam, 0, "ERRO", motivo, run_id)
    # um único ERRO por arquivo em uso (não acumula a cada rodada)
    db.con.execute("DELETE FROM itens WHERE status='ERRO' AND arquivo_origem=? AND hash_origem IS ?", (rel, hash_))
    db.inserir_item(arquivo_origem=rel, hash_origem=hash_, paginas_origem="", n_paginas=0, status="ERRO",
                    motivo=motivo, caminho_final=destino, caminho_origem=caminho, run_id=run_id, categoria="", nome_final="")
    db.commit()


def _processar(cfg, cat_cfg, org_cfg, pastas, db, run_id, manifesto, status, pendentes, cache, real, resumo, plano):
    nproc = int(cfg.get("processos") or 0) or max(1, (os.cpu_count() or 2) - 1)
    total = sum(a.usar for a in pendentes)
    nproc = max(1, min(nproc, total))
    log.info("Usando %d processo(s) em paralelo. Motor de OCR: %s", nproc, cfg.ocr.motor)
    por_futuro = {}
    feitos_arq = 0
    usados = db.caminhos_usados() if db else set()
    correcoes = carregar_correcoes(pastas)
    # 'spawn' (igual ao Windows): evita travamentos de fork com OpenCV/threads
    ex = ProcessPoolExecutor(max_workers=nproc, mp_context=multiprocessing.get_context("spawn"),
                             initializer=pgmod.iniciar_worker, initargs=(dict(cfg), None))
    try:
        if real:
            for a in pendentes:
                db.registrar_arquivo(a.hash, a.caminho, a.rel, a.tamanho, a.n_paginas, "PROCESSANDO", "", run_id)
            db.commit()
        for a in pendentes:
            for i in range(a.usar):
                f = ex.submit(pgmod.processar_pagina, {"path": a.caminho, "hash": a.hash, "idx": i, "cache": cache})
                por_futuro[f] = (a, i)
        feitas = 0
        for fut in as_completed(por_futuro):
            a, i = por_futuro[fut]
            try:
                r = fut.result()
            except Exception as e:      # processo morreu
                r = {"idx": i, "erro": f"falha no processo de OCR: {e}", "blank": False, "lines": []}
            a.resultados[i] = {"idx": i, "erro": r.get("erro"), "blank": r.get("blank")}
            if r.get("erro"):
                log.warning("Página %d de %s com erro: %s", i + 1, a.rel, r["erro"])
                status.erro(f"{a.rel} p.{i + 1}: {r['erro']}")
                resumo["erros"] += 1
            feitas += 1
            resumo["paginas"] += 1
            status.set(paginas_feitas=feitas, arquivo_atual=a.rel)
            if len(a.resultados) == a.usar:
                status.set(etapa="Separando e gravando documentos", arquivo_atual=a.rel, forcar=True)
                try:
                    _finalizar(cfg, cat_cfg, org_cfg, pastas, db, run_id, manifesto, status, a, cache, real, resumo,
                               plano, usados, correcoes)
                except Exception as e:
                    log.error("Falha ao finalizar %s: %s\n%s", a.rel, e, traceback.format_exc())
                    if real:
                        db.rollback()
                    _erro_arquivo(db, pastas, manifesto, run_id, a.rel, a.caminho, a.hash,
                                  f"falha ao separar/gravar: {e}"[:300], real, status=status, tam=a.tamanho)
                    resumo["erros"] += 1
                status.set(arquivos_feitos=status.d["arquivos_feitos"] + 1, etapa="Lendo páginas (OCR)", forcar=True)
        ex.shutdown(wait=True)
    except BaseException:
        ex.shutdown(wait=False, cancel_futures=True)
        raise


def _finalizar(cfg, cat_cfg, org_cfg, pastas, db, run_id, manifesto, status, a: Arq, cache, real, resumo, plano,
               usados, correcoes):
    # recarrega do cache o texto/posições (o processo principal não guarda tudo em memória)
    res = []
    for i in range(a.usar):
        r = pgmod.ler_cache(cache, a.hash, i) if not a.resultados[i].get("erro") else None
        res.append(r or {"idx": i, "erro": a.resultados[i].get("erro") or "sem resultado", "lines": []})
    an = analisar(res, cfg, cat_cfg, org_cfg, correcoes, a.hash)
    n_docs_antes = resumo["documentos"]
    stem = limpar_nome_arquivo(os.path.splitext(os.path.basename(a.caminho))[0])
    tag = a.hash[:8]
    ctx = {"arq": a, "stem": stem, "tag": tag}
    criados: list[str] = []
    if not real:
        _planejar(an, a, pastas, usados, plano, resumo, status)
        return
    try:
        # ---- PDF do lote inteiro com camada de texto
        dest_lote = os.path.join(pastas.originais_ocr, f"{stem}__{tag}_OCR.pdf")
        lote_doc = saida.montar_pdf_lote(a.caminho, a.hash, a.usar, res, cache, a.rel, dest_lote)
        manifesto.arquivo(dest_lote)
        criados.append(dest_lote)
        mapa = {"arquivo_origem": a.rel, "hash_origem": a.hash, "pdf_ocr": dest_lote, "n_paginas": a.usar,
                "gerado_em": agora(), "paginas": [None] * a.usar, "documentos": [], "soltos": []}
        por_pag_motivo = {}
        id_por_ancora = {}
        # ---- documentos
        for d in an.docs:
            cat = d.categoria
            pasta = _pasta_destino(pastas, cat, d.status)
            nome = _escolher_nome(pasta, d.nome_base, ".pdf", usados)
            destino = os.path.join(pasta, nome)
            campos_pub = {k: (v["valor"] or "") for k, v in d.campos.items()}
            item_id = db.inserir_item(
                arquivo_origem=a.rel, hash_origem=a.hash, paginas_origem=faixas([i + 1 for i in d.paginas]),
                n_paginas=len(d.paginas), categoria=cat, tipo=campos_pub["tipo"], orgao=campos_pub["orgao"],
                numero=campos_pub["numero"], data=campos_pub["data"], assunto=campos_pub["assunto"],
                destinatario=campos_pub["destinatario"], signatario_nome=campos_pub["signatario_nome"],
                signatario_cargo=campos_pub["signatario_cargo"], processo=campos_pub["processo"],
                objeto=campos_pub["objeto"], confianca_separacao=d.conf_separacao,
                confianca_categoria=d.conf_categoria,
                motivo=f"SEPARAÇÃO: {d.motivo_separacao} | CATEGORIA: {d.motivo_categoria}"
                       + (f" | REVISAR: {d.motivo_status}" if d.motivo_status else ""),
                status=d.status, caminho_final=destino, nome_final=nome, processo_tipo=d.processo_tipo or "",
                caminho_origem=a.caminho, run_id=run_id, campos_json=json.dumps(d.campos, ensure_ascii=False))
            id_por_ancora[d.paginas[0]] = item_id
            caminho_txt = os.path.join(pastas.textos, f"texto{item_id:06d}.txt")
            caminho_json = os.path.splitext(destino)[0] + ".json"
            saida.extrair_paginas(lote_doc, d.paginas, destino, nome, campos_pub["assunto"])
            escrever_atomico(caminho_txt, d.texto)
            doc_json = _json_documento(item_id, a, d, destino, nome, caminho_txt)
            escrever_atomico(caminho_json, json.dumps(doc_json, ensure_ascii=False, indent=1))
            for k in (destino, caminho_txt, caminho_json):
                manifesto.arquivo(k)
                criados.append(k)
            db.atualizar_item(item_id, caminho_texto=caminho_txt, caminho_json=caminho_json)
            for ordem, i in enumerate(d.paginas):
                mapa["paginas"][i] = {"pagina": i + 1, "estado": "DOCUMENTO", "id": item_id, "ordem_no_documento": ordem + 1}
            mapa["documentos"].append({"id": item_id, "paginas": [i + 1 for i in d.paginas], "nome_final": nome,
                                       "caminho_final": destino, "status": d.status})
            resumo["documentos"] += 1
            resumo["revisar"] += 1 if d.status == "REVISAR" else 0
            pc = status.d["por_categoria"]
            pc[cat] = pc.get(cat, 0) + 1
            ps = status.d["por_status"]
            ps[d.status] = ps.get(d.status, 0) + 1
            if d.orgao_novo:
                _registrar_orgao_novo(pastas, d, a)
            status.set(documentos=resumo["documentos"])
        # ---- soltos (blocos)
        for s in an.soltos:
            nome = _escolher_nome(pastas.soltos, f"SOLTO_{stem}_{tag}_p{faixas([i + 1 for i in s.paginas])}".replace(",", "_"), ".pdf", usados)
            destino = os.path.join(pastas.soltos, nome)
            cands = [{"id": id_por_ancora.get(c), "pagina_ancora": c + 1} for c in s.candidatos]
            texto = "\n\n".join(f"--- página {i + 1} ---\n" + _texto_pagina(res[i]) for i in s.paginas)
            item_id = db.inserir_item(
                arquivo_origem=a.rel, hash_origem=a.hash, paginas_origem=faixas([i + 1 for i in s.paginas]),
                n_paginas=len(s.paginas), categoria="", status="SOLTO", motivo=s.motivo, caminho_final=destino,
                nome_final=nome, caminho_origem=a.caminho, run_id=run_id,
                campos_json=json.dumps({"candidatos": cands}, ensure_ascii=False))
            caminho_txt = os.path.join(pastas.textos, f"texto{item_id:06d}.txt")
            caminho_json = os.path.splitext(destino)[0] + ".json"
            saida.extrair_paginas(lote_doc, s.paginas, destino, nome)
            escrever_atomico(caminho_txt, texto)
            escrever_atomico(caminho_json, json.dumps({
                "contrato_versao": 1, "id": item_id, "status": "SOLTO", "arquivo_origem": a.rel,
                "hash_origem": a.hash, "paginas_origem": faixas([i + 1 for i in s.paginas]), "motivo": s.motivo,
                "candidatos": cands, "caminho_final": destino, "caminho_texto": caminho_txt}, ensure_ascii=False, indent=1))
            for k in (destino, caminho_txt, caminho_json):
                manifesto.arquivo(k)
                criados.append(k)
            db.atualizar_item(item_id, caminho_texto=caminho_txt, caminho_json=caminho_json)
            for i in s.paginas:
                mapa["paginas"][i] = {"pagina": i + 1, "estado": "SOLTO", "id": item_id, "motivo": s.motivo}
            mapa["soltos"].append({"id": item_id, "paginas": [i + 1 for i in s.paginas], "motivo": s.motivo})
            resumo["soltos"] += 1
            ps = status.d["por_status"]
            ps["SOLTO"] = ps.get("SOLTO", 0) + 1
        # ---- brancas e páginas com erro
        for i in an.brancas:
            copia = ""
            if cfg.get("copiar_paginas_brancas"):
                nome = _escolher_nome(pastas.soltos, f"BRANCA_{stem}_{tag}_p{i + 1}", ".pdf", usados)
                copia = os.path.join(pastas.soltos, nome)
                saida.extrair_paginas(lote_doc, [i], copia, nome)
                manifesto.arquivo(copia)
                criados.append(copia)
            db.inserir_item(arquivo_origem=a.rel, hash_origem=a.hash, paginas_origem=str(i + 1), n_paginas=1,
                            categoria="", status="SOLTO", motivo="página em branco", caminho_final=copia,
                            caminho_origem=a.caminho, run_id=run_id)
            mapa["paginas"][i] = {"pagina": i + 1, "estado": "BRANCA"}
            resumo["soltos"] += 1
        for i, msg in an.erros:
            db.inserir_item(arquivo_origem=a.rel, hash_origem=a.hash, paginas_origem=str(i + 1), n_paginas=1,
                            categoria="", status="ERRO", motivo=f"página {i + 1}: {msg}", caminho_final="",
                            caminho_origem=a.caminho, run_id=run_id)
            mapa["paginas"][i] = {"pagina": i + 1, "estado": "ERRO", "motivo": msg}
        caminho_mapa = os.path.splitext(dest_lote)[0] + ".mapa.json"
        escrever_atomico(caminho_mapa, json.dumps(mapa, ensure_ascii=False, indent=1))
        manifesto.arquivo(caminho_mapa)
        criados.append(caminho_mapa)
        lote_doc.close()
        db.registrar_arquivo(a.hash, a.caminho, a.rel, a.tamanho, a.n_paginas, "CONCLUIDO", "", run_id)
        db.con.execute("DELETE FROM itens WHERE status='ERRO' AND arquivo_origem=? AND hash_origem IS NULL", (a.rel,))
        db.commit()
    except BaseException:
        db.rollback()
        for k in criados:
            try:
                os.remove(P(k))
            except OSError:
                pass
        raise
    if cfg.get("mover_para_processados"):
        _mover_processado(cfg, manifesto, a)
    if cfg.get("limpar_cache_apos_concluir", True):
        shutil.rmtree(P(os.path.join(cache, a.hash[:16])), ignore_errors=True)


def _texto_pagina(r: dict) -> str:
    return "\n".join(l["t"] for l in r.get("lines", []))


def _json_documento(item_id, a: Arq, d, destino, nome, caminho_txt) -> dict:
    return {
        "contrato_versao": 1, "versao_pipeline": VERSAO, "id": item_id, "status": d.status,
        "arquivo_origem": a.rel, "hash_origem": a.hash, "paginas_origem": faixas([i + 1 for i in d.paginas]),
        "paginas_lista": [i + 1 for i in d.paginas], "n_paginas": len(d.paginas),
        "categoria": d.categoria, "confianca_categoria": d.conf_categoria, "motivo_categoria": d.motivo_categoria,
        "pontos_categorias": d.pontos, "confianca_separacao": d.conf_separacao, "motivo_separacao": d.motivo_separacao,
        "motivo_revisao": d.motivo_status,
        "campos": {k: {"valor": v["valor"], "confianca": v["conf"], "origem": v["origem"]} for k, v in d.campos.items()},
        "processo_tipo": d.processo_tipo, "orgao_novo": d.orgao_novo, "faltam_paginas": d.faltam_paginas,
        "nome_final": nome, "caminho_final": destino, "caminho_texto": caminho_txt, "gerado_em": agora()}


def _registrar_orgao_novo(pastas, d, a):
    caminho = pastas.orgaos_novos
    novo = not os.path.exists(P(caminho))
    with open(P(caminho), "a", encoding="utf-8-sig" if novo else "utf-8", newline="") as f:
        w = csv.writer(f, delimiter=";")
        if novo:
            w.writerow(["sigla_provisoria", "origem_da_sigla", "arquivo_origem", "paginas", "data"])
        w.writerow([d.campos["orgao"]["valor"], d.campos["orgao"]["origem"], a.rel,
                    faixas([i + 1 for i in d.paginas]), agora()])


def _mover_processado(cfg, manifesto, a: Arq):
    destino_dir = os.path.join(resolver_pasta(cfg["entrada"]), cfg["pasta_processados"])
    P(destino_dir).mkdir(parents=True, exist_ok=True)
    destino = os.path.join(destino_dir, os.path.basename(a.caminho))
    n = 1
    while os.path.exists(P(destino)):
        n += 1
        b, e = os.path.splitext(os.path.basename(a.caminho))
        destino = os.path.join(destino_dir, f"{b}_{n}{e}")
    shutil.move(caminho_longo(a.caminho), caminho_longo(destino))
    manifesto.add("movido", de=a.caminho, para=destino)


# ------------------------------------------------------------------ simulação / calibração
def _planejar(an, a: Arq, pastas, usados, plano, resumo, status):
    for d in an.docs:
        pasta = _pasta_destino(pastas, d.categoria, d.status)
        nome = _escolher_nome(pasta, d.nome_base, ".pdf", usados)
        resumo["documentos"] += 1
        resumo["revisar"] += 1 if d.status == "REVISAR" else 0
        pc = status.d["por_categoria"]
        pc[d.categoria] = pc.get(d.categoria, 0) + 1
        plano.append({"tipo": "DOCUMENTO", "arquivo_origem": a.rel, "paginas_origem": faixas([i + 1 for i in d.paginas]),
                      "categoria": d.categoria, "status": d.status, "destino": os.path.join(pasta, nome),
                      "conf_separacao": d.conf_separacao, "conf_categoria": d.conf_categoria,
                      "campos": {k: v["valor"] for k, v in d.campos.items()},
                      "conf_campos": {k: v["conf"] for k, v in d.campos.items()},
                      "motivo_separacao": d.motivo_separacao, "motivo_categoria": d.motivo_categoria,
                      "motivo_revisao": d.motivo_status, "orgao_novo": d.orgao_novo})
    for s in an.soltos:
        resumo["soltos"] += 1
        plano.append({"tipo": "SOLTO", "arquivo_origem": a.rel, "paginas_origem": faixas([i + 1 for i in s.paginas]),
                      "motivo": s.motivo, "destino": pastas.soltos})
    for i in an.brancas:
        resumo["soltos"] += 1
        plano.append({"tipo": "BRANCA", "arquivo_origem": a.rel, "paginas_origem": str(i + 1), "motivo": "página em branco"})
    for i, msg in an.erros:
        plano.append({"tipo": "ERRO", "arquivo_origem": a.rel, "paginas_origem": str(i + 1), "motivo": msg})


def _gravar_plano(pastas, plano, modo, amostra, resumo):
    pasta = pastas.calibracao if amostra else pastas.simulacao
    garantir_pasta(pasta)
    ts = time.strftime("%Y%m%d_%H%M%S")
    base = os.path.join(pasta, f"{'calibracao' if amostra else 'plano'}_{ts}")
    escrever_atomico(base + ".json", json.dumps(plano, ensure_ascii=False, indent=1))
    with open(P(base + ".csv"), "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["tipo", "arquivo_origem", "paginas_origem", "categoria", "status", "destino", "conf_separacao",
                    "conf_categoria", "tipo_doc", "orgao", "numero", "data", "assunto", "destinatario", "signatario",
                    "processo", "motivo"])
        for p in plano:
            c = p.get("campos", {})
            w.writerow([p["tipo"], p["arquivo_origem"], p["paginas_origem"], p.get("categoria", ""), p.get("status", ""),
                        p.get("destino", ""), str(p.get("conf_separacao", "")).replace(".", ","),
                        str(p.get("conf_categoria", "")).replace(".", ","), c.get("tipo") or "", c.get("orgao") or "",
                        c.get("numero") or "", c.get("data") or "", c.get("assunto") or "", c.get("destinatario") or "",
                        c.get("signatario_nome") or "", c.get("processo") or "",
                        p.get("motivo") or (p.get("motivo_separacao", "") + " | " + p.get("motivo_categoria", ""))])
    resumo["plano"] = base + ".csv"
    if amostra:
        _relatorio_calibracao(base + ".md", plano, amostra)
        resumo["relatorio"] = base + ".md"


def _relatorio_calibracao(caminho, plano, amostra):
    docs = [p for p in plano if p["tipo"] == "DOCUMENTO"]
    soltos = [p for p in plano if p["tipo"] in ("SOLTO", "BRANCA")]
    L = [f"# Relatório de calibração ({amostra} primeiras páginas)", "",
         "Nada foi movido nem gravado fora desta pasta. Use este relatório para ajustar `config\\categorias.yaml`",
         "e `config\\orgaos.yaml`. Documentos cortados no fim da amostra podem aparecer incompletos.", "",
         f"- Documentos encontrados: **{len(docs)}** | Soltos/brancas: **{len(soltos)}**", ""]
    faixas_conf = [(0.0, 0.5), (0.5, 0.7), (0.7, 0.9), (0.9, 1.01)]
    for nome, chave in (("separação", "conf_separacao"), ("categoria", "conf_categoria")):
        L.append(f"## Distribuição da confiança de {nome}")
        for lo, hi in faixas_conf:
            n = sum(1 for d in docs if lo <= d[chave] < hi)
            L.append(f"- {lo:.1f} a {min(hi, 1):.1f}: {n}")
        L.append("")
    L.append("## Campos vazios (por campo)")
    chaves = ["tipo", "orgao", "numero", "data", "assunto", "destinatario", "signatario_nome", "signatario_cargo", "processo", "objeto"]
    for c in chaves:
        vazios = sum(1 for d in docs if not d["campos"].get(c))
        L.append(f"- {c}: {vazios} de {len(docs)} vazios; confiança média quando achado: "
                 + (f"{sum(d['conf_campos'][c] for d in docs if d['campos'].get(c)) / max(1, len(docs) - vazios):.2f}"))
    L += ["", "## Documentos de baixa confiança (revisar regras)", ""]
    for d in sorted(docs, key=lambda x: min(x["conf_separacao"], x["conf_categoria"]))[:25]:
        L.append(f"- {d['arquivo_origem']} p.{d['paginas_origem']} → **{d['categoria']}** "
                 f"(sep {d['conf_separacao']:.2f}, cat {d['conf_categoria']:.2f}) | {d['motivo_categoria']}")
    novas = [d for d in docs if d.get("orgao_novo")]
    if novas:
        L += ["", "## Siglas de órgão novas (acrescente em `config\\orgaos.yaml`)", ""]
        for d in novas:
            L.append(f"- {d['campos'].get('orgao')} ← {d['arquivo_origem']} p.{d['paginas_origem']}")
    L += ["", "## Páginas soltas", ""]
    for s in soltos:
        L.append(f"- {s['arquivo_origem']} p.{s['paginas_origem']}: {s['motivo']}")
    escrever_atomico(caminho, "\n".join(L) + "\n")
