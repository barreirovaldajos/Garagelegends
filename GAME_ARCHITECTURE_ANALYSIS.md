# ---
# RESUMEN DE FASE 2 - PROGRESO (MARZO 2026)
## ✅ Completado: Sistema I+D Funcional

- Implementados 4 árboles de investigación: Aceleración (⚡), Potencia (💪), Fiabilidad (🛡️), Clima (🌧️)
- Cada árbol nivela del 1 al 20 con costos y duraciones aumentantes
- Procesamiento semanal automático de investigación activa en weeklyTick
- Bonificaciones aplicadas a componentes del coche al completar investigación
- Persistencia del progreso de investigación
- Reseteo de I+D automático en ascensos/descensos de división

## ✅ Completado: HQ con capacidades reales

- Administración aplica bonus real a ingresos de sponsors por nivel
- Coste semanal de mantenimiento HQ calculado por nivel de cada edificio
- Academia limita entrenamientos simultáneos y acelera tiempos según nivel
- Centro de I+D ahora exige requisitos de HQ para investigar
- Túnel de viento desbloquea investigación de clima
- UI de I+D operativa con inicio de investigación y progreso

## ✅ Completado: Circuitos y clima dinámicos (motor de carrera)

- La simulación ahora aplica perfil por tipo de circuito (high-speed, power, technical, mixed, endurance)
- Ritmo base, riesgo, degradación y probabilidad de adelantamiento cambian según layout
- Clima puede cambiar durante la carrera (lluvia/seco) con impacto directo en riesgo y neumáticos
- Total de vueltas de simulación ajustado por layout
- UI de carrera usa el total de vueltas real de cada simulación

## ✅ Completado: Intervenciones tácticas en carrera

- Se añadieron 2 ventanas de intervención configurables por porcentaje de carrera
- Cada intervención puede cambiar el modo de motor (ECO/NORMAL/PUSH)
- Los cambios aplican impacto real en ritmo, riesgo y degradación
- Integración con estrategia guardada pre-race y visualización en race screen
- Los eventos de carrera registran cuándo se ejecuta cada intervención táctica

## ✅ Completado: Pit strategy avanzada

- Soporte real para plan de pit: single stop, double stop y adaptive
- Reacción estratégica a safety car: neutral, undercut, overcut
- Ajuste dinámico de próxima parada según intervención y contexto de carrera
- UI pre-race ampliada con configuración de plan de pit y reacción VSC
- Resumen de estrategia en race screen con plan de pit y SC reaction activos

## ✅ Completado: Staff impact en decisiones de carrera

- Race Engineer / Head of Pits / Chief Engineer / Data Analyst ahora afectan ejecución táctica
- Mejor staff reduce riesgo de errores en boxes y mejora probabilidad de pit limpio
- Under/overcut bajo safety car tiene eficacia dependiente del staff
- Staff técnico reduce riesgo de incidentes durante stint
- Staff de setup mejora probabilidad de adelantamiento y ritmo base
- Race screen muestra métricas de calidad de pit y control de riesgo por staff

## ✅ Completado: Forecast por ventanas + setup adaptativo

- Calendario ahora genera forecast por ventanas (start/mid/end) con nivel de confianza
- La incertidumbre del forecast afecta probabilidad de cambios climáticos en carrera
- Pre-race incluye setup de coche: Aero Balance y Weather Bias
- El setup modifica ritmo, riesgo y degradación según circuito y clima real
- Race screen muestra configuración de setup activa y previsión relevante

## ✅ Completado: Forecast updates temporales

- El forecast se actualiza automáticamente al abrir pre-race según horas restantes a la próxima carrera
- Se introducen tramos de confianza (lejos/media/cerca/inminente) con convergencia progresiva
- La incertidumbre disminuye al acercarse la carrera, reduciendo jitter del pronóstico
- El sistema evita re-roll constante usando buckets temporales persistidos

## ✅ Completado: Recomendador táctico automático

- Nuevo recomendador de estrategia basado en forecast, circuito y perfil de staff
- Genera sugerencia completa: compuesto, pit plan, SC reaction, setup e intervenciones
- Pre-race incluye panel de recomendación con razones y botón de "Apply Recommendation"
- Estrategia pre-race ya no se resetea en cada render: reutiliza estrategia guardada/actual

## ✅ Completado: Advisor adaptativo (aprendizaje continuo)

- Estado persistente de advisor añadido para guardar memoria táctica histórica
- El sistema registra resultados reales post-carrera (posición, puntos, mejora y estrategia usada)
- Se agregan estadísticas por layout+clima para ajustar recomendaciones futuras
- Las sesiones de práctica también alimentan la señal adaptativa del advisor
- El recomendador ahora mezcla forecast/staff con memoria histórica de rendimiento

## ✅ Completado: Confianza del advisor en pre-race

