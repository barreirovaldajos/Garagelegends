// ===== TEAM-PROFILE.JS – Mi Equipo screen + team modal =====
'use strict';

const TEAM_PROFILE = {
  // Temp storage for standings so onclick callbacks can reference by index (avoids escaping issues)
  _divStandings: null,

  // ===== PANTALLA COMPLETA: MI EQUIPO =====
  renderMyTeam() {
    const state = GL_STATE.getState();
    const el = document.getElementById('screen-mi-equipo');
    if (!el) return;

    const raceResults   = state.raceResults   || [];
    const seasonHistory = state.seasonHistory || [];

    // Use cached MP standings if available (set by dashboard/standings fetch)
    const uid = window.GL_AUTH && GL_AUTH.user && GL_AUTH.user.uid;
    const mpEntry = this._divStandings && uid
      ? this._divStandings.find(s => s.isPlayer && s.teamId === uid)
      : null;

    const wins       = mpEntry ? (mpEntry.wins    || 0) : 0;
    const podiums    = mpEntry ? (mpEntry.podiums  || 0) : 0;
    const points     = mpEntry ? (mpEntry.points   || 0) : 0;
    const position   = mpEntry ? (mpEntry.position || '-') : '-';
    const bestResult = mpEntry ? (mpEntry.bestResult || null) : null;

    const mp = window.GL_AUTH && GL_AUTH.mp;
    const divLabel = mp
      ? `${mp.division}-${mp.divisionGroup || mp.group || '?'}`
      : ((typeof Divisions !== 'undefined' && Divisions.divisionLabel)
          ? Divisions.divisionLabel(state.season.division, state.season.divisionGroup)
          : state.season.division);

    const allTimeWins    = seasonHistory.reduce((s, h) => s + (Number(h.wins)    || 0), 0) + wins;
    const allTimePodiums = seasonHistory.reduce((s, h) => s + (Number(h.podiums) || 0), 0) + podiums;
    const promotions     = seasonHistory.filter(h => h.result === 'promoted').length;
    const relegations    = seasonHistory.filter(h => h.result === 'relegated').length;
    const totalSeasons   = seasonHistory.length + 1;

    // ---- race results table ----
    const raceResultsHtml = raceResults.length
      ? `<table class="standings-table-full">
          <thead><tr>
            <th>${__('round', 'Ronda')}</th>
            <th>${__('standings_team', 'Circuito')}</th>
            <th>${__('standings_pos', 'Pos')}</th>
            <th>${__('standings_points', 'Pts')}</th>
          </tr></thead>
          <tbody>
            ${raceResults.slice().reverse().map(r => {
              const pos = r.position || r.finishPosition;
              const posClass = pos <= 3 ? `pos-${pos}` : 'pos-n';
              return `<tr>
                <td style="color:var(--t-tertiary)">${r.round || '—'}</td>
                <td>${(r.circuit && r.circuit.name) || '—'}</td>
                <td><div class="pos-badge ${posClass}">${pos ? 'P' + pos : '—'}</div></td>
                <td><strong style="color:var(--c-gold)">${r.points || 0}</strong></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>`
      : `<p style="color:var(--t-tertiary);font-size:0.82rem;text-align:center;padding:12px 0">${__('no_race_complete', 'Sin carreras completadas aún.')}</p>`;

    // ---- season history ----
    const historyHtml = seasonHistory.length
      ? seasonHistory.slice().reverse().slice(0, 6).map(h => {
          const res   = h.result === 'promoted' ? '▲' : h.result === 'relegated' ? '▼' : '–';
          const color = h.result === 'promoted' ? 'var(--c-green)' : h.result === 'relegated' ? 'var(--c-red)' : 'var(--t-tertiary)';
          const hDiv  = (typeof Divisions !== 'undefined' && Divisions.divisionLabel)
            ? Divisions.divisionLabel(h.division, h.divisionGroup)
            : h.division;
          return `<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--c-border);font-size:0.82rem">
            <span style="color:var(--t-tertiary);width:56px;flex-shrink:0">${__('season_history_year', 'Año')} ${h.year}</span>
            <span style="flex:1;color:var(--t-secondary)">${__('division', 'Div')} ${hDiv}</span>
            <span style="color:var(--c-gold);font-weight:700;width:28px;text-align:center">P${h.finishPosition || '?'}</span>
            <span style="color:var(--t-tertiary);width:52px;text-align:right">${h.points || 0} pts</span>
            <span style="color:var(--t-tertiary);width:24px;text-align:center">${h.wins || 0}W</span>
            <span style="color:${color};font-weight:700;width:16px;text-align:right">${res}</span>
          </div>`;
        }).join('')
      : `<p style="color:var(--t-tertiary);font-size:0.82rem;text-align:center;padding:12px 0">${__('season_history_empty', 'Sin temporadas completadas.')}</p>`;

    const primaryColor = (state.team.colors && state.team.colors.primary) || '#e8292a';

    el.innerHTML = `
      <div class="screen-header">
        <div class="screen-title-group">
          <div class="screen-eyebrow">${__('mi_equipo_eyebrow', 'PERFIL')}</div>
          <div class="screen-title">${__('mi_equipo_title', 'Mi Equipo')}</div>
          <div class="screen-subtitle">${state.team.origin || state.team.country || ''}</div>
        </div>
      </div>

      <!-- Hero -->
      <div class="card" style="display:flex;align-items:center;gap:var(--s-5);margin-bottom:var(--s-4);flex-wrap:wrap">
        <div style="font-size:3.5rem;width:72px;height:72px;display:flex;align-items:center;justify-content:center;border-radius:16px;background:${primaryColor}22;border:2px solid ${primaryColor}44;flex-shrink:0">
          ${state.team.logo || '🏎️'}
        </div>
        <div style="flex:1;min-width:180px">
          <div style="font-size:1.6rem;font-weight:800;color:var(--t-primary)">${state.team.name || 'My Team'}</div>
          <div style="font-size:0.82rem;color:var(--t-secondary);margin-top:3px">
            ${__('division', 'División')} ${divLabel}${state.team.engineSupplier ? ' · ' + state.team.engineSupplier : ''}
          </div>
          <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
            <span style="background:var(--c-gold)22;color:var(--c-gold);padding:3px 10px;border-radius:20px;font-size:0.73rem;font-weight:700">P${position} ${__('standings_eyebrow', 'División')}</span>
            ${state.team.fans ? `<span style="background:var(--c-surface-2);color:var(--t-secondary);padding:3px 10px;border-radius:20px;font-size:0.73rem">👥 ${GL_UI.fmtCR(state.team.fans)} fans</span>` : ''}
            <span style="background:${primaryColor}22;color:${primaryColor};padding:3px 10px;border-radius:20px;font-size:0.73rem;font-weight:600">${primaryColor.toUpperCase()}</span>
          </div>
        </div>
      </div>

      <!-- Stats esta temporada -->
      <div class="section-header" style="margin-bottom:var(--s-2)">
        <span class="section-title" style="font-size:0.85rem">${__('mi_equipo_season_stats', 'Esta temporada')}</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:var(--s-3);margin-bottom:var(--s-4)">
        ${[
          { label: __('standings_pos',     'Posición'),        val: `P${position}`, color: 'var(--c-gold)' },
          { label: __('standings_points',  'Puntos'),          val: points,         color: 'var(--t-primary)' },
          { label: __('standings_wins',    'Victorias'),       val: wins,           color: 'var(--t-primary)' },
          { label: __('standings_podiums', 'Podios'),          val: podiums,        color: 'var(--t-primary)' },
          { label: __('standings_best',    'Mejor resultado'), val: bestResult ? 'P' + bestResult : '—', color: 'var(--t-secondary)' },
          { label: __('mi_equipo_races',   'Carreras'),        val: raceResults.length, color: 'var(--t-secondary)' },
        ].map(s => `<div class="card" style="padding:var(--s-3);text-align:center">
          <div style="font-size:1.5rem;font-weight:800;color:${s.color}">${s.val}</div>
          <div style="font-size:0.68rem;color:var(--t-tertiary);margin-top:2px;text-transform:uppercase;letter-spacing:0.05em">${s.label}</div>
        </div>`).join('')}
      </div>

      <!-- Stats históricos -->
      <div class="section-header" style="margin-bottom:var(--s-2)">
        <span class="section-title" style="font-size:0.85rem">${__('mi_equipo_alltime', 'Historial total')}</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:var(--s-3);margin-bottom:var(--s-4)">
        ${[
          { label: __('mi_equipo_seasons',          'Temporadas'),       val: totalSeasons },
          { label: __('team_profile_alltime_wins',   'Victorias totales'), val: allTimeWins },
          { label: __('team_profile_alltime_podiums','Podios totales'),    val: allTimePodiums },
          { label: __('team_profile_promotions',     'Ascensos'),          val: promotions },
          { label: __('team_profile_relegations',    'Descensos'),         val: relegations },
        ].map(s => `<div style="padding:var(--s-3);border-radius:var(--r-lg);background:var(--c-surface-2);border:1px solid var(--c-border);text-align:center">
          <div style="font-size:1.3rem;font-weight:700;color:var(--t-secondary)">${s.val}</div>
          <div style="font-size:0.68rem;color:var(--t-tertiary);margin-top:2px;text-transform:uppercase;letter-spacing:0.05em">${s.label}</div>
        </div>`).join('')}
      </div>

      <!-- Resultados esta temporada -->
      <div class="section-header" style="margin-bottom:var(--s-2)">
        <span class="section-title" style="font-size:0.85rem">${__('mi_equipo_results_title', 'Resultados de carrera')}</span>
      </div>
      <div class="card mb-4">
        ${raceResultsHtml}
      </div>

      <!-- Historial de temporadas -->
      <div class="section-header" style="margin-bottom:var(--s-2)">
        <span class="section-title" style="font-size:0.85rem">${__('season_history_title', 'Temporadas anteriores')}</span>
      </div>
      <div class="card">
        ${historyHtml}
      </div>
    `;
  },

  // ===== MODAL: CUALQUIER EQUIPO (clic desde standings) =====
  openTeamByIndex(idx) {
    if (!this._divStandings) return;
    const s = this._divStandings[idx];
    if (!s) return;
    this.openTeamModal(s);
  },

  openTeamModal(s) {
    // s can come from SP standings {id, name, color, points, wins, podiums, bestResult, position}
    // or MP standings {teamId, teamName, color, points, wins, podiums, position, isPlayer}
    const name      = s.teamName || s.name || 'Team';
    const color     = s.color    || '#888';
    const position  = s.position || '—';
    const points    = s.points   || 0;
    const wins      = s.wins     || 0;
    const podiums   = s.podiums  || 0;
    const bestResult = s.bestResult || null;
    const isMe      = s.id === 'player' || (s.isPlayer && s.teamId === (window.GL_AUTH && GL_AUTH.user && GL_AUTH.user.uid));
    const isBot     = s.id !== 'player' && !s.isPlayer;

    GL_UI.openModal({
      title: name,
      size: 'sm',
      content: `
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px">
          <div style="width:44px;height:44px;border-radius:50%;background:${color};border:3px solid ${color}88;flex-shrink:0"></div>
          <div>
            <div style="font-size:1.1rem;font-weight:700;color:var(--t-primary)">${name}${isBot ? ' 🤖' : ''}</div>
            ${isMe   ? `<div style="font-size:0.75rem;color:var(--c-accent);margin-top:2px">⭐ ${__('standings_you', 'Tu equipo')}</div>` : ''}
            ${isBot  ? `<div style="font-size:0.75rem;color:var(--t-tertiary);margin-top:2px">${__('team_profile_bot', 'Equipo bot')}</div>` : ''}
            ${!isMe && !isBot ? `<div style="font-size:0.75rem;color:var(--t-tertiary);margin-top:2px">👤 ${__('team_profile_player', 'Jugador real')}</div>` : ''}
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          ${[
            { label: __('standings_pos',     'Posición'),  val: position ? 'P' + position : '—' },
            { label: __('standings_points',  'Puntos'),    val: points },
            { label: __('standings_wins',    'Victorias'), val: wins },
            { label: __('standings_podiums', 'Podios'),    val: podiums },
            ...(bestResult ? [{ label: __('standings_best', 'Mejor resultado'), val: 'P' + bestResult }] : []),
          ].map(stat => `<div style="padding:10px;border-radius:10px;background:var(--c-surface-2);border:1px solid var(--c-border);text-align:center">
            <div style="font-size:1.2rem;font-weight:700;color:var(--t-primary)">${stat.val}</div>
            <div style="font-size:0.7rem;color:var(--t-tertiary);margin-top:2px;text-transform:uppercase;letter-spacing:0.05em">${stat.label}</div>
          </div>`).join('')}
        </div>
        ${isMe ? `<div style="margin-top:16px">
          <button class="btn btn-primary w-full" style="justify-content:center" onclick="GL_UI.closeTopModal();GL_APP.navigateTo('mi-equipo')">
            ${__('mi_equipo_view_full', 'Ver perfil completo →')}
          </button>
        </div>` : ''}
      `
    });
  }
};

window.GL_TEAM_PROFILE = TEAM_PROFILE;
