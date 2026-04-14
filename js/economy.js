// economy.js
// Módulo central para lógica de economía, ingresos, gastos y balance semanal

'use strict';

const Economy = {
  ensureFinanceMeta(state) {
    if (!state) return;
    if (!state.finances) state.finances = {};
    if (typeof state.finances.deficitStreak !== 'number') state.finances.deficitStreak = 0;
    if (typeof state.finances.criticalDeficit !== 'boolean') state.finances.criticalDeficit = false;
    if (typeof state.finances.lastNet !== 'number') state.finances.lastNet = 0;
    if (!state.team) state.team = {};
    if (typeof state.team.fans !== 'number') state.team.fans = 0;
  },

  calculateTeamIncomeBreakdown(state) {
    if (!state) {
      return { sponsorIncome: 0, fanRevenue: 0, divisionGrant: 0, bonusIncome: 0, income: 0 };
    }
    const sponsors = (state.sponsors || []).filter(s => !s.expired);
    const baseSponsorIncome = sponsors.reduce((sum, s) => sum + (s.weeklyValue || s.income || 0), 0);
    const adminLv = (state.hq && state.hq.admin) || 1;
    const division = Number(state?.season?.division) || 8;
    const divisionGrantTable = { 1: 65000, 2: 52000, 3: 42000, 4: 34000, 5: 28000, 6: 23000, 7: 19000, 8: 16000 };
    const sponsorMultiplier = 1
      + (adminLv >= 2 ? 0.1 : 0)
      + (adminLv >= 3 ? 0.05 : 0)
      + (adminLv >= 4 ? 0.05 : 0)
      + (adminLv >= 5 ? 0.1 : 0);
    const sponsorIncome = Math.round(baseSponsorIncome * sponsorMultiplier);
    const fanRevenue = Math.floor((state?.team?.fans || 0) * 0.12);
    const divisionGrant = divisionGrantTable[division] || 22000;
    const bonusIncome = Number(state?.finances?.bonusIncome) || 0;

    return {
      sponsorIncome,
      fanRevenue,
      divisionGrant,
      bonusIncome,
      income: sponsorIncome + fanRevenue + divisionGrant + bonusIncome
    };
  },

  calculateTeamExpenseBreakdown(state) {
    if (!state) {
      return { salaries: 0, hqCost: 0, contractCost: 0, constructionUpkeep: 0, expenses: 0 };
    }
    const pilots = state.pilots || [];
    const staff = state.staff || [];
    const salaries = pilots.reduce((sum, p) => sum + (p.salary || 0), 0) + staff.reduce((sum, s) => sum + (s.salary || 0), 0);
    const hq = state.hq || {};
    const HQ_WEEKLY_COST = { admin: 300, wind_tunnel: 450, rnd: 600, factory: 550, academy: 300 };
    const hqCost = Object.keys(HQ_WEEKLY_COST).reduce((sum, key) => {
      return sum + ((hq[key] || 0) * HQ_WEEKLY_COST[key]);
    }, 0);

    const contracts = (state.contracts || []).filter(c => !c.expired);
    const contractCost = contracts.reduce((sum, c) => sum + (c.weeklyCost || 0), 0);
    const constructionUpkeep = state?.construction?.active ? 500 : 0;

    return {
      salaries,
      hqCost,
      contractCost,
      constructionUpkeep,
      expenses: salaries + hqCost + contractCost + constructionUpkeep
    };
  },

  calculateTeamIncome(state) {
    return this.calculateTeamIncomeBreakdown(state).income;
  },

  calculateTeamExpenses(state) {
    return this.calculateTeamExpenseBreakdown(state).expenses;
  },

  handleDeficitStatus(state, net) {
    if (!state) {
      return { streak: 0, critical: false, fansDelta: 0, notes: [] };
    }
    this.ensureFinanceMeta(state);

    const effects = {
      streak: state.finances.deficitStreak,
      critical: false,
      fansDelta: 0,
      notes: []
    };

    if (net < 0) {
      state.finances.deficitStreak += 1;
      effects.streak = state.finances.deficitStreak;

      const fanLoss = state.finances.deficitStreak >= 3 ? 120 : 45;
      state.team.fans = Math.max(0, (state.team.fans || 0) - fanLoss);
      effects.fansDelta = -fanLoss;

      if (state.finances.deficitStreak >= 3) {
        state.finances.criticalDeficit = true;
        effects.critical = true;
        effects.notes.push('critical_deficit');
      } else {
        state.finances.criticalDeficit = false;
        effects.notes.push('deficit');
      }
      return effects;
    }

    // Positive week recovers deficit pressure gradually.
    if (state.finances.deficitStreak > 0) {
      state.finances.deficitStreak = Math.max(0, state.finances.deficitStreak - 1);
      effects.notes.push('recovery');
    }
    state.finances.criticalDeficit = false;
    return effects;
  },

  processWeeklyBalance(state) {
    if (!state) {
      return { income: 0, expenses: 0, net: 0, effects: { streak: 0, critical: false, fansDelta: 0, notes: [] } };
    }
    this.ensureFinanceMeta(state);
    const income = this.calculateTeamIncome(state);
    const expenses = this.calculateTeamExpenses(state);
    const net = income - expenses;

    state.finances.weeklyIncome = income;
    state.finances.weeklyExpenses = expenses;
    state.finances.lastNet = net;

    const effects = this.handleDeficitStatus(state, net);
    return { income, expenses, net, effects };
  }
};

if (typeof window !== 'undefined') {
  window.Economy = Economy;
}