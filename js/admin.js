// ===== ADMIN.JS – Admin panel for Garage Legends =====
'use strict';

const GL_ADMIN = {
  _db: null,
  _cachedPlayers: [],
  _systemMessageListener: null,

  // ---- Firestore shortcut ----
  db() {
    if (!this._db && window.GL_AUTH && GL_AUTH._db) this._db = GL_AUTH._db;
    return this._db;
  },

  isAdmin() {
    return !!(window.GL_AUTH && GL_AUTH.isAdmin());
  },

  // ==========================================
  //  DIVISION KEY HELPERS
  // ==========================================

  divKey(division, group) {
    return `${division}_${group}`;
  },

  parseDivKey(key) {
    const [d, g] = String(key).split('_');
    return { division: Number(d), group: Number(g) };
  },

  // ==========================================
  //  RENDER ADMIN PANEL
  // ==========================================

  renderAdminPanel() {
    if (!this.isAdmin()) return;
    const el = document.getElementById('screen-admin');
    if (!el) return;

    const divOptions = (window.GL_DATA && Array.isArray(GL_DATA.DIVISIONS))
      ? GL_DATA.DIVISIONS.slice().sort((a, b) => a.div - b.div)
      : [];

    el.innerHTML = `
      <div class="screen-header">
        <div class="screen-title-group">
          <div class="screen-eyebrow">${__('admin_eyebrow')}</div>
          <div class="screen-title">${__('admin_title')}</div>
        </div>
        <div class="screen-actions">
          <button class="btn btn-secondary" onclick="GL_ADMIN.openDataPanel()">📊 ${__('admin_data_panel')}</button>
          <button class="btn btn-secondary" onclick="GL_APP.navigateTo('dashboard')">← ${__('back') || 'Back'}</button>
        </div>
      </div>

      <!-- System Message -->
      <div class="card" style="margin-bottom:var(--s-4)">
        <div class="section-title" style="margin-bottom:12px">📢 ${__('admin_system_message')}</div>
        <div style="display:flex;gap:8px;align-items:flex-end">
          <textarea id="admin-sysmsg-input" rows="2" style="flex:1;background:var(--c-surface-2);color:var(--t-primary);border:1px solid var(--c-border);border-radius:var(--r-sm);padding:8px;font-size:0.82rem;resize:vertical;font-family:inherit" placeholder="${__('admin_sysmsg_placeholder')}"></textarea>
          <button class="btn btn-primary" onclick="GL_ADMIN.saveSystemMessage()" style="height:40px">${__('admin_save')}</button>
        </div>
        <div id="admin-sysmsg-status" style="font-size:0.72rem;color:var(--t-tertiary);margin-top:6px"></div>
      </div>

      <!-- Race Control -->
      <div class="card" style="margin-bottom:var(--s-4)">
        <div class="section-title" style="margin-bottom:4px">🏁 ${__('admin_race_control')}</div>
        <div style="font-size:0.75rem;color:var(--t-tertiary);margin-bottom:12px">Simula la próxima carrera pendiente en <strong>todas</strong> las divisiones y grupos activos simultáneamente.</div>
        <button class="btn btn-primary" onclick="GL_ADMIN.handleForceAllRaces()" style="background:var(--c-red,#e8292a)">🏁 Forzar carrera en todas las divisiones</button>
        <div style="display:flex;gap:8px;align-items:center;margin-top:10px">
          <input id="admin-race-round-filter" type="number" min="1" max="52" placeholder="Ronda (opcional)" style="width:160px;background:var(--c-surface-2);color:var(--t-primary);border:1px solid var(--c-border);border-radius:var(--r-sm);padding:6px 8px;font-size:0.82rem" />
          <button class="btn btn-secondary" onclick="GL_ADMIN.handleForceAllRaces(true)">🔁 Equiparar divisiones atrasadas</button>
        </div>
        <div style="font-size:0.7rem;color:var(--t-tertiary);margin-top:4px">Ingresá el número de ronda para correr <em>solo</em> las divisiones que tienen esa ronda pendiente.</div>
        <div id="admin-race-status" style="font-size:0.72rem;color:var(--t-tertiary);margin-top:8px"></div>
      </div>

      <!-- Player Management -->
      <div class="card" style="margin-bottom:var(--s-4)">
        <div class="section-title" style="margin-bottom:12px">👥 ${__('admin_player_mgmt')}</div>
        <div style="display:flex;gap:8px;margin-bottom:12px">
          <input id="admin-player-search" type="text" placeholder="${__('admin_search_placeholder')}" style="flex:1;background:var(--c-surface-2);color:var(--t-primary);border:1px solid var(--c-border);border-radius:var(--r-sm);padding:8px;font-size:0.82rem" />
          <button class="btn btn-secondary" onclick="GL_ADMIN.handleSearchPlayers()">🔍 ${__('admin_search')}</button>
          <button class="btn btn-ghost" onclick="GL_ADMIN.handleSearchPlayers('')" title="${__('admin_show_all')}">👁️</button>
        </div>
        <div id="admin-player-list" style="font-size:0.82rem;color:var(--t-secondary)">${__('admin_search_hint')}</div>
      </div>

      <!-- Division Tools -->
      <div class="card" style="margin-bottom:var(--s-4)">
        <div class="section-title" style="margin-bottom:12px">🔧 ${__('admin_div_tools')}</div>
        <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap">
          <div>
            <label style="font-size:0.72rem;color:var(--t-tertiary);display:block;margin-bottom:4px">${__('division')}</label>
            <select id="admin-tool-div" style="background:var(--c-surface-2);color:var(--t-primary);border:1px solid var(--c-border);border-radius:var(--r-sm);padding:6px 10px;font-size:0.82rem">
              ${divOptions.map(d => `<option value="${d.div}">${d.div} – ${d.name || ''}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:0.72rem;color:var(--t-tertiary);display:block;margin-bottom:4px">${__('admin_group')}</label>
            <select id="admin-tool-group" style="background:var(--c-surface-2);color:var(--t-primary);border:1px solid var(--c-border);border-radius:var(--r-sm);padding:6px 10px;font-size:0.82rem">
              ${this._buildGroupOptions(divOptions[0])}
            </select>
          </div>
          <button class="btn btn-secondary" onclick="GL_ADMIN.handleResetGroup()" style="border-color:var(--c-red,#e8292a);color:var(--c-red,#e8292a)">🔄 ${__('admin_reset_group')}</button>
        </div>
        <div id="admin-tool-status" style="font-size:0.72rem;color:var(--t-tertiary);margin-top:8px"></div>
      </div>

      <!-- Season Control -->
      <div class="card" style="margin-bottom:var(--s-4)">
        <div class="section-title" style="margin-bottom:4px">📅 Control de Temporada</div>
        <div style="font-size:0.75rem;color:var(--t-tertiary);margin-bottom:12px">Fuerza el cierre de la temporada actual y arranca la siguiente. Solo actúa sobre divisiones cuyas carreras ya han terminado; las que aún tienen carreras pendientes se omiten.</div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <button class="btn btn-primary" onclick="GL_ADMIN.handleForceSeasonAdvance()" style="background:var(--c-gold,#f4c430);color:#000;border-color:var(--c-gold,#f4c430)">🔁 Avanzar a siguiente temporada</button>
        </div>
        <div id="admin-season-status" style="font-size:0.72rem;color:var(--t-tertiary);margin-top:8px"></div>
      </div>
    `;

    // Wire up division select → group select sync (solo para Division Tools)
    this._wireGroupSync('admin-tool-div', 'admin-tool-group');

    // Load current system message
    this.loadSystemMessageIntoInput();
  },

  // ==========================================
  //  UI HELPERS
  // ==========================================

  _buildGroupOptions(divEntry) {
    const parallel = (divEntry && divEntry.parallelDivisions > 1) ? divEntry.parallelDivisions : 1;
    let html = '';
    for (let i = 1; i <= parallel; i++) {
      const label = (typeof Divisions !== 'undefined' && Divisions.groupLabel) ? Divisions.groupLabel(i) : i;
      html += `<option value="${i}">${label}</option>`;
    }
    return html;
  },

  _wireGroupSync(divSelectId, groupSelectId) {
    const divSel = document.getElementById(divSelectId);
    const groupSel = document.getElementById(groupSelectId);
    if (!divSel || !groupSel) return;
    divSel.addEventListener('change', () => {
      const divNum = Number(divSel.value);
      const divEntry = (window.GL_DATA && Array.isArray(GL_DATA.DIVISIONS))
        ? GL_DATA.DIVISIONS.find(d => d.div === divNum)
        : null;
      groupSel.innerHTML = this._buildGroupOptions(divEntry || { parallelDivisions: 1 });
    });
  },

  _playerRowHTML(p) {
    const divLabel = (typeof Divisions !== 'undefined' && Divisions.divisionLabel)
      ? Divisions.divisionLabel(p.division, p.divisionGroup)
      : p.division;
    const roleTag = p.role === 'admin'
      ? '<span style="background:var(--c-gold);color:#000;padding:1px 6px;border-radius:4px;font-size:0.68rem;font-weight:700">ADMIN</span>'
      : '';
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--c-surface-2);border-radius:var(--r-sm);margin-bottom:6px;flex-wrap:wrap">
        <div style="flex:1;min-width:120px">
          <div style="font-weight:700;color:var(--t-primary)">${p.teamName || '(no team)'} ${roleTag}</div>
          <div style="font-size:0.72rem;color:var(--t-tertiary)">${p.email} · UID: ${p.id.slice(0,8)}…</div>
        </div>
        <div style="font-size:0.78rem;color:var(--t-secondary);min-width:60px;text-align:center">
          ${__('division')} ${divLabel}
        </div>
        <div style="display:flex;gap:4px">
          <button class="btn btn-ghost btn-sm" onclick="GL_ADMIN.openMoveDialog('${p.id}','${(p.teamName||'').replace(/'/g,"\\'")}')" title="${__('admin_move')}">📦 ${__('admin_move')}</button>
          <button class="btn btn-ghost btn-sm" onclick="GL_ADMIN.openPointsDialog('${p.id}','${(p.teamName||'').replace(/'/g,"\\'")}')" title="${__('admin_adjust_pts')}">±🏆</button>
        </div>
      </div>`;
  },

  // ==========================================
  //  SYSTEM MESSAGE
  // ==========================================

  async loadSystemMessageIntoInput() {
    const input = document.getElementById('admin-sysmsg-input');
    const status = document.getElementById('admin-sysmsg-status');
    if (!input) return;
    try {
      const msg = await this.loadSystemMessage();
      if (msg && msg.text) {
        input.value = msg.text;
        if (status) status.textContent = __('admin_sysmsg_loaded');
      }
    } catch (e) {
      if (status) status.textContent = __('admin_error') + ': ' + e.message;
    }
  },

  async loadSystemMessage() {
    const db = this.db();
    if (!db) return null;
    try {
      const snap = await db.collection('admin').doc('config').get();
      if (snap.exists) return snap.data().systemMessage || null;
    } catch (_) {}
    return null;
  },

  async saveSystemMessage() {
    const input = document.getElementById('admin-sysmsg-input');
    const status = document.getElementById('admin-sysmsg-status');
    if (!input) return;
    const text = input.value.trim();
    try {
      const db = this.db();
      if (!db) throw new Error('No Firestore connection');
      await db.collection('admin').doc('config').set({
        systemMessage: {
          text,
          authorId: GL_AUTH.getUserId(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }
      }, { merge: true });
      if (status) {
        status.textContent = text ? __('admin_sysmsg_saved') : __('admin_sysmsg_cleared');
        status.style.color = 'var(--c-green)';
      }
      GL_UI.toast(__('admin_sysmsg_saved'), 'success');
    } catch (e) {
      if (status) { status.textContent = __('admin_error') + ': ' + e.message; status.style.color = 'var(--c-red,#e8292a)'; }
    }
  },

  // ==========================================
  //  PLAYER MANAGEMENT
  // ==========================================

  async handleSearchPlayers(overrideQuery) {
    const input = document.getElementById('admin-player-search');
    const listEl = document.getElementById('admin-player-list');
    const query = typeof overrideQuery === 'string' ? overrideQuery : (input ? input.value.trim() : '');
    if (listEl) listEl.innerHTML = `<div style="color:var(--t-tertiary)">${__('admin_loading')}...</div>`;
    try {
      const players = await this.searchPlayers(query);
      if (!listEl) return;
      if (!players.length) {
        listEl.innerHTML = `<div style="color:var(--t-tertiary)">${__('admin_no_results')}</div>`;
        return;
      }
      listEl.innerHTML = `<div style="font-size:0.72rem;color:var(--t-tertiary);margin-bottom:8px">${players.length} ${__('admin_players_found')}</div>`
        + players.map(p => this._playerRowHTML(p)).join('');
    } catch (e) {
      if (listEl) listEl.innerHTML = `<div style="color:var(--c-red,#e8292a)">${__('admin_error')}: ${e.message}</div>`;
    }
  },

  async searchPlayers(query) {
    const db = this.db();
    if (!db) return [];
    const snap = await db.collection('profiles').get();
    const players = [];
    snap.forEach(doc => {
      const data = doc.data();
      const save = data.save_data || {};
      const mp   = data.mp || {};
      // Division/group comes from mp (MP assignment), not save_data.season (SP legacy field)
      players.push({
        id: doc.id,
        email: data.email || '',
        role: data.role || 'player',
        teamName: (save.team && save.team.name) || '',
        teamColor: (save.team && save.team.colors && save.team.colors.primary) || '#888',
        division:      mp.division      || (save.season && save.season.division)      || 8,
        divisionGroup: mp.divisionGroup || (save.season && save.season.divisionGroup) || 1,
        divKey:        mp.divKey        || null,
        year:          mp.seasonYear    || (save.season && save.season.year)           || 1,
        hasTeam: !!(save.team && save.team.name)
      });
    });
    this._cachedPlayers = players;
    if (!query) return players;
    const q = query.toLowerCase();
    return players.filter(p =>
      p.email.toLowerCase().includes(q) ||
      p.teamName.toLowerCase().includes(q)
    );
  },

  openMoveDialog(userId, teamName) {
    const db = this.db();
    GL_UI.openModal({
      title: `${__('admin_move')}: ${teamName}`,
      content: `
        <div style="display:flex;flex-direction:column;gap:12px">
          <div>
            <label style="font-size:0.78rem;color:var(--t-secondary);display:block;margin-bottom:4px">${__('division')}</label>
            <select id="admin-move-divkey" style="width:100%;background:var(--c-surface-2);color:var(--t-primary);border:1px solid var(--c-border);border-radius:var(--r-sm);padding:8px;font-size:0.82rem">
              <option value="">Cargando divisiones…</option>
            </select>
          </div>
          <button class="btn btn-primary w-full" style="justify-content:center" onclick="GL_ADMIN.executeMovePlayer('${userId}')">
            ${__('admin_confirm_move')}
          </button>
        </div>`
    });

    // Load real division documents from Firestore so we always use the correct doc ID
    setTimeout(async () => {
      const sel = document.getElementById('admin-move-divkey');
      if (!sel || !db) return;
      try {
        const snap = await db.collection('divisions').where('phase', '==', 'season').get();
        const docs = [];
        snap.forEach(doc => docs.push({ id: doc.id, ...doc.data() }));
        docs.sort((a, b) => (a.division - b.division) || (a.group - b.group));
        if (docs.length === 0) {
          sel.innerHTML = '<option value="">No hay divisiones activas</option>';
          return;
        }
        sel.innerHTML = docs.map(d => {
          const groupLetter = (typeof Divisions !== 'undefined' && Divisions.groupLabel)
            ? Divisions.groupLabel(Number(d.group) || 1) : (d.group || 1);
          const divEntry = (window.GL_DATA && GL_DATA.DIVISIONS)
            ? GL_DATA.DIVISIONS.find(x => x.div === d.division) : null;
          const divName = divEntry ? divEntry.name : '';
          return `<option value="${d.id}">${d.division}-${groupLetter} – ${divName}</option>`;
        }).join('');
      } catch (e) {
        const sel2 = document.getElementById('admin-move-divkey');
        if (sel2) sel2.innerHTML = '<option value="">Error al cargar divisiones</option>';
      }
    }, 50);
  },

  async executeMovePlayer(userId) {
    const divKeySel = document.getElementById('admin-move-divkey');
    if (!divKeySel || !divKeySel.value) {
      GL_UI.toast('Selecciona una división', 'warning');
      return;
    }
    const targetDivKey = divKeySel.value;
    try {
      await this.movePlayer(userId, targetDivKey);
      GL_UI.closeTopModal();
      GL_UI.toast(__('admin_player_moved'), 'success');
      this.handleSearchPlayers('');
    } catch (e) {
      GL_UI.toast(__('admin_error') + ': ' + e.message, 'error');
    }
  },

  async movePlayer(userId, newDivKey) {
    const db = this.db();
    if (!db) throw new Error('No DB');
    const ref = db.collection('profiles').doc(userId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error('Player not found');
    const data = snap.data();

    // --- 1. Fetch the target division document ---
    const newDivRef = db.collection('divisions').doc(newDivKey);
    const newDivSnap = await newDivRef.get();
    if (!newDivSnap.exists) throw new Error(`División ${newDivKey} no existe.`);
    const newDivData = newDivSnap.data();

    // --- 2. Update save_data ---
    const saveData = JSON.parse(JSON.stringify(data.save_data || {}));
    if (!saveData.season) saveData.season = {};
    saveData.season.division = newDivData.division;
    saveData.season.divisionGroup = newDivData.group;
    if (typeof window.GL_ENGINE !== 'undefined' && GL_ENGINE.buildInitialStandings) {
      saveData.standings = GL_ENGINE.buildInitialStandings(newDivData.division);
    }

    // --- 3. Move MP division assignment in Firestore ---
    const oldMp = data.mp || null;
    const oldDivKey = oldMp && oldMp.divKey ? oldMp.divKey : null;

    // Remove from old division (standings + slot)
    if (oldDivKey && oldDivKey !== newDivKey) {
      const oldDivRef = db.collection('divisions').doc(oldDivKey);
      const oldDivSnap = await oldDivRef.get();
      if (oldDivSnap.exists) {
        const oldDivData = oldDivSnap.data();

        // Remove from standings
        const oldStandings = (oldDivData.standings || []).filter(s => s.teamId !== userId);

        // Remove slot
        const oldSlots = Object.assign({}, oldDivData.slots || {});
        if (oldMp.slotIndex != null) {
          delete oldSlots[String(oldMp.slotIndex)];
        } else {
          // Find slot by userId
          for (const [k, v] of Object.entries(oldSlots)) {
            if (v && v.userId === userId) { delete oldSlots[k]; break; }
          }
        }

        await oldDivRef.update({ standings: oldStandings, slots: oldSlots });
      }
    }

    // Add to new division (standings + slot)
    let newSlotIndex = oldMp && oldDivKey === newDivKey ? (oldMp.slotIndex ?? null) : null;

    // Find slot: 1) empty slot, 2) bot slot to replace, 3) error
    const newSlots = Object.assign({}, newDivData.slots || {});
    const MAX_SLOTS = 10;
    if (newSlotIndex == null) {
      for (let i = 0; i < MAX_SLOTS; i++) {
        if (!newSlots[String(i)]) { newSlotIndex = i; break; }
      }
    }
    if (newSlotIndex == null) {
      // Division full — replace first bot slot
      for (let i = 0; i < MAX_SLOTS; i++) {
        if (newSlots[String(i)] && newSlots[String(i)].type === 'bot') {
          newSlotIndex = i;
          break;
        }
      }
    }
    if (newSlotIndex == null) throw new Error(`Division ${newDivKey} is full (no open or bot slots).`);

    // Build team snapshot from save_data (full snapshot so race engine has pilots/car)
    const teamSnap = {
      teamName:       (saveData.team && saveData.team.name)            || 'Team',
      colors:         (saveData.team && saveData.team.colors)          || { primary: '#888', secondary: '#0a0b0f' },
      logo:           (saveData.team && saveData.team.logo)            || '',
      pilots:         saveData.pilots || [],
      car:            { components: (saveData.car && saveData.car.components) || {} },
      staff:          saveData.staff  || [],
      hq:             saveData.hq     || { admin:1, wind_tunnel:1, rnd:1, factory:1, academy:1 },
      engineSupplier: (saveData.team && saveData.team.engineSupplier)  || '',
      fans:           (saveData.team && saveData.team.fans)            || 1000
    };
    newSlots[String(newSlotIndex)] = {
      type: 'player',
      userId: userId,
      teamSnapshot: teamSnap,
      joinedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    // Upsert standing entry — remove player's old entry + bot that occupied this slot (if any)
    const newStandings = (newDivData.standings || []).filter(s =>
      s.teamId !== userId && !(s.slotIndex === newSlotIndex && !s.isPlayer)
    );
    newStandings.push({
      slotIndex: newSlotIndex,
      teamId: userId,
      teamName: teamSnap.teamName,
      color: teamSnap.colors.primary || '#888',
      points: 0,
      wins: 0,
      podiums: 0,
      position: newStandings.length + 1,
      bestResult: 0,
      isPlayer: true
    });

    await newDivRef.update({ standings: newStandings, slots: newSlots });

    // --- 4. Update profile: save_data + mp ---
    await ref.update({
      save_data: saveData,
      save_updated_at: firebase.firestore.FieldValue.serverTimestamp(),
      mp: {
        division: newDivData.division,
        divisionGroup: newDivData.group,
        divKey: newDivKey,
        slotIndex: newSlotIndex,
        status: 'active',
        seasonYear: newDivData.seasonYear || 1
      }
    });

    // --- 5. Fill remaining empty slots with bots (client-side) ---
    await this._fillDivisionBots(newDivKey, newDivData.division);
  },

  async _fillDivisionBots(divKey, division) {
    const db = this.db();
    if (!db) return;
    const divRef = db.collection('divisions').doc(divKey);
    const divSnap = await divRef.get();
    if (!divSnap.exists) return;

    const divData = divSnap.data();
    const slots = divData.slots || {};
    const standings = divData.standings || [];
    const seasonYear = divData.seasonYear || 1;
    const MAX_SLOTS = 10;

    // Find empty slot indices
    const emptyIndices = [];
    for (let i = 0; i < MAX_SLOTS; i++) {
      if (!slots[String(i)]) emptyIndices.push(i);
    }
    if (!emptyIndices.length) return;

    const CAR_RANGE = { 8:[38,55],7:[42,60],6:[48,65],5:[52,70],4:[56,75],3:[62,80],2:[68,85],1:[72,92] };
    const carRange = CAR_RANGE[division] || CAR_RANGE[8];
    const aiTeams = (window.GL_DATA && GL_DATA.AI_TEAMS) ? GL_DATA.AI_TEAMS : [];
    const aiPilots = (window.GL_DATA && GL_DATA.PILOT_POOL) ? GL_DATA.PILOT_POOL.filter(p => String(p.id).startsWith('ai')) : [];
    const RNG = window.GL_ENGINE_CORE && GL_ENGINE_CORE.SeededRNG;
    if (!aiTeams.length || !RNG) return;

    const usedBotIds = new Set(Object.values(slots).filter(s => s && s.type === 'bot' && s.botTeamId).map(s => s.botTeamId));
    const available = aiTeams.filter(t => !usedBotIds.has(t.id));

    const slotUpdates = {};
    const newStandingEntries = [];

    emptyIndices.forEach((slotIdx, i) => {
      const aiTeam = available[i % (available.length || 1)];
      if (!aiTeam) return;
      const botSeed = `bot_${divKey}_${slotIdx}_${seasonYear}`;
      const rng = new RNG(botSeed);

      const components = {};
      ['engine','chassis','aero','brakes','gearbox','reliability','efficiency','tyreManage'].forEach(comp => {
        components[comp] = { score: rng.intRange(carRange[0], carRange[1]), level: 1 };
      });

      const hashSeed = s => { let h = 0; for (let c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
      const pilot1 = aiPilots[hashSeed(botSeed + '_p1') % aiPilots.length] || aiPilots[0];
      const pilot2 = aiPilots[hashSeed(botSeed + '_p2') % aiPilots.length] || aiPilots[1] || aiPilots[0];

      slotUpdates[`slots.${slotIdx}`] = {
        type: 'bot',
        botTeamId: aiTeam.id,
        teamSnapshot: {
          teamName: aiTeam.name,
          colors: { primary: aiTeam.color, secondary: '#0a0b0f' },
          logo: '',
          pilots: [Object.assign({}, pilot1), Object.assign({}, pilot2)],
          car: { components },
          staff: [],
          hq: { admin:1, wind_tunnel:1, rnd:1, factory:1, academy:1 },
          engineSupplier: '',
          fans: 1000 + rng.intRange(0, 3000)
        }
      };

      if (!standings.find(s => s.teamId === aiTeam.id)) {
        newStandingEntries.push({
          slotIndex: slotIdx,
          teamId: aiTeam.id,
          teamName: aiTeam.name,
          color: aiTeam.color,
          flag: aiTeam.flag || '',
          points: 0, wins: 0, podiums: 0,
          position: standings.length + newStandingEntries.length + 1,
          bestResult: 0,
          isPlayer: false
        });
      }
    });

    if (Object.keys(slotUpdates).length) await divRef.update(slotUpdates);
    if (newStandingEntries.length) {
      const finalStandings = standings.concat(newStandingEntries);
      finalStandings.forEach((s, i) => { s.position = i + 1; });
      await divRef.update({ standings: finalStandings });
    }
  },

  openPointsDialog(userId, teamName) {
    GL_UI.openModal({
      title: `${__('admin_adjust_pts')}: ${teamName}`,
      content: `
        <div style="display:flex;flex-direction:column;gap:12px">
          <div>
            <label style="font-size:0.78rem;color:var(--t-secondary);display:block;margin-bottom:4px">${__('admin_pts_amount')}</label>
            <input id="admin-pts-amount" type="number" value="0" style="width:100%;background:var(--c-surface-2);color:var(--t-primary);border:1px solid var(--c-border);border-radius:var(--r-sm);padding:8px;font-size:0.82rem" />
            <div style="font-size:0.68rem;color:var(--t-tertiary);margin-top:2px">${__('admin_pts_hint')}</div>
          </div>
          <div>
            <label style="font-size:0.78rem;color:var(--t-secondary);display:block;margin-bottom:4px">${__('admin_pts_reason')}</label>
            <input id="admin-pts-reason" type="text" placeholder="${__('admin_pts_reason_placeholder')}" style="width:100%;background:var(--c-surface-2);color:var(--t-primary);border:1px solid var(--c-border);border-radius:var(--r-sm);padding:8px;font-size:0.82rem" />
          </div>
          <button class="btn btn-primary w-full" style="justify-content:center" onclick="GL_ADMIN.executeAdjustPoints('${userId}')">
            ${__('admin_confirm_adjust')}
          </button>
        </div>`
    });
  },

  async executeAdjustPoints(userId) {
    const amountEl = document.getElementById('admin-pts-amount');
    const reasonEl = document.getElementById('admin-pts-reason');
    if (!amountEl) return;
    const amount = Number(amountEl.value);
    const reason = reasonEl ? reasonEl.value.trim() : '';
    if (amount === 0) { GL_UI.toast(__('admin_pts_zero'), 'warning'); return; }
    try {
      await this.adjustPoints(userId, amount, reason);
      GL_UI.closeTopModal();
      GL_UI.toast(__('admin_pts_adjusted'), 'success');
      this.handleSearchPlayers('');
    } catch (e) {
      GL_UI.toast(__('admin_error') + ': ' + e.message, 'error');
    }
  },

  async adjustPoints(userId, amount, reason) {
    const db = this.db();
    if (!db) throw new Error('No DB');
    const ref = db.collection('profiles').doc(userId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error('Player not found');
    const data = snap.data();
    const saveData = JSON.parse(JSON.stringify(data.save_data || {}));
    if (Array.isArray(saveData.standings)) {
      const entry = saveData.standings.find(s => s.id === 'player');
      if (entry) {
        entry.points = Math.max(0, (entry.points || 0) + Number(amount));
        // Re-sort standings by points descending
        saveData.standings.sort((a, b) => (b.points || 0) - (a.points || 0));
        saveData.standings.forEach((s, i) => { s.position = i + 1; });
      }
    }
    await ref.update({
      save_data: saveData,
      save_updated_at: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Log the adjustment for audit
    try {
      await db.collection('admin').doc('point_adjustments').set({
        log: firebase.firestore.FieldValue.arrayUnion({
          playerId: userId,
          teamName: (saveData.team && saveData.team.name) || '',
          amount: Number(amount),
          reason: reason || '',
          adminId: GL_AUTH.getUserId(),
          ts: Date.now()
        })
      }, { merge: true });
    } catch (_) { /* audit log is best-effort */ }
  },

  // ==========================================
  //  DIVISION TOOLS
  // ==========================================

  async handleResetGroup() {
    const divSel = document.getElementById('admin-tool-div');
    const groupSel = document.getElementById('admin-tool-group');
    if (!divSel || !groupSel) return;
    const div = Number(divSel.value);
    const group = Number(groupSel.value);
    const groupLabel = (typeof Divisions !== 'undefined' && Divisions.divisionLabel)
      ? Divisions.divisionLabel(div, group) : `${div}-${group}`;
    const ok = await GL_UI.confirm(
      __('admin_reset_confirm_title'),
      `${__('admin_reset_confirm_text')} ${groupLabel}?\n\nEsto eliminará a todos los jugadores del grupo y recreará el grupo con bots. Los jugadores perderán su asignación de división.`,
      __('admin_reset_confirm_ok'),
      __('cancel')
    );
    if (!ok) return;
    const statusEl = document.getElementById('admin-tool-status');
    if (statusEl) { statusEl.textContent = 'Reiniciando grupo...'; statusEl.style.color = 'var(--t-secondary)'; }
    try {
      const key = this.divKey(div, group);
      const adminResetGroup = firebase.functions().httpsCallable('adminResetGroup');
      const result = await adminResetGroup({ divKey: key });
      const affected = (result.data.affectedPlayers || []).length;
      if (statusEl) {
        statusEl.textContent = `${__('admin_group_reset_ok')} · ${affected} jugador(es) desasignados`;
        statusEl.style.color = 'var(--c-green)';
      }
      GL_UI.toast(`${__('admin_group_reset_ok')} (${groupLabel})`, 'success');
    } catch (e) {
      if (statusEl) { statusEl.textContent = __('admin_error') + ': ' + (e.message || e); statusEl.style.color = 'var(--c-red,#e8292a)'; }
    }
  },

  // ==========================================
  //  SEASON CONTROL
  // ==========================================

  async handleForceSeasonAdvance() {
    const statusEl = document.getElementById('admin-season-status');
    const ok = await GL_UI.confirm(
      'Avanzar a siguiente temporada',
      'Esto cerrará todas las divisiones que ya terminaron sus carreras (aplicando ascensos y descensos) y creará la nueva temporada.\n\nLas divisiones con carreras pendientes NO se verán afectadas.\n\n¿Continuar?',
      '🔁 Avanzar',
      __('cancel')
    );
    if (!ok) return;

    if (statusEl) { statusEl.textContent = 'Procesando temporada...'; statusEl.style.color = 'var(--t-secondary)'; }
    try {
      const adminForceSeasonAdvance = firebase.functions().httpsCallable('adminForceSeasonAdvance');
      const result = await adminForceSeasonAdvance({});
      const data = result.data || {};
      const ended = (data.endedDivisions || []).length;
      if (statusEl) {
        statusEl.textContent = `✓ ${data.message || 'Hecho'}`;
        statusEl.style.color = 'var(--c-green)';
      }
      GL_UI.toast(`Nueva temporada iniciada (${ended} división(es) cerradas)`, 'success');
    } catch (e) {
      // Firebase HttpsError expone el mensaje real en e.message o e.details
      const msg = (e && e.message) ? e.message : String(e);
      if (statusEl) { statusEl.textContent = msg; statusEl.style.color = 'var(--c-red,#e8292a)'; }
      GL_UI.toast(msg, 'error');
    }
  },

  // ==========================================
  //  RACE CONTROL
  // ==========================================

  async handleForceStartRace() {
    const divSel = document.getElementById('admin-race-div');
    const groupSel = document.getElementById('admin-race-group');
    if (!divSel || !groupSel) return;
    const div = Number(divSel.value);
    const group = Number(groupSel.value);
    const groupLabel = (typeof Divisions !== 'undefined' && Divisions.divisionLabel)
      ? Divisions.divisionLabel(div, group) : `${div}-${group}`;

    const ok = await GL_UI.confirm(
      __('admin_race_confirm_title'),
      `${__('admin_race_confirm_text')} ${groupLabel}?`,
      __('admin_force_start'),
      __('cancel')
    );
    if (!ok) return;

    const statusEl = document.getElementById('admin-race-status');
    try {
      const key = this.divKey(div, group);
      if (statusEl) { statusEl.textContent = 'Simulating race...'; statusEl.style.color = 'var(--t-secondary)'; }
      const adminForceRace = firebase.functions().httpsCallable('adminForceRace');
      const result = await adminForceRace({ divKey: key });
      const data = result.data || {};
      if (statusEl) {
        statusEl.textContent = `Race completed: ${groupLabel} R${data.round || '?'} · ${(data.topPositions || []).map(p => `${p.name} P${p.pos}`).join(', ')}`;
        statusEl.style.color = 'var(--c-green)';
      }
      GL_UI.toast(`Race simulated for ${groupLabel}`, 'success');
    } catch (e) {
      if (statusEl) { statusEl.textContent = __('admin_error') + ': ' + (e.message || e); statusEl.style.color = 'var(--c-red,#e8292a)'; }
    }
  },

  async handleForceAllRaces(useRoundFilter = false) {
    const roundFilterEl = document.getElementById('admin-race-round-filter');
    const roundFilter = useRoundFilter && roundFilterEl && roundFilterEl.value.trim()
      ? parseInt(roundFilterEl.value.trim(), 10)
      : null;

    const confirmMsg = roundFilter
      ? `Correr ronda ${roundFilter} solo para divisiones que aún la tienen pendiente?`
      : 'Simulate the next race for ALL active divisions?';
    const ok = await GL_UI.confirm('Force All Races', confirmMsg, 'Run All', __('cancel'));
    if (!ok) return;

    const statusEl = document.getElementById('admin-race-status');
    try {
      if (statusEl) { statusEl.textContent = 'Running all races...'; statusEl.style.color = 'var(--t-secondary)'; }
      const adminForceAllRaces = firebase.functions().httpsCallable('adminForceAllRaces');
      const result = await adminForceAllRaces(roundFilter ? { roundFilter } : {});
      const data = result.data || {};
      if (statusEl) {
        statusEl.textContent = `Done: ${data.processed || 0} divisions processed`;
        statusEl.style.color = 'var(--c-green)';
      }
      GL_UI.toast(`All races completed (${data.processed || 0} divisions)`, 'success');
    } catch (e) {
      if (statusEl) { statusEl.textContent = __('admin_error') + ': ' + (e.message || e); statusEl.style.color = 'var(--c-red,#e8292a)'; }
    }
  },

  // ==========================================
  //  DATA PANEL (placeholder)
  // ==========================================

  openDataPanel() {
    GL_UI.openModal({
      title: __('admin_data_panel'),
      content: `
        <div style="text-align:center;padding:32px 16px">
          <div style="font-size:2.5rem;margin-bottom:12px">📊</div>
          <div style="font-size:1rem;font-weight:700;color:var(--t-primary);margin-bottom:8px">${__('admin_data_coming_soon')}</div>
          <div style="font-size:0.82rem;color:var(--t-secondary)">${__('admin_data_desc')}</div>
        </div>`
    });
  },

  // ==========================================
  //  SYSTEM MESSAGE FOR PLAYERS
  // ==========================================

  // Called from dashboard to show system message notification to players
  async checkSystemMessage() {
    if (!window.GL_AUTH || !GL_AUTH.isAuthenticated()) return;
    try {
      const msg = await this.loadSystemMessage();
      if (!msg || !msg.text) return;
      const state = GL_STATE.getState();
      const lastSeen = state._lastSystemMessageTs || 0;
      const msgTs = msg.updatedAt ? (msg.updatedAt.toMillis ? msg.updatedAt.toMillis() : msg.updatedAt) : 0;
      if (msgTs > lastSeen) {
        GL_STATE.addNotification({ text: `📢 ${msg.text}`, type: 'info' });
        state._lastSystemMessageTs = msgTs;
        GL_STATE.saveState();
      }
    } catch (_) { /* silent */ }
  }
};

window.GL_ADMIN = GL_ADMIN;
