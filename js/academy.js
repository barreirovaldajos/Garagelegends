// academy.js
// Módulo para lógica de entrenamiento, progresión y scouting de pilotos

'use strict';

const Academy = {

  getNowMs() {
    if (typeof window !== 'undefined' && window.GL_ENGINE && typeof window.GL_ENGINE.getNowMs === 'function') {
      return window.GL_ENGINE.getNowMs();
    }
    return Date.now();
  },

  getAcademyCaps(state) {
    const academyLv = (state.hq && state.hq.academy) || 1;
    return {
      trainingSlots: academyLv >= 3 ? 2 : 1,
      trainingSpeedMultiplier: 1
        + (academyLv >= 2 ? 0.1 : 0)
        + (academyLv >= 3 ? 0.2 : 0)
        + (academyLv >= 4 ? 0.25 : 0)
        + (academyLv >= 5 ? 0.45 : 0)
    };
  },

  queueTraining(state, pilotId, trainingType, duration, targetAttr) {
    if (!state.academyQueue) state.academyQueue = [];
    const caps = this.getAcademyCaps(state);
    if (state.academyQueue.length >= caps.trainingSlots) {
      if (typeof window !== 'undefined' && window.GL_STATE) {
        window.GL_STATE.addLog('❌ Academia al límite. Mejora la Academia para más entrenamientos simultáneos.', 'warning');
      }
      return false;
    }
    const adjustedDuration = Math.max(5 * 60 * 1000, Math.floor(duration / caps.trainingSpeedMultiplier));
    state.academyQueue.push({ pilotId, trainingType, startTime: this.getNowMs(), duration: adjustedDuration, targetAttr });
    if (typeof window !== 'undefined' && window.GL_STATE) {
      window.GL_STATE.setAcademyQueue(state.academyQueue);
    }
    return true;
  },

  processActiveTraining(state) {
    if (!state.academyQueue) return;
    const now = this.getNowMs();
    let changed = false;
    state.academyQueue = state.academyQueue.filter(item => {
      if (now - item.startTime >= item.duration) {
        this.improveAttribute(state, item.pilotId, item.targetAttr);
        if (typeof window !== 'undefined' && window.GL_STATE) {
          window.GL_STATE.addLog(`🎓 ${item.trainingType}: ${item.targetAttr} mejorado para piloto ${item.pilotId}.`, 'good');
        }
        changed = true;
        return false;
      }
      return true;
    });
    if (changed && typeof window !== 'undefined' && window.GL_STATE) {
      window.GL_STATE.setAcademyQueue(state.academyQueue);
    }
  },

  improveAttribute(state, pilotId, attr) {
    const pilot = (state.pilots || []).find(p => p.id === pilotId);
    if (pilot && pilot.attrs && typeof pilot.attrs[attr] === 'number') {
      pilot.attrs[attr] = Math.min(99, pilot.attrs[attr] + 1);
    }
  },

  generateScoutingPool(state) {
    // Genera un pool semanal de 3-5 pilotos candidatos con stats variados
    const pool = [];
    const names = ['Alex', 'Jordan', 'Casey', 'Morgan', 'Taylor', 'Riley', 'Sam', 'Jamie', 'Robin', 'Drew'];
    for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i++) {
      const id = 'scout_' + Date.now() + '_' + i + '_' + Math.floor(Math.random()*1000);
      const name = names[Math.floor(Math.random() * names.length)] + ' ' + String.fromCharCode(65 + Math.floor(Math.random()*26)) + '.';
      const attrs = {
        pace: 50 + Math.floor(Math.random() * 30),
        racePace: 50 + Math.floor(Math.random() * 30),
        consistency: 45 + Math.floor(Math.random() * 35),
        rain: 40 + Math.floor(Math.random() * 40),
        tyre: 40 + Math.floor(Math.random() * 40),
        aggression: 40 + Math.floor(Math.random() * 40),
        overtake: 40 + Math.floor(Math.random() * 40),
        techFB: 40 + Math.floor(Math.random() * 40),
        mental: 40 + Math.floor(Math.random() * 40),
        charisma: 40 + Math.floor(Math.random() * 40)
      };
      pool.push({
        id, name, attrs,
        age: 18 + Math.floor(Math.random() * 10),
        salary: 4000 + Math.floor(Math.random() * 4000),
        potential: 60 + Math.floor(Math.random() * 40),
        contractWeeks: 20,
        emoji: '🏁',
        bio: 'Joven promesa con potencial.'
      });
    }
    state.scoutingPool = pool;
    if (typeof window !== 'undefined' && window.GL_STATE) {
      window.GL_STATE.setScoutingPool(pool);
      window.GL_STATE.addLog('🔍 Nuevo pool de scouting generado.', 'info');
    }
  },

  attemptScout(state, candidateId) {
    // Contrata un piloto del pool si hay espacio
    if (!state.scoutingPool) return false;
    const candidate = state.scoutingPool.find(p => p.id === candidateId);
    if (!candidate) return false;
    if (!state.pilots) state.pilots = [];
    if (state.pilots.length >= 3) {
      if (typeof window !== 'undefined' && window.GL_STATE) {
        window.GL_STATE.addLog('❌ Límite de pilotos alcanzado.', 'warning');
      }
      return false;
    }
    state.pilots.push(candidate);
    state.scoutingPool = state.scoutingPool.filter(p => p.id !== candidateId);
    if (typeof window !== 'undefined' && window.GL_STATE) {
      window.GL_STATE.setScoutingPool(state.scoutingPool);
      window.GL_STATE.addLog(`✅ Piloto ${candidate.name} fichado vía scouting.`, 'good');
    }
    return true;
  }
};

if (typeof window !== 'undefined') {
  window.Academy = Academy;
}