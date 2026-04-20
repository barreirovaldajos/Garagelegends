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
        <div class="section-title" style="margin-bottom:12px">🏁 ${__('admin_race_control')}</div>
        <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap">
          <div>
            <label style="font-size:0.72rem;color:var(--t-tertiary);display:block;margin-bottom:4px">${__('division')}</label>
            <select id="admin-race-div" style="background:var(--c-surface-2);color:var(--t-primary);border:1px solid var(--c-border);border-radius:var(--r-sm);padding:6px 10px;font-size:0.82rem">
              ${divOptions.map(d => `<option value="${d.div}">${d.div} – ${d.name || ''}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:0.72rem;color:var(--t-tertiary);display:block;margin-bottom:4px">${__('admin_group')}</label>
            <select id="admin-race-group" style="background:var(--c-surface-2);color:var(--t-primary);border:1px solid var(--c-border);border-radius:var(--r-sm);padding:6px 10px;font-size:0.82rem">
              ${this._buildGroupOptions(divOptions[0])}
            </select>
          </div>
          <button class="btn btn-primary" onclick="GL_ADMIN.handleForceStartRace()" style="background:var(--c-red,#e8292a)">🏁 ${__('admin_force_start')}</button>
        </div>
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
    `;

    // Wire up division select → group select sync
    this._wireGroupSync('admin-race-div', 'admin-race-group');
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
      players.push({
        id: doc.id,
        email: data.email || '',
        role: data.role || 'player',
        teamName: (save.team && save.team.name) || '',
        teamColor: (save.team && save.team.colors && save.team.colors.primary) || '#888',
        division: (save.season && save.season.division) || 8,
        divisionGroup: (save.season && save.season.divisionGroup) || 1,
        year: (save.season && save.season.year) || 1,
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
    const divOptions = (window.GL_DATA && Array.isArray(GL_DATA.DIVISIONS))
      ? GL_DATA.DIVISIONS.slice().sort((a, b) => a.div - b.div)
      : [];
    const firstDiv = divOptions[0] || { parallelDivisions: 1 };

    GL_UI.openModal({
      title: `${__('admin_move')}: ${teamName}`,
      content: `
        <div style="display:flex;flex-direction:column;gap:12px">
          <div>
            <label style="font-size:0.78rem;color:var(--t-secondary);display:block;margin-bottom:4px">${__('division')}</label>
            <select id="admin-move-div" style="width:100%;background:var(--c-surface-2);color:var(--t-primary);border:1px solid var(--c-border);border-radius:var(--r-sm);padding:8px;font-size:0.82rem">
              ${divOptions.map(d => `<option value="${d.div}">${d.div} – ${d.name || ''}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:0.78rem;color:var(--t-secondary);display:block;margin-bottom:4px">${__('admin_group')}</label>
            <select id="admin-move-group" style="width:100%;background:var(--c-surface-2);color:var(--t-primary);border:1px solid var(--c-border);border-radius:var(--r-sm);padding:8px;font-size:0.82rem">
              ${this._buildGroupOptions(firstDiv)}
            </select>
          </div>
          <button class="btn btn-primary w-full" style="justify-content:center" onclick="GL_ADMIN.executeMovePlayer('${userId}')">
            ${__('admin_confirm_move')}
          </button>
        </div>`
    });

    // Wire group sync inside modal
    setTimeout(() => this._wireGroupSync('admin-move-div', 'admin-move-group'), 50);
  },

  async executeMovePlayer(userId) {
    const divSel = document.getElementById('admin-move-div');
    const groupSel = document.getElementById('admin-move-group');
    if (!divSel || !groupSel) return;
    const newDiv = Number(divSel.value);
    const newGroup = Number(groupSel.value);
    try {
      await this.movePlayer(userId, newDiv, newGroup);
      GL_UI.closeTopModal();
      GL_UI.toast(__('admin_player_moved'), 'success');
      this.handleSearchPlayers(''); // Refresh list
    } catch (e) {
      GL_UI.toast(__('admin_error') + ': ' + e.message, 'error');
    }
  },

  async movePlayer(userId, newDivision, newGroup) {
    const db = this.db();
    if (!db) throw new Error('No DB');
    const ref = db.collection('profiles').doc(userId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error('Player not found');
    const data = snap.data();

    // --- 1. Update save_data ---
    const saveData = JSON.parse(JSON.stringify(data.save_data || {}));
    if (!saveData.season) saveData.season = {};
    saveData.season.division = Number(newDivision);
    saveData.season.divisionGroup = Number(newGroup);
    if (typeof window.GL_ENGINE !== 'undefined' && GL_ENGINE.buildInitialStandings) {
      saveData.standings = GL_ENGINE.buildInitialStandings(Number(newDivision));
    }

    // --- 2. Move MP division assignment in Firestore ---
    const newDivKey = this.divKey(newDivision, newGroup);
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
    const newDivRef = db.collection('divisions').doc(newDivKey);
    const newDivSnap = await newDivRef.get();
    let newDivData;
    if (!newDivSnap.exists) {
      // Auto-create the division document so the admin can always move players
      newDivData = {
        division: Number(newDivision),
        group: Number(newGroup),
        seasonYear: 1,
        phase: 'season',
        slots: {},
        standings: [],
        nextRaceRound: 1,
        raceInProgress: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      await newDivRef.set(newDivData);
    } else {
      newDivData = newDivSnap.data();
    }

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

    // Build team snapshot from save_data
    const teamSnap = {
      teamName: (saveData.team && saveData.team.name) || 'Team',
      colors: (saveData.team && saveData.team.colors) || { primary: '#888' }
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

    // --- 3. Update profile: save_data + mp ---
    await ref.update({
      save_data: saveData,
      save_updated_at: firebase.firestore.FieldValue.serverTimestamp(),
      mp: {
        division: Number(newDivision),
        divisionGroup: Number(newGroup),
        divKey: newDivKey,
        slotIndex: newSlotIndex,
        status: 'active',
        seasonYear: newDivData.seasonYear || 1
      }
    });
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
      `${__('admin_reset_confirm_text')} ${groupLabel}?`,
      __('admin_reset_confirm_ok'),
      __('cancel')
    );
    if (!ok) return;
    const statusEl = document.getElementById('admin-tool-status');
    try {
      const db = this.db();
      if (!db) throw new Error('No DB');
      const key = this.divKey(div, group);
      await db.collection('divisions').doc(key).delete();
      if (statusEl) { statusEl.textContent = __('admin_group_reset_ok'); statusEl.style.color = 'var(--c-green)'; }
      GL_UI.toast(__('admin_group_reset_ok'), 'success');
    } catch (e) {
      if (statusEl) { statusEl.textContent = __('admin_error') + ': ' + e.message; statusEl.style.color = 'var(--c-red,#e8292a)'; }
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

  async handleForceAllRaces() {
    const ok = await GL_UI.confirm(
      'Force All Races',
      'Simulate the next race for ALL active divisions?',
      'Run All',
      __('cancel')
    );
    if (!ok) return;

    const statusEl = document.getElementById('admin-race-status');
    try {
      if (statusEl) { statusEl.textContent = 'Running all races...'; statusEl.style.color = 'var(--t-secondary)'; }
      const adminForceAllRaces = firebase.functions().httpsCallable('adminForceAllRaces');
      const result = await adminForceAllRaces({});
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
