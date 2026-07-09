# PLAN DE REVISIÓN TOTAL — Garage Legends
_Revisión 2026-07-09 · 5 frentes: diseño/balance, arquitectura cliente, backend/producción, visual/UX, congruencia docs↔código_

## Resumen ejecutivo

El proyecto está **funcionalmente sólido en su capa media** (design system real, responsive trabajado, tests de functions, reglas Firestore con intención anti-cheat), pero tiene **3 problemas estructurales** que generan casi todo lo demás:

1. **El motor está duplicado de verdad**: `js/engine.js` no usa `shared/engine-core.js` — es una **reimplementación** del loop de carrera con constantes distintas. `sync-shared.sh --check` pasa porque solo compara las 2 copias de `shared/`, no detecta esta divergencia. Cliente y servidor simulan juegos diferentes.
2. **El anti-cheat es evadible**: las reglas Firestore permiten al cliente escribir `role: 'admin'` y `mp.pendingCredits` en su propio perfil — los dos pilares de la seguridad (rol admin y economía server-only) caen.
3. **El juego vende cosas que no existen**: edificios HQ (hasta 1.5M CR), Academia L2-L5, y varios staff prometen bonos que el código nunca aplica. Junto al DNF roto de la IA (54% por carrera) y la agresividad sin costo, el balance está colapsado: ganar es casi automático y el dinero sobra desde D3.

---

## ERRORES A CORREGIR (por fases, orden = prioridad)

### FASE 0 — Seguridad crítica (antes que nada; prod está expuesta hoy) ✅ COMPLETADA 2026-07-09

| # | Sev | Dónde | Error |
|---|-----|-------|-------|
| 0.1 | 🔴 ALTA | `firestore.rules:103-110` | ~~**Escalada a admin desde el cliente.** Nada impide a un jugador escribir `role: 'admin'` en su propio `profiles/{uid}`; `isAdmin()` lee ese campo → acceso total a `divisions/`, `admin/` y funciones con check de rol. Fix: bloquear cambio de `role` con `diff().affectedKeys()`.~~ ✅ **RESUELTO** — `isSafeRoleWrite()` añadida: el write no-admin exige `role` idéntico al ya almacenado. |
| 0.2 | 🔴 ALTA | `firestore.rules:29-43,64-67` | ~~**Anti-cheat de créditos evadible en 2 writes.** El cliente puede escribir `mp.pendingCredits: 1e9` (paso 1) y luego subir sus créditos (paso 2): `isSafeEconomyWrite` valida contra el `mp` previo, que el propio cliente acaba de inflar. Fix: `mp.*` solo-escritura-servidor en reglas.~~ ✅ **RESUELTO** — `isSafeMpWrite()` añadida: `mp.pendingCredits`/`pendingTokens` entrantes deben ser `<=` al valor ya almacenado (el cliente solo consume/borra, nunca sube). |
| 0.3 | 🔴 ALTA | `js/dashboard.js:519`, `js/screens.js:4537` | ~~**XSS almacenado.** `s.teamName` (escrito por otros usuarios) y `car.name` se interpolan en `innerHTML` sin escapar. Un nombre de equipo `<img onerror=…>` se ejecuta en el navegador de todos los rivales. Fix: `escapeHtml` en todo `innerHTML` con datos de usuario.~~ ✅ **RESUELTO** — ambos envueltos en la `escapeHtml()` global existente. |

Detalle de la auditoría y del fix en `PENDIENTES.md` (sección 🐛 Bugs, entradas 2026-07-09).

### FASE 1 — Integridad de carrera y pipeline (servidor) ✅ COMPLETADA 2026-07-09

