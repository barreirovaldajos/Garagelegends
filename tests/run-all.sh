#!/usr/bin/env bash
# ===== run-all.sh — Ejecuta todos los tests de multiplayer =====
# Desde la raíz del proyecto: bash tests/run-all.sh

set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"

GREEN='\033[0;32m'; RED='\033[0;31m'; NC='\033[0m'; BOLD='\033[1m'

pass=0; fail=0

run_node() {
  local name="$1"; local file="$2"
  echo ""
  echo "${BOLD}▶ $name${NC}"
  if node "$file"; then
    echo -e "${GREEN}  → PASSED${NC}"; ((pass++))
  else
    echo -e "${RED}  → FAILED${NC}"; ((fail++))
  fi
}

run_emulator() {
  local name="$1"; local file="$2"
  echo ""
  echo "${BOLD}▶ $name${NC}"
  if FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node "$file"; then
    echo -e "${GREEN}  → PASSED${NC}"; ((pass++))
  else
    echo -e "${RED}  → FAILED${NC}"; ((fail++))
  fi
}

echo "================================================"
echo "  Garage Legends — Multiplayer Test Suite"
echo "================================================"

# ── Tests Node puro (sin emulator)
echo -e "\n${BOLD}== Tests Node (sin emulator) ==${NC}"
run_node "01 SeededRNG"       "tests/01-seeded-rng.test.js"
run_node "02 engine-core"     "tests/02-engine-core.test.js"

# ── Tests con Firebase Emulator
echo -e "\n${BOLD}== Tests con Firestore Emulator ==${NC}"
echo "  (Asegúrate de que el emulator esté corriendo: firebase emulators:start --only firestore)"
echo ""

run_emulator "03 bot-filler"        "tests/03-bot-filler.test.js"
run_emulator "04 division-manager"  "tests/04-division-manager.test.js"
run_emulator "05 race-runner"       "tests/05-race-runner.test.js"
run_emulator "06 season-manager"    "tests/06-season-manager.test.js"
run_emulator "07 firestore-rules"   "tests/07-firestore-rules.test.js"

echo ""
echo "================================================"
echo "  RESULTADO FINAL: ${pass} suites ✅  ${fail} suites ❌"
echo "================================================"

if [ $fail -gt 0 ]; then exit 1; fi
