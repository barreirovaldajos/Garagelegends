// ===== TEAM-PROFILE.JS – Mi Equipo screen + team modal =====
'use strict';

const TEAM_PROFILE = {
  _divStandings: null,
  _browserStandings: null,

  setTeamColor(type, value) {
    const state = GL_STATE.getState();
    if (!state.team.colors) state.team.colors = { primary: '#e8292a', secondary: '#0a0b0f' };
    state.team.colors[type] = value;
    GL_STATE.saveState();
    const preview = document.getElementById('tp-car-preview');
    if (preview) preview.innerHTML = this._renderCarPreview(state);
    if (window.GL_UI && typeof GL_UI.toast === 'function') GL_UI.toast('Color actualizado', 'success');
  },

  setTeamLogo(logo) {
    const state = GL_STATE.getState();
    state.team.logo = logo;
    GL_STATE.saveState();
    this.renderMyTeam();
  },

  _renderCarPreview(state) {
    const primary = (state.team.colors && state.team.colors.primary) || '#e8292a';
    const secondary = (state.team.colors && state.team.colors.secondary) || '#0a0b0f';
    const logo = state.team.logo || '🏎️';
    const name = state.team.name || 'Mi Equipo';
    return `
      <div style="width:180px;height:60px;border-radius:8px;background:linear-gradient(135deg,${secondary} 40%,${primary} 100%);display:flex;align-items:center;justify-content:center;gap:8px;font-size:1.6rem;box-shadow:0 0 0 2px ${primary}66;position:relative;overflow:hidden">
        <div style="position:absolute;inset:0;background:linear-gradient(90deg,transparent,${primary}44,transparent);pointer-events:none"></div>
        ${logo}
      </div>
      <div>
        <div style="font-weight:700;color:var(--t-primary)">${name}</div>
        <div style="font-size:0.75rem;color:var(--t-tertiary);margin-top:2px">${primary.toUpperCase()} · ${secondary.toUpperCase()}</div>
      </div>`;
  },

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

      <!-- Personalización de escudería -->
      <div class="section-header" style="margin-bottom:var(--s-2)">
        <span class="section-title" style="font-size:0.85rem">🎨 ${__('customization_title', 'Personalización de Escudería')}</span>
      </div>
      <div class="card" style="margin-bottom:var(--s-4)">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:var(--s-4)">
          <!-- Color primario -->
          <div>
            <div style="font-size:0.72rem;color:var(--t-tertiary);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">${__('customization_primary_color', 'Color principal (libre)')}</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
              ${['#e8292a','#ff6b00','#f5c518','#22c55e','#4a9eff','#a855f7','#ec4899','#ffffff','#888888','#0a0b0f'].map(c =>
                `<div onclick="GL_TEAM_PROFILE.setTeamColor('primary','${c}')" style="width:32px;height:32px;border-radius:50%;background:${c};cursor:pointer;border:3px solid ${'${primaryColor}' === c ? '#fff' : 'transparent'};transition:transform 0.15s" title="${c}"></div>`
              ).join('')}
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              <input type="color" id="tp-color-primary" value="${primaryColor}" oninput="GL_TEAM_PROFILE.setTeamColor('primary',this.value)" style="width:40px;height:40px;border:none;background:none;cursor:pointer;border-radius:8px">
              <span style="font-size:0.8rem;color:var(--t-secondary)">${__('customization_custom_color', 'Color personalizado')}</span>
            </div>
          </div>
          <!-- Color secundario -->
          <div>
            <div style="font-size:0.72rem;color:var(--t-tertiary);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">${__('customization_secondary_color', 'Color secundario (libre)')}</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
              ${['#0a0b0f','#1e293b','#111827','#1c1917','#e8292a','#ff6b00','#22c55e','#4a9eff','#f5c518','#ffffff'].map(c =>
                `<div onclick="GL_TEAM_PROFILE.setTeamColor('secondary','${c}')" style="width:32px;height:32px;border-radius:50%;background:${c};cursor:pointer;border:2px solid rgba(255,255,255,0.15);transition:transform 0.15s" title="${c}"></div>`
              ).join('')}
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              <input type="color" id="tp-color-secondary" value="${(state.team.colors && state.team.colors.secondary) || '#0a0b0f'}" oninput="GL_TEAM_PROFILE.setTeamColor('secondary',this.value)" style="width:40px;height:40px;border:none;background:none;cursor:pointer;border-radius:8px">
              <span style="font-size:0.8rem;color:var(--t-secondary)">${__('customization_custom_color', 'Color personalizado')}</span>
            </div>
          </div>
          <!-- Logo de escudería — GL-031: expanded icon system with VIP tier -->
          <div>
            <div style="font-size:0.72rem;color:var(--t-tertiary);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">${__('customization_logo', 'Logo de escudería')}</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
              ${['🏎️','🚀','⚡','🔥','🦅','🐉','💎','🛡️','🌟','🏆','⚙️','🦁','🐺','🦊','🐯','🌙','☄️','🎯','💥','🏁','🦋','🌊','🎪','⚔️','🏔️','🌪️','🔱','⚓','🎖️','🎗️','🧿','🔮','🪬','🪄','🎭','🃏'].map(em =>
                `<span onclick="GL_TEAM_PROFILE.setTeamLogo('${em}')" style="font-size:1.6rem;cursor:pointer;padding:4px;border-radius:8px;background:${state.team.logo===em?primaryColor+'33':'transparent'};transition:background 0.15s" title="${em}">${em}</span>`
              ).join('')}
            </div>
            ${(()=>{
              const isVip = state.team && state.team.vipUntil && state.team.vipUntil > Date.now();
              const vipLogos = ['👑','🏅','🎇','✨','💫','🌈','🦄','🐉‍🔥','⚜️','🔰','🕊️','🌟'];
              if (isVip) {
                return `<div style="font-size:0.7rem;color:var(--c-accent);font-weight:700;margin-bottom:4px">⭐ Logos VIP exclusivos</div>
                  <div style="display:flex;gap:6px;flex-wrap:wrap">
                    ${vipLogos.map(em =>
                      `<span onclick="GL_TEAM_PROFILE.setTeamLogo('${em}')" style="font-size:1.6rem;cursor:pointer;padding:4px;border-radius:8px;background:${state.team.logo===em?primaryColor+'33':'rgba(139,92,246,0.12)'};border:1px solid rgba(139,92,246,0.3);transition:background 0.15s" title="VIP: ${em}">${em}</span>`
                    ).join('')}
                  </div>`;
              }
              return `<div style="font-size:0.72rem;color:var(--t-tertiary);margin-top:4px;padding:8px;border-radius:8px;background:rgba(255,255,255,0.03);border:1px dashed var(--c-border)">
                🔒 ${__('customization_vip_logos', '12 logos exclusivos desbloqueables con Pase VIP')}
                <button class="btn btn-ghost btn-sm" style="margin-left:6px;font-size:0.7rem;padding:2px 8px" onclick="GL_SCREENS.renderGarage();GL_APP.navigateTo('garage')">Activar VIP →</button>
              </div>`;
            })()}
          </div>
        </div>
        <!-- Preview del auto -->
        <div style="margin-top:var(--s-4);padding-top:var(--s-4);border-top:1px solid var(--c-border)">
          <div style="font-size:0.72rem;color:var(--t-tertiary);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">${__('customization_car_preview', 'Preview de librea')}</div>
          <div id="tp-car-preview" style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:10px;background:rgba(255,255,255,0.03)">
            ${this._renderCarPreview(state)}
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
      <div class="card mb-4">
        ${historyHtml}
      </div>

      <!-- Buscador de divisiones -->
      <div class="section-header" style="margin-bottom:var(--s-2)">
        <span class="section-title" style="font-size:0.85rem">🔍 ${__('division_browser_title', 'Explorar Divisiones')}</span>
      </div>
      <div class="card">
        <div style="font-size:0.75rem;color:var(--t-tertiary);margin-bottom:10px">${__('division_browser_hint', 'Consulta las clasificaciones de cualquier grupo. Útil para seguir a amigos o rivales.')}</div>
        <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-bottom:12px">
          <div>
            <label style="font-size:0.68rem;color:var(--t-tertiary);display:block;margin-bottom:3px;text-transform:uppercase;letter-spacing:0.05em">${__('division', 'División')}</label>
            <select id="tp-browser-div" onchange="GL_TEAM_PROFILE._onBrowserDivChange()" style="background:var(--c-surface-2);color:var(--t-primary);border:1px solid var(--c-border);border-radius:var(--r-sm);padding:6px 10px;font-size:0.82rem">
              ${(window.GL_DATA && GL_DATA.DIVISIONS ? GL_DATA.DIVISIONS.slice().sort((a,b) => a.div - b.div) : []).map(d =>
                `<option value="${d.div}">${d.div} – ${d.name || ''}</option>`
              ).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:0.68rem;color:var(--t-tertiary);display:block;margin-bottom:3px;text-transform:uppercase;letter-spacing:0.05em">${__('admin_group', 'Grupo')}</label>
            <select id="tp-browser-group" style="background:var(--c-surface-2);color:var(--t-primary);border:1px solid var(--c-border);border-radius:var(--r-sm);padding:6px 10px;font-size:0.82rem">
              ${this._buildBrowserGroupOptions(1)}
            </select>
          </div>
          <button class="btn btn-primary" onclick="GL_TEAM_PROFILE.loadDivisionBrowser()" style="height:34px">
            ${__('division_browser_search', 'Ver clasificación')}
          </button>
        </div>
        <div id="tp-browser-results" style="font-size:0.82rem;color:var(--t-tertiary)">
          ${__('division_browser_empty', 'Selecciona una división y pulsa "Ver clasificación".')}
        </div>
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

  // ===== BUSCADOR DE DIVISIONES =====

  _buildBrowserGroupOptions(divNum) {
    const catalog = (window.GL_DATA && GL_DATA.DIVISIONS) ? GL_DATA.DIVISIONS : [];
    const entry = catalog.find(d => d.div === Number(divNum));
    const parallel = (entry && entry.parallelDivisions > 1) ? entry.parallelDivisions : 1;
    let html = '';
    for (let i = 1; i <= parallel; i++) {
      const lbl = (typeof Divisions !== 'undefined' && Divisions.groupLabel) ? Divisions.groupLabel(i) : i;
      html += `<option value="${i}">${lbl}</option>`;
    }
    return html;
  },

  _onBrowserDivChange() {
    const divSel   = document.getElementById('tp-browser-div');
    const groupSel = document.getElementById('tp-browser-group');
    if (!divSel || !groupSel) return;
    groupSel.innerHTML = this._buildBrowserGroupOptions(Number(divSel.value));
  },

  async loadDivisionBrowser() {
    const divSel   = document.getElementById('tp-browser-div');
    const groupSel = document.getElementById('tp-browser-group');
    const results  = document.getElementById('tp-browser-results');
    if (!divSel || !groupSel || !results) return;

    const divNum   = Number(divSel.value);
    const groupNum = Number(groupSel.value);
    const divKey   = `${divNum}_${groupNum}`;
    const divLabel = (typeof Divisions !== 'undefined' && Divisions.divisionLabel)
      ? Divisions.divisionLabel(divNum, groupNum)
      : `${divNum}-${groupNum}`;

    results.innerHTML = `<div style="color:var(--t-tertiary)">Cargando División ${divLabel}…</div>`;

    try {
      const db = window.GL_AUTH && GL_AUTH._db;
      if (!db) throw new Error('Sin conexión a base de datos');

      const snap = await db.collection('divisions').doc(divKey).get();
      if (!snap.exists) {
        results.innerHTML = `<div style="color:var(--t-tertiary)">División ${divLabel} no encontrada.</div>`;
        return;
      }

      const data     = snap.data();
      const standings = (data.standings || []).slice().sort((a, b) => (a.position || 99) - (b.position || 99));
      this._browserStandings = standings;

      const catalog  = (typeof Divisions !== 'undefined') ? Divisions.getDivisionConfig(divNum) : null;
      const promoN   = catalog ? catalog.promotions  : 0;
      const relegN   = catalog ? catalog.relegations : 0;
      const total    = standings.length;
      const phase    = data.phase || 'season';
      const seasonY  = data.seasonYear || 1;
      const round    = data.lastRaceRound || 0;
      const calendar = data.calendar || [];
      const totalRaces = calendar.length;

      const uid = window.GL_AUTH && GL_AUTH.user && GL_AUTH.user.uid;

      const rows = standings.map((s, idx) => {
        const pos      = s.position || (idx + 1);
        const posClass = pos <= 3 ? `pos-${pos}` : 'pos-n';
        const isMe     = s.isPlayer && s.teamId === uid;
        const isPlayer = s.isPlayer && !isMe;

        let zoneBg = '';
        if (promoN > 0 && pos <= promoN)              zoneBg = 'background:rgba(46,196,182,0.07)';
        if (relegN > 0 && pos > total - relegN)        zoneBg = 'background:rgba(232,41,42,0.07)';

        return `<tr style="${zoneBg}" onclick="GL_TEAM_PROFILE.openBrowserTeamByIdx(${idx})" style="cursor:pointer">
          <td><div class="pos-badge ${posClass}">${pos}</div></td>
          <td style="padding:6px 4px">
            <span style="color:${isMe ? 'var(--c-accent)' : 'var(--t-primary)'};font-weight:${isMe ? '700' : '400'}">
              ${escapeHtml(s.teamName || '—')}${isMe ? ' ⭐' : ''}${isPlayer ? ' 👤' : ''}${!s.isPlayer ? ' 🤖' : ''}
            </span>
          </td>
          <td style="font-weight:700;color:var(--c-gold)">${s.points || 0}</td>
          <td style="color:var(--t-secondary)">${s.wins || 0}</td>
          <td style="color:var(--t-tertiary)">${s.podiums || 0}</td>
          <td style="color:var(--t-tertiary);font-size:0.72rem">${s.bestResult ? 'P' + s.bestResult : '—'}</td>
        </tr>`;
      }).join('');

      const promoFooter = promoN > 0
        ? `<div style="display:flex;align-items:center;gap:6px;margin-top:8px;font-size:0.72rem;color:var(--c-green)"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:rgba(46,196,182,0.3)"></span>Top ${promoN} ascienden</div>` : '';
      const relegFooter = relegN > 0
        ? `<div style="display:flex;align-items:center;gap:6px;margin-top:4px;font-size:0.72rem;color:var(--c-red,#e8292a)"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:rgba(232,41,42,0.2)"></span>Últimos ${relegN} descienden</div>` : '';

      results.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:4px">
          <span style="font-weight:700;color:var(--t-primary)">División ${divLabel}</span>
          <span style="font-size:0.72rem;color:var(--t-tertiary)">Temporada ${seasonY} · Ronda ${round}/${totalRaces} · ${phase === 'offseason' ? '🏁 Finalizada' : '🟢 En curso'}</span>
        </div>
        <table class="standings-table-full" style="cursor:default">
          <thead><tr>
            <th style="width:36px">Pos</th>
            <th>Equipo</th>
            <th>Pts</th>
            <th>V</th>
            <th>Pod</th>
            <th>Mejor</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        ${promoFooter}${relegFooter}
      `;
    } catch (err) {
      results.innerHTML = `<div style="color:var(--c-red,#e8292a)">Error: ${err.message}</div>`;
    }
  },

  openBrowserTeamByIdx(idx) {
    if (!this._browserStandings) return;
    const s = this._browserStandings[idx];
    if (!s) return;
    this.openTeamModal(s);
  },

  openTeamModal(s) {
    // s can come from SP standings {id, name, color, points, wins, podiums, bestResult, position}
    // or MP standings {teamId, teamName, color, points, wins, podiums, position, isPlayer}
    const name      = escapeHtml(s.teamName || s.name || 'Team');
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
