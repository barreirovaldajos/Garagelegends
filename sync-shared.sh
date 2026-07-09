#!/bin/bash
# sync-shared.sh — copia el canónico shared/ → functions/lib/shared/
# Ejecutar ANTES de desplegar funciones para evitar divergencias.
# Fuente de verdad: Garagelegends/shared/
#
# Uso: ./sync-shared.sh [--dry-run|--check]
#   (sin args)  copia shared/*.js → functions/lib/shared/
#   --dry-run   muestra qué copiaría, sin modificar nada
#   --check     solo verifica: exit 0 si las copias están idénticas,
#               exit 1 si divergen (no modifica nada). Correr al iniciar sesión.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$SCRIPT_DIR/shared"
DST="$SCRIPT_DIR/functions/lib/shared"

MODE=${1:-""}

if [ ! -d "$SRC" ]; then
    echo "ERROR: carpeta canónica no encontrada: $SRC" >&2
    exit 1
fi

if [ ! -d "$DST" ]; then
    echo "ERROR: carpeta destino no encontrada: $DST" >&2
    exit 1
fi

# --- Modo --check: verificar sin modificar ---------------------------------
if [ "$MODE" = "--check" ]; then
    DIVERGED=0
    for f in "$SRC"/*.js; do
        fname="$(basename "$f")"
        dst_file="$DST/$fname"
        if [ ! -f "$dst_file" ]; then
            echo "DIVERGE: $fname no existe en functions/lib/shared/" >&2
            DIVERGED=$((DIVERGED + 1))
        elif ! diff -q "$f" "$dst_file" >/dev/null 2>&1; then
            echo "DIVERGE: $fname difiere entre shared/ y functions/lib/shared/" >&2
            DIVERGED=$((DIVERGED + 1))
        fi
    done
    if [ "$DIVERGED" -gt 0 ]; then
        echo "" >&2
        echo "ERROR: $DIVERGED archivo(s) divergen. El canónico es shared/." >&2
        echo "Ejecuta ./sync-shared.sh para sincronizar antes de deployar funciones." >&2
        exit 1
    fi
    echo "OK: shared/ y functions/lib/shared/ están idénticos."
    exit 0
fi
# ---------------------------------------------------------------------------

DRY="$MODE"

echo "Sincronizando shared/ → functions/lib/shared/"
echo "  Origen:  $SRC"
echo "  Destino: $DST"

CHANGED=0
for f in "$SRC"/*.js; do
    fname="$(basename "$f")"
    dst_file="$DST/$fname"

    if [ ! -f "$dst_file" ] || ! diff -q "$f" "$dst_file" >/dev/null 2>&1; then
        echo "  COPIAR: $fname"
        if [ "$DRY" != "--dry-run" ]; then
            cp "$f" "$dst_file"
        fi
        CHANGED=$((CHANGED + 1))
    else
        echo "  OK (sin cambios): $fname"
    fi
done

if [ "$DRY" = "--dry-run" ]; then
    echo ""
    echo "Dry-run: $CHANGED archivo(s) diferente(s). Ejecuta sin --dry-run para aplicar."
else
    echo ""
    echo "Listo: $CHANGED archivo(s) copiado(s)."
fi