| # | Sev | Dónde | Error |
|---|-----|-------|-------|
| 1.1 | 🔴 ALTA | `functions/lib/race-runner.js:27,43` | ~~**Lock de carrera no atómico** (read-then-write fuera de transacción). Si `runScheduledRace` y `adminForceAllRaces` coinciden → doble ejecución de la ronda y **premios duplicados** (`increment` ×2). Fix: claim del lock en `db.runTransaction`.~~ ✅ **RESUELTO** — el check de fase/lock/próxima-carrera y el `raceInProgress: true` ahora ocurren dentro de un único `db.runTransaction`; dos llamadas concurrentes ya no pueden pasar ambas la comprobación. |
| 1.2 | 🔴 ALTA | `functions/index.js:16-44` | ~~`runScheduledRace` sin `runWith` → **timeout 60s por defecto** con bucle serial sobre todas las divisiones. A escala se corta a mitad (ejecución parcial). Fix: `runWith({timeoutSeconds:540})` + paralelizar como `adminForceAllRaces`.~~ ✅ **RESUELTO** — `runWith({timeoutSeconds:540, memory:'512MB'})` + paralelizado con `Promise.all` (mismo patrón que `adminForceAllRaces`). |
| 1.3 | 🔴 ALTA | `.github/workflows/deploy.yml` | ~~**El CI de prod solo deploya hosting.** Functions y `firestore.rules` van a mano → el repo puede divergir de lo que corre en `garagelegends-1` (los fixes de la Fase 0 no llegarían a prod por CI). Fix: añadir functions+rules al workflow (con `./sync-shared.sh` previo).~~ ✅ **RESUELTO** — añadidos pasos `./sync-shared.sh`, `deploy --only firestore:rules` y `deploy --only functions` al workflow de prod. ⚠️ No probado en un push real a `main` (requiere `secrets.FIREBASE_TOKEN` en CI) — verificar en el próximo deploy. |
| 1.4 | 🟡 MEDIA | `functions/index.js:164-174` | ~~`adminStartNewSeason` sin timeout extendido (60s) pese a crear divisiones/bots en serie → temporada medio-creada si corta.~~ ✅ **RESUELTO** — `runWith({timeoutSeconds:300})` (mismo valor que `adminForceSeasonAdvance`). |
| 1.5 | 🟡 MEDIA | `.github/workflows/deploy-dev.yml` | ~~Deploya functions **sin** `./sync-shared.sh --check` — puede subir la copia vieja de `shared/`.~~ ✅ **RESUELTO** — añadido paso `./sync-shared.sh --check` antes del deploy. |
| 1.6 | 🟡 MEDIA | `.firebaserc:5-15` | ~~Alias `dev` → proyecto `garagelegends-dev`, pero los hosting targets están definidos solo bajo `garagelegends-1`. Unificar.~~ ✅ **RESUELTO** — no existe un proyecto Firebase separado `garagelegends-dev` (los sitios `dani`/`juana`/`dev` son sitios de hosting adicionales *dentro* de `garagelegends-1`, que es donde `.firebaserc` define los targets). Cambiado el alias `dev` → `garagelegends-1`, y `deploy-dev.yml` ahora usa `--only hosting:dev` (target explícito) en vez de `--only hosting` a secas, para no arriesgarse a desplegar los 4 targets (incluido `main`=prod) desde el workflow de dev. |
| 1.7 | 🟢 BAJA | `functions/lib/season-manager.js:98-133` | ~~Reasignación de temporada: un `update` serial por jugador, sin batch ni tolerancia a fallo a mitad de lista.~~ ✅ **RESUELTO** — promovidos/descendidos/quedan-igual ahora se resuelven en un único paso: `db.getAll()` para confirmar existencia + `db.batch()` en lotes de 500 (mismo patrón que `inactivity.js`). Tests de functions (6/6) siguen en verde. |

### FASE 2 — Motor duplicado y sincronización cliente/servidor