- El recomendador calcula confianza cuantitativa basada en muestras y rendimiento histórico
- Se exponen métricas: confidence %, level (low/medium/high), samples y key de contexto
- El panel de recomendación en pre-race muestra claramente cuándo confiar más o menos
- Las razones de la recomendación incluyen la confianza del advisor para transparencia

## ✅ Completado: Cold start guardrails

- Si la confianza del advisor es baja, se aplican límites automáticos de riesgo/agresividad
- Recomendaciones de alto riesgo se estabilizan (modo motor y plan de pit más seguros)
- El panel pre-race indica cuando los guardrails están activos
- Se añade botón "Apply Safe Variant" para forzar una estrategia conservadora explícita

## ✅ Completado: Advisor A/B modes

- Se agrega modo configurable del advisor: conservative, balanced, aggressive
- Cada modo altera sesgo de recomendación (agresividad, riesgo, motor, plan de pit)
- Los guardrails usan umbral dinámico por modo (más estricto en conservative, más flexible en aggressive)
- Pre-race permite cambiar modo del advisor en tiempo real y recalcular recomendación

## ✅ Completado: Telemetría del advisor por modo

- Se registra por carrera la fuente de estrategia aplicada: recommended, safe o manual
- Se agregan métricas acumuladas por modo (races, avg points, podium rate, dnf rate)
- El motor expone `getAdvisorTelemetry()` para visualización y ajuste de balance
- El panel de recomendación en pre-race muestra rendimiento histórico del modo activo

## ✅ Completado: Comparador de modos + auto-sugerencia

- Dashboard incorpora panel dedicado de advisor con comparativa conservative/balanced/aggressive
- Se muestran por modo: carreras, promedio de puntos, tasa de podio y tasa de DNF
- Se añade tendencia de corto plazo por modo (ultimas 5 carreras) para lectura rapida de forma
- Sistema detecta modo alternativo con mejor rendimiento usando señal hibrida (historico + forma reciente)
- El panel incluye leyenda de escala para interpretar rapidamente la tendencia ▁..▇
- Se agrega cooldown persistente de sugerencias para evitar cambios de modo en semanas consecutivas
- Telemetria de sugerencias ampliada: mostradas, aplicadas e ignoradas (persistente)
- Dashboard incorpora tasa de adopcion de sugerencias (applied/shown)
- Dashboard incorpora adopcion por modo (C/B/A) para evaluar sesgo de recomendaciones
- Adopcion por modo ahora incluye porcentaje y resaltado visual del mejor modo
- Sugerencias basadas en tasa de adopcion: si un modo muestra >= 70% adopcion y modo activo < 65%, se recomienda automáticamente
- Sistema dual de sugerencias: rendimiento-based (delta de puntos) + adoption-based (tasa de adopcion)
- Sugerencias muestran razon de origen: "performance suggests" vs "your data shows highest success"
- Se agrega historial de adopcion (ultimas 10 decisiones) con sparkline para ver consistencia reciente
- Dashboard ahora muestra mix por origen (performance/adoption) y aceptacion por origen en ventana reciente
- Comparador por origen ahora usa umbral minimo de muestras para marcar "best" y muestra alerta de baja confianza
- Panel advisor añade selector de ventana (5/10/20 decisiones) para analizar corto y mediano plazo
- Panel advisor incorpora comparador temporal de aceptacion (ventana actual vs ventana previa) con delta en pp
- Panel advisor incorpora semaforo de tendencia (mejorando/estable/empeorando) basado en umbrales de delta
- Telemetria de rechazo enriquecida: desglose de ignoradas por expiracion vs sobrescritura manual
- Advisor genera nota accionable segun patron de rechazo (expiracion dominante, override dominante o balanceado)
- Nota accionable incorpora botones one-click que ajustan politica de sugerencias (cooldown/umbrales) con persistencia
- Se añade boton one-click para restaurar politica por defecto (cooldown y umbrales) y facilitar iteracion segura
- Dashboard expone snapshot de politica activa (cooldown + umbrales S/R/P) para transparencia operativa
- Se añaden presets one-click de politica (conservative/balanced/aggressive) con perfil activo persistente
- Se añade historial persistente de cambios de politica (auditoria) con ultimo cambio visible en dashboard
- Dashboard muestra timeline corto (ultimos 5 cambios) de politica para trazabilidad rapida
- Timeline de politica incorpora accion one-click para copiar/exportar resumen al portapapeles
- Se añade auto baseline recomendado por telemetria (one-click) para recuperar politica optima rapidamente
- Acción one-click para aplicar modo sugerido desde dashboard/recomendaciones
- Se añade ventana de bloqueo temporal para cambios de politica, evitando ajustes demasiado frecuentes
- Panel advisor incorpora indicador de salud de datos (muestras de carreras/sugerencias/decisiones)
- Se añade accion de mantenimiento para archivar y resetear historial visible de telemetria del advisor
- Se agrega smoke-test tecnico del advisor (13 casos: cooldown, lock, ventana, salud, ignore-reasons, validacion)
- Se endurece cierre de temporada: snapshot historico, transicion offseason->season y ascenso/descenso por configuracion de division
- Economia semanal endurecida: ingreso/gasto unificados, racha de deficit con penalizaciones y señales de recuperacion
- Offline catch-up endurecido: simulacion por ventana temporal (4h/24h/7d), carreras/practicas coherentes y resumen agregado
- UX financiera mejorada: visibilidad de racha de deficit/estado critico en dashboard y pantalla de finanzas
- Se implementa objetivo de campaña por fases (F1/F2/F3) con recompensas, tracking persistente y visibilidad en dashboard
- Se añade panel de Campaign Progress en Standings con objetivo activo e historial reciente de hitos completados
- Se añade Season Summary modal post-transicion con resultado de division, bonus de temporada y estado del objetivo de campaña
- Standings incorpora acceso rapido para reabrir el ultimo Season Summary sin esperar un nuevo rollover
- Se agrega suite `core-loop-smoke-tests` (4 casos) para transicion de temporada, campaña y ventanas offline
- Se corrige bug en `simulateRace` por indice de jugador fuera de scope al calcular DNF/final
- Se expande `core-loop-smoke-tests` a 9 casos cubriendo bordes de ascenso/descenso y campaña fase2/fase3/fallo
- Standings pasa a ser hub de progresion MVP: historial navegable de temporadas + Hall of Fame con hitos clave
- Economia base ajustada para evitar deficit estructural de arranque: subsidio visible de liga + upkeep HQ inicial mas suave

