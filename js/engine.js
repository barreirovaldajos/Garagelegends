// ===== ENGINE.JS – Race simulation + economy + events =====
'use strict';

const { GL_STATE: S, GL_DATA: D } = window;

// ---- pilot overall score ----
function pilotScore(pilot) {
  if (!pilot) return 40;
  const a = pilot.attrs;
  return Math.round((a.pace + a.racePace + a.consistency + a.rain + a.tyre + a.aggression + a.overtake + a.techFB + a.mental + a.charisma) / 10);
}

// ---- car overall score ----
function carScore() {
  const c = S.getCar().components;
  const keys = Object.keys(c);
  return Math.round(keys.reduce((sum, k) => sum + c[k].score, 0) / keys.length);
}

// ---- build full grid (player + AI teams) ----
function buildRaceGrid(playerPilot, weather) {
  const state = S.getState();
  const pd = S.getCar();
  const car = carScore();
  const pilot = pilotScore(playerPilot);
  const rain = weather === 'wet' ? (playerPilot ? playerPilot.attrs.rain / 100 : 0.6) : 1;
  const playerBase = (car * 0.5 + pilot * 0.5) * rain;

  const grid = [{
    id: 'player',
    name: state.team.name || 'Your Team',
    color: state.team.colors.primary,
    isPlayer: true,
    base: playerBase,
    score: playerBase + (Math.random() - 0.5) * 12,
    tyre: 'medium', wear: 0, gaps: 0
  }];

  const aiCount = Math.min(D.AI_TEAMS.length, 11);
  for (let i = 0; i < aiCount; i++) {
    const t = D.AI_TEAMS[i];
    const aiBase = 35 + Math.random() * 35; // AI skill spread
    const rainMod = weather === 'wet' ? (0.8 + Math.random() * 0.4) : 1;
    grid.push({
      id: t.id, name: t.name, color: t.color, isPlayer: false,
      base: aiBase * rainMod,
      score: aiBase * rainMod + (Math.random() - 0.5) * 10,
      tyre: ['soft','medium','hard'][Math.floor(Math.random() * 3)],
      wear: 0, gaps: 0
    });
  }
  grid.sort((a, b) => b.score - a.score);
  return grid;
}

// ---- tyre degradation per compound ----
const TYRE_DEG = { soft: 1.5, medium: 0.9, hard: 0.5 };
const TYRE_PACE = { soft: 8, medium: 0, hard: -4 };