| # | Sev | Dónde | Error |
|---|-----|-------|-------|
| 2.1 | 🔴 ALTA | `js/engine.js` vs `shared/engine-core.js` | **`engine.js` reimplementa el motor con constantes divergentes** (ej. desgaste `wearOveruse * 460` en cliente vs `* 1100` en core, `engine.js:2087` vs `engine-core.js:1059`). La validación server nunca reproducirá al cliente. Fix de fondo: que el cliente delegue en `GL_ENGINE_CORE` de verdad; mientras tanto, auditar y alinear constantes. |
| 2.2 | 🔴 ALTA | `shared/engine-core.js:1388` vs `js/data.js:220` | **Calendarios incompatibles**: core genera `min(8+(8−div),12)` carreras; el cliente (el `generateCalendar` de `data.js` que usa `endSeason`) genera siempre 8. El bug "resuelto" el 2026-06-22 sigue vivo por el otro lado. Decidir el número correcto y unificar. |
| 2.3 | 🟡 MEDIA | `functions/shared/data-constants.js` | **Copia huérfana trackeada en git** (solo se borró `engine-core.js` de esa carpeta). Nada la requiere y `sync-shared.sh` no la cubre — mismo patrón que causó el bug de junio. Borrar. |
| 2.4 | 🔴 ALTA | `js/screens.js:3905` | `runSimulation` sin guard de `_raceInProgress`: volver a `#race` y re-clicar lanza **2 loops rAF** → `finishRace()` ×2 → doble economía, doble semana, doble standings. |
| 2.5 | 🔴 ALTA | `js/auth.js:83-168,271-276` | **Doble aplicación de recompensas MP**: `ensureProfile` las aplica en memoria sin limpiar `mp.pending*` en Firestore; el listener las aplica otra vez → saldo inflado → write rechazado → reconciliación hacia abajo. El jugador ve créditos que suben y se recortan. |
| 2.6 | 🔴 ALTA | `js/auth.js:162,272` | El listener MP **nunca se desuscribe** en signOut/cambio de usuario y el guard impide crear el del nuevo usuario → recompensas dejan de aplicarse + listener zombi con permission-denied en bucle. |
| 2.7 | 🟡 MEDIA | `js/auth.js:265-266` | Llama a `GL_DASHBOARD.renderTopbar`/`GL_APP.refreshTopbar`, que **no existen** (son `updateTopbar`/`buildTopbar`) → topbar no refleja créditos tras recompensas. |
| 2.8 | 🟡 MEDIA | `js/screens.js:4552-4586` | La carrera en vivo otorga I+D con posiciones **interpoladas del HUD** y marca `awardedRounds`, bloqueando el award exacto del servidor. La fórmula está copiada en 4 sitios y ya diverge. |
| 2.9 | 🟡 MEDIA | `js/state.js:231-310` | `choosePreferredStateCandidate` prefiere el save "meaningful" sobre el timestamp → un save local viejo **resucita partidas reseteadas** desde otro dispositivo y se re-sube. Además persiste en localStorage antes de aplicar migraciones. |

### FASE 3 — Balance de juego

| # | Sev | Dónde | Error |
|---|-----|-------|-------|
| 3.1 | 🔴 ALTA | `engine-core.js:1127`, `engine.js:2157` | **DNF de la IA: ~54% por carrera** (1.2%/vuelta × 65 vueltas) → ~10 de 18 rivales abandonan; terminar ya es top-10. Bajar a ~0.15-0.2%/vuelta. |
| 3.2 | 🔴 ALTA | `engine-core.js:1055,1144` | **Agresividad = estrategia dominante**: +800 ms/vuelta a agg 100 (≈52 s/carrera) con costo casi nulo — los incidentes solo miran `riskLevel`. Meter agresividad en la prob. de incidente o bajar el beneficio a ~5 ms/punto. |
| 3.3 | 🔴 ALTA | `js/data.js:127-152`, `js/engine.js:268` | **HQ vende efectos inexistentes**: Túnel de Viento "+10…+75 Aero" (L5 = 1.5M CR), I+D "+Potencia", Fábrica "+Fiabilidad" — `getHqCapabilities` no aplica ninguno. Aplicarlos o reescribir los textos. |
| 3.4 | 🔴 ALTA | `js/academy.js:27` | `Academy.queueTraining` es **código muerto** (nadie lo llama). El único entrenamiento es `trainPilot`: gratis, 1/día. La Academia L2-L5 (90k→1.4M CR) no compra nada usable; ídem Coach (+25% desarrollo). |
| 3.5 | 🟡 MEDIA | `economy.js`, `screens.js:3090` | **Economía superior sin tensión**: sponsors escalan ×1→×13 por división, gastos casi planos → D1 ≈ +430k/sem sin sumidero; nadie quiebra nunca (créditos clampados a 0, castigo por déficit irrelevante). |
| 3.6 | 🟡 MEDIA | `engine-core.js:1054,582` | Ventaja oculta del jugador: multiplicador de ritmo 175 vs 160, coche AI escalado 0.82-1.04× del suyo, más ruido de vuelta para la IA. Sumado a 3.1, ascender D8→D1 es casi automático. |
| 3.7 | 🟢 BAJA | `engine.js:2358` | Premio P16 en D8 redondea a 0 y cae al fallback de 100 CR — incongruente con la tabla. |
| 3.8 | 🟢 BAJA | data/UI | `potential`, `morale`, `contractWeeks` se muestran y `potential` pesa 30% en el salario, pero no tienen ningún efecto de juego. Staff anunciado sin implementar: Ojeador, Médico (no hay lesiones), Ing. Jefe (+I+D). |

