# PENDIENTES — 04_Garage_legend
_Auditoría 2026-06-18_

Proyecto auditado: juego web (Vanilla JS, sin bundler) sobre Firebase Hosting + Firestore + Cloud Functions. Código en `Garagelegends/`. La arquitectura de seguridad es notablemente sólida: las reglas de Firestore validan economía/HQ/coche server-side, las compras pasan por funciones atómicas (`deductCredits`/`deductTokens`) con transacciones, y los endpoints admin verifican rol `admin`. No se detectaron secretos reales expuestos (las claves Firebase web y la `anonKey`/publishable de Supabase son públicas por diseño; el service account está gitignored y NO está commiteado).

## 🐛 Bugs

- ~~**[media]** `Garagelegends/shared/engine-core.js:1388` vs `Garagelegends/functions/lib/shared/engine-core.js:1388` — Divergencia cliente/servidor en `generateCalendar`. El cliente calcula el número de carreras de la temporada como `Math.min(8 + (8 - division), 12)` (8 en D8, hasta 12 en divisiones altas), pero la copia que realmente ejecutan las Cloud Functions usa `var count = 8` fijo. Resultado: en divisiones altas el cliente puede mostrar/asumir un calendario de hasta 12 carreras mientras el servidor solo corre 8. La existencia de scripts `fix-calendar-8races.js` y `force-pending-races*.js` sugiere que este desajuste ya causó incidencias en producción. → Unificar la fórmula en ambas copias (o, mejor, eliminar la duplicación, ver Mejoras).~~ ✅ **RESUELTO 2026-06-22** — `functions/lib/shared/engine-core.js:1388` cambiado de `var count = 8` a `var count = Math.min(8 + (8 - division), 12)` para alinearlo con el cliente.

- **[baja]** `Garagelegends/js/state.js` (`addCredits`/`addTokens`) — Suman créditos/tokens en memoria y llaman `saveState()`, que sincroniza a Firestore. Las reglas (`isSafeEconomyWrite`) rechazan cualquier incremento de créditos/tokens por encima de `mp.pendingCredits` (que solo escribe el servidor). Si algún flujo de premio/recompensa usa `addCredits` localmente sin que el servidor haya fijado antes `pendingCredits`, ese write fallará silenciosamente y el saldo local divergirá del remoto hasta el próximo refresh. → Confirmar que todo ingreso pasa por servidor (ver Dudas) y, si no, manejar el error de write rechazado en `saveState`.

## ⚠️ Incoherencias / riesgos

- ~~**[media]** `Garagelegends/functions/shared/engine-core.js` — Copia HUÉRFANA y desincronizada del motor. Nada la requiere (todas las funciones hacen `require('./shared/...')` desde `functions/lib/`, que resuelve a `functions/lib/shared/`). Esta copia tiene valores de degradación de neumáticos distintos (0.55/0.38/0.18 frente a 0.65/0.50/0.38 en cliente y en la copia real del servidor) y otros campos. Es código muerto que confunde y puede llevar a editar el archivo equivocado. → Borrar `functions/shared/` o convertir las tres copias en una sola fuente.~~ ✅ **RESUELTO 2026-06-22** — `functions/shared/engine-core.js` eliminado. Confirmado dead code: ningún `require` lo importaba (todos apuntan a `functions/lib/shared/`).

- ~~**[media]** Triplicación de `shared/engine-core.js` (3 copias: `shared/`, `functions/shared/`, `functions/lib/shared/`). `data-constants.js` sí está idéntico en las 3, pero `engine-core.js` ya divergió. El CLAUDE.md dice "cualquier lógica compartida debe ir en `shared/` para evitar duplicación", pero el mecanismo real es copiar el archivo a mano a varias rutas, lo que es precisamente la fuente de la divergencia del bug anterior. → Establecer una única fuente y un paso de copia/sincronización (script o symlink) en lugar de mantener copias manuales.~~ ✅ **RESUELTO 2026-06-22** — Eliminada la copia huérfana `functions/shared/`. Quedan 2 copias activas (`shared/` canónico + `functions/lib/shared/`). CLAUDE.md actualizado documentando cuál es el canónico y que hay que copiar manualmente antes de deploy de funciones.