---
# RESUMÉN DE FASE 2 (MARZO 2026)

## ✅ Modularización y hooks MMO/social

- Se crearon módulos independientes: economy.js, academy.js, divisions.js
- engine.js y state.js refactorizados para exponer hooks y lógica modular
- Progresión de pilotos y scouting semanal implementados y persistentes
- Preparados hooks para MMO/social: facciones, ayuda, eventos globales
- Ligas dinámicas y estructura de divisiones inicial integrada

## Próximos pasos sugeridos

- Implementar ciclo temporal claro (season, week, ascensos)
- Economía semanal automática para todos los equipos
- I+D funcional y árbol de investigación
- Mejorar dashboard y visualización de progresión
- Integrar HQ con capacidades reales
- Pulir sistema de carreras y circuitos

---
# 🔍 ANÁLISIS CRÍTICO: Garage Legends - Arquitectura del Juego

**Fecha:** 27 de Marzo 2026  
**Estado Actual:** MVP Prototype  
**Conclusión:** El juego tiene fundamentos buenos pero arquitectura fragmentada. Requiere refactorización estructural.

---

## 📋 PROBLEMAS ESTRUCTURALES IDENTIFICADOS

### **1. CICLO TEMPORAL CONFUSO** 🔴 CRÍTICO

**Problema:**
- Documento dice: "Temporada = 1 mes real" (10 carreras)
- Estado actual: `season.week` (1-52?) pero no hay claridad sobre cuándo es "una temporada"
- Garage Legends requiere: **Estructura temporal binaria clara**

**Consecuencia:**
- ¿Cuándo llega el Reseteo Tecnológico de ascensos?
- ¿Cuándo se cierran patrocinios?
- ¿Cuándo expiran contratos de pilotos?
- Sistema de ligas es prácticamente inexistente

**Cambio Propuesto:** 
```
ESTRUCTURA TEMPORAL CORRECTA:
├─ Season (4 semanas reales = 1 mes)
│  ├─ Week 1-4: Competición
│  ├─ Cada Week = 2 carreras (Gran Premio 1 Midweek, Gran Premio 2 Weekend)
│  ├─ Ascenso/Descenso: Fin de Season (automático)
│  └─ Total por Season: 8 carreras (10 en doc, reducir a 8 es mejor)
├─ Division System (Ligas Efectivas)
│  ├─ Div 10 (Novatos) → Div 1 (Élite)
│  ├─ 10 equipos por División (20 autos en pista)
│  ├─ Ascenso: Top 2 promocionan
│  ├─ Descenso: Bottom 2 descienden
│  └─ Team B: Desbloquea en Div 3
└─ Offseason (entre seasons)
   ├─ Contrataciones de staff
   ├─ Renovaciones de patrocinadores
   └─ Reseteo tecnológico
```

---

### **2. ECONOMÍA DEL JUEGO ROTA** 🔴 CRÍTICO

**Problema:**
- Estado: `finances.weeklyIncome` y `finances.weeklyExpenses` existen pero **no se procesan automáticamente**
- El documento requiere: "Balance se ejecuta 1 vez por semana de forma automática"
- Actual: Los créditos aparecen mágicamente en el onboarding