// ---- race simulation ----
function simulateRace(options = {}) {
  const state = S.getState();
  const { weather = 'dry', circuits, round } = options;
  const pilot = state.pilots[0] || { attrs:{ pace:55, racePace:55, consistency:60, rain:55, tyre:55, aggression:60, overtake:55, techFB:55, mental:55, charisma:60 }, name:'Driver' };
  const strategy = options.strategy || {
    tyre: 'medium', aggression: 50, pitLap: 35, riskLevel: 50
  };
  const totalLaps = 30;

  let grid = buildRaceGrid(pilot, weather);
  const events = [];
  let safetyCarActive = false;

  // Qualify – sort with qualy weights
  grid.forEach(e => {
    e.qualyScore = e.score + (Math.random() - 0.5) * 8;
    if (e.isPlayer) {
      e.tyre = strategy.tyre;
    }
  });
  grid.sort((a, b) => b.qualyScore - a.qualyScore);
  const gridStart = grid.map(e => ({...e}));
  const playerStart = gridStart.findIndex(e => e.isPlayer) + 1;

  events.push({ lap: 0, type: 'info', text: `<strong>Qualifying P${playerStart}.</strong> ${weather === 'wet' ? '🌧️ Wet track!' : '☀️ Dry conditions.'}` });

  // Race ticks
  const positions = grid.map((e, i) => ({ ...e, pos: i + 1, laps: 0, pit: false, retired: false }));
  let playerPit = false;
  let playerWear = 0;

  for (let lap = 1; lap <= totalLaps; lap++) {
    // Safety car event
    if (!safetyCarActive && Math.random() < 0.06) {
      safetyCarActive = true;
      events.push({ lap, type: 'safety', text: `🟡 <strong>Virtual Safety Car deployed!</strong> Pack bunches up.` });
      // Shuffle slightly when SC out
      positions.forEach(p => { if (!p.isPlayer && !p.retired) p.pos += (Math.random() < 0.3 ? -1 : 0); });
    }
    if (safetyCarActive && Math.random() < 0.4) {
      safetyCarActive = false;
      events.push({ lap, type: 'info', text: `🟢 Safety car period ends. Green flag!` });
    }

    // Player pit stop
    if (!playerPit && lap === Math.floor(strategy.pitLap / 100 * totalLaps) + 1) {
      playerPit = true;
      playerWear = 0;
      const newTyre = strategy.tyre === 'soft' ? 'hard' : 'soft';
      const gain = Math.random() < 0.5 ? 1 : 2;
      const playerIdx = positions.findIndex(p => p.isPlayer);
      positions[playerIdx].tyre = newTyre;
      events.push({ lap, type: 'pit', text: `🔵 <strong>${pilot.name} pits!</strong> Switches to ${newTyre} tyres. ${gain === 1 ? 'Clean stop.' : 'Slight delay.'}` });
    }

    // Incidents
    positions.forEach(p => {
      if (!p.retired && !p.isPlayer) {
        if (Math.random() < 0.012) {
          p.retired = true;
          events.push({ lap, type: 'incident', text: `💥 <strong>${p.name}</strong> retires with mechanical failure!` });
        }
      }
    });
    // Player incident
    const pIdx = positions.findIndex(e => e.isPlayer);
    if (pIdx >= 0 && !positions[pIdx].retired) {
      const riskFactor = strategy.riskLevel / 100;
      if (Math.random() < 0.008 * riskFactor + 0.005) {
        if (Math.random() < 0.3) {
          positions[pIdx].retired = true;
          events.push({ lap, type: 'incident', text: `💥 <strong>${pilot.name} retires!</strong> Mechanical issue. DNF.` });
        } else {
          const lostPos = Math.floor(Math.random() * 3) + 1;
          positions[pIdx].pos = Math.min(positions.length, positions[pIdx].pos + lostPos);
          events.push({ lap, type: 'incident', text: `⚠️ <strong>${pilot.name}</strong> has a spin! Drops ${lostPos} position(s).` });
        }
      }
    }

    // Overtake / position battles every 5 laps
    if (lap % 5 === 0 && pIdx >= 0 && !positions[pIdx].retired) {
      const p = positions[pIdx];
      const ahead = positions.find(x => x.pos === p.pos - 1 && !x.retired);
      if (ahead && Math.random() < 0.3 + (strategy.aggression / 200)) {
        p.pos--;
        ahead.pos++;
        events.push({ lap, type: 'good', text: `✅ <strong>${pilot.name}</strong> overtakes <strong>${ahead.name}</strong>! Moves up to P${p.pos}.` });
      }

      // Good laptime
      if (Math.random() < 0.15) {
        events.push({ lap, type: 'good', text: `🟢 Personal best lap by <strong>${pilot.name}</strong> on lap ${lap}.` });
      }
    }

    // Tyre wear event
    playerWear += TYRE_DEG[strategy.tyre] || 0.9;
    if (playerWear > 30 && playerWear < 32 && pIdx >= 0 && !positions[pIdx].retired) {
      events.push({ lap, type: 'incident', text: `⚠️ Tyre performance dropping significantly for <strong>${pilot.name}</strong>.` });
    }
  }

  // Final sort and position
  const activePositions = positions.filter(p => !p.retired).sort((a, b) => a.pos - b.pos);
  const retiredPositions = positions.filter(p => p.retired);
  const finalGrid = [...activePositions, ...retiredPositions];

  let playerFinalPos = finalGrid.findIndex(p => p.isPlayer) + 1;
  if (positions[pIdx]?.retired) playerFinalPos = finalGrid.length;

  const points = D.POINTS_TABLE[playerFinalPos - 1] || 0;
  const isDNF = positions[pIdx]?.retired;

  // Closing event
  if (!isDNF) {
    events.push({ lap: totalLaps, type: playerFinalPos <= 3 ? 'good' : 'info', text: `🏁 <strong>RACE FINISH: P${playerFinalPos}</strong> for ${pilot.name}. ${points > 0 ? points + ' points scored!' : 'No points this time.'}` });
  }

  // Calculate financials
  const prizeMap = [50000,40000,35000,25000,20000,15000,12000,10000,8000,5000,3000,2000,1500,1000,500,300];
  const prizeMoney = prizeMap[playerFinalPos - 1] || 200;

  return {
    position: playerFinalPos,
    isDNF,
    points,
    events,
    finalGrid,
    gridStart,
    weather,
    circuit: circuits,
    prizeMoney,
    fastestLap: !isDNF && playerFinalPos <= 5 && Math.random() < 0.2,
    improvement: playerFinalPos - playerStart,
  };
}

