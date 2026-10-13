# Scripts da Etapa B (recalcular)

Requisitos: pacote MP_FILTRADO descompactado em `mp_levantamento/` (o SINAPI fica em `_PRECOS/`) e LibreOffice para recalcular a planilha.

1. Descompactar o SINAPI: `unzip mp_levantamento/_PRECOS/SINAPI_BA_NAO_DESONERADO_2026_08.zip -d <TRAB>/sinapi`
2. Ajustar a triagem e os parâmetros em `modelo.py` (objetos em `OBJ`; BDI, contingência e fator em `BDI`, `CONT` e `FREG`).
3. `python3 -I modelo.py <TRAB> mp_levantamento` (grava `<TRAB>/etapa_b/resultado.json`)
4. `python3 -I gerar_xlsx.py <TRAB> mp_levantamento/levantamento_parametrico.xlsx` e recalcular as fórmulas no LibreOffice
5. `python3 -I gerar_nota.py <TRAB> mp_levantamento/nota_tecnica.md` e `python3 -I gerar_prazos.py mp_levantamento mp_levantamento/prazos.md`

Os parâmetros também podem ser alterados direto na aba PARAMETROS da planilha, que recalcula sozinha.