**Concepto Faltante:**
```
SISTEMA ECONÓMICO REAL REQUERIDO:

1. Income Stream:
   ├─ Sponsors (variable por sponsor)
   ├─ Merchandising (basado en fans + posición)
   └─ Bonos de resultado (Top 3 finishes)

2. Expense Stream:
   ├─ Salarios de Pilotos (configurables, semanales)
   ├─ Salarios de Staff (por rol)
   ├─ Mantenimiento de HQ (por nivel de edificio)
   ├─ Construcción (gasto inicial de CR)
   └─ Investigación (gasto de CR por proyecto)

3. Ciclo Semanal (Cada Monday 00:00 UTC):
   ├─ Calcula ingresos totales
   ├─ Calcula gastos totales
   ├─ Si balance < 0:
   │  ├─ Morale cae 15%
   │  ├─ Rendimiento en carrera -10%
   │  └─ Log CRITICAL ALERT
   ├─ Si balance > 0:
   │  └─ Reputación sube 2%
   └─ Guarda en history[]

4. Déficit Permanente:
   ├─ 3 weeks seguidas con balance negativo = GAME OVER
   └─ Necesita "bailout" o venta de activos
```

**Cambio Propuesto:** 
Implementar motor de economía semanal automático en `engine.js` que:
- Se ejecute cada Monday 00:00 UTC
- Procese ingresos/gastos de TODOS los equipos (MMO - ligas dinámicas)
- Genere eventos económicos (crisis de patrocinio, ofertas de transferencia, etc.)

---

### **3. SISTEMA DE PILOTOS SUPERFICIAL** 🔴 CRÍTICO

**Problema:**
- Estado: Pilotos son objetos planos con atributos pero sin **progresión real**
- Documento requiere:
  - "Draft Semanal" (garantizado 1 vez/semana)
  - Atributos mejorables en Academia (consume tiempo real)
  - Staff mecánicos/ingenieros que afecten desarrollo
- Actual: Pilotos existen pero son estáticos

**Concepto Faltante:**
```
DESARROLLO DINÁMICO DE PILOTOS:

Attributos que crecen con tiempo:
├─ Reflex (ej: 55 → mejora máx +1 por semana de entrenamiento)
├─ Overtaking (mejora en carrera, especialmente si ganan)
├─ Tyre Management (mejora con uso)
├─ Rain (mejora si corre bajo lluvia)
├─ Mental (sube si equipo tiene éxito, baja si no)
└─ Charisma (afecta sponsors y fans)

Draft Scouting Semanal:
├─ GRATUITO 1 vez por semana automático
├─ Pool dinámico de candidatos (rarity: Common, Rare, Epic, Legendary)
├─ Puede usarse Tokens ME para un draft extra
└─ Raros mejoran con edad/experiencia

Carrera vs Entrenamiento:
├─ Entrenar = consume tiempo real (30min - 2h)
├─ Mejora +1-3 atributos específicos
├─ Posibilidad de lesión (0.5%)
├─ Cuesta dinero (payroll)
```

**Cambio Propuesto:**
- Implementar `academyTrainingQueue[]` con temporizadores
- Crear algoritmo de Draft Pool semanal
- Agregar estadísticas de carrera que mejoran naturally

---

### **4. SISTEMA I+D FANTASMA** 🔴 CRÍTICO

**Problema:**
- Estado: `car.rnd = { points: 0, active: null, queue: [] }` existe pero no funciona
- Documento requiere:
  - "4 ramas" (Aceleración, Potencia, Fiabilidad, Clima)
  - Reseteo a cero en ascensos
  - Investigación consume tiempo real + CR
- Actual: No hay implementación funcional

**Concepto Faltante:**
```
R&D TREE SYSTEM REQUERIDO:

Estructura de investigación:
├─ Acceleration Tree (mejora aceleración 0-100)
│  ├─ Lv 1-10: Cada lv = +2 aceleración
│  ├─ Costo: 5,000 CR + 5 días
│  └─ Requiere: Factory Lv 2
├─ Power Tree (mejora potencia máxima)
│  ├─ Lv 1-10: Cada lv = +2 potencia
│  ├─ Costo: 8,000 CR + 7 días
│  └─ Requiere: R&D Centre Lv 2
├─ Reliability Tree
│  ├─ Reduce fallos: -0.5% por lv
│  ├─ Costo: 6,000 CR + 6 días
│  └─ Requiere: Factory Lv 3
└─ Weather Tree
   ├─ Mejora en lluvia/calor
   ├─ Costo: 7,000 CR + 7 días
   └─ Requiere: Wind Tunnel Lv 2

Motor DNA Aplica Siempre:
├─ Vulcan: -20% tiempos TODOS los árboles
├─ Titan: -50% costo Reliability
├─ Aero-V: -30% tiempos Weather Tree
└─ etc.

Reseteo en Ascenso:
├─ Todos los árboles → Lv 0
├─ Se debloquean nuevos niveles (11-20)
└─ Nuevo motor disponible (caro)
```

