// economy.js
// Módulo central para lógica de economía, ingresos, gastos y balance semanal

'use strict';

const Economy = {
  ensureFinanceMeta(state) {
    if (!state.finances) state.finances = {};
    if (typeof state.finances.deficitStreak !== 'number') state.finances.deficitStreak = 0;
    if (typeof state.finances.criticalDeficit !== 'boolean') state.finances.criticalDeficit = false;
    if (typeof state.finances.lastNet !== 'number') state.finances.lastNet = 0;
  },

  calculateTeamIncomeBreakdown(state) {
    const sponsors = (state.sponsors || []).filter(s => !s.expired);
    const baseSponsorIncome = sponsors.reduce((sum, s) => sum + (s.weeklyValue || s.income || 0), 0);
    const adminLv = (state.hq && state.hq.admin) || 1;
    const division = Number(state?.season?.division) || 8;
    const divisionGrantTable = { 1: 36000, 2: 34000, 3: 32000, 4: 30000, 5: 28000, 6: 26000, 7: 24000, 8: 22000 };
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
    this.ensureFinanceMeta(state);

    const effects = {
      streak: state.finances.deficitStreak,
      critical: false,
      reputationDelta: 0,
      fansDelta: 0,
      notes: []
    };

    if (net < 0) {
      state.finances.deficitStreak += 1;
      effects.streak = state.finances.deficitStreak;

      const repLoss = state.finances.deficitStreak >= 3 ? 8 : 3;
      const fanLoss = state.finances.deficitStreak >= 3 ? 120 : 45;
      state.team.reputation = Math.max(0, (state.team.reputation || 0) - repLoss);
      state.team.fans = Math.max(0, (state.team.fans || 0) - fanLoss);
      effects.reputationDelta = -repLoss;
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

    const repGain = 1;
    state.team.reputation = Math.min(500, (state.team.reputation || 0) + repGain);
    effects.reputationDelta = repGain;
    return effects;
  },

  processWeeklyBalance(state) {
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