### FASE 4 — Visual / UX ⚠️ PARCIAL 2026-07-09 (ítems ALTA/BAJA y 2 de MEDIA resueltos; 4.4/4.5/4.9/4.10 quedan pendientes — barridos grandes, no mecánicos)

| # | Sev | Dónde | Error |
|---|-----|-------|-------|
| 4.1 | 🔴 ALTA | `css/dashboard.css:721-790` | ~~`.engine-selection-grid`, `.engine-card`, `.hq-progress-*` quedaron **dentro del `@media (max-width:768px)`** (abre en 647) → en escritorio se renderizan sin estilo. Sacarlos del media query.~~ ✅ **RESUELTO** — movidos fuera del media query, como bloque global antes de `/* ---- MOBILE ---- */`. |
| 4.2 | 🔴 ALTA | varios | ~~**5 variables CSS inexistentes**: `--c-primary`, `--br-lg`, `--bg-primary`, `--c-good`, `--c-warn` (correctos: `--c-accent`, `--r-lg`, `--c-bg`, `--c-green`, `--c-red`) → bordes transparentes, estados promoción/descenso sin color.~~ ✅ **RESUELTO** — corregidas todas las ocurrencias en `css/dashboard.css`, `js/admin.js`, `js/onboarding.js` y `js/dashboard.js` (verificado con grep, 0 restantes). |
| 4.3 | 🔴 ALTA | `js/onboarding.js:47`, `js/app.js:170` | ~~`GL_I18N.currentLang` **no existe** (es `.lang`) → países del onboarding siempre en inglés y reloj siempre `en-US`, aunque el juego esté en ES.~~ ✅ **RESUELTO** — ambos cambiados a `GL_I18N.lang`. |
| 4.4 | 🔴 ALTA | `screens.js`, `ui.js`, `admin.js` | **~140 strings fuera de i18n** — pendiente, barrido grande fuera del alcance de hoy (2026-07-09). |
| 4.5 | 🟡 MEDIA | `screens.js`, `app.js:181` | **Carrera de 30 min sin protección** (`beforeunload` + persistencia de playback) — pendiente, cambio de comportamiento no trivial fuera del alcance de hoy. |
| 4.6 | 🟡 MEDIA | `js/screens.js:3849-3850` | ~~Botones QA "REAL 30m / QA 2m" **visibles para cualquier jugador** en la cabecera de carrera.~~ ✅ **RESUELTO** — ambos botones ahora solo se renderizan si `GL_AUTH.isAdmin()`. |
| 4.7 | 🟡 MEDIA | `js/auth.js:327-339` | ~~Fallos de guardado remoto en sesión = solo `console.warn` — el usuario no se entera de que no está guardando en la nube.~~ ✅ **RESUELTO** — toast `warning` (throttlado a 1/60s) con la clave i18n ya existente `profile_cloud_sync_fail`. |
| 4.8 | 🟡 MEDIA | `js/screens.js:~4071`, `ui.js:16` | ~~Toast tipo `'good'` no existe (success/error/info/warning) → premio de carrera sale genérico.~~ ✅ **RESUELTO** — corregidas las 12 llamadas `GL_UI.toast(..., 'good')` en `app.js`/`dashboard.js`/`screens.js` a `'success'` (no se tocó `GL_STATE.addLog`/`events.push`, que son sistemas de tipos distintos donde `'good'` sí es válido). |
| 4.9 | 🟡 MEDIA | global | Accesibilidad — pendiente, barrido grande fuera del alcance de hoy. |
| 4.10 | 🟢 BAJA | `js/onboarding.js:106-127` | Wizard duplica con inline styles grises lo que onboarding.css ya define — pendiente (cosmético, no priorizado hoy). |
| 4.11 | 🟢 BAJA | `js/dashboard.js:58,359` | ~~`renderNextEvent` busca `#dash-next-event` que no existe → el botón "avanzar temporada" por esa vía es inalcanzable.~~ ✅ **RESUELTO** — cambiado a `#dash-circuit-preview` (el contenedor real ya presente en `renderSkeleton`, junto a standings). |
| 4.12 | 🟢 BAJA | `js/ui.js:6-13`, `index.html:106` | ~~Doble `#toast-container` (id duplicado).~~ ✅ **RESUELTO** — eliminado el `<div id="toast-container">` estático de `index.html` (nunca se consultaba por id; `ui.js` crea el suyo dinámicamente). |

### FASE 5 — Documentación y limpieza ⚠️ PARCIAL 2026-07-09