**Cambio Propuesto:**
- Crear árbol visual de investigación
- Implementar temporizadores de investigación
- Agregar validaciones de requisitos

---

### **5. GESTIÓN DE HQ INCOMPLETA** 🟡 ALTA

**Problema:**
- Estado: 5 edificios en HQ, pero cada uno no tiene **propósito estratégico claro**
- Documento requiere: Cada edificio mejorado debe **desbloquear capacidades**
- Actual: Los edificios mejoran pero no sabemos qué consiguen

**Concepto Faltante:**
```
HQ BUILDINGS - CAPACIDADES REALES:

Admin Office (Administración):
├─ Lv 1: Base financiera
├─ Lv 2: +10% ingresos de sponsors
├─ Lv 3: Nuevo sponsor disponible/semana
├─ Lv 5: Gestión de crisis económicas (¿defer pagos?)
└─ Lv 10: IPO (ganancias pasivas)

Factory (Fábrica):
├─ Lv 1: Construye componentes básicos
├─ Lv 2: Desbloquea árbol Acceleration R&D
├─ Lv 3: Permite construcción paralela de 2 componentes
├─ Lv 5: Descuentos en costos de construcción (-15%)
└─ Lv 10: Automatización (construcción continua sin pausa)

R&D Centre (Centro de I+D):
├─ Lv 1: Acceso básico a árboles
├─ Lv 2: Desbloquea Power Tree
├─ Lv 3: +25% velocidad I+D
├─ Lv 5: Research points por carreras (+1 por top 5)
└─ Lv 10: Nuevos componentes futuros (hybrid, IA)

Wind Tunnel (Túnel de Viento):
├─ Lv 1: Acceso aero básico
├─ Lv 2: Desbloquea Weather Tree
├─ Lv 3: Simulaciones más precisas (+5% ventaja en lluvia)
├─ Lv 5: +10% aerodinamica en todas las mejoras
└─ Lv 10: Acceso a tracks futuros (circuitos especiales)

Academy (Academia):
├─ Lv 1: Entrenamientos básicos
├─ Lv 2: +10% velocidad de mejora de pilotos
├─ Lv 3: Permite 2 entrenamientos simultaneos
├─ Lv 5: Menores riesgo de lesión (-50%)
├─ Lv 10: Génesis de talento (genera joven promesa cada 2 weeks)
```

**Cambio Propuesto:**
- Crear matriz HQ Level → Capacidades
- Mostrar visualmente qué se desbloquea en cada nivel
- Implementar validaciones (no puedes investigar si R&D < Lv2)

---

### **6. SISTEMA DE CARRERAS VACÍO** 🟡 ALTA

**Problema:**
- Motor de carreras existe pero:
  - No hay **variabilidad de circuitos** reales
  - "Muro de Boxes" es el único circuito
  - No hay **decisiones tácticas reales** durante la carrera
  - Estrategia es solo 4 sliders (tyre, aggression, pitLap, riskLevel)
- Documento requiere: "Decisiones tácticas de ritmo y paradas en boxes"

**Concepto Faltante:**
```
CARRERAS DINÁMICAS REALES:

Circuitos en Rotación (por División):
├─ Div 8-7: Muro de Boxes, Pista Verde, Circuito Rápido (3 tracks)
├─ Div 6-5: +2 tracks nuevos
├─ Div 4-3: +2 tracks nuevos
├─ Div 2-1: Todos disponibles (10 tracks real)
└─ Características únicas:
   ├─ Muro de Boxes: Curvas cerradas, neumáticos críticos
   ├─ Pista Verde: Alta velocidad, fiabilidad crítica
   └─ Circuito Rápido: Lluvia frecuente, aero importante

Clima Dinámico:
├─ Precisión aumenta conforme se acerca la carrera
├─ 7 días antes: ±40% error
├─ 1 día antes: ±10% error
├─ Día carrera: Acceso a forecast a las 2h antes
└─ Posibilidad de lluvia sorpresiva (safety car)

Decisiones Tácticas En Vivo (durante carrera):
├─ Cada 5-10 laps puedes ajustar:
│  ├─ Modo motor (Eco, Normal, Push)
│  ├─ Línea de trazada (línea corta vs larga)
│  ├─ Timing de parada en boxes
│  └─ Neumáticos para próxima stint
├─ Costo: Pierde 5-10% ritmo mientras decides
└─ Puede ser manual (pausar carrera) o automático

Strategy Templates (pre-hechas):
├─ Aggressive: Push desde lap 1
├─ Defensive: Manage tyres, late pit
├─ Tactical: Reaccionar a eventos
└─ Fuel Saver: Eco mode, long stint
```