- ~~**[baja]** `Garagelegends/js/onboarding-old.js` — Código muerto: el archivo existe (429 líneas) pero no se referencia en `index.html` ni en ningún otro `.js`. → Eliminar.~~ ✅ **RESUELTO 2026-06-22** — Archivo eliminado. Confirmado: cero referencias en todo el proyecto.

- **[baja]** ~~`Garagelegends/js/supabase-config.js` y~~ `Garagelegends/js/firebase-config.dev.js` — No se cargan desde `index.html` (solo se carga `firebase-config.js`). ~~El de Supabase es residuo documentado de la migración abandonada;~~ el `.dev` se asume que se intercambia durante el deploy dev. → ~~Borrar el de Supabase;~~ documentar/automatizar el swap del `.dev` para que no quede ambiguo. ✅ **RESUELTO 2026-07-01** — borrado, 0 referencias en index.html/*.js

- ~~**[baja]** `Garagelegends/js/economy.js` (`processWeeklyBalance`, `handleDeficitStatus`) — El CLAUDE.md afirma que `Economy` "No muta el estado — solo calcula", pero estas funciones SÍ mutan `state.finances.*` y `state.team.fans`. Las funciones `calculateTeam*Breakdown` sí son puras, pero la afirmación general del doc es incorrecta. → Corregir el docstring/CLAUDE.md o separar cálculo puro de mutación.~~ ✅ **RESUELTO 2026-06-22** — CLAUDE.md corregido: `calculateTeamIncomeBreakdown`/`calculateTeamExpenseBreakdown` son puras; `processWeeklyBalance` y `handleDeficitStatus` sí mutan `state.finances.*` y `state.team.fans`.

## ✨ Mejoras

- ~~**[media]** Eliminar la triplicación de `shared/` mediante un único origen + script de build/copy.~~ ✅ **RESUELTO 2026-06-28** — Creado `Garagelegends/sync-shared.sh`: copia `shared/*.js` → `functions/lib/shared/` con diff de cambios, soporte `--dry-run` y salida clara. Ejecutar antes de `firebase deploy --only functions`.

- **[baja]** `Garagelegends/functions/index.js` — Las funciones programadas (`runScheduledRace`, `weeklyEconomy`) y `adminForceAllRaces` iteran divisiones en serie con `await` dentro de bucles `for...of` y consultas N+1 (p.ej. una query `strategies` por jugador en `weeklyEconomy`). Con 52 divisiones esto puede acercarse al timeout. → Considerar batching/paralelizar con `Promise.all` por lotes y/o denormalizar `lastActiveAt`.

- **[baja]** `Garagelegends/js/state.js` (`spendCredits`/`spendTokens`) — El manejo de error mapea solo `failed-precondition` y `unauthenticated`; cualquier otro error de red devuelve "Sin conexión" aunque sea otra causa. Aceptable, pero podría loggear `err.code` real para depurar.

- **[baja]** Portabilidad: hay numerosos `desktop.ini` (metadata de Windows Explorer) repartidos por el árbol. Ya están en `.gitignore`, pero conviene confirmar que no se suben (no aparecen en `git ls-files`). Sin impacto funcional.

## ❓ Dudas / a confirmar con el usuario

1. ¿Cuál es el número de carreras "correcto" por temporada: el del cliente (8–12 según división) o el del servidor (8 fijo)? Hay que decidirlo y unificar las copias de `engine-core.js`.
2. ¿La copia `functions/shared/engine-core.js` (huérfana y desincronizada) se puede borrar sin riesgo, o algún deploy/script la usa que no aparece en los `require`?
3. ¿Todos los ingresos de créditos/tokens del jugador (premios de carrera, sponsors, etc.) pasan por el servidor que fija `mp.pendingCredits` antes de que el cliente haga `saveState()`? Si no, algunos writes de incremento están siendo rechazados silenciosamente por las reglas.
4. ¿`firebase-config.dev.js` se intercambia automáticamente en el pipeline de deploy `dev`, o se hace a mano? (Para documentarlo y evitar deploys de dev apuntando a prod.)
