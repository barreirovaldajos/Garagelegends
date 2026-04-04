// divisions.js
// Módulo para lógica de ligas, divisiones, ascensos y descensos

'use strict';

// Estructura base de ligas MMO/social
const DEFAULT_LEAGUES = [
  { id: 1, name: 'World Series', tier: 1, teams: [], mmo: true },
  { id: 2, name: 'Continental Cup', tier: 2, teams: [], mmo: false },
  { id: 3, name: 'National League', tier: 3, teams: [], mmo: false }
];

function getLeaguesStorageKey() {
  if (window.GL_AUTH && typeof GL_AUTH.getStorageKeySuffix === 'function') {
    const suffix = GL_AUTH.getStorageKeySuffix();
    if (suffix) return `leagues_${suffix}`;
  }
  return 'leagues';
}

function loadLeagues() {
  const key = getLeaguesStorageKey();
  let raw = localStorage.getItem(key);
  if (!raw && key !== 'leagues') {
    const legacy = localStorage.getItem('leagues');
    if (legacy) {
      raw = legacy;
      localStorage.setItem(key, legacy);
    }
  }
  try {
    return raw ? JSON.parse(raw) : DEFAULT_LEAGUES;
  } catch (_) {
    return DEFAULT_LEAGUES;
  }
}

let leagues = loadLeagues();

const Divisions = {
    // MMO/social: hooks y placeholders
    getLeagues() {
      return leagues;
    },
    setLeagues(newLeagues) {
      leagues = newLeagues;
      localStorage.setItem(getLeaguesStorageKey(), JSON.stringify(leagues));
    },
    registerMMOEvent(event) {
      // Placeholder: integrar con backend MMO
      // Por ahora, solo loguea
      console.log('MMO Event:', event);
    },
    requestHelpMMO(request) {
      // Placeholder: integrar con backend MMO
      // Por ahora, solo loguea
      console.log('MMO Help Request:', request);
    },
  getDivisionConfig(divNum) {
    // Ejemplo: configuración por división
    const configs = {
      8: { teams: 10, promotions: 2, relegations: 2 },
      7: { teams: 10, promotions: 2, relegations: 2 },
      // ...
      1: { teams: 10, promotions: 0, relegations: 2 }
    };
    return configs[divNum] || configs[8];
  },

  getTeamsInDivision(divNum) {
    // TODO: Integrar con sistema MMO/multijugador
    return [];
  },

  calculatePromotion(standings, divNum) {
    const config = this.getDivisionConfig(divNum);
    return standings.slice(0, config.promotions);
  },

  calculateRelegation(standings, divNum) {
    const config = this.getDivisionConfig(divNum);
    return standings.slice(-config.relegations);
  },

  startDivisionSeason(divNum) {
    // TODO: Inicializar temporada de división
  },

  generateDivisionCalendar(divNum) {
    // TODO: Generar calendario por división
  },

  endDivisionSeason(divNum) {
    // TODO: Procesar ascensos/descensos
  }
};


if (typeof window !== 'undefined') {
  window.Divisions = Divisions;
}