**Cambio Propuesto:**
- Crear 5-8 circuitos con características únicas
- Simular decisiones tácticas (incluso si no es tiempo real completo)
- Agregar variabilidad de clima (incluso si es simple)

---

### **7. FACCIONES / ALIANZAS COMPLETAMENTE IGNORADAS** 🟡 ALTA

**Problema:**
- Documento: "Al comprar un motor, entras en mega-alianza global con usuarios de esa marca"
- Implementación actual: CERO
- Requiere infraestructura social/MMO significativa

**Concepto Faltante:**
```
ENGINE FACTION SYSTEM:

Cuando eliges motorista en onboarding:
├─ Te unes a Facción de ese motor
├─ Ejemplo: Zenith Motors Guild
├─ Tendrá Discord/comunidad
├─ Bonos de facción:
│  ├─ Descuento 5% en I+D de ese motor
│  ├─ +2% ingresos (bonus de synergy)
│  ├─ Acceso a "faction shop" (componentes exclusivos)
│  └─ Leaderboard de facción (rankings)

Asistencia Mutua (social feature):
├─ Envía "help request" a aliados
│  ├─ "-20% tiempo construcción siguiente 4h"
│  ├─ "+1,000 CR bonus"
│  ├─ "+5% velocidad I+D"
│  └─ Puedes pedir 1 vez cada 48h
├─ Aliados pueden ACEPTAR/RECHAZAR
├─ Historial de ayuda (reputación social)
└─ Si ayudas 5 veces = descuento Tokens

Faction Event (semanal):
├─ Evento donde TODA la facción compite
├─ Ejemplo: "Zenith Championship"
├─ Rewards compartidos si ganan Top 3
├─ Contribuye a LEADERBOARD GLOBAL de facción
```

**Cambio Propuesto:**
- Crear tabla de facciones
- Implementar sistema de "ayuda" básico (puede ser sin tiempo real)
- Mostrar bonos de facción en UI

---

### **8. MODO DE JUEGO SIN PROPÓSITO CLARO** 🟡 ALTA

**Problema:**
- Jugador nuevo termina onboarding y... ¿luego qué? ¿Objetivo?
- No hay **meta-objetivo** abridor

**Concepto Faltante:**
```
META-OBJETIVO DEL JUEGO:

Fases de Progresión:
├─ FASE 1 (Semanas 1-8): "Survive & Prove"
│  ├─ Objetivo: Terminar temporada sin deficits
│  ├─ Asecendance: Top 3 → asciende
│  ├─ Descenso: Bottom 2 → desciende
│  ├─ Rewards: +100k CR si top 3
│  └─ Desbloquea: Team B en Div 3
├─ FASE 2 (Seasons 2-4): "Climb"
│  ├─ Objetivo: Escalar Divisiones
│  ├─ Reto: Competencia aumenta cada división
│  ├─ Tecnología se resetea en cada ascenso
│  └─ Desbloquea: Nuevas capacidades en Div 5
├─ FASE 3 (Seasons 5+): "Dynasty"
│  ├─ Objetivo: Dominar Div 1
│  ├─ Desafío: Campeonato Mundial (anual)
│  ├─ Logro: Campeón Div 1
│  └─ (Cycles vuelve a empezar o retiro)

Championship Annual Event:
├─ Ocurre después de Season 8
├─ Solo Div 1 (10 equipos)
├─ 2 SuperRaces (50 laps cada una)
├─ El ganador = "World Champion" (Hall of Fame)
├─ El perdedor = "Runner-up"
```

**Cambio Propuesto:**
- Crear "Campaign Mode" con 3 fases claras
- Implementar Championship anual
- Agregar Hall of Fame y achievements históricos

---

### **9. PERSISTENCIA OFFLINE INCOMPLETA** 🟡 ALTA

**Problema:**
- Documento: "Juego usa reloj del mundo. Construcción continúa aunque cierres"
- Actual: `catchUpOffline()` existe pero **no procesa economía, carreras, o construcciones correctamente**
- Si cierras juego 48h, ¿qué pasa?

