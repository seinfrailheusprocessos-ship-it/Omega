# Scripts da Etapa B e da Etapa B-J (recalcular)

Requisitos: pacote MP_FILTRADO descompactado em `mp_levantamento/` (o SINAPI fica em `_PRECOS/`) e LibreOffice para recalcular a planilha.

1. Descompactar o SINAPI: `unzip mp_levantamento/_PRECOS/SINAPI_BA_NAO_DESONERADO_2026_08.zip -d <TRAB>/sinapi`
2. Ajustar a triagem e os parâmetros em `modelo.py` (objetos do MP em `OBJ`; BDI, contingência e fator em `BDI`, `CONT` e `FREG`). Os objetos da Justiça ficam em `OBJ_J`, no `modelo_jus.py`, que usa os mesmos preços, demandas-tipo e parâmetros do `modelo.py`.
3. `python3 -I modelo.py <TRAB> mp_levantamento` (grava `<TRAB>/etapa_b/resultado.json`)
4. `python3 -I modelo_jus.py <TRAB> mp_levantamento` (grava `<TRAB>/etapa_b/resultado_justica.json`; calcula só os paramétricos da Justiça que não estão calculados no MP)
5. `python3 -I gerar_xlsx.py <TRAB> mp_levantamento/levantamento_parametrico.xlsx` e recalcular as fórmulas no LibreOffice
6. `python3 -I gerar_nota.py <TRAB> mp_levantamento/nota_tecnica.md`
7. `python3 -I gerar_prazos.py mp_levantamento mp_levantamento/prazos.md` (MP) e `python3 -I gerar_prazos_jus.py mp_levantamento mp_levantamento/prazos_justica.md` (Justiça)
8. `python3 -I gerar_plano_jus.py mp_levantamento mp_levantamento/dossies_justica_plano.json mp_levantamento/scripts`

Os parâmetros também podem ser alterados direto na aba PARAMETROS da planilha, que recalcula sozinha.