// ---- weekly economy tick ----
function weeklyTick() {
  const state = S.getState();
  let income = 0;
  let expenses = 0;

  // Sponsor income
  state.sponsors.forEach(sp => {
    income += sp.income || 0;
  });

  // Fan income
  income += Math.floor((state.team.fans || 0) * 0.05);

  // Staff salaries
  state.staff.forEach(st => {
    expenses += st.salary || 0;
  });

  // Pilot salaries
  state.pilots.forEach(p => {
    expenses += (p.salary || 0);
  });

  // Facility maintenance (2% of total investment)
  const facCost = state.facilities.reduce((s, f) => s + (f.level > 0 ? f.level * 800 : 0), 0);
  expenses += facCost;

  const net = income - expenses;
  S.addCredits(net);

  // Log
  S.getState().finances.history.push({
    week: state.season.week,
    income, expenses, net
  });
  if (S.getState().finances.history.length > 52) S.getState().finances.history.shift();

  // Advance week
  S.getState().season.week++;
  S.addLog(`Week ${state.season.week} complete. Net: ${net > 0 ? '+' : ''}${net.toLocaleString()} CR`, net >= 0 ? 'good' : 'bad');
  S.saveState();

  // Trigger random event
  if (Math.random() < 0.35) generateRandomEvent();

  return { income, expenses, net };
}

// ---- hq construction timer ----
function updateConstructionQueue() {
  const state = S.getState();
  const c = state.construction;
  if (!c || !c.active) return false;
  
  if (Date.now() >= c.startTime + c.durationMs) {
    // Complete construction
    state.hq[c.buildingId] = c.targetLevel;
    
    // Log
    const bNames = { wind_tunnel: 'Túnel de Viento', rnd: 'I+D', factory: 'Fábrica', academy: 'Academia', admin: 'Administración' };
    S.addLog(`🏗️ ${bNames[c.buildingId] || c.buildingId} completado (Nivel ${c.targetLevel})`, 'good');
    
    // Clear queue
    c.active = false;
    c.buildingId = null;
    c.startTime = 0;
    c.durationMs = 0;
    c.targetLevel = 0;
    
    S.saveState();
    return true;
  }
  return false;
}

