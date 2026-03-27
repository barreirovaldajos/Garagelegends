// ===== ONBOARDING.JS – 6-Phase Guided Wizard with NPC Elena =====
'use strict';

const OB = {
  step: 0,
  totalSteps: 6,
  data: {
    name: '', country: '', countryFlag: '',
    primaryColor: '#e8292a', secondaryColor: '#0a0b0f',
    logo: '🏎️', engineSupplier: 'cosmos',
    pilotChosen: false,
    windTunnelAccelerated: false
  },

  COUNTRIES: [
    {name:'Italia',flag:'🇮🇹'},{name:'Alemania',flag:'🇩🇪'},{name:'Reino Unido',flag:'🇬🇧'},
    {name:'Brasil',flag:'🇧🇷'},{name:'Francia',flag:'🇫🇷'},{name:'Japón',flag:'🇯🇵'},
    {name:'España',flag:'🇪🇸'},{name:'EE.UU.',flag:'🇺🇸'},{name:'Australia',flag:'🇦🇺'},
    {name:'México',flag:'🇲🇽'},{name:'Países Bajos',flag:'🇳🇱'},{name:'Mónaco',flag:'🇲🇨'},
    {name:'Suecia',flag:'🇸🇪'},{name:'Sudáfrica',flag:'🇿🇦'},{name:'Argentina',flag:'🇦🇷'}
  ],
  LOGOS: ['🏎️','🚀','⚡','🔥','🦅','🐉','💎','🛡️','🌟','🏆','⚙️','🦁'],

  ENGINES: [
    { 
      id:'cosmos', name:'Cosmos Power', cost: 45000, dna: '+10% Velocidad Inicial',
      tagline: 'El Comerciante de Velocidad',
      description: 'Motor barato y robusto para equipos agresivos.',
      color: '#e74c3c'
    },
    { 
      id:'zenith', name:'Zenith Motors', cost: 35000, dna: '+15% Eficiencia',
      tagline: 'El Camino Equilibrado',
      description: 'Equilibrio perfecto entre coste y rendimiento.',
      color: '#3498db'
    },
    { 
      id:'aerov', name:'Aero-V', cost: 30000, dna: '+12% Aerodinámica',
      tagline: 'Bloque Compacto',
      description: 'Optimizado para aerodinámica y curvas.',
      color: '#2ecc71'
    },
    { 
      id:'titan', name:'Titan Dynamics', cost: 40000, dna: '+20% Fiabilidad',
      tagline: 'A Prueba de Balas',
      description: 'Fiabilidad extrema contra averías.',
      color: '#f1c40f'
    },
    { 
      id:'vulcan', name:'Vulcan Tech', cost: 60000, dna: '−20% Tiempos I+D',
      tagline: 'Laboratorio de Innovación',
      description: 'Reduce tiempos de investigación.',
      color: '#9b59b6'
    }
  ],

  start() {
    const el = document.getElementById('onboarding-screen');
    if (!el) return;
    el.style.display = 'flex';
    this.renderPhase0();
  },

  renderPhase0() {
    // Welcome to Motor Empire splash
    const el = document.getElementById('onboarding-screen');
    el.innerHTML = `
      <div class="ob-phase0" style="display:flex;align-items:center;justify-content:center;height:100%;width:100%;position:relative;overflow:hidden;background:linear-gradient(135deg,#0a0b0f 0%,#1a1b2e 100%)">
        <div style="position:absolute;inset:0;opacity:0.1">
          <div style="position:absolute;top:10%;left:10%;width:300px;height:300px;background:radial-gradient(circle,#e8292a,transparent);border-radius:50%;filter:blur(80px)"></div>
          <div style="position:absolute;bottom:10%;right:10%;width:300px;height:300px;background:radial-gradient(circle,#4a9eff,transparent);border-radius:50%;filter:blur(80px)"></div>
        </div>
        <div style="position:relative;z-index:10;text-align:center;max-width:500px;padding:40px">
          <div style="font-size:0.8rem;color:#aaa;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:var(--s-3)">
            ${__('ob_phase0_tagline')}
          </div>
          <h1 style="font-size:3.5rem;font-weight:900;color:var(--t-primary);margin-bottom:var(--s-4);line-height:1">
            Motor<br><span style="color:#e8292a">Empire</span>
          </h1>
          <p style="font-size:1.1rem;color:var(--t-secondary);margin-bottom:var(--s-6);line-height:1.5">
            ${__('ob_phase0_subtitle')}
          </p>
          <button class="btn btn-primary btn-lg" onclick="GL_OB.step=0;GL_OB.renderWizardShell();GL_OB.renderStep(0)" style="font-size:1.05rem;padding:16px 40px">
            ${__('ob_phase0_btn')}
          </button>
        </div>
      </div>`;
  },

  renderWizardShell() {
    const el = document.getElementById('onboarding-screen');
    el.innerHTML = `
      <div class="ob-wizard" style="display:flex;flex-direction:column;height:100%;background:var(--bg-primary)">
        <div class="ob-progress-bar-track" style="height:3px;background:#222"><div class="ob-progress-bar-fill" id="ob-prog-fill" style="height:100%;background:#e8292a;width:0%;transition:width 0.3s ease"></div></div>
        <div class="ob-step-indicator" style="padding:20px;border-bottom:1px solid #333">
          <span class="ob-step-num" id="ob-step-num" style="font-size:0.8rem;color:#888;text-transform:uppercase">Fase 1 de 6</span>
          <span class="ob-step-title" id="ob-step-title" style="font-size:1.5rem;font-weight:700;color:var(--t-primary);display:block;margin:8px 0">Identidad del Equipo</span>
          <div class="ob-step-dots" id="ob-dots" style="display:flex;gap:6px;margin-top:12px"></div>
        </div>
        <div class="ob-step-body" style="flex:1;overflow:auto;padding:40px;display:grid;grid-template-columns:1fr 1fr;gap:40px">
          <div class="ob-npc-elena" id="ob-elena" style="display:flex;flex-direction:column;justify-content:flex-start"></div>
          <div class="ob-step-inner" id="ob-step-inner" style="display:flex;flex-direction:column;justify-content:flex-start"></div>
        </div>
        <div class="ob-footer" style="padding:20px;border-top:1px solid #333;display:flex;justify-content:space-between;align-items:center">
          <span class="ob-footer-hint" id="ob-hint" style="font-size:0.85rem;color:#888;flex:1"></span>
          <div style="display:flex;gap:12px">
            <button class="btn btn-ghost" id="ob-back-btn">${__('ob_back')}</button>
            <button class="btn btn-primary" id="ob-next-btn">${__('ob_continue')}</button>
          </div>
        </div>
      </div>`;

    document.getElementById('ob-back-btn').onclick = () => { if (this.step > 0) { this.step--; this.renderStep(this.step); } else { this.renderPhase0(); } };
    document.getElementById('ob-next-btn').onclick = () => this.nextStep();
  },

  renderStep(step) {
    console.log('Rendering OB step:', step);
    const stepTitles = [
      __('ob_step1_title'), 
      __('ob_step2_title'), 
      __('ob_step3_title'), 
      __('ob_step4_title'), 
      __('ob_step5_title'), 
      __('ob_step6_title')
    ];
    
    const numEl = document.getElementById('ob-step-num');
    const titleEl = document.getElementById('ob-step-title');
    const progEl = document.getElementById('ob-prog-fill');
    const dotsEl = document.getElementById('ob-dots');
    
    if (numEl) numEl.textContent = `Fase ${step + 1} de ${this.totalSteps}`;
    if (titleEl) titleEl.textContent = stepTitles[step] || 'Configuración';
    if (progEl) progEl.style.width = ((step) / (this.totalSteps - 1)) * 100 + '%';

    // Dots
    if (dotsEl) {
      let dots = '';
      for (let i = 0; i < this.totalSteps; i++) {
        dots += `<div class="ob-dot" style="width:8px;height:8px;border-radius:50%;background:${i < step ? '#e8292a' : i === step ? '#4a9eff' : '#333'};transition:all 0.3s ease"></div>`;
      }
      dotsEl.innerHTML = dots;
    }

    try {
      if (step === 0) this.renderPhase1();
      else if (step === 1) this.renderPhase2();
      else if (step === 2) this.renderPhase3();
      else if (step === 3) this.renderPhase4();
      else if (step === 4) this.renderPhase5();
      else if (step === 5) this.renderPhase6();
    } catch (e) {
      console.error('Error rendering OB step:', step, e);
    }

    const inner = document.getElementById('ob-step-inner');
    if (inner) {
      inner.style.opacity = '0';
      inner.style.transform = 'translateY(12px)';
      setTimeout(() => {
        inner.style.transition = 'all 0.35s ease';
        inner.style.opacity = '1';
        inner.style.transform = 'translateY(0)';
      }, 20);
    }
  },

  renderPhase1() {
    // Team Identity (Name + Country)
    const elElena = document.getElementById('ob-elena');
    const inner = document.getElementById('ob-step-inner');
    
    if (!elElena || !inner) return;
    
    elElena.innerHTML = `
      <div class="elena-dialogue" style="background:rgba(74,158,255,0.1);border-left:3px solid #4a9eff;padding:20px;border-radius:8px">
        <div style="font-size:2rem;margin-bottom:10px">👩‍💼</div>
        <div style="font-size:1rem;color:var(--t-primary);font-weight:600;margin-bottom:8px">Elena</div>
        <div style="font-size:0.95rem;color:var(--t-secondary);line-height:1.6">${__('ob_phase1_elena')}</div>
      </div>`;

    inner.innerHTML = `
      <div>
        <div class="ob-step-heading" style="font-size:1.8rem;font-weight:700;color:var(--t-primary);margin-bottom:8px">¿Cómo se llama tu equipo?</div>
        <p class="ob-step-sub" style="color:var(--t-secondary);margin-bottom:20px">Tu nombre de equipo es tu legado. Elige con cuidado.</p>
        <input class="ob-name-input" id="ob-name" placeholder="Introduce el nombre del equipo..." value="${this.data.name}" maxlength="30" style="width:100%;padding:12px;border:1px solid #333;border-radius:8px;background:rgba(255,255,255,0.05);color:var(--t-primary);margin-bottom:20px">
        
        <div>
          <p style="font-size:0.85rem;color:var(--t-secondary);margin-bottom:12px;text-transform:uppercase;letter-spacing:0.05em">Selecciona tu base de operaciones:</p>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
            ${this.COUNTRIES.map(c => `
              <div class="choice-card" data-country="${c.name}" data-flag="${c.flag}" style="border:2px solid ${this.data.country===c.name?'#e8292a':'#333'};padding:12px;border-radius:8px;text-align:center;cursor:pointer;transition:all 0.2s ease;background:${this.data.country===c.name?'rgba(232,41,42,0.1)':'transparent'}">
                <span style="font-size:1.5rem">${c.flag}</span>
                <div style="font-size:0.75rem;font-weight:600;margin-top:4px;color:var(--t-primary)">${c.name}</div>
              </div>`).join('')}
          </div>
        </div>
      </div>`;
    
    document.getElementById('ob-hint').textContent = 'Tu base determina la base de fans regional y las oportunidades de patrocinio.';
    document.getElementById('ob-next-btn').textContent = __('ob_continue');

    inner.querySelector('#ob-name').oninput = e => { this.data.name = e.target.value; };
    inner.querySelectorAll('[data-country]').forEach(el => {
      el.onclick = () => {
        inner.querySelectorAll('[data-country]').forEach(e => e.style.borderColor = '#333');
        el.style.borderColor = '#e8292a';
        this.data.country = el.dataset.country;
        this.data.countryFlag = el.dataset.flag;
      };
    });
  },

  renderPhase2() {
    // Mechanical Heart (Engine with context + comparatives)
    const elElena = document.getElementById('ob-elena');
    const inner = document.getElementById('ob-step-inner');
    
    if (!elElena || !inner) return;
    
    elElena.innerHTML = `
      <div class="elena-dialogue" style="background:rgba(74,158,255,0.1);border-left:3px solid #4a9eff;padding:20px;border-radius:8px">
        <div style="font-size:2rem;margin-bottom:10px">👩‍💼</div>
        <div style="font-size:1rem;color:var(--t-primary);font-weight:600;margin-bottom:8px">Elena</div>
        <div style="font-size:0.95rem;color:var(--t-secondary);line-height:1.6">${__('ob_phase2_elena')}</div>
      </div>`;
    
    inner.innerHTML = `
      <div>
        <div class="ob-step-heading" style="font-size:1.8rem;font-weight:700;color:var(--t-primary);margin-bottom:8px">Elige tu Corazón Mecánico</div>
        <p class="ob-step-sub" style="color:var(--t-secondary);margin-bottom:20px">Cada motor tiene un DNA único que te define la temporada.</p>
        
        <div style="display:flex;flex-direction:column;gap:12px;max-height:600px;overflow-y:auto">
          ${this.ENGINES.map(e => {
            const selected = this.data.engineSupplier === e.id;
            const budget = 150000 - e.cost;
            return `
              <div data-engine="${e.id}" style="border-left:4px solid ${e.color};padding:16px;border-radius:8px;background:${selected?'rgba(232,41,42,0.1)':'rgba(255,255,255,0.02)'};border:1px solid ${selected?'#e8292a':'#333'};cursor:pointer;transition:all 0.2s ease">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
                  <div>
                    <div style="font-weight:800;font-size:1.1rem;color:${e.color}">${e.name}</div>
                    <div style="font-size:0.75rem;color:#888">${e.tagline}</div>
                  </div>
                  <div class="badge" style="background:${e.color}22;color:${e.color};padding:4px 10px;border-radius:4px;font-size:0.75rem;font-weight:600;white-space:nowrap">${e.dna}</div>
                </div>
                <p style="font-size:0.85rem;color:var(--t-secondary);margin:8px 0">${e.description}</p>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;padding-top:10px;border-top:1px solid #333">
                  <div style="font-size:0.75rem;font-weight:600;color:#777">Costo: <span style="color:${budget<20000?'#e8292a':'#2ecc71'}">${e.cost.toLocaleString()} CR</span></div>
                  <div style="font-size:0.75rem;color:${budget<20000?'#e8292a':'#2ecc71'};font-weight:600">Presupuesto: ${budget.toLocaleString()} CR</div>
                </div>
              </div>`;
          }).join('')}
        </div>
      </div>`;
    
    document.getElementById('ob-hint').textContent = __('ob_phase2_motor_explained');
    document.getElementById('ob-next-btn').textContent = __('ob_continue');

    inner.querySelectorAll('[data-engine]').forEach(el => {
      el.onclick = () => {
        inner.querySelectorAll('[data-engine]').forEach(e => {
          e.style.background = 'rgba(255,255,255,0.02)';
          e.style.borderColor = '#333';
        });
        el.style.background = 'rgba(232,41,42,0.1)';
        el.style.borderColor = '#e8292a';
        this.data.engineSupplier = el.dataset.engine;
      };
    });
  },

  renderPhase3() {
    // Star Player (Draft Scouting)
    const elElena = document.getElementById('ob-elena');
    const inner = document.getElementById('ob-step-inner');
    
    if (!elElena || !inner) return;
    
    elElena.innerHTML = `
      <div class="elena-dialogue" style="background:rgba(74,158,255,0.1);border-left:3px solid #4a9eff;padding:20px;border-radius:8px">
        <div style="font-size:2rem;margin-bottom:10px">👩‍💼</div>
        <div style="font-size:1rem;color:var(--t-primary);font-weight:600;margin-bottom:8px">Elena</div>
        <div style="font-size:0.95rem;color:var(--t-secondary);line-height:1.6">${__('ob_phase3_elena')}</div>
      </div>`;

    const youngPilot = GL_DATA.PILOT_POOL ? GL_DATA.PILOT_POOL.filter(p => p.potential > 70)[Math.floor(Math.random() * 3)] : { name: 'Joven Promesa', potential: 85, reflex: 78 };

    inner.innerHTML = `
      <div>
        <div class="ob-step-heading" style="font-size:1.8rem;font-weight:700;color:var(--t-primary);margin-bottom:8px">Descubre tu Primera Estrella</div>
        <p class="ob-step-sub" style="color:var(--t-secondary);margin-bottom:20px">Tu primer Scout es gratuito. Aquí encuentras a una Joven Promesa excepcional.</p>
        
        <div style="background:rgba(74,158,255,0.05);border:1px solid #4a9eff;padding:20px;border-radius:12px;margin-bottom:20px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
            <div>
              <div style="font-size:1.4rem;font-weight:800;color:var(--t-primary)">${youngPilot.name || 'Joven Promesa'}</div>
              <div style="font-size:0.85rem;color:var(--t-secondary)">Potencial: ${youngPilot.potential || 85}/100</div>
            </div>
            <div style="background:#4a9eff;color:white;padding:8px 12px;border-radius:6px;font-weight:700">⭐ ${youngPilot.potential || 85}</div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:15px">
            <div style="background:rgba(255,255,255,0.05);padding:10px;border-radius:6px">
              <div style="font-size:0.75rem;color:#888;text-transform:uppercase">Reflejos</div>
              <div style="font-size:1.2rem;font-weight:700;color:#4a9eff">${youngPilot.reflex || 78}</div>
            </div>
            <div style="background:rgba(255,255,255,0.05);padding:10px;border-radius:6px">
              <div style="font-size:0.75rem;color:#888;text-transform:uppercase">Edad</div>
              <div style="font-size:1.2rem;font-weight:700;color:#4a9eff">${youngPilot.age || 19} años</div>
            </div>
          </div>
        </div>

        <button class="btn btn-primary" id="scout-btn-ob" style="width:100%;padding:16px;font-size:1rem">${__('ob_phase3_btn_scout')}</button>
      </div>`;
    
    document.getElementById('ob-hint').textContent = 'Este joven tiene potencial excepcional. ¡Promover es la clave!';
    document.getElementById('ob-next-btn').textContent = __('ob_continue');

    document.getElementById('scout-btn-ob').onclick = () => {
      GL_UI.toast(__('ob_phase3_reward_toast'), 'success');
      this.data.pilotChosen = true;
      setTimeout(() => this.nextStep(), 500);
    };
  },

  renderPhase4() {
    // Workshop Begins (First construction with tutorial)
    const elElena = document.getElementById('ob-elena');
    const inner = document.getElementById('ob-step-inner');
    
    if (!elElena || !inner) return;
    
    elElena.innerHTML = `
      <div class="elena-dialogue" style="background:rgba(74,158,255,0.1);border-left:3px solid #4a9eff;padding:20px;border-radius:8px">
        <div style="font-size:2rem;margin-bottom:10px">👩‍💼</div>
        <div style="font-size:1rem;color:var(--t-primary);font-weight:600;margin-bottom:8px">Elena</div>
        <div style="font-size:0.95rem;color:var(--t-secondary);line-height:1.6">${__('ob_phase4_elena')}</div>
      </div>`;

    inner.innerHTML = `
      <div>
        <div class="ob-step-heading" style="font-size:1.8rem;font-weight:700;color:var(--t-primary);margin-bottom:8px">Tu Primer Proyecto</div>
        <p class="ob-step-sub" style="color:var(--t-secondary);margin-bottom:20px">Vamos a mejorar el Túnel de Viento a Nivel 2.</p>
        
        <div style="background:rgba(46,204,113,0.05);border:1px solid #2ecc71;padding:16px;border-radius:12px;margin-bottom:20px">
          <div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:12px">
            <div style="font-size:2rem">🌪️</div>
            <div>
              <div style="font-weight:700;color:var(--t-primary)">Mejora: Túnel de Viento Lv2</div>
              <div style="font-size:0.85rem;color:var(--t-secondary);margin-top:4px">Mejora: Aerodinámica +5%</div>
            </div>
          </div>
          <div style="background:rgba(255,255,255,0.05);padding:12px;border-radius:6px;margin-top:12px;border-left:3px solid #2ecc71">
            <div style="font-size:0.85rem;color:#888;margin-bottom:4px">Costo: 8,000 CR • Tiempo: 30 minutos</div>
            <div style="font-size:0.8rem;color:#4a9eff;font-weight:600">${__('ob_phase4_note')}</div>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:12px">
          <button class="btn btn-primary" id="build-wait-btn" style="width:100%;padding:14px">⏱️ Esperar 30 minutos (tiempo real)</button>
          <button class="btn btn-secondary" id="build-accelerate-btn" style="width:100%;padding:14px">⚡ Acelerar con 5 Fichas</button>
        </div>
      </div>`;
    
    document.getElementById('ob-hint').textContent = __('ob_phase4_elena_tips');
    document.getElementById('ob-next-btn').textContent = __('ob_continue');
    document.getElementById('ob-next-btn').disabled = true;
    document.getElementById('ob-next-btn').style.opacity = '0.5';

    document.getElementById('build-accelerate-btn').onclick = () => {
      GL_UI.toast(__('ob_phase4_reward_toast'), 'success');
      this.data.windTunnelAccelerated = true;
      document.getElementById('ob-next-btn').disabled = false;
      document.getElementById('ob-next-btn').style.opacity = '1';
    };

    document.getElementById('build-wait-btn').onclick = () => {
      GL_UI.toast(__('ob_phase4_reward_toast'), 'success');
      this.data.windTunnelAccelerated = false;
      document.getElementById('ob-next-btn').disabled = false;
      document.getElementById('ob-next-btn').style.opacity = '1';
    };
  },

  renderPhase5() {
    // Proving Ground (Exhibition Race)
    const elElena = document.getElementById('ob-elena');
    const inner = document.getElementById('ob-step-inner');
    
    if (!elElena || !inner) return;
    
    elElena.innerHTML = `
      <div class="elena-dialogue" style="background:rgba(74,158,255,0.1);border-left:3px solid #4a9eff;padding:20px;border-radius:8px">
        <div style="font-size:2rem;margin-bottom:10px">👩‍💼</div>
        <div style="font-size:1rem;color:var(--t-primary);font-weight:600;margin-bottom:8px">Elena</div>
        <div style="font-size:0.95rem;color:var(--t-secondary);line-height:1.6">${__('ob_phase5_elena')}</div>
      </div>`;

    inner.innerHTML = `
      <div>
        <div class="ob-step-heading" style="font-size:1.8rem;font-weight:700;color:var(--t-primary);margin-bottom:8px">Tu Carrera de Prueba</div>
        <p class="ob-step-sub" style="color:var(--t-secondary);margin-bottom:20px">Circuito de exhibición • 3 vueltas • Sin puntos oficiales</p>
        
        <div style="background:rgba(232,41,42,0.05);border:1px solid #e8292a;padding:16px;border-radius:12px;margin-bottom:20px">
          <div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:12px">
            <div style="font-size:2rem">🏁</div>
            <div>
              <div style="font-weight:700;color:var(--t-primary)">Circuito: Muro de Boxes</div>
              <div style="font-size:0.85rem;color:var(--t-secondary);margin-top:4px">Carrera de 3 vueltas • Clima: Soleado</div>
            </div>
          </div>
        </div>

        <button class="btn btn-primary" id="race-btn-ob" style="width:100%;padding:16px;font-size:1rem">${__('ob_phase5_btn_race')}</button>
      </div>`;
    
    document.getElementById('ob-hint').textContent = 'Lee la telemetría y presiona el botón de "Ataque Máximo" para ganar.';
    document.getElementById('ob-next-btn').textContent = __('ob_continue');

    document.getElementById('race-btn-ob').onclick = () => {
      GL_UI.toast(`🏆 ¡Ganaste! ${__('ob_phase5_result_elena')}`, 'success');
      setTimeout(() => this.nextStep(), 800);
    };
  },

  renderPhase6() {
    // Welcome to the Empire (Liberation & Novice Missions)
    const elElena = document.getElementById('ob-elena');
    const inner = document.getElementById('ob-step-inner');
    
    if (!elElena || !inner) return;
    
    elElena.innerHTML = `
      <div class="elena-dialogue" style="background:rgba(74,158,255,0.1);border-left:3px solid #4a9eff;padding:20px;border-radius:8px">
        <div style="font-size:2rem;margin-bottom:10px">👩‍💼</div>
        <div style="font-size:1rem;color:var(--t-primary);font-weight:600;margin-bottom:8px">Elena</div>
        <div style="font-size:0.95rem;color:var(--t-secondary);line-height:1.6">${__('ob_phase6_elena')}</div>
      </div>`;

    inner.innerHTML = `
      <div>
        <div class="ob-step-heading" style="font-size:1.8rem;font-weight:700;color:var(--t-primary);margin-bottom:8px">¡Bienvenido a Motor Empire!</div>
        <p class="ob-step-sub" style="color:var(--t-secondary);margin-bottom:20px">Tu garaje está listo. Tus pilotos están listos. ¡Ahora a conquistar!</p>
        
        <div style="margin-top:20px">
          <div style="font-size:0.85rem;color:#888;text-transform:uppercase;margin-bottom:12px">Misiones de Novato</div>
          <div style="display:flex;flex-direction:column;gap:10px">
            <div style="background:rgba(255,255,255,0.05);border-left:3px solid #4a9eff;padding:12px;border-radius:6px">
              <div style="font-weight:600;color:var(--t-primary);margin-bottom:4px">📚 ${__('ob_phase6_mission1')}</div>
              <div style="font-size:0.8rem;color:var(--t-secondary)">Reward: +10,000 CR</div>
            </div>
            <div style="background:rgba(255,255,255,0.05);border-left:3px solid #4a9eff;padding:12px;border-radius:6px">
              <div style="font-weight:600;color:var(--t-primary);margin-bottom:4px">🔍 ${__('ob_phase6_mission2')}</div>
              <div style="font-size:0.8rem;color:var(--t-secondary)">Reward: +8,000 CR + 5 Fichas</div>
            </div>
            <div style="background:rgba(255,255,255,0.05);border-left:3px solid #4a9eff;padding:12px;border-radius:6px">
              <div style="font-weight:600;color:var(--t-primary);margin-bottom:4px">💰 ${__('ob_phase6_mission3')}</div>
              <div style="font-size:0.8rem;color:var(--t-secondary)">Reward: +5,000 CR</div>
            </div>
          </div>
        </div>
      </div>`;
    
    document.getElementById('ob-hint').textContent = 'Completa estas misiones para familiarizarte con el juego.';
    document.getElementById('ob-next-btn').textContent = '🚀 Entrar al Juego';
  },

  nextStep() {
    console.log('Next step clicked. Current step:', this.step);
    
    // Validate
    if (this.step === 0 && !this.data.name.trim()) { GL_UI.toast('Por favor introduce el nombre del equipo', 'warning'); return; }
    if (this.step === 0 && !this.data.country) { GL_UI.toast('Por favor selecciona un país base', 'warning'); return; }
    if (this.step === 2 && !this.data.pilotChosen) { GL_UI.toast('Por favor busca un piloto primero', 'warning'); return; }

    if (this.step >= this.totalSteps - 1) {
      console.log('Finalizing OB session...');
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
    state.team.engineSupplier = this.data.engineSupplier;
    state.team.reputation = 150;
    state.team.fans = 1250;
    state.meta.created = Date.now();

    // Pilots
    if (GL_DATA && GL_DATA.PILOT_POOL) {
      state.pilots = GL_DATA.PILOT_POOL.slice(0, 2).map(p => ({
        ...GL_STATE.deepClone(p),
        morale: 85,
        contractWeeks: 52,
        number: Math.floor(Math.random() * 89) + 11
      }));
    }

    // Engine cost
    const engData = this.ENGINES.find(e => e.id === this.data.engineSupplier);
    const engCost = engData ? engData.cost : 45000;
    let budget = 150000 - engCost;

    // HQ - Initial levels
    state.hq = { admin: 1, wind_tunnel: 1, rnd: 1, factory: 1, academy: 1 };
    state.construction = { active: false, buildingId: null, startTime: null, durationMs: null, targetLevel: null };

    // Starting budget with milestone rewards
    state.finances.credits = budget + 150000; // +150k bonus for completing onboarding
    state.finances.tokens = 50; // +50 tokens for progression

    state.season.phase = 'season';
    state.season.division = 8;

    // Sponsors - add one seed sponsor
    state.sponsors = [
      {
        id: 'veloce_seed',
        name: 'VELOCE Energy',
        logo: '⚡',
        income: 6000,
        duration: 10,
        weekStarted: 1,
        contractType: 'initial'
      }
    ];

    // Standings
    if (typeof GL_ENGINE !== 'undefined' && GL_ENGINE.buildInitialStandings) {
      state.standings = GL_ENGINE.buildInitialStandings(10);
    }

    GL_STATE.saveState();
  },

  finish() {
    GL_STATE.addLog(`¡Bienvenido a Motor Empire, ${GL_STATE.getState().team.name}! Tu viaje comienza ahora.`, 'good');
    GL_STATE.saveState();

    const ob = document.getElementById('onboarding-screen');
    ob.style.transition = 'opacity 0.5s ease';
    ob.style.opacity = '0';
    setTimeout(() => {
      ob.style.display = 'none';
      document.getElementById('app').style.display = 'grid';
      if (typeof GL_DASHBOARD !== 'undefined') GL_DASHBOARD.init();
      if (typeof GL_APP !== 'undefined') {
        GL_APP.buildTopbar();
        GL_APP.buildSidebar();
        GL_APP.navigateTo('dashboard');
      }
      GL_UI.toast(`¡Bienvenido ${GL_STATE.getState().team.name}! 🚀 Motor Empire te espera.`, 'success', 4000);
    }, 500);
  }
};

window.GL_OB = OB;
