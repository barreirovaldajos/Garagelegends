// ===== TEST 2: engine-core.js — simulateRace en Node, determinismo =====
// Run: node tests/02-engine-core.test.js

'use strict';

const core = require('../shared/engine-core.js');
const data = require('../shared/data-constants.js');

let passed = 0;
let failed = 0;

function assert(desc, condition) {
  if (condition) { console.log(`  ✅ ${desc}`); passed++; }
  else { console.error(`  ❌ FAIL: ${desc}`); failed++; }
}
function assertEq(desc, a, b) {
  if (JSON.stringify(a) === JSON.stringify(b)) { console.log(`  ✅ ${desc}`); passed++; }
  else { console.error(`  ❌ FAIL: ${desc}\n     got:      ${JSON.stringify(a)}\n     expected: ${JSON.stringify(b)}`); failed++; }
}

// ── Helpers
function makePlayerTeam(id = 'player_1') {
  return {
    userId: id,
    teamId: id,
    teamName: 'Test Team',
    colors: { primary: '#ff0000' },
    pilots: [data.PILOT_POOL[0], data.PILOT_POOL[1]],
    car: {
      components: {
        engine:      { score: 65, level: 1 },
        chassis:     { score: 62, level: 1 },
        aero:        { score: 60, level: 1 },
        brakes:      { score: 58, level: 1 },
        gearbox:     { score: 63, level: 1 },
        reliability: { score: 60, level: 1 },
        efficiency:  { score: 61, level: 1 },
        tyreManage:  { score: 59, level: 1 }
      }
    },
    staff: [],
    engineSupplier: '',
    strategy: {
      tyre: 'medium', aggression: 50, pitLap: 42, riskLevel: 40,
      engineMode: 'normal', pitPlan: 'single', safetyCarReaction: 'live',
      setup: { aeroBalance: 50, wetBias: 50 },
      selectedPilotIds: [data.PILOT_POOL[0].id, data.PILOT_POOL[1].id],
      driverConfigs: {}
    }
  };
}

function makeBotSlot(teamId) {
  const aiTeam = data.AI_TEAMS.find(t => t.id === teamId) || data.AI_TEAMS[0];
  return {
    botTeamId: aiTeam.id,
    aiTeamData: aiTeam,
    teamSnapshot: {
      car: {
        components: {
          engine:      { score: 55, level: 1 },
          chassis:     { score: 52, level: 1 },
          aero:        { score: 50, level: 1 },
          brakes:      { score: 48, level: 1 },
          gearbox:     { score: 53, level: 1 },
          reliability: { score: 50, level: 1 },
          efficiency:  { score: 51, level: 1 },
          tyreManage:  { score: 49, level: 1 }
        }
      },
      pilots: [data.PILOT_POOL.find(p => p.id === 'ai1'), data.PILOT_POOL.find(p => p.id === 'ai2')]
    }
  };
}

const CIRCUIT = data.CIRCUITS[0]; // Silverstone
const SEED    = '8_1_1_2026_c1';

function runRace(seed) {
  const rng = new core.SeededRNG(seed);
  return core.simulateRace({
    rng,
    playerTeams: [makePlayerTeam('user_abc')],
    botSlots: data.AI_TEAMS.slice(0, 4).map(t => makeBotSlot(t.id)),
    circuit: CIRCUIT,
    weather: 'dry',
    forecast: null,
    round: 1,
    division: 8,
    pointsTable: data.POINTS_TABLE,
    pilotPool: data.PILOT_POOL
  });
}

console.log('\n=== engine-core simulateRace Tests ===\n');

// ── 1. Estructura del resultado
console.log('1. Estructura del resultado');
{
  const result = runRace(SEED);
  assert('Tiene finalGrid', Array.isArray(result.finalGrid));
  assert('Tiene events', Array.isArray(result.events));
  assert('Tiene lapSnapshots', Array.isArray(result.lapSnapshots));
  assert('Tiene teamSummaries', result.teamSummaries && typeof result.teamSummaries === 'object');
  assert('Tiene allCarsResults', Array.isArray(result.allCarsResults));
  assert('Tiene totalLaps', Number.isFinite(result.totalLaps) && result.totalLaps > 0);
  assert('Tiene gridStart', Array.isArray(result.gridStart));
  assert('Tiene playerCars', Array.isArray(result.playerCars));
}

// ── 2. finalGrid tiene posiciones válidas
console.log('\n2. finalGrid');
{
  const result = runRace(SEED);
  const grid = result.finalGrid;
  assert('finalGrid no vacío', grid.length > 0);
  assert('Posiciones son únicas', new Set(grid.map(c => c.pos)).size === grid.length);
  assert('Posiciones van de 1 a N', grid.every((c, i) => c.pos === i + 1));
  assert('El ganador tiene pos=1', grid[0].pos === 1);
}

// ── 3. playerCars tiene el jugador
console.log('\n3. playerCars');
{
  const result = runRace(SEED);
  assert('playerCars no vacío', result.playerCars.length > 0);
  const car = result.playerCars[0];
  assert('Tiene position', Number.isFinite(car.position));
  assert('Tiene points (≥0)', Number.isFinite(car.points) && car.points >= 0);
  assert('Tiene teamId', !!car.teamId);
}