// ---- start hq upgrade ----
function startHqUpgrade(buildingId, cost, durationMs, targetLevel, useToken = false) {
  const state = S.getState();
  if (state.construction.active) {
    return { ok: false, msg: 'Ya hay una construcción en curso' };
  }
  
  // Apply Vulcan Tech bonus if they have it
  let finalDuration = durationMs;
  if (state.team.engineSupplier === 'Vulcan') {
    finalDuration = Math.floor(finalDuration * 0.85);
  }
  
  // Apply token speedup if requested (e.g. 70% reduction)
  if (useToken) {
    if (!S.spendTokens(5)) return { ok: false, msg: 'Tokens insuficientes (5 necesarios)' };
    finalDuration = Math.floor(finalDuration * 0.3);
  } else {
    if (!S.spendCredits(cost)) {
      return { ok: false, msg: `Saldo insuficiente. Necesitas ${cost.toLocaleString()} CR` };
    }
  }

  state.construction = {
    active: true,
    buildingId: buildingId,
    startTime: Date.now(),
    durationMs: finalDuration,
    targetLevel: targetLevel
  };
  S.saveState();
  return { ok: true, durationMs: finalDuration };
}

// ---- generate random event ----
function generateRandomEvent() {
  const state = S.getState();
  const t = D.RANDOM_EVENT_TEMPLATES[Math.floor(Math.random() * D.RANDOM_EVENT_TEMPLATES.length)];
  const ev = { ...t, id: t.id + '_' + Date.now() };

  // Fill in template variables
  if (state.sponsors.length && ev.text.includes('{{sponsor}}')) {
    ev.text = ev.text.replace('{{sponsor}}', state.sponsors[0].name);
  }
  if (state.pilots.length && ev.text.includes('{{pilot}}')) {
    ev.text = ev.text.replace('{{pilot}}', state.pilots[Math.floor(Math.random() * state.pilots.length)].name);
  }
  if (state.staff.length && ev.text.includes('{{staff}}')) {
    ev.text = ev.text.replace('{{staff}}', state.staff[Math.floor(Math.random() * state.staff.length)].name);
  }
  ev.text = ev.text.replace('{{component}}', ['engine','gearbox','brakes','suspension'][Math.floor(Math.random()*4)]);

  S.addRandomEvent(ev);
  return ev;
}

// ---- apply random event choice ----
function applyEventChoice(event, choiceIndex) {
  const state = S.getState();
  const choice = event.choices[choiceIndex];

  // Simple effects based on event type and choice
  if (event.id.startsWith('re9')) {
    if (choiceIndex === 0) { S.addCredits(15000); S.addLog('💰 Received +15,000 CR bonus!', 'good'); }
    else { S.addTokens(8); S.addLog('🪙 Received +8 tokens!', 'good'); }
  } else if (event.id.startsWith('re4') && choiceIndex === 0) {
    S.spendCredits(5000);
    const car = S.getCar();
    Object.keys(car.components).forEach(k => { car.components[k].score = Math.min(99, car.components[k].score + 10); });
    S.addLog('⚙️ Tech partnership accepted! All car stats +10', 'good');
  } else if (event.id.startsWith('re5') && choiceIndex === 0) {
    S.spendCredits(8000);
    S.addLog('🔧 Mechanical issue repaired!', 'info');
  } else if (event.id.startsWith('re7')) {
    if (choiceIndex === 0) {
      const st = state.staff[0];
      if (st) { st.salary = Math.round(st.salary * 1.25); S.addLog(`💼 Counter-offered ${st.name}. Salary increased.`, 'info'); }
    } else {
      if (state.staff.length) { state.staff.shift(); S.addLog('👋 Staff member left the team.', 'bad'); }
    }
  } else if (event.id.startsWith('re11') && choiceIndex === 0) {
    S.getState().finances.weeklyIncome = (S.getState().finances.weeklyIncome || 0) + 500;
    S.addLog('📦 Merchandise income boosted!', 'good');
  }
  S.saveState();
}

// ---- build initial AI standings ----
function buildInitialStandings(division) {
  const teams = D.AI_TEAMS.slice(0, 9);
  const standings = teams.map((t, i) => ({
    id: t.id, name: t.name, color: t.color, flag: t.flag,
    points: 0, wins: 0, position: i + 2, bestResult: 0
  }));
  standings.unshift({
    id: 'player', name: S.getState().team.name || 'Your Team',
    color: S.getState().team.colors.primary, flag: '',
    points: 0, wins: 0, position: 1, bestResult: 0
  });
  return standings;
}

