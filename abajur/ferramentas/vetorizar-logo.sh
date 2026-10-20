#!/usr/bin/env bash
# Vetoriza abajur_logo.jpg (traço preto sobre branco) em public/icons/logo.svg com fundo transparente e cor = currentColor,
# sem redesenhar: o contorno sai do próprio desenho (potrace, código aberto). Depois gera os ícones PNG.
# Uso: bash ferramentas/vetorizar-logo.sh caminho/abajur_logo.jpg
set -euo pipefail
ORIG="${1:-abajur_logo.jpg}"
AQUI="$(cd "$(dirname "$0")" && pwd)"
DEST="$AQUI/../public/icons/logo.svg"
TMP="$(mktemp -d)"
command -v potrace >/dev/null || { echo "Instale o potrace (sudo apt install potrace)"; exit 1; }
convert "$ORIG" -colorspace Gray -trim +repage -bordercolor white -border 4% -threshold 55% "$TMP/logo.pbm"
potrace "$TMP/logo.pbm" -s --flat -o "$TMP/logo.svg"
# cor do traço acompanha o tema (currentColor) e fundo transparente
sed -e 's/fill="#000000"/fill="currentColor"/g' -e 's/<svg /<svg role="img" aria-label="Abajur" /' "$TMP/logo.svg" > "$DEST"
echo "logo vetorizado em $DEST"
node "$AQUI/gerar-icones.mjs"