**Concepto Faltante:**
```
OFFLINE CATCH-UP REAL:

Cuando re-abres tras X horas offline:
├─ if X > 7 días:
│  ├─ Procesa 1 season completa automáticamente
│  ├─ Tu equipo JUEGA las 8 carreras (sin input)
│  ├─ Usa estrategia default
│  ├─ Genera resultados (gana / pierde / sube / baja)
│  ├─ Actualiza economía (ingresos, gastos)
│  └─ Muestra modal: "Your Season - You finished P4, +150k CR"
├─ elif X > 24h:
│  ├─ Procesa 1-2 carreras que ocurrieron
│  ├─ Calcula economía hasta hoy
│  ├─ Completa construcciones en progreso
│  └─ Modal: "While you were away... [Race 1 result] [Race 2 result]"
└─ elif X > 4h:
   ├─ Solo actualiza construcciones
   ├─ Calcula pequeño bonus economía
   └─ No hay modal (silencioso)

Offline Simulation:
├─ Tus pilotos corren vs AI con estrategia default
├─ Performance basado en car stats + pilot stats
├─ Sin perder dinero (salarios no se restan offline? O sí?)
├─ Posibilidad de ascenso/descenso automático
└─ Puede resultar en final de season inesperado

Return to Game Flow:
├─ if offline >= 7 días: Mostrar Season Summary
├─ if offline 24-48h: Mostrar Race Summary
├─ Botón "Review Details" → ver todas las carreras offline
├─ Seguido: Ir a Dashboard normal
```

**Cambio Propuesto:**
- Refactorizar `catchUpOffline()` para procesar economía real
- Agregar simulación de carreras offline
- Mostrar modal de "mientras estabas fuera"

---

### **10. MONETIZACIÓN NO IMPLEMENTADA** 🟠 MEDIA

**Problema:**
- Documento requiere: "Tope Diario de Tokens ME" (anti-whale)
- Actual: No hay límite de gasto de tokens, ni siquiera sistema de tokens real
- Falta: "Pase Mensual" (Suscripción Premium)

**Concepto Faltante:**
```
MONETIZACIÓN JUSTA PROPUESTA:

Tokens ME (Premium Currency):
├─ Adquisición Gratuita:
│  ├─ Onboarding: +50 tokens
│  ├─ Logros: 1-5 tokens cada uno
│  ├─ Rewards pasivos: 1 token cada 7 dias
│  └─ Season Rewards: 5-15 tokens por rango
├─ Adquisición de Pago:
│  ├─ Pack 50: $2.99
│  ├─ Pack 500: $24.99
│  ├─ Pack 2000: $84.99 (bundle discount)
│  └─ Monthly Pass: $9.99 → +100 tokens/mes
├─ Tope Diario Estricto:
│  ├─ Max 50 tokens gastables por día en ACCELERATORS
│  ├─ Resto de gastos (skins, etc.) sin límite
│  └─ Se resetea 00:00 UTC
└─ Usos:
   ├─ Acelerar construcción: 5-20 tokens
   ├─ Acelerar I+D: 5-20 tokens
   ├─ Acelerar entrenamientos: 3-10 tokens
   └─ NO puede comprarse CR directamente (evergreen)

Pase Mensual Premium ($9.99/mes):
├─ Beneficios:
│  ├─ +100 tokens automáticos (1x/mes)
│  ├─ +2 construcciones simultáneas (en lugar de 1)
│  ├─ +1 draft scouting semanal (2 gratuit vs 1)
│  ├─ Descuento 10% en tokens gastos
│  ├─ Priority matchmaking (liga más competitiva)
│  └─ Especial cosmetic (equipo badge premium)
├─ Auto-renews
└─ Cancelación fácil (no traps)

Monetización NO-Predatoria:
├─ NO batalla pase
├─ NO loot boxes
├─ NO "pay to race"
├─ NO publicidades
├─ CR nunca se compra (farming solo)
└─ Cosmetics opcionales (pinturas de equipo, decoraciones HQ)

Estimado de Ingresos F2P Serio:
├─ 1M usuarios
├─ 2% conversion a "gastadores": 20k
├─ ARPPU promedio: $4-6/mes (mix de pases + tokens)
├─ MRR: $80-120k
├─ Margen: ~70% → ~$56-84k/mes
```

**Cambio Propuesto:**
- Implementar sistema de tokens real
- Agregar tope diario
- Crear Pase Mensual simple
- NO implementar nada predatorio

---

## 🎯 PRIORIDADES DE REFACTORIZACIÓN

### TIER 1 - BLOQUEADORES (Sem 1-2)
1. **Ciclo temporal + Division System** ← Core loop roto
2. **Economía semanal + Procesamiento automático** ← Sin esto no hay gameplay
3. **Sistema I+D funcional** ← Interfaz existe, lógica no

### TIER 2 - FUNDACIONALES (Sem 3-4)
4. **HQ Capacidades reales** ← Las mejoras no hacen nada
5. **Draft/Scouting semanal** ← Necesario para progresión piloto
6. **Clima + Circuitos variados** ← Sin esto, carreras aburridas

### TIER 3 - PULIDO (Sem 5-6)
7. **Facciones / Alianzas** ← Social feature, menos crítico
8. **Offline Catch-up real** ← Currently broken
9. **Meta-objetivos / Championship** ← Purpose clarification
10. **Monetización justa** ← Cuando el juego sea sólido

---

