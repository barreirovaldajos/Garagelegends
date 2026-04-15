// ===== UI.JS – Shared UI utilities =====
'use strict';

// ---- Toast Notifications ----
let _toastContainer = null;
function getToastContainer() {
  if (!_toastContainer) {
    _toastContainer = document.createElement('div');
    _toastContainer.id = 'toast-container';
    document.body.appendChild(_toastContainer);
  }
  return _toastContainer;
}

function toast(message, type = 'info', duration = 3500) {
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type]||'🔔'}</span><span>${message}</span>`;
  getToastContainer().appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.3s ease';
    setTimeout(() => el.remove(), 300);
  }, duration);
}

// ---- Modal System ----
let _modalStack = [];
function openModal({ title = '', content = '', size = '', onClose = null } = {}) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const modal = document.createElement('div');
  modal.className = `modal ${size === 'lg' ? 'modal-lg' : ''}`;
  modal.innerHTML = `
    <button class="modal-close">✕</button>
    ${title ? `<h2 style="font-family:var(--font-display);font-size:1.4rem;font-weight:800;margin-bottom:var(--s-5)">${title}</h2>` : ''}
    <div class="modal-body">${content}</div>
  `;
  overlay.appendChild(modal);

  let isClosed = false;

  const close = () => {
    if (isClosed) return;
    isClosed = true;
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.2s ease';
    setTimeout(() => {
      overlay.remove();
      _modalStack = _modalStack.filter(m => m.overlay !== overlay);
      if (onClose) onClose();
    }, 200);
  };

  modal.querySelector('.modal-close').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  document.body.appendChild(overlay);
  _modalStack.push({ overlay, close });
  return { overlay, modal, close };
}

function closeTopModal() {
  if (_modalStack.length) _modalStack[_modalStack.length - 1].close();
}

function closeAllModals() {
  const stack = _modalStack.slice();
  stack.forEach(entry => entry.close());
}

function forceCloseAllModals() {
  _modalStack.forEach(entry => {
    if (entry && entry.overlay && entry.overlay.parentNode) {
      entry.overlay.remove();
    }
  });
  _modalStack = [];
}

// ---- Confirm Dialog ----
function confirm(title, message, okLabel = ((typeof window !== 'undefined' && window.__) ? window.__('btn_confirm', 'Confirm') : 'Confirm'), cancelLabel = ((typeof window !== 'undefined' && window.__) ? window.__('btn_cancel', 'Cancel') : 'Cancel')) {
  return new Promise(resolve => {
    const { modal, close } = openModal({
      title,
      content: `<p style="color:var(--t-secondary);margin-bottom:var(--s-6)">${message}</p>
        <div style="display:flex;gap:var(--s-3);justify-content:flex-end">
          <button class="btn btn-ghost" id="modal-cancel">${cancelLabel}</button>
          <button class="btn btn-primary" id="modal-ok">${okLabel}</button>
        </div>`
    });
    modal.querySelector('#modal-ok').onclick = () => { close(); resolve(true); };
    modal.querySelector('#modal-cancel').onclick = () => { close(); resolve(false); };
  });
}

// ---- Progress Bar ----
function progressBar(value, max = 100, color = '') {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return `<div class="progress-wrap"><div class="progress-bar ${color}" style="width:${pct}%"></div></div>`;
}

// ---- Stat Bar (label + bar + value) ----
function statBar(label, value, max = 99, color = '') {
  return `
    <div class="stat-bar">
      <span class="stat-label">${label}</span>
      ${progressBar(value, max, color)}
      <span class="stat-val">${value}</span>
    </div>`;
}

// ---- Pilot Card HTML ----
function pilotCardHTML(pilot, selected = false) {
  const hue = pilot.attrs.pace > 70 ? '#e8292a' : pilot.attrs.consistency > 75 ? '#4a9eff' : '#2ecc7a';
    return `
      <div class="pilot-card ${selected ? 'selected' : ''}" data-id="${pilot.id}">
        <div class="pilot-card-header" style="background:linear-gradient(135deg,${hue}22,var(--c-surface-2))">
          <div class="pilot-avatar" style="background:${hue}33;width:60px;height:60px;border-radius:var(--r-md);display:flex;align-items:center;justify-content:center;font-size:2rem">${pilot.emoji||'🧑'}</div>
          <div class="pilot-number">${pilot.number || '--'}</div>
        </div>
      <div class="pilot-card-body">
        <div class="pilot-name">${pilot.name}</div>
        <div class="pilot-nationality">${pilot.nat} · Age ${pilot.age}</div>
        ${statBar('Pace', pilot.attrs.pace)}
        ${statBar('Race Pace', pilot.attrs.racePace)}
        ${statBar('Consistency', pilot.attrs.consistency)}
        ${statBar('Rain', pilot.attrs.rain, 99, 'blue')}
        <div style="display:flex;justify-content:space-between;margin-top:var(--s-3)">
          <span class="badge badge-orange">Salary: ${(pilot.salary/1000).toFixed(0)}k CR/wk</span>
          <span class="badge badge-purple">Pot: ${pilot.potential}%</span>
        </div>
        ${pilot.bio ? `<p style="font-size:0.75rem;color:var(--t-tertiary);margin-top:var(--s-2);font-style:italic">"${pilot.bio}"</p>` : ''}
      </div>
    </div>`;
}

// ---- Mini stat hexagon row ----
function statRow(label, val, icon = '') {
  return `<div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid var(--c-border)">
    <span style="font-size:1rem">${icon}</span>
    <span style="flex:1;font-size:0.82rem;color:var(--t-secondary)">${label}</span>
    <span style="font-family:var(--font-display);font-weight:700;font-size:0.9rem">${val}</span>
  </div>`;
}

// ---- Format credits ----
function fmtCR(n) {
  if (Math.abs(n) >= 1000000) return (n/1000000).toFixed(2) + 'M';
  if (Math.abs(n) >= 1000) return (n/1000).toFixed(1) + 'k';
  return n.toString();
}
function fmtSign(n) { return (n >= 0 ? '+' : '') + fmtCR(n); }

// ---- Relative time ----
function relTime(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return Math.floor(diff/60000) + 'm ago';
  return Math.floor(diff/3600000) + 'h ago';
}

// ---- Build sponsor chips ----
function sponsorChipHTML(sp) {
  return `<div class="sponsor-chip">
    <span style="font-size:1.2rem">${sp.logo||'💰'}</span>
    <span class="sponsor-chip-name">${sp.name}</span>
    <span class="sponsor-chip-income">+${fmtCR(sp.income)}/wk</span>
    <span style="font-size:0.72rem;color:var(--t-tertiary);margin-left:auto">${sp.weeksLeft || sp.duration}wk left</span>
  </div>`;
}

// ---- Color picker swatches ----
const TEAM_COLORS = [
  '#e8292a','#ff4a1c','#f5c842','#2ecc7a','#4a9eff',
  '#9b6dff','#ff8c42','#00d4ff','#ff6b9d','#c0c0c0',
  '#ffffff','#1a1a2e','#0f3460','#533483','#05c3b6'
];

function colorSwatchesHTML(selectedColor) {
  return TEAM_COLORS.map(c => `
    <div class="ob-color-swatch ${c===selectedColor?'selected':''}"
      style="background:${c}" data-color="${c}" title="${c}">
    </div>`).join('');
}

// ---- Random event modal ----
function showRandomEvent(ev) {
  if (!ev) return;
  const typeIcon = { good:'✨', bad:'⚠️', warning:'🔔', info:'ℹ️' }[ev.type] || '📋';
  const content = `
    <div style="text-align:center;margin-bottom:var(--s-6)">
      <div style="font-size:3rem;margin-bottom:var(--s-3)">${typeIcon}</div>
      <p style="color:var(--t-secondary);font-size:0.9rem;line-height:1.6">${ev.text}</p>
    </div>
    <div style="display:flex;flex-direction:column;gap:var(--s-2)">
      ${ev.choices.map((ch, i) => `
        <button class="btn btn-secondary w-full" onclick="GL_UI.handleEventChoice('${ev.id}',${i},this.closest('.modal-overlay'))" style="justify-content:center">${ch}</button>
      `).join('')}
    </div>`;

  openModal({ title: ev.title, content });
}

function handleEventChoice(evId, choiceIdx, overlay) {
  const ev = window._pendingEvent;
  if (ev) GL_ENGINE.applyEventChoice(ev, choiceIdx);
  overlay.remove();
  _modalStack = _modalStack.filter(m => m.overlay !== overlay);
  window._pendingEvent = null;
  if (typeof GL_DASHBOARD !== 'undefined') GL_DASHBOARD.refresh();
}

// ---- Circuit SVG path by layout type ----
function circuitSVG(layout) {
  const s = 'fill="none" stroke="rgba(232,41,42,0.55)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"';
  const sf = '<rect x="92" y="13" width="8" height="12" fill="none" stroke="rgba(255,255,255,0.7)" stroke-width="1.5" stroke-dasharray="2 2"/>';
  const layouts = {
    // Flowing arcs, few direction changes — Spa/Suzuka inspired
    'high-speed': `<path ${s} d="M22,36 L64,18 L122,18 L162,36 L178,52 L174,66 L155,72 L134,68 L140,60 L166,70 L148,75 L110,72 L68,72 L34,68 L16,55 L18,42 Z"/>${sf}`,
    // Long straights, tight chicane — Monza inspired
    power: `<path ${s} d="M22,38 L98,18 L162,38 L172,52 L170,62 L160,68 L152,64 L160,55 L170,65 L154,74 L98,72 L56,72 L24,65 L14,52 L16,44 Z"/>${sf}`,
    // Tight corners, direction changes — Monaco/Hungaroring inspired
    technical: `<path ${s} d="M28,40 L60,22 L102,22 L138,28 L152,40 L148,52 L136,58 L122,56 L126,66 L146,60 L156,68 L140,76 L98,76 L62,74 L40,68 L26,58 L22,48 Z"/>${sf}`,
    // Balanced mix of fast and slow sections
    mixed: `<path ${s} d="M24,38 L70,18 L128,18 L164,38 L172,56 L164,66 L148,70 L140,62 L158,68 L152,74 L108,74 L66,72 L36,66 L18,54 L20,44 Z"/>${sf}`,
    // Long lap, variety — Le Mans/Nürburgring inspired
    endurance: `<path ${s} d="M22,38 L72,16 L130,16 L168,38 L174,54 L168,64 L156,70 L140,68 L134,74 L148,76 L112,78 L76,76 L52,72 L38,66 L24,58 L16,46 Z"/>${sf}`
  };
  return `<svg viewBox="0 0 200 90" style="width:100%;height:100%;opacity:0.85">${layouts[layout] || layouts['mixed']}</svg>`;
}

window.GL_UI = {
  toast, openModal, closeTopModal, closeAllModals, forceCloseAllModals, confirm,
  progressBar, statBar, pilotCardHTML, fmtCR, fmtSign, relTime,
  sponsorChipHTML, colorSwatchesHTML, TEAM_COLORS, statRow,
  showRandomEvent, handleEventChoice, circuitSVG
};