| # | Sev | Dónde | Error |
|---|-----|-------|-------|
| 5.1 | 🟡 MEDIA | `RACE_STRATEGY_PLAYBOOK.md` | ~~Describe un sistema de neumáticos que **ya no existe**...~~ ⚠️ **PARCIAL** — añadida cabecera de aviso "DESACTUALIZADO" con la lista de discrepancias y remisión a `shared/engine-core.js`. La reescritura completa del documento queda pendiente (requiere estudio profundo del motor, Fase 2). |
| 5.2 | 🟡 MEDIA | `DIVISION_TREE_DESIGN.md` | ~~Propuesta **nunca implementada tal cual**... sin marca de "propuesta vs implementado".~~ ✅ **RESUELTO** — añadida cabecera "PROPUESTA, no implementada tal cual" con remisión a los archivos reales (`js/divisions.js`, `shared/data-constants.js`, `season-manager.js`). |
| 5.3 | 🟡 MEDIA | `GAME_ARCHITECTURE_ANALYSIS.md` | ~~Híbrido confuso... Marcar HISTÓRICO.~~ ✅ **RESUELTO** — añadida cabecera "HISTÓRICO". |
| 5.4 | 🟢 BAJA | `SUPABASE_SETUP.md` | ~~Manda editar `js/supabase-config.js`, borrado el 2026-07-01. Archivar o borrar.~~ ✅ **RESUELTO** — movido a `docs/_archive/SUPABASE_SETUP.md` con cabecera "ARCHIVADO". |
| 5.5 | 🟢 BAJA | `docs/game-variables/` | ~~`RACE_FORMULAS_MATH.md` (soft −750) vs `_BALANCED.md` (−550, el vigente) sin nota de cuál manda. Ídem `RACE_IMPACT_NUMERIC_MATRIX*`.~~ ✅ **RESUELTO** — añadida nota en ambas versiones no-`_BALANCED` señalando que `_BALANCED` es la vigente. |
| 5.6 | 🟢 BAJA | `CLAUDE.md` (×2) | ~~Correcciones: expone `GL_SCREENS`... "rama de trabajo `Dani`"... "offline-first"...~~ ✅ **RESUELTO** — el `GL_SCREENS`/`GL_TRACKING` resultó ser un falso positivo (el CLAUDE.md de `Garagelegends/` ya decía `SCREENS`/`GL_TRACK` correctamente). Corregidos: el puntero de `04_Garage_legend/CLAUDE.md` (ya no dice "rama `Dani`", documenta que el trabajo es en `main`) y la nota "offline-first" (ahora aclara la excepción server-only de `deductCredits`/`deductTokens`). |
| 5.7 | 🟢 BAJA | `js/divisions.js:155-178`, `js/dashboard.js` | ⚠️ **PARCIAL** — ✅ eliminados los 4 stubs TODO de `divisions.js` (`getTeamsInDivision`, `startDivisionSeason`, `generateDivisionCalendar`, `endDivisionSeason`, 0 llamadas confirmadas) y ✅ `renderPilotMorale`/`renderSponsors` de `dashboard.js` (0 llamadas, apuntaban a `#dash-morale`/`#dash-sponsors` inexistentes). `renderAdvisorTelemetry` (~90 líneas + varios helpers encadenados) se deja pendiente: verificar que ninguno de sus helpers (`getAdvisorPolicyTimeline`, `updateAdvisorSuggestionTelemetry`, etc.) se usa desde otro flujo alcanzable requiere más estudio del que cabía hoy. `state.facilities` **no es código muerto** — se lee activamente en `dashboard.js:603,1782` como fallback; se deja tal cual. Extra (no listado originalmente): eliminada también `functions/shared/data-constants.js`, copia huérfana trackeada en git del mismo patrón que causó el bug de `engine-core.js` en junio (0 `require` la referenciaba). |

---

## MEJORAS RECOMENDADAS (no son bugs — inversión sugerida)

