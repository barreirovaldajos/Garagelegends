// ===== SCREENS.JS – All secondary screen renderers =====
'use strict';

const SCREENS = {

  // ===== GARAGE SCREEN (HQ) =====
  renderGarage() {
    const state = GL_STATE.getState();
    const hqLevels = state.hq || { wind_tunnel: 1, rnd: 1, factory: 1, academy: 1, admin: 1 };
    const c = state.construction || { active: false };
    const engineSup = state.team.engineSupplier ? GL_DATA.ENGINE_SUPPLIERS.find(e => e.id === state.team.engineSupplier) : null;
    
    const el = document.getElementById('screen-garage');
    if (!el) return;
    
    el.innerHTML = `
      <div class="screen-header">
        <div class="screen-title-group">
          <div class="screen-eyebrow">Motor Empire Infraestructura</div>
          <div class="screen-title">Cuartel General (HQ)</div>
          <div class="screen-subtitle">Invierte tus Dólares ME en edificios para ganar ventaja técnica a lo largo de la temporada.</div>
        </div>
        ${engineSup ? `
        <div class="card" style="display:flex;align-items:center;gap:var(--s-3);padding:var(--s-3) var(--s-4);border-color:${engineSup.color}66;background:${engineSup.color}11">
           <div style="font-size:2rem">⚙️</div>
           <div>
              <div style="font-size:0.75rem;color:var(--t-secondary)">Motor Oficial</div>
              <div style="font-weight:700;color:${engineSup.color}">${engineSup.name}</div>
           </div>
        </div>` : ''}
      </div>
      
      <div class="garage-layout">
        <div class="garage-map">
          <div class="garage-map-bg"></div>
          <div class="garage-grid-overlay"></div>
          <div class="section-eyebrow" style="position:relative;z-index:2">Instalaciones Físicas · ${state.team.name || ''}</div>
          
          <div class="garage-buildings mt-auto" style="position:relative;z-index:2;margin-top:var(--s-5)">
            ${GL_DATA.FACILITIES.map(def => {
              const currentLevel = hqLevels[def.id] || 0;
              const nextLevelData = def.levels[currentLevel];
              const isUpgrading = c.active && c.buildingId === def.id;
              let contentHtml = '';
              
              if (isUpgrading) {
                // Show real-time progress bar
                contentHtml = `
                  <div class="building-upgrade-bar"><div class="building-upgrade-fill" id="hq-fill-${def.id}" style="width:0%"></div></div>
                  <div style="display:flex;justify-content:space-between;font-size:0.65rem;margin-top:2px;">
                     <span style="color:var(--c-gold)">Construyendo Lv${currentLevel+1}</span>
                     <span id="hq-time-${def.id}">--:--</span>
                  </div>
                `;
              } else if (nextLevelData) {
                // Determine if we can afford it
                const canAfford = state.finances.credits >= nextLevelData.cost;
                const canStart = !c.active && canAfford;
                const durationMins = Math.round(nextLevelData.durationMs / 60000);
                let durationStr = durationMins > 60 ? `${Math.round(durationMins/60)}h` : `${durationMins}m`;
                if(state.team.engineSupplier === 'Vulcan') durationStr += ' (-15%)';
                
                contentHtml = `
                  <button class="btn btn-secondary btn-sm ${!canStart ? 'disabled' : ''}" 
                          onclick="GL_SCREENS.upgradeBuilding('${def.id}', ${nextLevelData.cost}, ${nextLevelData.durationMs}, ${currentLevel+1})" 
                          style="font-size:0.7rem;padding:6px;width:100%;margin-top:var(--s-2)">
                    Nv${currentLevel+1} · ${GL_UI.fmtCR(nextLevelData.cost)} CR · ⏱️ ${durationStr}
                  </button>
                `;
              } else {
                contentHtml = `<span class="badge badge-gold" style="width:100%;display:block;text-align:center;margin-top:var(--s-2)">NIVEL MÁXIMO</span>`;
              }

              return `<div class="building-tile ${isUpgrading?'upgrading':''}">
                <div class="building-icon">${def.icon}</div>
                <div class="building-name">${def.name}</div>
                <div class="building-level">
                  ${Array.from({length:def.maxLevel}).map((_,i) => `<div class="building-level-dot ${i<currentLevel?'filled':''}"></div>`).join('')}
                </div>
                ${contentHtml}
              </div>`;
            }).join('')}
          </div>
        </div>
        
        <div class="flex flex-col gap-4">
          <div class="card">
            <div class="section-eyebrow">Motor Empire Buffs</div>
            <div class="section-title mb-4" style="font-size:1.1rem">Capacidades del Cuartel</div>
            ${GL_DATA.FACILITIES.map(def => {
              const currentLevel = hqLevels[def.id] || 0;
              const curData = def.levels[currentLevel - 1];
              return curData ? `<div style="display:flex;align-items:center;gap:var(--s-3);margin-bottom:var(--s-3);">
                <span style="font-size:1.5rem">${def.icon}</span>
                <div><div style="font-size:0.85rem;font-weight:700">${def.name} · Lv${currentLevel}</div>
                <div style="font-size:0.75rem;color:var(--t-secondary)">${curData.effect}</div></div></div>` : '';
            }).join('')}
          </div>
          
          <div class="card">
            <div class="section-eyebrow">Gestión de Construcción</div>
            <div class="section-title mb-2">Pase Mensual VIP</div>
            <p style="font-size:0.8rem;color:var(--t-secondary);margin-bottom:var(--s-3)">Acelera la construcción instantáneamente usando Tokens, o despacha 2 mejoras simultáneas con el Pase VIP.</p>
            ${c.active ? `
              <button class="btn btn-gold w-full" onclick="GL_SCREENS.showBoostModal()">
                ⚡ Acelerar ${GL_DATA.FACILITIES.find(f=>f.id===c.buildingId)?.name} (5 Tokens)
              </button>
            ` : `
              <button class="btn btn-secondary w-full disabled">Sin construcciones activas</button>
            `}
          </div>
        </div>
      </div>`;
      
      // Start live timer loop if construction is active
      if (c.active && !this._hqTimer) {
         this._hqTimer = setInterval(() => this.updateHqTimers(), 1000);
      } else if (!c.active && this._hqTimer) {
         clearInterval(this._hqTimer);
         this._hqTimer = null;
      }
      this.updateHqTimers(); // manual initial call
  },
  
  updateHqTimers() {
     const c = GL_STATE.getConstruction();
     if (!c || !c.active) return;
     const now = Date.now();
     const remainingMs = (c.startTime + c.durationMs) - now;
     
     const fillEl = document.getElementById(`hq-fill-${c.buildingId}`);
     const timeEl = document.getElementById(`hq-time-${c.buildingId}`);
     
     if (remainingMs <= 0) {
        // Complete! Engine will catch it next tick
        if(fillEl) fillEl.style.width = '100%';
        if(timeEl) timeEl.textContent = 'Completado';
        return;
     }
     
     if (fillEl) {
        let pct = ((now - c.startTime) / c.durationMs) * 100;
        fillEl.style.width = Math.min(100, pct) + '%';
     }
     
     if (timeEl) {
        const h = Math.floor(remainingMs / 3600000);
        const m = Math.floor((remainingMs % 3600000) / 60000);
        const s = Math.floor((remainingMs % 60000) / 1000);
        timeEl.textContent = `${h>0?h+'h ':''}${m}m ${s}s`;
     }
  },

  upgradeBuilding(id, cost, durationMs, targetLevel) {
    const result = GL_ENGINE.startHqUpgrade(id, cost, durationMs, targetLevel, false);
    if (result.ok) {
      GL_UI.toast(`🏗️ Construcción iniciada.`, 'success');
      this.renderGarage();
      GL_DASHBOARD.refresh();
    } else {
      GL_UI.toast(result.msg, 'warning');
    }
  },

  showBoostModal() {
    GL_UI.confirm('Acelerar Construcción', '¿Usar 5 Tokens para acortar el tiempo restante de construcción al 30% del original?', 'Gastar 5 Tokens ⚡', 'Cancelar').then(ok => {
      if (!ok) return;
      if (!GL_STATE.spendTokens(5)) { GL_UI.toast('¡Tokens insuficientes!', 'error'); return; }
      const c = GL_STATE.getConstruction();
      if(c && c.active) {
         const remaining = (c.startTime + c.durationMs) - Date.now();
         if (remaining > 0) {
            c.durationMs = c.durationMs - Math.floor(remaining * 0.7); // cut 70% of remaining time
            GL_STATE.saveState();
            GL_UI.toast('⚡ ¡Construcción acelerada!', 'success');
            this.renderGarage();
         }
      }
    });
  },

  // ===== PILOTS SCREEN =====
  renderPilots() {
    const state = GL_STATE.getState();
    const pilots = state.pilots || [];
    const el = document.getElementById('screen-pilots');
    if (!el) return;
    el.innerHTML = `
      <div class="screen-header">
        <div class="screen-title-group">
          <div class="screen-eyebrow">${__('pilots_eyebrow')}</div>
          <div class="screen-title">${__('pilots_title')}</div>
          <div class="screen-subtitle">${__('pilots_subtitle')}</div>
        </div>
        <div class="screen-actions">
          <button class="btn btn-secondary" onclick="GL_APP.navigateTo('market')">${__('pilots_transfer_market')}</button>
        </div>
      </div>
      <div class="pilot-roster-grid">
        ${pilots.map(p => this.fullPilotCard(p, state)).join('')}
        ${pilots.length < 3 ? `<div class="card" style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:280px;text-align:center;border-style:dashed;cursor:pointer" onclick="GL_APP.navigateTo('market')">
          <div style="font-size:2.5rem;margin-bottom:var(--s-3)">➕</div>
          <div style="font-weight:600">${__('pilots_sign_new')}</div>
          <div style="font-size:0.78rem;color:var(--t-secondary);margin-top:var(--s-2)">${__('pilots_find_talent')}</div>
        </div>` : ''}
      </div>`;
  },

  fullPilotCard(p, state) {
    const overall = GL_ENGINE.pilotScore(p);
    const bgColor = state.team.colors.primary;
    const now = new Date();
    const lastDate = p.lastTrained ? new Date(p.lastTrained) : new Date(0);
    const canTrain = lastDate.toDateString() !== now.toDateString();

    return `
      <div class="pilot-full-card">
        <div class="pilot-full-header" style="background:linear-gradient(135deg,${bgColor}22,var(--c-surface-2))">
          <div class="pilot-full-avatar" style="background:${bgColor}33;font-size:2.5rem">${p.emoji||'🧑'}</div>
          <div>
            <div class="pilot-full-name">${p.name}</div>
            <div class="pilot-full-meta">${p.nat} · ${__('age')} ${p.age}</div>
            <span class="badge badge-orange">${__('overall')}: ${overall}</span>
          </div>
          <div class="pilot-full-number">${p.number||'77'}</div>
        </div>
        <div class="pilot-full-body">
          <div class="section-eyebrow" style="margin-bottom:var(--s-3)">${__('pilots_attrs')}</div>
          <div class="pilot-full-attrs">
            ${GL_UI.statBar(__('pilots_qualifying'), p.attrs.pace)}
            ${GL_UI.statBar(__('pilots_race'), p.attrs.racePace)}
            ${GL_UI.statBar(__('pilots_consistency'), p.attrs.consistency)}
            ${GL_UI.statBar(__('pilots_rain'), p.attrs.rain, 99, 'blue')}
            ${GL_UI.statBar(__('pilots_tyre'), p.attrs.tyre, 99, 'green')}
            ${GL_UI.statBar(__('pilots_mental'), p.attrs.mental, 99, 'purple')}
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:var(--s-4)">
            <div><div style="font-size:0.72rem;color:var(--t-tertiary)">${__('pilots_salary')}</div><div style="font-family:var(--font-display);font-weight:800;color:var(--c-gold)">${GL_UI.fmtCR(p.salary)}${__('per_week')}</div></div>
            <div style="text-align:center"><div style="font-size:0.72rem;color:var(--t-tertiary)">${__('pilots_contract')}</div><div style="font-family:var(--font-display);font-weight:800">${p.contractWeeks||20}${__('market_weeks').substring(0,2)}</div></div>
            <div style="text-align:center"><div style="font-size:0.72rem;color:var(--t-tertiary)">${__('pilots_potential')}</div><div style="font-family:var(--font-display);font-weight:800;color:var(--c-purple)">${p.potential}%</div></div>
          </div>
          <div style="margin-top:var(--s-4)">${GL_UI.progressBar(p.morale||75,100,'green')}</div>
          <div style="display:flex;justify-content:space-between;font-size:0.72rem;color:var(--t-tertiary);margin-top:4px"><span>${__('pilots_morale')}</span><span>${p.morale||75}/100</span></div>
          <button class="btn w-full mt-4 ${canTrain ? 'btn-secondary' : ''}" onclick="GL_ENGINE.trainPilot('${p.id}')" ${canTrain ? '' : 'disabled'}>
            ${canTrain ? '🏋️ ' + (__('pilots_train')||'Train') : '⏳ ' + (__('pilots_trained_today')||'Trained')}
          </button>
        </div>
      </div>`;
  },

  // ===== STAFF SCREEN =====
  renderStaff() {
    const state = GL_STATE.getState();
    const staff = state.staff || [];
    const el = document.getElementById('screen-staff');
    if (!el) return;
    el.innerHTML = `
      <div class="screen-header">
        <div class="screen-title-group">
          <div class="screen-eyebrow">${__('staff_eyebrow')}</div>
          <div class="screen-title">${__('staff_title')}</div>
          <div class="screen-subtitle">${__('staff_subtitle')}</div>
        </div>
      </div>
      <div class="grid-2 mb-6">
        ${staff.map(s => `
          <div class="card card-hover flex gap-4">
            <div class="icon-circle ${s.rarity==='rare'?'gold':s.rarity==='uncommon'?'blue':'green'}" style="width:52px;height:52px;font-size:1.5rem">${s.emoji||'👤'}</div>
            <div style="flex:1">
              <div style="font-family:var(--font-display);font-weight:700;font-size:0.95rem">${s.name}</div>
              <div style="font-size:0.75rem;color:var(--t-secondary);margin-bottom:var(--s-2)">${s.role} · ${s.nat}</div>
              <span class="badge badge-${s.rarity==='rare'?'gold':s.rarity==='uncommon'?'blue':'gray'}">${s.rarity||'common'}</span>
              <div style="margin-top:var(--s-3);font-size:0.75rem;color:var(--t-tertiary)">${s.bio||''}</div>
            </div>
            <div style="text-align:right;flex-shrink:0">
              <div style="font-family:var(--font-display);font-weight:800;color:var(--c-gold)">${GL_UI.fmtCR(s.salary)}</div>
              <div style="font-size:0.7rem;color:var(--t-tertiary)">${__('staff_week')}</div>
            </div>
          </div>`).join('')}
        <div class="card" style="display:flex;align-items:center;justify-content:center;text-align:center;border-style:dashed;min-height:100px;cursor:pointer" onclick="GL_SCREENS.showHireStaff()">
          <div><div style="font-size:1.5rem">➕</div><div style="font-weight:600;margin-top:var(--s-2)">${__('staff_hire')}</div></div>
        </div>
      </div>`;
  },

  showHireStaff() {
    const available = GL_DATA.STAFF_POOL.filter(s => !GL_STATE.getState().staff.find(st=>st.id===s.id));
    GL_UI.openModal({ title: 'Hire Staff', size: 'lg', content: `
      <div style="display:flex;flex-direction:column;gap:var(--s-3)">
        ${available.map(s => `
          <div class="market-pilot-row" onclick="GL_SCREENS.hireStaff('${s.id}', this.closest('.modal-overlay'))">
            <div class="market-pilot-avatar" style="font-size:1.5rem">${s.emoji||'👤'}</div>
            <div class="market-pilot-info">
              <div class="market-pilot-name">${s.name}</div>
              <div class="market-pilot-meta">${s.role} · ${s.nat}</div>
              <div style="font-size:0.75rem;color:var(--t-tertiary);margin-top:4px">${s.bio||''}</div>
            </div>
            <div class="market-pilot-salary"><div class="market-pilot-salary-val">${GL_UI.fmtCR(s.salary)}/wk</div>
              <span class="badge badge-${s.rarity==='rare'?'gold':s.rarity==='uncommon'?'blue':'gray'}">${s.rarity}</span></div>
          </div>`).join('')}
      </div>` });
  },

  hireStaff(id, overlay) {
    const s = GL_DATA.STAFF_POOL.find(s=>s.id===id);
    if (!s) return;
    GL_STATE.getState().staff.push(GL_STATE.deepClone(s));
    GL_STATE.addLog(`👥 ${s.name} joined as ${s.role}.`, 'good');
    GL_STATE.saveState();
    overlay?.remove();
    GL_UI.toast(`${s.name} hired!`, 'success');
    this.renderStaff();
  },

  // ===== CAR DEV SCREEN =====
  renderCar() {
    const state = GL_STATE.getState();
    const car = state.car;
    const el = document.getElementById('screen-car');
    if (!el) return;
    const total = Math.round(Object.values(car.components).reduce((s,c)=>s+c.score,0)/Object.keys(car.components).length);
    el.innerHTML = `
      <div class="screen-header">
        <div class="screen-title-group">
          <div class="screen-eyebrow">${__('car_eyebrow')}</div>
          <div class="screen-title">${__('car_title')}</div>
          <div class="screen-subtitle">${__('car_subtitle')}</div>
        </div>
        <div class="screen-actions"><button class="btn btn-primary" onclick="GL_SCREENS.showRnD()">${__('car_start_rnd')}</button></div>
      </div>
      <div class="car-layout">
        <div>
          <div class="car-visual card" style="margin-bottom:var(--s-5)">
            <div class="car-display-text">${state.team.name||'GL'}</div>
            <div>
              <div class="car-name-display" style="color:${state.team.colors.primary}">${car.name}</div>
              <div style="text-align:center;margin-top:var(--s-2)">
                <span class="badge badge-blue">${__('car_overall')}: ${total}/99</span>
              </div>
              ${GL_UI.progressBar(total, 99, 'blue')}
            </div>
          </div>
          <div class="car-stats-grid">
            ${Object.entries(car.components).map(([key, c]) => {
              const labels = { engine:__('car_engine'),chassis:__('car_chassis'),aero:__('car_aero'),tyreManage:__('car_tyre_manage'),brakes:__('car_brakes'),gearbox:__('car_gearbox'),reliability:__('car_reliability'),efficiency:__('car_efficiency') };
              const icons  = { engine:'⚙️',chassis:'🔩',aero:'💨',tyreManage:'🏎️',brakes:'🛑',gearbox:'⚡',reliability:'🛡️',efficiency:'⛽' };
              const colors = { engine:'red',chassis:'blue',aero:'blue',tyreManage:'green',brakes:'red',gearbox:'orange',reliability:'green',efficiency:'gold' };
              return `<div class="car-stat-block">
                <div class="car-stat-name">${icons[key]||''} ${labels[key]||key}</div>
                <div class="car-stat-val">${c.score}<span style="font-size:0.75rem;color:var(--t-tertiary)">/99</span></div>
                <div class="car-stat-bar">${GL_UI.progressBar(c.score,99,colors[key]||'')}</div>
                <div style="font-size:0.7rem;color:var(--t-tertiary);margin-top:4px">Lv ${c.level}</div>
              </div>`;
            }).join('')}
          </div>
        </div>
        <div class="flex flex-col gap-4">
          <div class="card">
            <div class="section-eyebrow">${__('car_quick_upgrades')}</div>
            <div class="section-title mb-4" style="font-size:1rem">${__('car_spend_credits')}</div>
            ${Object.entries(car.components).map(([key, c]) => {
              const labels = { engine:__('car_engine'),chassis:__('car_chassis'),aero:__('car_aero'),tyreManage:__('car_tyre_manage'),brakes:__('car_brakes'),gearbox:__('car_gearbox'),reliability:__('car_reliability'),efficiency:__('car_efficiency') };
              const cost = 5000 + c.level * 3000;
              return `<div class="finance-row">
                <span class="finance-row-label">${labels[key]}</span>
                <button class="btn btn-ghost btn-sm" onclick="GL_SCREENS.upgradeCarComp('${key}')">+3 · ${GL_UI.fmtCR(cost)} CR</button>
              </div>`;
            }).join('')}
          </div>
          <div class="card">
            <div class="section-eyebrow">${__('car_rnd_points')}</div>
            <div class="stat-card-value" style="font-size:1.4rem">${car.rnd.points || 0}</div>
            <div style="font-size:0.78rem;color:var(--t-secondary);margin-top:4px">${__('car_rnd_desc')}</div>
          </div>
        </div>
      </div>`;
  },

  upgradeCarComp(key) {
    const car = GL_STATE.getCar();
    const cost = 5000 + car.components[key].level * 3000;
    if (!GL_STATE.spendCredits(cost)) { GL_UI.toast('Not enough credits', 'warning'); return; }
    car.components[key].score = Math.min(99, car.components[key].score + 3);
    car.components[key].level++;
    GL_STATE.addLog(`⚙️ ${key} upgraded +3 points`, 'good');
    GL_STATE.saveState();
    GL_UI.toast(`${key} improved!`, 'success');
    this.renderCar();
    GL_DASHBOARD.refresh();
  },

  showRnD() { GL_UI.toast(__('car_rnd_unlock'), 'info'); },

  // ===== CALENDAR SCREEN =====
  renderCalendar() {
    const state = GL_STATE.getState();
    const cal = state.season.calendar || [];
    const el = document.getElementById('screen-calendar');
    if (!el) return;
    const pts = GL_STATE.getMyStanding().points || 0;
    el.innerHTML = `
      <div class="screen-header">
        <div class="screen-title-group">
          <div class="screen-eyebrow">${__('calendar_eyebrow')} ${state.season.year}</div>
          <div class="screen-title">${__('calendar_title')}</div>
          <div class="screen-subtitle">${__('division')} ${state.season.division} · ${cal.length} ${__('calendar_round').toLowerCase()} · ${__('topbar_week')} ${state.season.week}</div>
        </div>
        <div class="screen-actions">
          <span class="badge badge-gold" style="font-size:0.85rem;padding:8px 16px">🏆 ${pts} ${__('points')}</span>
        </div>
      </div>
      <div class="calendar-timeline">
        ${cal.map(r => {
          const isDone = r.status === 'done';
          const isNext = r.status === 'next';
          const res = r.result;
          return `<div class="calendar-race-item ${isDone?'done':''} ${isNext?'next':''}">
            <div class="calendar-round">
              <div class="calendar-round-label">${__('calendar_round')}</div>
              <div class="calendar-round-num">${r.round}</div>
            </div>
            <div class="calendar-circuit-dot"></div>
            <div class="calendar-info">
              <div class="calendar-race-name">${r.circuit?.name||'Circuit'}</div>
              <div class="calendar-race-meta">${r.circuit?.country||''} · ${r.circuit?.laps||0} ${__('laps')} · ${r.circuit?.length||''}</div>
            </div>
            <div class="calendar-weather">${r.weather==='wet'?'🌧️':'☀️'}</div>
            <div class="calendar-result">
              ${isDone && res ? `<div class="calendar-result-pos" style="color:${res.position<=3?'var(--c-gold)':'var(--t-primary)'}">P${res.position}</div>
                <div class="calendar-result-pts">+${res.points} ${__('points')}</div>` :
              isNext ? `<button class="btn btn-primary btn-sm" onclick="GL_APP.navigateTo('prerace')">${__('calendar_race_arrow')}</button>` :
              `<div style="font-size:0.78rem;color:var(--t-tertiary)">${__('calendar_upcoming')}</div>`}
            </div>
          </div>`;
        }).join('')}
      </div>`;
  },

  // ===== STANDINGS SCREEN =====
  renderStandings() {
    const state = GL_STATE.getState();
    const standings = state.standings || [];
    const el = document.getElementById('screen-standings');
    if (!el) return;
    const divInfo = GL_DATA.DIVISIONS.find(d=>d.div===state.season.division);
    el.innerHTML = `
      <div class="screen-header">
        <div class="screen-title-group">
          <div class="screen-eyebrow">${__('standings_eyebrow')}</div>
          <div class="screen-title">${__('standings_title')} ${state.season.division}</div>
          <div class="screen-subtitle">${divInfo?.name || ''} · ${divInfo?.promotions || 0} ${__('standings_promotion_spots')}</div>
        </div>
      </div>
      <div class="card p-0">
        <table class="standings-table-full">
          <thead><tr>
            <th>${__('standings_pos')}</th><th>${__('standings_team')}</th><th>${__('standings_points')}</th><th>${__('standings_wins')}</th><th>${__('standings_best')}</th><th>${__('standings_status')}</th>
          </tr></thead>
          <tbody>
            ${standings.map((s, i) => {
              const isPromo = divInfo && i < divInfo.promotions;
              const isRelegate = divInfo && i >= standings.length - divInfo.relegations && state.season.division < 8;
              return `<tr class="${s.id==='player'?'my-row':''} ${isPromo?'promoted':''} ${isRelegate?'relegated':''}">
                <td><div class="pos-badge pos-${i<3?i+1:'n'}">${i+1}</div></td>
                <td style="display:flex;align-items:center;gap:var(--s-2);min-width:200px">
                  <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${s.color||'#888'};flex-shrink:0"></span>
                  ${s.flag||''} <strong>${s.name}</strong>${s.id==='player'?' <span style="font-size:0.8rem;color:var(--c-accent)">'+__('standings_you')+'</span>':''}
                </td>
                <td><strong style="color:var(--c-gold)">${s.points}</strong></td>
                <td>${s.wins || 0}</td>
                <td>${s.bestResult ? 'P'+s.bestResult : '–'}</td>
                <td>${isPromo ? `<span class="badge badge-green">${__('standings_promote')}</span>` : isRelegate ? `<span class="badge badge-red">${__('standings_relegate')}</span>` : '–'}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  },

  // ===== FINANCES SCREEN =====
  renderFinances() {
    const state = GL_STATE.getState();
    const fi = state.finances;
    const el = document.getElementById('screen-finances');
    if (!el) return;
    const history = fi.history || [];
    const sponsorIncome = (state.sponsors||[]).reduce((s,sp)=>s+(sp.income||0),0);
    const pilotCost = (state.pilots||[]).reduce((s,p)=>s+(p.salary||0),0);
    const staffCost = (state.staff||[]).reduce((s,st)=>s+(st.salary||0),0);
    const facCost = (state.facilities||[]).reduce((s,f)=>s+(f.level>0?f.level*800:0),0);
    const income = sponsorIncome + Math.floor((state.team.fans||0)*0.05);
    const expenses = pilotCost + staffCost + facCost;
    el.innerHTML = `
      <div class="screen-header">
        <div class="screen-title-group">
          <div class="screen-eyebrow">${__('finances_eyebrow')}</div>
          <div class="screen-title">${__('finances_title')}</div>
          <div class="screen-subtitle">${__('finances_subtitle')}</div>
        </div>
        <div class="screen-actions"><span class="badge badge-gold" style="font-size:1rem;padding:10px 20px">💰 ${GL_UI.fmtCR(fi.credits||0)} CR</span></div>
      </div>
      <div class="grid-2 mb-6">
        <div class="card">
          <div class="section-eyebrow">${__('finances_income')}</div>
          <div style="margin-top:var(--s-4)">
            <div class="finance-chart-bar-h"><span class="finance-chart-label">${__('finances_sponsors')}</span><div class="finance-chart-bar-wrap"><div class="finance-chart-bar-fill" style="width:${Math.min(100,(sponsorIncome/Math.max(income,1)*100).toFixed(0))}%;background:var(--c-green)"></div></div><span class="finance-chart-val positive">+${GL_UI.fmtCR(sponsorIncome)}</span></div>
            <div class="finance-chart-bar-h"><span class="finance-chart-label">${__('finances_fan_revenue')}</span><div class="finance-chart-bar-wrap"><div class="finance-chart-bar-fill" style="width:${Math.min(100,((income-sponsorIncome)/Math.max(income,1)*100).toFixed(0))}%;background:var(--c-blue)"></div></div><span class="finance-chart-val positive">+${GL_UI.fmtCR(income-sponsorIncome)}</span></div>
          </div>
          <div class="divider"></div>
          <div style="display:flex;justify-content:space-between"><span style="font-weight:700">${__('finances_total_income')}</span><span style="font-family:var(--font-display);font-weight:800;color:var(--c-green)">+${GL_UI.fmtCR(income)}${__('per_week')}</span></div>
        </div>
        <div class="card">
          <div class="section-eyebrow">${__('finances_expenses')}</div>
          <div style="margin-top:var(--s-4)">
            <div class="finance-chart-bar-h"><span class="finance-chart-label">${__('finances_pilots')}</span><div class="finance-chart-bar-wrap"><div class="finance-chart-bar-fill" style="width:${Math.min(100,(pilotCost/Math.max(expenses,1)*100).toFixed(0))}%;background:var(--c-red)"></div></div><span class="finance-chart-val negative">-${GL_UI.fmtCR(pilotCost)}</span></div>
            <div class="finance-chart-bar-h"><span class="finance-chart-label">${__('finances_staff')}</span><div class="finance-chart-bar-wrap"><div class="finance-chart-bar-fill" style="width:${Math.min(100,(staffCost/Math.max(expenses,1)*100).toFixed(0))}%;background:var(--c-orange)"></div></div><span class="finance-chart-val negative">-${GL_UI.fmtCR(staffCost)}</span></div>
            <div class="finance-chart-bar-h"><span class="finance-chart-label">${__('finances_facilities')}</span><div class="finance-chart-bar-wrap"><div class="finance-chart-bar-fill" style="width:${Math.min(100,(facCost/Math.max(expenses,1)*100).toFixed(0))}%;background:var(--c-gold)"></div></div><span class="finance-chart-val negative">-${GL_UI.fmtCR(facCost)}</span></div>
          </div>
          <div class="divider"></div>
          <div style="display:flex;justify-content:space-between"><span style="font-weight:700">${__('finances_total_expenses')}</span><span style="font-family:var(--font-display);font-weight:800;color:var(--c-red)">-${GL_UI.fmtCR(expenses)}${__('per_week')}</span></div>
        </div>
      </div>
      <div class="card">
        <div class="section-eyebrow">${__('finances_history')}</div>
        ${history.length ? `
          <div style="display:flex;align-items:flex-end;gap:4px;height:80px;margin-top:var(--s-4)">
            ${history.slice(-12).map(h => {
              const maxAbs = Math.max(...history.map(x=>Math.abs(x.net)));
              const pct = maxAbs ? Math.abs(h.net)/maxAbs*100 : 50;
              return `<div title="${__('topbar_week')} ${h.week}: ${GL_UI.fmtSign(h.net)}" style="flex:1;background:${h.net>=0?'var(--c-green)':'var(--c-red)'};opacity:0.7;border-radius:3px 3px 0 0;height:${Math.max(6,pct)}%;min-height:4px"></div>`;
            }).join('')}
          </div>
          <div style="display:flex;justify-content:space-between;font-size:0.7rem;color:var(--t-tertiary);margin-top:4px"><span>${__('finances_weeks_ago')}</span><span>${__('finances_latest')}</span></div>` : `<p style="color:var(--t-tertiary);font-size:0.82rem;margin-top:var(--s-4)">${__('finances_no_history')}</p>`}
      </div>`;
  },

  // ===== MARKET SCREEN =====
  renderMarket() {
    const state = GL_STATE.getState();
    const myIds = state.pilots.map(p=>p.id);
    const available = GL_DATA.PILOT_POOL.filter(p => !myIds.includes(p.id));
    const el = document.getElementById('screen-market');
    if (!el) return;
    el.innerHTML = `
      <div class="screen-header">
        <div class="screen-title-group">
          <div class="screen-eyebrow">${__('market_eyebrow')}</div>
          <div class="screen-title">${__('market_title')}</div>
          <div class="screen-subtitle">${__('market_subtitle')}</div>
        </div>
      </div>
      <div class="tabs mb-6" style="max-width:400px">
        <button class="tab active" onclick="GL_SCREENS.marketTab('pilots',this)">${__('market_tab_pilots')}</button>
        <button class="tab" onclick="GL_SCREENS.marketTab('sponsors',this)">${__('market_tab_sponsors')}</button>
      </div>
      <div id="market-content">
        ${this.marketPilotList(available)}
      </div>`;
  },

  marketTab(tab, btn) {
    document.querySelectorAll('.tabs .tab').forEach(t=>t.classList.remove('active'));
    btn.classList.add('active');
    const mc = document.getElementById('market-content');
    if (tab === 'pilots') {
      const myIds = GL_STATE.getState().pilots.map(p=>p.id);
      mc.innerHTML = this.marketPilotList(GL_DATA.PILOT_POOL.filter(p=>!myIds.includes(p.id)));
    } else {
      mc.innerHTML = this.marketSponsorList();
    }
  },

  marketPilotList(pilots) {
    if (!pilots.length) return `<p style="color:var(--t-secondary);font-size:0.9rem">${__('market_no_pilots')}</p>`;
    return pilots.map(p => {
      const overall = GL_ENGINE.pilotScore(p);
      return `<div class="market-pilot-row">
        <div class="market-pilot-avatar" style="font-size:2rem">${p.emoji||'🧑'}</div>
        <div class="market-pilot-info">
          <div class="market-pilot-name">${p.name} <span style="font-size:0.7rem;color:var(--t-secondary)">${p.nat} · ${__('age')} ${p.age}</span></div>
          <div class="market-pilot-meta">${__('overall')} ${overall} · ${__('pilots_potential')} ${p.potential}%</div>
          <div style="font-size:0.75rem;color:var(--t-tertiary);margin-top:4px;font-style:italic">"${p.bio||''}"</div>
        </div>
        <div class="market-pilot-attrs">
          <div class="market-attr"><div class="market-attr-val">${p.attrs.pace}</div><div class="market-attr-label">PACE</div></div>
          <div class="market-attr"><div class="market-attr-val">${p.attrs.racePace}</div><div class="market-attr-label">RACE</div></div>
          <div class="market-attr"><div class="market-attr-val">${p.attrs.rain}</div><div class="market-attr-label">RAIN</div></div>
        </div>
        <div class="market-pilot-salary">
          <div class="market-pilot-salary-val">${GL_UI.fmtCR(p.salary)}<span style="font-size:0.7rem">${__('per_week')}</span></div>
          <div class="market-pilot-salary-label">${__('market_salary')}</div>
          <button class="btn btn-primary btn-sm" style="margin-top:var(--s-2)" onclick="GL_SCREENS.signPilot('${p.id}')">${__('market_sign')}</button>
        </div>
      </div>`;
    }).join('');
  },

  marketSponsorList() {
    const myIds = GL_STATE.getState().sponsors.map(s=>s.id);
    const available = GL_DATA.SPONSOR_POOL.filter(s=>!myIds.includes(s.id));
    return available.map(sp => `
      <div class="market-pilot-row">
        <div class="market-pilot-avatar" style="font-size:2rem;background:${sp.bg||'#111'}">${sp.logo}</div>
        <div class="market-pilot-info">
          <div class="market-pilot-name" style="color:${sp.color}">${sp.name}</div>
          <div class="market-pilot-meta">${__('market_duration')}: ${sp.duration} ${__('market_weeks')} · ${__('market_req')}: ${sp.demand}</div>
        </div>
        <div class="market-pilot-salary">
          <div class="market-pilot-salary-val">+${GL_UI.fmtCR(sp.income)}<span style="font-size:0.7rem">${__('per_week')}</span></div>
          <div class="market-pilot-salary-label">${__('market_sponsor_income')}</div>
          <button class="btn btn-primary btn-sm" style="margin-top:var(--s-2)" onclick="GL_SCREENS.signSponsor('${sp.id}')">${__('market_sign_deal')}</button>
        </div>
      </div>`).join('');
  },

  signPilot(id) {
    const state = GL_STATE.getState();
    if (state.pilots.length >= 3) { GL_UI.toast(__('market_max_pilots'), 'warning'); return; }
    const p = GL_DATA.PILOT_POOL.find(x=>x.id===id);
    if (!p) return;
    state.pilots.push({ ...GL_STATE.deepClone(p), morale:80, contractWeeks:20, number:Math.floor(Math.random()*89)+11 });
    GL_STATE.addLog(`🧑‍✈️ ${p.name} signed!`, 'good');
    GL_STATE.saveState();
    GL_UI.toast(`${p.name} signed!`, 'success');
    this.renderMarket();
    GL_DASHBOARD.refresh();
  },

  signSponsor(id) {
    const sp = GL_DATA.SPONSOR_POOL.find(x=>x.id===id);
    if (!sp) return;
    GL_STATE.getState().sponsors.push({ ...GL_STATE.deepClone(sp), weeksLeft: sp.duration });
    GL_STATE.addLog(`💼 ${sp.name} sponsor deal signed!`, 'good');
    GL_STATE.saveState();
    GL_UI.toast(`${sp.name} deal signed!`, 'success');
    this.renderMarket();
    GL_DASHBOARD.refresh();
  },

  // ===== PRE-RACE SCREEN =====
  renderPreRace() {
    const state = GL_STATE.getState();
    const cal = state.season.calendar || [];
    const next = cal.find(r=>r.status==='next');
    const el = document.getElementById('screen-prerace');
    if (!el) return;
    if (!next) { el.innerHTML = `<div class="card"><p style="color:var(--t-secondary)">${__('prerace_no_race')}</p></div>`; return; }
    const c = next.circuit;
    el.innerHTML = `
      <div class="screen-header">
        <div class="screen-title-group">
          <div class="screen-eyebrow">${__('round')} ${next.round} · ${__('prerace_eyebrow')}</div>
          <div class="screen-title">${c.name}</div>
          <div class="screen-subtitle">${c.country} · ${c.laps} ${__('laps')} · ${c.length} · ${next.weather==='wet'?__('prerace_rain_expected'):__('prerace_dry2')}</div>
        </div>
        <div class="screen-actions">
          <button class="btn btn-primary btn-lg" onclick="GL_SCREENS.saveStrategy()">${window.__('prerace_save_strat') || 'Guardar Estrategia'}</button>
        </div>
      </div>
      <div class="prerace-grid">
        <div class="prerace-block">
          <div class="prerace-block-title">${__('prerace_strategy_preset')}</div>
          <div id="strategy-presets">
            ${[
              {id:'balanced',icon:'⚖️',name:__('prerace_balanced'),desc:__('prerace_balanced_desc')},
              {id:'aggressive',icon:'🔥',name:__('prerace_aggressive'),desc:__('prerace_aggressive_desc')},
              {id:'conservative',icon:'🛡️',name:__('prerace_conservative'),desc:__('prerace_conservative_desc')},
              {id:'tactical',icon:'🧠',name:__('prerace_tactical'),desc:__('prerace_tactical_desc')}
            ].map(s => `
              <div class="strategy-preset ${s.id==='balanced'?'selected':''}" data-strat="${s.id}" onclick="GL_SCREENS.selectStrategy('${s.id}', this)">
                <span class="strategy-preset-icon">${s.icon}</span>
                <div><div class="strategy-preset-name">${s.name}</div><div class="strategy-preset-desc">${s.desc}</div></div>
              </div>`).join('')}
          </div>
        </div>
        <div class="prerace-block">
          <div class="prerace-block-title">${__('prerace_tyre_strategy')}</div>
          <div class="tire-choice-row" id="tyre-choice">
            <div class="tire-btn soft selected" onclick="GL_SCREENS.selectTyre('soft',this)">🔴 Soft<br><span style="font-size:0.65rem;opacity:0.7">Fast, high wear</span></div>
            <div class="tire-btn medium" onclick="GL_SCREENS.selectTyre('medium',this)">🟡 Medium<br><span style="font-size:0.65rem;opacity:0.7">Balanced</span></div>
            <div class="tire-btn hard" onclick="GL_SCREENS.selectTyre('hard',this)">⚪ Hard<br><span style="font-size:0.65rem;opacity:0.7">Durable, slower</span></div>
          </div>
          <div class="divider"></div>
          <div class="prerace-block-title" style="margin-top:0">${__('prerace_params')}</div>
          ${this.sliderGroup('aggression',__('prerace_aggression'),__('prerace_left_conservative'),__('prerace_right_aggressive'),60)}
          ${this.sliderGroup('riskLevel',__('prerace_risk'),__('prerace_left_safe'),__('prerace_right_fullsend'),40)}
          ${this.sliderGroup('pitLap',__('prerace_pit_window'),__('prerace_left_early'),__('prerace_right_late'),50)}
        </div>
        <div class="prerace-block">
          <div class="prerace-block-title">${__('prerace_driver_assign')}</div>
          ${state.pilots.map(p => `
            <div class="morale-pill" style="margin-bottom:var(--s-3)">
              <div class="morale-avatar" style="font-size:1.2rem">${p.emoji||'🧑'}</div>
              <div class="morale-info"><div class="morale-name">${p.name}</div><div style="font-size:0.7rem;color:var(--t-secondary)">${__('overall')} ${GL_ENGINE.pilotScore(p)}</div></div>
              <button class="btn btn-secondary btn-sm" style="margin-left:auto">${__('prerace_primary_driver')}</button>
            </div>`).join('')}
        </div>
        <div class="prerace-block">
          <div class="prerace-block-title">${__('prerace_circuit_intel')}</div>
          ${GL_UI.statRow(__('prerace_layout_type'), c.layout, '🗺️')}
          ${GL_UI.statRow(__('prerace_total_laps'), c.laps, '🔄')}
          ${GL_UI.statRow(__('prerace_circuit_len'), c.length, '📏')}
          ${GL_UI.statRow(__('prerace_rain_prob'), `${100 - c.weather}%`, '🌧️')}
          ${GL_UI.statRow(__('prerace_weather'), next.weather === 'wet' ? '🌧️ '+__('prerace_wet_adv') : '☀️ '+__('prerace_dry_norm'), '⛅')}
          <div class="divider"></div>
          <div class="circuit-mini">${GL_UI.circuitSVG(c.layout)}</div>
        </div>
      </div>`;

    window._raceStrategy = { tyre:'soft', strategy:'balanced', aggression:60, riskLevel:40, pitLap:50 };
  },

  sliderGroup(id, label, leftLabel, rightLabel, val) {
    return `<div class="slider-group">
      <div class="slider-header">
        <span class="slider-name">${label}</span>
        <span class="slider-val" id="sv-${id}">${val}</span>
      </div>
      <div style="display:flex;align-items:center;gap:var(--s-2)">
        <span style="font-size:0.7rem;color:var(--t-tertiary)">${leftLabel}</span>
        <input type="range" min="0" max="100" value="${val}" oninput="document.getElementById('sv-${id}').textContent=this.value; if(window._raceStrategy) window._raceStrategy['${id}']=+this.value" style="flex:1">
        <span style="font-size:0.7rem;color:var(--t-tertiary)">${rightLabel}</span>
      </div>
    </div>`;
  },

  selectStrategy(id, el) {
    document.querySelectorAll('.strategy-preset').forEach(e=>e.classList.remove('selected'));
    el.classList.add('selected');
    if (window._raceStrategy) window._raceStrategy.strategy = id;
    if (id === 'aggressive') { window._raceStrategy.aggression = 80; window._raceStrategy.riskLevel = 70; }
    if (id === 'conservative') { window._raceStrategy.aggression = 30; window._raceStrategy.riskLevel = 20; }
  },

  selectTyre(t, el) {
    document.querySelectorAll('.tire-btn').forEach(e=>{ e.classList.remove('selected','soft','medium','hard'); });
    el.classList.add('selected', t);
    if (window._raceStrategy) window._raceStrategy.tyre = t;
  },

  saveStrategy() {
    const state = GL_STATE.getState();
    const nextIdx = (state.season.calendar || []).findIndex(r=>r.status==='next');
    if (nextIdx !== -1) {
      state.season.calendar[nextIdx].savedStrategy = window._raceStrategy || { tyre:'medium', strategy:'balanced', aggression:60, riskLevel:40, pitLap:50 };
      GL_STATE.saveState();
      GL_UI.toast(window.__('prerace_strat_saved') || 'Estrategia guardada con éxito', 'good');
      GL_APP.navigateTo('dashboard');
    }
  },

  // ===== RACE SCREEN =====
  renderRace() {
    const state = GL_STATE.getState();
    const cal = state.season.calendar || [];
    const next = cal.find(r=>r.status==='next');
    const el = document.getElementById('screen-race');
    if (!el) return;
    const circuit = next?.circuit || GL_DATA.CIRCUITS[0];
    const weather = next?.weather || 'dry';
    const strategy = window._raceStrategy || { tyre:'medium', aggression:50, riskLevel:40, pitLap:50 };

    el.innerHTML = `
      <div class="screen-header">
        <div class="screen-title-group">
          <div class="screen-eyebrow">${__('race_eyebrow')} ${next?.round||1}</div>
          <div class="screen-title">${circuit.name}</div>
          <div class="screen-subtitle">${weather==='wet'?'🌧️':'☀️'} ${weather} ${__('race_conditions')}</div>
        </div>
        <div class="screen-actions">
          <button class="btn btn-primary" id="race-sim-btn" onclick="GL_SCREENS.runSimulation()">${__('race_sim_btn')}</button>
        </div>
      </div>
      <div class="race-layout">
        <div class="race-track-view">
          <div class="race-track-bg"></div>
          <div class="race-status-bar" id="race-status-bar">
            <span class="race-lap-counter" id="race-lap">🏁 ${__('race_ready')}</span>
            <span class="race-condition">${weather==='wet'?'🌧️':'☀️'} ${weather.charAt(0).toUpperCase()+weather.slice(1)} · ${circuit.laps} ${__('laps')}</span>
            <span style="margin-left:auto;font-size:0.8rem;color:var(--t-secondary)">${__('race_tyre')}: <strong>${(strategy.tyre||'M').charAt(0).toUpperCase()}</strong></span>
          </div>
          <div class="race-event-log" id="race-event-log">
            <div class="race-event" style="border-color:var(--c-border)">
              <span class="race-event-text">🏁 ${__('race_press_start')}</span>
            </div>
          </div>
        </div>
        <div class="flex flex-col gap-4">
          <div class="card">
            <div class="section-eyebrow">${__('race_grid_position')}</div>
            <div class="race-grid-list" id="race-grid-list">
              <div style="color:var(--t-tertiary);font-size:0.82rem;padding:var(--s-4) 0">${__('race_grid_appear')}</div>
            </div>
          </div>
          <div class="card">
            <div class="section-eyebrow">${__('race_strat_active')}</div>
            <div style="display:flex;flex-direction:column;gap:4px;margin-top:var(--s-3)">
              ${GL_UI.statRow(__('race_compound'), (strategy.tyre||'medium').charAt(0).toUpperCase()+(strategy.tyre||'medium').slice(1), '🏎️')}
              ${GL_UI.statRow(__('prerace_aggression'), (strategy.aggression||50)+'%', '🔥')}
              ${GL_UI.statRow(__('prerace_risk'), (strategy.riskLevel||40)+'%', '⚠️')}
              ${GL_UI.statRow(__('prerace_pit_window'), __('race_lap') + ' ~' + (Math.round((strategy.pitLap||50)/100*30)), '🔧')}
            </div>
          </div>
        </div>
      </div>`;
  },

  runSimulation() {
    const state = GL_STATE.getState();
    const cal = state.season.calendar || [];
    const nextIdx = cal.findIndex(r=>r.status==='next');
    const next = cal[nextIdx];
    const strategy = window._raceStrategy || { tyre:'medium', aggression:50, riskLevel:40, pitLap:50 };

    document.getElementById('race-sim-btn').disabled = true;
    document.getElementById('race-sim-btn').textContent = `⏳ ${__('race_racing')}`;

    const result = GL_ENGINE.simulateRace({
      weather: next?.weather || 'dry',
      circuits: next?.circuit || GL_DATA.CIRCUITS[0],
      round: next?.round || 1,
      strategy
    });

    window._lastRaceResult = result;

    // Show events progressively
    const log = document.getElementById('race-event-log');
    if (log) log.innerHTML = '';
    const lapEl = document.getElementById('race-lap');

    let i = 0;
    const evInterval = setInterval(() => {
      if (i >= result.events.length) {
        clearInterval(evInterval);
        setTimeout(() => {
          // Update standings and calendar
          GL_ENGINE.updateStandings(result);
          if (nextIdx >= 0 && cal[nextIdx]) {
            cal[nextIdx].status = 'done';
            cal[nextIdx].result = { position: result.position, points: result.points };
          }
          if (nextIdx + 1 < cal.length) cal[nextIdx + 1].status = 'next';
          state.season.raceIndex = nextIdx + 1;
          GL_STATE.addCredits(result.prizeMoney);
          GL_STATE.addLog(`🏁 Round ${next?.round}: P${result.position} · ${result.points} pts · +${GL_UI.fmtCR(result.prizeMoney)} CR`, 'good');

          // R&D points
          state.car.rnd.points = (state.car.rnd.points || 0) + 5 + Math.floor(Math.random() * 5);

          // Fan growth
          state.team.fans += 100 + result.points * 50;

          GL_STATE.saveState();
          GL_ENGINE.weeklyTick();

          setTimeout(() => GL_APP.navigateTo('postrace'), 1000);
        }, 800);
        return;
      }
      const ev = result.events[i];
      if (log) {
        const div = document.createElement('div');
        div.className = `race-event ${ev.type}`;
        div.innerHTML = `<span class="race-event-lap">${__('race_lap_short')} ${ev.lap}</span><span class="race-event-text">${ev.text}</span>`;
        log.appendChild(div);
        log.scrollTop = log.scrollHeight;
      }
      if (lapEl) lapEl.textContent = `🏁 ${__('race_lap')} ${ev.lap} / 30`;

      const gl = document.getElementById('race-grid-list');
      if (gl && result.finalGrid && i > result.events.length / 2) {
        gl.innerHTML = result.finalGrid.slice(0,8).map((car, idx) => `
          <div class="race-pos-row ${car.isPlayer?'my-car':''}">
            <span class="race-pos-num">${idx+1}</span>
            <span class="race-pos-name">${car.isPlayer ? `<strong>${car.name}</strong>` : car.name}</span>
            <span class="race-pos-tire">${car.tyre==='soft'?'🔴':car.tyre==='hard'?'⚪':'🟡'}</span>
            <span class="race-pos-gap">${idx === 0 ? __('race_leader') : '+' + (Math.random()*30+0.5).toFixed(1)+'s'}</span>
          </div>`).join('');
      }
      i++;
    }, 200);
  },

  // ===== POST-RACE SCREEN =====
  renderPostRace() {
    const result = window._lastRaceResult;
    const el = document.getElementById('screen-postrace');
    if (!el) return;
    if (!result) { el.innerHTML = `<div class="card"><p style="color:var(--t-secondary)">${__('postrace_no_result')}</p></div>`; return; }
    const posColor = result.position <= 1 ? 'var(--c-gold)' : result.position <= 3 ? '#cd7c32' : result.position <= 8 ? 'var(--c-green)' : 'var(--t-primary)';
    const state = GL_STATE.getState();
    el.innerHTML = `
      <div class="screen-header">
        <div class="screen-title-group">
          <div class="screen-eyebrow">${__('postrace_eyebrow')}</div>
          <div class="screen-title">${__('postrace_title')}</div>
          <div class="screen-subtitle">${result.circuit?.name || 'Last Race'} · ${result.weather === 'wet' ? '🌧️' : '☀️'}</div>
        </div>
        <div class="screen-actions">
          <button class="btn btn-secondary" onclick="GL_APP.navigateTo('dashboard')">← ${__('dashboard')}</button>
          <button class="btn btn-primary" onclick="GL_APP.navigateTo('prerace')">${__('postrace_next')} →</button>
        </div>
      </div>
      <div class="post-race-hero">
        <div class="post-race-position">
          <div class="post-race-pos-num" style="color:${posColor}">${result.isDNF ? 'DNF' : 'P'+result.position}</div>
          <div class="post-race-pos-label">${result.isDNF ? __('postrace_dnf') : result.position === 1 ? '🏆 '+__('postrace_winner') : result.position <= 3 ? '🥇 '+__('postrace_podium') : __('postrace_classified')}</div>
        </div>
        <div class="post-race-info">
          <div class="post-race-title">${result.isDNF ? __('postrace_mech_fail') : result.position === 1 ? __('postrace_victory') : result.position <= 3 ? __('postrace_podium_fin') : `P${result.position} ${__('postrace_finish')}`}</div>
          <div style="color:var(--t-secondary)">${result.circuit?.name} · ${__('prerace_weather')}: ${result.weather}</div>
          <div class="post-race-metrics">
            <div class="post-race-metric"><div class="post-race-metric-val" style="color:var(--c-gold)">${result.points}</div><div class="post-race-metric-label">${__('points')}</div></div>
            <div class="post-race-metric"><div class="post-race-metric-val" style="color:var(--c-green)">+${GL_UI.fmtCR(result.prizeMoney)}</div><div class="post-race-metric-label">${__('postrace_prize')}</div></div>
            <div class="post-race-metric"><div class="post-race-metric-val">${result.improvement < 0 ? '▲'+Math.abs(result.improvement) : result.improvement > 0 ? '▼'+result.improvement : '—'}</div><div class="post-race-metric-label">${__('postrace_vs_grid')}</div></div>
          </div>
        </div>
      </div>
      <div class="grid-2">
        <div class="card">
          <div class="section-eyebrow">${__('postrace_events')}</div>
          <div class="race-event-log" style="max-height:250px;overflow-y:auto">
            ${result.events.map(ev => `<div class="race-event ${ev.type}"><span class="race-event-lap">L${ev.lap}</span><span class="race-event-text">${ev.text}</span></div>`).join('')}
          </div>
        </div>
        <div class="card">
          <div class="section-eyebrow">${__('postrace_class')}</div>
          <div class="race-grid-list">
            ${result.finalGrid.slice(0,10).map((car, i) => `
              <div class="race-pos-row ${car.isPlayer?'my-car':''}">
                <span class="race-pos-num">${i+1}</span>
                <span class="race-pos-name">${car.isPlayer?'<strong style="color:var(--c-accent)">'+car.name+'</strong>':car.name}</span>
                <span style="font-size:0.78rem;color:var(--c-gold)">${GL_DATA.POINTS_TABLE[i]||0} pts</span>
              </div>`).join('')}
          </div>
        </div>
      </div>`;
  },

};

window.GL_SCREENS = SCREENS;