// ── 4. teamSummaries tiene el equipo del jugador
console.log('\n4. teamSummaries');
{
  const result = runRace(SEED);
  const summary = result.teamSummaries['user_abc'];
  assert('teamSummary existe para user_abc', !!summary);
  assert('Tiene bestPosition', Number.isFinite(summary.bestPosition));
  assert('Tiene points', Number.isFinite(summary.points));
  assert('Tiene prizeMoney (≥0)', Number.isFinite(summary.prizeMoney) && summary.prizeMoney >= 0);
}

// ── 5. Determinismo: misma seed → resultado idéntico
console.log('\n5. Determinismo');
{
  const r1 = runRace(SEED);
  const r2 = runRace(SEED);
  assertEq('finalGrid idéntico con misma seed', r1.finalGrid.map(c => c.id), r2.finalGrid.map(c => c.id));
  assertEq('totalLaps idéntico', r1.totalLaps, r2.totalLaps);
  assertEq('playerCars posición idéntica', r1.playerCars[0].position, r2.playerCars[0].position);
  assertEq('Número de eventos idéntico', r1.events.length, r2.events.length);
}

// ── 6. Seeds distintas → resultados potencialmente distintos
console.log('\n6. Seeds distintas producen variedad');
{
  // Con 10 seeds distintas el jugador debe aparecer en al menos 2 posiciones distintas
  const results = ['sA','sB','sC','sD','sE','sF','sG','sH','sI','sJ'].map(s => runRace(s));
  const positions = results.map(r => r.playerCars[0].position);
  assert('Al menos 2 posiciones distintas en 10 seeds', new Set(positions).size >= 2);
  // También verificamos que la carrera misma es distinta (grid distinto)
  const grids = results.map(r => r.finalGrid.map(c => c.id).join(','));
  assert('Al menos 2 grids distintos en 10 seeds', new Set(grids).size >= 2);
}

// ── 7. Carrera húmeda funciona
console.log('\n7. Carrera húmeda');
{
  const rng = new core.SeededRNG('wet_race_test');
  const result = core.simulateRace({
    rng,
    playerTeams: [makePlayerTeam('user_wet')],
    botSlots: data.AI_TEAMS.slice(0, 3).map(t => makeBotSlot(t.id)),
    circuit: data.CIRCUITS[3], // Spa — layout mixed, alta prob lluvia
    weather: 'wet',
    forecast: null,
    round: 2,
    division: 8,
    pointsTable: data.POINTS_TABLE,
    pilotPool: data.PILOT_POOL
  });
  assert('Carrera húmeda tiene finalGrid', result.finalGrid.length > 0);
  assert('Hay eventos', result.events.length > 0);
}

// ── 8. generateCalendar
console.log('\n8. generateCalendar');
{
  const rng = new core.SeededRNG('cal_test');
  const calendar = core.generateCalendar(8, data.CIRCUITS, rng);
  assert('Calendario tiene al menos 8 carreras', calendar.length >= 8);
  assert('Primera carrera tiene status next', calendar[0].status === 'next');
  assert('Resto son upcoming', calendar.slice(1).every(r => r.status === 'upcoming'));
  assert('Cada carrera tiene circuito', calendar.every(r => !!r.circuit));
  assert('Misma seed → mismo calendario', (() => {
    const rng2 = new core.SeededRNG('cal_test');
    const cal2 = core.generateCalendar(8, data.CIRCUITS, rng2);
    return JSON.stringify(calendar.map(r => r.circuitId)) === JSON.stringify(cal2.map(r => r.circuitId));
  })());
}

// ── 9. updateStandingsPure
console.log('\n9. updateStandingsPure');
{
  const standings = [
    { teamId: 'team_A', points: 10, wins: 0, podiums: 0, bestResult: 5, position: 1 },
    { teamId: 'team_B', points: 5,  wins: 0, podiums: 0, bestResult: 8, position: 2 }
  ];
  const raceResult = {
    allCarsResults: [
      { teamId: 'team_A', position: 1, points: 25 },
      { teamId: 'team_B', position: 2, points: 18 }
    ]
  };
  const updated = core.updateStandingsPure(standings, raceResult, data.POINTS_TABLE);
  assert('updateStandingsPure devuelve array', Array.isArray(updated));
  assert('team_A tiene 35 puntos', updated.find(s => s.teamId === 'team_A').points === 35);
  assert('team_B tiene 23 puntos', updated.find(s => s.teamId === 'team_B').points === 23);
  assert('team_A sigue en P1', updated[0].teamId === 'team_A');
  assert('team_A tiene 1 win', updated.find(s => s.teamId === 'team_A').wins === 1);
  assert('No muta el original', standings[0].points === 10);
}

console.log(`\n${'─'.repeat(40)}`);
console.log(`Resultado: ${passed} ✅  ${failed} ❌`);
if (failed > 0) process.exit(1);