### Alto impacto
- **Un solo motor de verdad.** La raíz del 60% de los errores es la triple lógica (engine.js / engine-core.js / data.js). Migrar `engine.js` a consumir `GL_ENGINE_CORE` de verdad elimina la clase entera de bugs de divergencia (2.1, 2.2) y hace real la validación server.
- **Escalar gastos por división** (salarios ×multiplicador, mantenimiento proporcional) o añadir sumideros recurrentes (piezas, inscripción) — daría tensión económica a D1-D3 y, de paso, uso a la Academia si se le pone coste (arregla 3.4 y 3.5 juntos).
- **Consolidar paleta**: 133 hex distintos (89 en JS); mapear a los tokens existentes (`#e8292a`→`--c-accent`, verdes→`--c-green`, dorados→`--c-gold`). Mejor ratio esfuerzo/resultado visual.
- **Guardia de carrera en curso**: `beforeunload` + persistir resultado y `startTs` en localStorage para reanudar el playback tras recarga (el resultado ya está precalculado).
- **Barrido i18n** de los ~140 strings, empezando por estrategia/prerace y toasts de carrera.
- **Trocear `screens.js` (4.948 líneas)** en módulos (prerace, live-race, playback, postrace, garage, market) extrayendo un motor de playback común — hoy `renderLiveGrid`, `formatRemaining` y el loop rAF están duplicados dentro del propio archivo.

### Impacto medio
- **Batch/`getAll` en race-runner.js** (mismo patrón N+1 ya corregido en weeklyEconomy) + atomicidad del cierre de carrera (flag `rewardsApplied` por ronda para reintento idempotente).
- **Centralizar duraciones de carrera MP** en `game_constants.js` — hoy hay 3 juegos de constantes distintos (4/7/11m, 2/4/8m…).
- **`escapeHtml` único en ui.js** usado sistemáticamente (hoy hay 2 versiones que difieren en escapar `'`).
- **Indicador global "🔴 EN CARRERA"** en topbar mientras `_raceInProgress`, clicable.
- **Toast de error de sync** (con throttle) cuando `syncStatus` pase a error.
- **Documentar (o eliminar) los targets `dani`/`juana`**: sirven la config de PROD y comparten Firestore de prod — cero aislamiento real; si son espejos intencionales, dejarlo escrito.
- **Mover docs de la raíz a `docs/`** con encabezado de estado/fecha, y **archivar scripts one-off** ya aplicados (`fix-*`, `force-*`, `migrate-*`) en `scripts/_archive/` — todos cargan el service account y correrlos por error es destructivo.
- **Opción A de economía** (enrutar TODO ingreso por Cloud Function): hoy la reconciliación (opción B, 2026-07-09) descarta el ingreso local rechazado. Si 0.2 se cierra, la opción A se vuelve el estado final coherente.

### Impacto bajo
- Dar efecto a `potential` (cap de crecimiento en entrenamiento) — ya se cobra en el salario.
- Consecuencia real de déficit sostenido (embargo de fichajes) ya que no hay bancarrota.
- Subir `--t-tertiary` a ~`#6b7280`; ESC + foco en modales; reducir bottom-bar móvil a 5 ítems.
- Mover `'use strict'` de `engine.js:106` al inicio del archivo (hoy no es directiva).
- Quitar efectos secundarios de getters (`getResearchStatus` guarda estado durante un render).
- Rate-limit / agregación para `logUserEvent` y stats de admin (costo Firestore a futuro).

---

## Estado 2026-07-09 (sesión Merlin)

Resueltas hoy: **Fase 1 completa** (backend/CI) y **Fase 4/5 mayormente** (visual/UX y
docs — quedan 4.4 i18n, 4.5 guardia de carrera, 4.9 accesibilidad y 4.10, todos barridos
grandes fuera del alcance de la sesión). **Fase 2 (motor duplicado) y Fase 3 (balance)
siguen sin tocar** — requieren decisiones de diseño de Daniel (ver dudas al final del
documento) antes de tocar código. `PENDIENTES.md` tiene el detalle fila por fila.

## Orden de ataque sugerido

1. **Fase 0 completa + 1.1 + 1.3** en un solo lote (seguridad + que el deploy de reglas/functions salga por CI). Deploy a prod el mismo día.
2. **Fase 2** (motor + sync cliente/servidor): empezar por 2.4-2.7 (fixes puntuales) y planificar 2.1 (unificación del motor) como trabajo mayor aparte.
3. **Fase 4.1-4.4** (CSS roto + currentLang): baratos y muy visibles.
4. **Fase 3** (balance): requiere decisiones de diseño de Daniel (¿HQ aplica stats o cambia el texto? ¿carreras por temporada: 8 fijas o 8-12?). Sesión propia.
5. **Fase 5 + mejoras** según hueco.

_Dudas que solo Daniel puede resolver: nº de carreras por temporada (2.2), HQ aplica bonos vs reescribir textos (3.3), destino de targets dani/juana, opción A de economía._
