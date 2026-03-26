// ===== ONBOARDING.JS – 8-Step Wizard =====
'use strict';

const OB = {
  step: 0,
  totalSteps: 2,
  data: {
    name: '', country: '', countryFlag: '',
    primaryColor: '#e8292a', secondaryColor: '#0a0b0f',
    logo: '🏎️'
  },

  COUNTRIES: [
    {name:'Italy',flag:'🇮🇹'},{name:'Germany',flag:'🇩🇪'},{name:'UK',flag:'🇬🇧'},
    {name:'Brazil',flag:'🇧🇷'},{name:'France',flag:'🇫🇷'},{name:'Japan',flag:'🇯🇵'},
    {name:'Spain',flag:'🇪🇸'},{name:'USA',flag:'🇺🇸'},{name:'Australia',flag:'🇦🇺'},
    {name:'Mexico',flag:'🇲🇽'},{name:'Netherlands',flag:'🇳🇱'},{name:'Monaco',flag:'🇲🇨'},
    {name:'Sweden',flag:'🇸🇪'},{name:'South Africa',flag:'🇿🇦'},{name:'Argentina',flag:'🇦🇷'}
  ],
  LOGOS: ['🏎️','🚀','⚡','🔥','🦅','🐉','💎','🛡️','🌟','🏆','⚙️','🦁'],
  SEED_SPONSORS: [
    { id:'ss1', name:'VELOCE Energy', logo:'⚡', color:'#e8292a', income: 6000, duration: 10,
      pros:['High weekly income (+6k CR)','Bonus for top 8 finishes'],
      cons:['Demands race results fast','Ends after season if no top 8'] },
    { id:'ss2', name:'NovaTech Systems', logo:'💻', color:'#4a9eff', income: 4500, duration: 14,
      pros:['Long contract (14 weeks)','No performance demands'],
      cons:['Lower income','No performance bonuses'] },
    { id:'ss3', name:'Grid Fuels', logo:'⛽', color:'#f5c842', income: 5200, duration: 12,
      pros:['Good income','Fuel discount (saves 500 CR/race)'],
      cons:['Requires logo visibility in top 6','Mid-length contract'] }
  ],

  start() {
    const el = document.getElementById('onboarding-screen');
    if (!el) return;
    el.style.display = 'flex';
    this.renderWelcome();
  },

  renderWelcome() {
    const el = document.getElementById('onboarding-screen');
    el.innerHTML = `
      <div class="ob-welcome">
        <div class="ob-welcome-bg"></div>
        <div class="ob-grid-lines"></div>
        <div class="ob-speed-lines" id="speed-lines"></div>
        <div class="ob-welcome-content anim-fade-up">
          <div class="ob-tagline">${__('ob_tagline')}</div>
          <div class="ob-headline">Garage<br><span>Legends</span></div>
          <p class="ob-subtitle">${__('ob_subtitle')}</p>
          <div class="ob-stats-row">
            <div class="ob-stat"><div class="ob-stat-val">8</div><div class="ob-stat-label">${__('ob_stats_div')}</div></div>
            <div class="ob-stat"><div class="ob-stat-val">∞</div><div class="ob-stat-label">${__('ob_stats_strat')}</div></div>
            <div class="ob-stat"><div class="ob-stat-val">100+</div><div class="ob-stat-label">${__('ob_stats_events')}</div></div>
          </div>
          <button class="btn btn-primary btn-lg" id="ob-start-btn" style="font-size:1.05rem;padding:16px 40px">
            ${__('ob_start_btn')}
          </button>
        </div>
      </div>`;

    // Animate speed lines
    const sl = el.querySelector('#speed-lines');
    for (let i = 0; i < 8; i++) {
      const line = document.createElement('div');
      line.className = 'speed-line';
      line.style.top = (10 + i * 12) + '%';
      line.style.animationDelay = (i * 0.4) + 's';
      line.style.animationDuration = (2 + Math.random() * 2) + 's';
      sl.appendChild(line);
    }

    el.querySelector('#ob-start-btn').onclick = () => this.showWizard();
  },

  showWizard() {
    this.step = 0;
    this.renderWizardShell();
    this.renderStep(0);
  },

  renderWizardShell() {
    const el = document.getElementById('onboarding-screen');
    el.innerHTML = `
      <div class="ob-wizard">
        <div class="ob-progress-bar-track"><div class="ob-progress-bar-fill" id="ob-prog-fill" style="width:0%"></div></div>
        <div class="ob-step-indicator">
          <span class="ob-step-num" id="ob-step-num">Step 1 of 8</span>
          <span class="ob-step-title" id="ob-step-title">Team Identity</span>
          <div class="ob-step-dots" id="ob-dots"></div>
        </div>
        <div class="ob-step-body">
          <div class="ob-step-inner" id="ob-step-inner"></div>
        </div>
        <div class="ob-footer">
          <span class="ob-footer-hint" id="ob-hint"></span>
          <div style="display:flex;gap:12px">
            <button class="btn btn-ghost" id="ob-back-btn">${__('ob_back')}</button>
            <button class="btn btn-primary" id="ob-next-btn">${__('ob_continue')}</button>
          </div>
        </div>
      </div>`;

    document.getElementById('ob-back-btn').onclick = () => { if (this.step > 0) { this.step--; this.renderStep(this.step); } else { this.renderWelcome(); } };
    document.getElementById('ob-next-btn').onclick = () => this.nextStep();
  },

  renderStep(step) {
    const steps = [__('ob_step1_title'), __('ob_step3_title')]; // Step 3 was Team identity/colors
    document.getElementById('ob-step-num').textContent = `${__('ob_step')} ${step + 1} ${__('ob_step_of')} ${this.totalSteps}`;
    document.getElementById('ob-step-title').textContent = steps[step];

    const fillPct = ((step) / this.totalSteps) * 100;
    document.getElementById('ob-prog-fill').style.width = fillPct + '%';

    // Dots
    let dots = '';
    for (let i = 0; i < this.totalSteps; i++) {
      dots += `<div class="ob-dot ${i < step ? 'done' : i === step ? 'active' : ''}"></div>`;
    }
    document.getElementById('ob-dots').innerHTML = dots;

    const renderFns = [
      this.renderStep0.bind(this), this.renderStep1.bind(this)
    ];
    if (renderFns[step]) renderFns[step]();

    const inner = document.getElementById('ob-step-inner');
    inner.style.opacity = '0';
    inner.style.transform = 'translateY(12px)';
    setTimeout(() => {
      inner.style.transition = 'all 0.35s ease';
      inner.style.opacity = '1';
      inner.style.transform = 'translateY(0)';
    }, 20);
  },

  renderStep0() {
    const inner = document.getElementById('ob-step-inner');
    inner.innerHTML = `
      <div class="ob-step-heading">${__('ob_s1_heading')}</div>
      <p class="ob-step-sub">${__('ob_s1_sub')}</p>
      <input class="ob-name-input" id="ob-name" placeholder="${__('ob_s1_placeholder')}" value="${this.data.name}" maxlength="30">
      <div style="margin-top:var(--s-6)">
        <p style="font-size:0.85rem;color:var(--t-secondary);margin-bottom:var(--s-3)">${__('ob_s1_base')}</p>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:var(--s-2)">
          ${this.COUNTRIES.map(c => `
            <div class="choice-card card-sm ${this.data.country===c.name?'selected':''}" style="text-align:center" data-country="${c.name}" data-flag="${c.flag}">
              <span style="font-size:1.5rem">${c.flag}</span>
              <div style="font-size:0.8rem;font-weight:600;margin-top:4px">${c.name}</div>
            </div>`).join('')}
        </div>
      </div>`;
    document.getElementById('ob-hint').textContent = __('ob_s1_hint');
    inner.querySelector('#ob-name').oninput = e => { this.data.name = e.target.value; };
    inner.querySelectorAll('[data-country]').forEach(el => {
      el.onclick = () => {
        inner.querySelectorAll('[data-country]').forEach(e => e.classList.remove('selected'));
        el.classList.add('selected');
        this.data.country = el.dataset.country;
        this.data.countryFlag = el.dataset.flag;
      };
    });
  },

  renderStep1() {
    const inner = document.getElementById('ob-step-inner');
    inner.innerHTML = `
      <div class="ob-step-heading">${__('ob_s3_heading') || 'Team Identity'}</div>
      <p class="ob-step-sub">${__('ob_s3_sub') || 'Select your colors and emblem'}</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--s-8);align-items:start">
        <div>
          <p style="font-family:var(--font-label);font-size:0.65rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--t-tertiary);margin-bottom:var(--s-3)">${__('ob_s3_primary') || 'Primary Color'}</p>
          <div class="ob-color-row" id="ob-primary-colors">
            ${GL_UI.colorSwatchesHTML(this.data.primaryColor)}
          </div>
          <p style="font-family:var(--font-label);font-size:0.65rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--t-tertiary);margin-bottom:var(--s-3);margin-top:var(--s-5)">${__('ob_s3_logo') || 'Team Emblem'}</p>
          <div style="display:flex;flex-wrap:wrap;gap:var(--s-2)">
            ${this.LOGOS.map(l => `<div class="choice-card card-sm ${this.data.logo===l?'selected':''}" style="width:52px;text-align:center;padding:8px;font-size:1.5rem" data-logo="${l}">${l}</div>`).join('')}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:var(--s-4)">
          <div class="ob-logo-preview" id="ob-preview" style="background:${this.data.primaryColor}22;border-color:${this.data.primaryColor}">
            <span style="font-size:3rem">${this.data.logo}</span>
          </div>
          <div style="text-align:center">
            <div style="font-family:var(--font-display);font-size:1.4rem;font-weight:800;color:var(--t-primary)" id="ob-prev-name">${this.data.name||'Your Team'}</div>
            <div style="font-size:0.78rem;color:var(--t-secondary)">${this.data.countryFlag||''} ${this.data.country||'Unknown'}</div>
          </div>
          <div style="width:60px;height:8px;border-radius:4px;background:${this.data.primaryColor}" id="ob-color-strip"></div>
        </div>
      </div>`;
    document.getElementById('ob-hint').textContent = __('ob_s3_hint') || 'You can change these later.';
    document.getElementById('ob-next-btn').textContent = __('ob_finish_btn') || 'Finish';

    inner.querySelectorAll('#ob-primary-colors .ob-color-swatch').forEach(el => {
      el.onclick = () => {
        inner.querySelectorAll('#ob-primary-colors .ob-color-swatch').forEach(e => e.classList.remove('selected'));
        el.classList.add('selected');
        this.data.primaryColor = el.dataset.color;
        document.getElementById('ob-preview').style.background = this.data.primaryColor + '22';
        document.getElementById('ob-preview').style.borderColor = this.data.primaryColor;
        document.getElementById('ob-color-strip').style.background = this.data.primaryColor;
      };
    });
    inner.querySelectorAll('[data-logo]').forEach(el => {
      el.onclick = () => {
        inner.querySelectorAll('[data-logo]').forEach(e => e.classList.remove('selected'));
        el.classList.add('selected');
        this.data.logo = el.dataset.logo;
        document.getElementById('ob-preview').innerHTML = `<span style="font-size:3rem">${this.data.logo}</span>`;
      };
    });
  },







  nextStep() {
    // Validate
    if (this.step === 0 && !this.data.name.trim()) { GL_UI.toast(__('ob_name_required'), 'warning'); return; }
    if (this.step === 0 && !this.data.country) { GL_UI.toast(__('ob_country_required'), 'warning'); return; }

    if (this.step === this.totalSteps - 1) {
      this.applyChoices();
      this.finish();
      return;
    }

    this.step++;
    this.renderStep(this.step);
  },

  applyChoices() {
    const state = GL_STATE.getState();
    state.team.name = this.data.name;
    state.team.country = this.data.country;
    state.team.countryFlag = this.data.countryFlag;
    state.team.colors.primary = this.data.primaryColor;
    state.team.logo = this.data.logo;
    state.team.reputation = 100;
    state.team.fans = 250;
    state.meta.created = Date.now();

    // Default Pilots (2 random rookies so the engine doesn't break)
    state.pilots = GL_DATA.PILOT_POOL.slice(0, 2).map(p => {
      return { ...GL_STATE.deepClone(p), morale: 80, training: null, contractWeeks: 20, number: Math.floor(Math.random()*89)+11, lastTrainedTimestamp: null };
    });

    // Sponsor
    state.sponsors = []; // Start with 0 sponsors

    // Starting budget
    let budget = 120000; // Increased base budget

    // Facilities – Garage level 1, everything else 0
    state.facilities = GL_DATA.FACILITIES.map(f => ({ id:f.id, name:f.name, level:0, upgrading:false, completeWeek:null }));
    state.facilities.find(f=>f.id==='garage').level = 1;

    // Staff – start with no staff to make them hire one? Let's give them a basic engineer.
    state.staff = [GL_STATE.deepClone(GL_DATA.STAFF_POOL.find(s=>s.id==='s7') || GL_DATA.STAFF_POOL[0])]; // pit crew head or engineer

    // Calendar
    const cal = GL_DATA.generateCalendar(8);
    state.season.calendar = cal;
    state.season.totalRaces = cal.length;
    state.season.phase = 'season';

    state.finances.credits = budget;
    state.finances.tokens = 20;

    // Standings
    state.standings = GL_ENGINE.buildInitialStandings(8);

    GL_STATE.saveState();
  },

  finish() {
    GL_STATE.addLog(`Welcome to Garage Legends! Your journey begins now.`, 'good');
    GL_STATE.saveState();

    const ob = document.getElementById('onboarding-screen');
    ob.style.transition = 'opacity 0.5s ease';
    ob.style.opacity = '0';
    setTimeout(() => {
      ob.style.display = 'none';
      document.getElementById('app').style.display = 'grid';
      if (typeof GL_DASHBOARD !== 'undefined') GL_DASHBOARD.init();
      if (typeof GL_APP !== 'undefined') GL_APP.navigateTo('dashboard');
      GL_UI.toast(`${__('ob_welcome_toast')} ${GL_STATE.getState().team.name}! 🏁`, 'success', 4000);
    }, 500);
  }
};

window.GL_OB = OB;