## 💣 CAMBIOS ARQUITECTÓNICOS RECOMENDADOS

### **Refactorizar `engine.js`:**
```javascript
// ACTUAL (incompleto):
{
  simulateRace() { /* ... */ },
  buildInitialStandings() { /* ... */ }
}

// PROPUESTO (completo):
{
  // Weekly Economy
  processWeeklyEconomy(),
  calculateIncome(),
  calculateExpenses(),
  checkDeficitStatus(),
  
  // Seasons & Divisions
  startNewSeason(),
  endSeason(),
  promoteTeams(),
  relegateTeams(),
  
  // Race System
  buildInitialStandings(),
  simulateRace(),
  processRaceResults(),
  updatePointStandings(),
  
  // R&D
  processActiveResearch(),
  completeResearch(),
  resetTechOnPromotion(),
  
  // Offline
  catchUpOffline(),
  simulateMissedRaces(),
  
  // Events Random
  generateRandomEvent(),
  processSponsorEvents()
}
```

### **Refactorizar `state.js`:**
```javascript
// Agregar a DEFAULT_STATE:
{
  // ... existing ...
  
  // Temporal
  season: {
    year, week, phase,
    startDate (ms), endDate (ms),  // ← NEW: temporal reference
    currentDivision, 
    raceCalendar, // ← NEW: generated per season
    ladder []  // ← NEW: standings with promotion zones
  },
  
  // Academy Queue
  academyQueue: [
    { pilotId, trainingType, startTime, duration, targetAttr }
  ],
  
  // Research Queue
  researchQueue: [
    { branch, level, startTime, duration, cost, statusPercent }
  ],
  
  // Economic history
  financialHistory: [
    { week, income, expenses, net, sponsors[], incidents[] }
  ],
  
  // Faction
  faction: {
    engineSupplier,
    joinedDate,
    helpRequests: { sent: [], received: [] },
    contributedEvents: []
  }
}
```

### **Crear `divisions.js` (NEW):**
```javascript
// Gestiona toda la lógica de ligas
{
  getDivisionConfig(divNum),
  getTeamsInDivision(divNum),
  calculatePromotion(),
  calculateRelegation(),
  getPromotionThreshold(),
  getRelegationThreshold(),
  startDivisionSeason(),
  generateDivisionCalendar(),
  endDivisionSeason()
}
```

### **Crear `economy.js` (NEW):**
```javascript
// Gestiona todas las finanzas
{
  calculateTeamIncome(),
  calculateTeamExpenses(),
  processWeeklyBalance(),
  handleDeficit(),
  generateSponsorIncome(),
  calculateMerchandiseRevenue(),
  getRaceBonus(),
  applyIncomeLedger()
}
```

### **Crear `academy.js` (NEW):**
```javascript
// Gestiona entrenamientos de pilotos
{
  queueTraining(),
  processActiveTraining(),
  completeTraining(),
  improveAttribute(),
  generateScoutingPool(),
  attemptScout(),
  checkInjury(),
  retirePilot()
}
```

---

## 📊 IMPACTO ESTIMADO DE CHANGES

| Cambio | Impacto en Gameplay | Dificultad | Tiempo |
|--------|-------------------|-----------|--------|
| Ciclo Temporal Claro | **Crítico** - Todo depende | Alto | 5h |
| Economía Automática | **Crítico** - Core loop | Alto | 8h |
| I+D Funcional | **Alto** - Progression clave | Medio | 4h |
| HQ Capacidades | **Alto** - Estrategia | Medio | 3h |
| Draft Scouting | **Medio** - QoL | Bajo | 2h |
| Circuitos Variados | **Medio** - Variedad | Medio | 4h |
| Division System | **Alto** - MMO essence | Medio | 6h |
| Offline Fix | **Bajo** - Edge case | Bajo | 2h |

**Estimado Total: 34 horas** → ~1 semana full-time

---

## 🚀 RECOMENDACIÓN DE RUTA

**MVP Mejorado (Viable en 1 semana):**
1. ✅ Onboarding rediseñado (DONE)
2. ⏳ **Ciclo temporal claro** (START HERE)
3. ⏳ **Economía semanal automática**
4. ⏳ **I+D funcional**
5. ⏳ **Dashboard rediseñado** (prioridad visual)

**Después (MVP+):**
6. HQ Capacidades
7. Draft Scouting
8. Division System
9. Championship Annual

**Nunca (puede omitirse sin afectar core):**
- Facciones complejas
- Offline catch-up perfecto
- Monetización premium (mantener F2P forever está bien)

---

## 🎯 CONCLUSIÓN

El juego tiene **ideas excelentes** pero **falta arquitectura** para llevarlas. La refactorización propuesta transforma Garage Legends de "prototipo interesante" a "juego viable".

**Próximo paso:** ¿Empezamos por Ciclo Temporal o Economía?