// ---- update standings after race ----
function updateStandings(raceResult) {
  const state = S.getState();
  let standings = state.standings;
  const { position, points, finalGrid } = raceResult;

  // Update player
  const playerEntry = standings.find(s => s.id === 'player');
  if (playerEntry) {
    playerEntry.points += points;
    if (position === 1) playerEntry.wins++;
    if (!playerEntry.bestResult || position < playerEntry.bestResult) playerEntry.bestResult = position;
  }

  // Update AI
  finalGrid.forEach((car, idx) => {
    if (!car.isPlayer) {
      const entry = standings.find(s => s.id === car.id);
      if (entry) {
        const aiPts = D.POINTS_TABLE[idx] || 0;
        entry.points += aiPts;
        if (idx === 0) entry.wins++;
      }
    }
  });

  // Sort and re-assign positions
  standings.sort((a, b) => b.points - a.points || b.wins - a.wins);
  standings.forEach((s, i) => { s.position = i + 1; });
  state.standings = standings;
  S.saveState();
}
// ---- get next real-world race date ----
function getNextRaceDate() {
  const now = new Date();
  const currentDay = now.getDay();
  const currentHours = now.getHours();

  let nextEvent = new Date(now);
  nextEvent.setHours(18, 0, 0, 0);

  let daysToAdd = 0;
  let type = '';

  if (currentDay === 0) { // Sunday
    if (currentHours >= 18) {
      daysToAdd = 3; type = 'practice'; // Next is Wed
    } else {
      daysToAdd = 0; type = 'race'; // Today is Sun
    }
  } else if (currentDay === 1) { // Mon
    daysToAdd = 2; type = 'practice';
  } else if (currentDay === 2) { // Tue
    daysToAdd = 1; type = 'practice';
  } else if (currentDay === 3) { // Wed
    if (currentHours >= 18) {
      daysToAdd = 4; type = 'race'; // Next is Sun
    } else {
      daysToAdd = 0; type = 'practice'; // Today is Wed
    }
  } else if (currentDay === 4) { // Thu
    daysToAdd = 3; type = 'race';
  } else if (currentDay === 5) { // Fri
    daysToAdd = 2; type = 'race';
  } else if (currentDay === 6) { // Sat
    daysToAdd = 1; type = 'race';
  }

  nextEvent.setDate(now.getDate() + daysToAdd);
  return { date: nextEvent, type };
}

