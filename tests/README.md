# Tests Multiplayer — Garage Legends

## Setup

### 1. Dependencias para el test de rules (07)

```bash
npm install --save-dev @firebase/rules-unit-testing firebase
```

### 2. Firebase Emulator (para tests 03 al 07)

```bash
# Instalar si no está
npm install -g firebase-tools

# Iniciar emulator (desde la raíz del proyecto)
firebase emulators:start --only firestore
```

El emulator corre en `127.0.0.1:8080` por defecto.

---

## Ejecutar

### Todos los tests (requiere emulator activo)
```bash
bash tests/run-all.sh
```

### Tests individuales

| Test | Requiere emulator | Comando |
|------|:-----------------:|---------|
| 01 — SeededRNG | No | `node tests/01-seeded-rng.test.js` |
| 02 — engine-core | No | `node tests/02-engine-core.test.js` |
| 03 — bot-filler | Sí | `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node tests/03-bot-filler.test.js` |
| 04 — division-manager | Sí | `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node tests/04-division-manager.test.js` |
| 05 — race-runner | Sí | `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node tests/05-race-runner.test.js` |
| 06 — season-manager | Sí | `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node tests/06-season-manager.test.js` |
| 07 — firestore-rules | Sí | `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node tests/07-firestore-rules.test.js` |

---

## Qué valida cada test

| # | Módulo | Qué se prueba |
|---|--------|---------------|
| 01 | `SeededRNG` | Reproducibilidad, `next()`, `intRange()`, `chance()`, `pickSeeded()`, `shuffle()` |
| 02 | `engine-core` | `simulateRace()` pura en Node, determinismo, estructura de resultado, `updateStandingsPure()`, `generateCalendar()` |
| 03 | `bot-filler` | Llena vacíos, no duplica bots, scores en rango por división, no sobreescribe players |
| 04 | `division-manager` | Asigna slot libre, crea nuevo grupo si lleno, escribe `mp` en profile, `updateTeamSnapshot()` |
| 05 | `race-runner` | Carrera completa, guarda `raceResults`, actualiza standings, aplica prize money, consume strategies, guards |
| 06 | `season-manager` | Ascensos/descensos correctos, archive, `pendingDivision` en profiles, bordes (div 1 / div 8) |
| 07 | `firestore.rules` | Player escribe su strategy, no la ajena; raceResults read-only; divisions solo lectura para clientes |
