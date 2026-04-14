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

function getDivisionCatalog() {
  const rawCatalog = (window.GL_DATA && Array.isArray(window.GL_DATA.DIVISIONS))
    ? window.GL_DATA.DIVISIONS
    : [];
  return rawCatalog
    .map((entry) => ({
      div: Number(entry?.div),
      teams: Number(entry?.teams),
      promotions: Number(entry?.promotions),
      relegations: Number(entry?.relegations),
      parallelDivisions: Number(entry?.parallelDivisions || 1),
      name: entry?.name || ''
    }))
    .filter((entry) => Number.isFinite(entry.div) && entry.div >= 1)
    .sort((a, b) => a.div - b.div);
}

function getDivisionBounds(catalog) {
  const source = Array.isArray(catalog) ? catalog : getDivisionCatalog();
  if (!source.length) {
    return { minDivision: 1, maxDivision: 8 };
  }
  return {
    minDivision: source[0].div,
    maxDivision: source[source.length - 1].div
  };
}

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
  getDivisionCatalog() {
    return getDivisionCatalog();
  },

  getDivisionBounds() {
    return getDivisionBounds(getDivisionCatalog());
  },

  getTeamSlotsPerDivision() {
    return 10;
  },

  getPilotSlotsPerDivision() {
    return this.getTeamSlotsPerDivision() * 2;
  },

  getDivisionConfig(divNum) {
    const catalog = getDivisionCatalog();
    const bounds = getDivisionBounds(catalog);
    const numericDiv = Number(divNum);
    const targetDiv = Number.isFinite(numericDiv)
      ? Math.max(bounds.minDivision, Math.min(bounds.maxDivision, Math.round(numericDiv)))
      : bounds.maxDivision;
    const matched = catalog.find((entry) => entry.div === targetDiv);
    if (matched) {
      return {
        teams: Number.isFinite(matched.teams) && matched.teams > 0 ? matched.teams : this.getTeamSlotsPerDivision(),
        promotions: Number.isFinite(matched.promotions) ? Math.max(0, matched.promotions) : 2,
        relegations: Number.isFinite(matched.relegations) ? Math.max(0, matched.relegations) : 2,
        parallelDivisions: Number.isFinite(matched.parallelDivisions) && matched.parallelDivisions > 0 ? matched.parallelDivisions : 1,
        name: matched.name || `Division ${targetDiv}`
      };
    }

    if (targetDiv <= bounds.minDivision) {
      return { teams: this.getTeamSlotsPerDivision(), promotions: 0, relegations: 4, parallelDivisions: 1, name: 'Division 1' };
    }
    if (targetDiv >= bounds.maxDivision) {
      return { teams: this.getTeamSlotsPerDivision(), promotions: 2, relegations: 0, parallelDivisions: 1, name: `Division ${bounds.maxDivision}` };
    }
    return { teams: this.getTeamSlotsPerDivision(), promotions: 2, relegations: 2, parallelDivisions: 1, name: `Division ${targetDiv}` };
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