// ---- offline progression catchup ----
function catchUpOffline() {
  const state = S.getState();
  if (!state || !state.meta.saveTime) return 0;
  
  const now = Date.now();
  let saveTime = state.meta.saveTime;
  let missedRaces = 0;
  
  // Check if any building finished while offline
  updateConstructionQueue();
  
  // Find the exact next Wed/Sun 18:00 from a timestamp
  const getNextRaceSlot = (timestamp) => {
    let dMs = timestamp;
    for(let i=0; i < 200; i++) { // max 200 hours = 8 days
       dMs += 60*60*1000; // step 1 hour
       let testD = new Date(dMs);
       const day = testD.getDay();
       const hour = testD.getHours();
       if ((day === 0 || day === 3) && hour === 18) {
           testD.setMinutes(0,0,0);
           return { time: testD.getTime(), type: (day === 0 ? 'race' : 'practice') };
       }
    }
    return { time: now + 10000, type: 'race' }; // fallback far future
  };

  let slot = getNextRaceSlot(saveTime);
  const SIM_LIMIT = 8; // Max 8 races catchup (1 season)
  let logs = [];

  while (slot.time <= now && missedRaces < SIM_LIMIT) {
    const cal = state.season.calendar || [];
    const nextRaceObj = cal.find(r => r.status === 'next');
    
    if (slot.type === 'practice') {
       const prize = 15000 + Math.floor(Math.random() * 10000);
       S.addCredits(prize);
       state.pilots.forEach(p => {
          const attrs = Object.keys(p.attrs);
          const tA = attrs[Math.floor(Math.random() * attrs.length)];
          p.attrs[tA] = Math.min(99, p.attrs[tA] + 1);
       });
       logs.push(`⏱️ Práctica (Miércoles): Pilotos +1 Exp | +${GL_UI.fmtCR(prize)} CR`);
       missedRaces++;
    } else {
       if (nextRaceObj) {
         const simResult = simulateRace({ weather: 'dry', round: nextRaceObj.round, circuits: nextRaceObj.circuit });
         updateStandings(simResult);
         nextRaceObj.status = 'finished';
         nextRaceObj.result = simResult;
         
         const points = simResult.points;
         S.addCredits(simResult.prizeMoney);
         
         logs.push(`🏁 Carrera (Domingo, Ronda ${nextRaceObj.round}): P${simResult.position} (+${points} pts, +${GL_UI.fmtCR(simResult.prizeMoney)} CR)`);
         missedRaces++;
         
         const newNext = cal.find(r => r.status === 'pending');
         if (newNext) newNext.status = 'next';
         weeklyTick();
       } else {
         break;
       }
    }
    slot = getNextRaceSlot(slot.time);
  }
  
  if (missedRaces > 0) {
    S.saveState();
    setTimeout(() => {
      GL_UI.openModal({
        title: __('offline_catchup_title') || 'While You Were Away...',
        content: `
          <p style="color:var(--t-secondary);margin-bottom:16px">${__('offline_catchup_desc') || 'Your team continued to compete in scheduled races:'}</p>
          <div style="background:var(--c-surface-2);padding:16px;border-radius:8px;font-family:monospace;font-size:0.85rem;line-height:1.5;color:var(--t-primary)">
            ${logs.join('<br>')}
          </div>
          <button class="btn btn-primary w-full mt-4" style="justify-content:center" onclick="GL_UI.closeModal()">${__('continue')}</button>
        `
      });
    }, 500);
  }
  
  // Sync saveTime so we don't simulate again
  state.meta.saveTime = Date.now();
  localStorage.setItem('garage_legends_v1', JSON.stringify(state));
  
  return missedRaces;
}

// ---- train pilot (once a day) ----
function trainPilot(pid) {
  const state = S.getState();
  const p = state.pilots.find(x => x.id === pid);
  if (!p) return;
  
  const now = new Date();
  const lastDate = p.lastTrained ? new Date(p.lastTrained) : new Date(0);
  if (lastDate.toDateString() === now.toDateString()) {
    GL_UI.toast(window.__('pilots_trained_today') || 'Trained Today', 'warning');
    return;
  }
  
  // Apply training points (randomly increase 1 stat by 1-2 points)
  const attrs = Object.keys(p.attrs);
  const targetAttr = attrs[Math.floor(Math.random() * attrs.length)];
  const gain = Math.floor(Math.random() * 2) + 1;
  p.attrs[targetAttr] = Math.min(99, p.attrs[targetAttr] + gain);
  
  p.lastTrained = now.getTime();
  S.saveState();
  
  GL_UI.toast(`🏋️ ${p.name}: +${gain} ${window.__(`attr_${targetAttr}`)||targetAttr}!`, 'good');
  if (window.GL_SCREENS && document.getElementById('screen-pilots').classList.contains('active')) {
    window.GL_SCREENS.renderPilots();
  }
}

window.GL_ENGINE = {
  pilotScore, carScore, buildRaceGrid, simulateRace,
  weeklyTick, updateConstructionQueue, startHqUpgrade,
  generateRandomEvent, applyEventChoice,
  buildInitialStandings, updateStandings, getNextRaceDate, catchUpOffline, trainPilot
};

