# Race Strategy Playbook (v1)

Este documento explica como la estrategia pre-carrera impacta el resultado en el modelo actual.
Fuente principal: js/engine.js y UI de estrategia en js/screens.js.

## 1) Flujo de calculo (resumen)

1. Se toma la estrategia guardada en Pre-Race (window._raceStrategy).
2. Se calcula un base score para jugador y AI en clasificacion.
3. Durante la carrera se simulan por vuelta:
- clima dinamico
- VSC/safety car
- desgaste de neumatico
- ventanas de pit adaptadas
- incidentes
- sobrepasos
4. Se ordena el resultado final, se asignan puntos y premio.

## 2) Parametros y efecto real en carrera

### 2.1 tyre (soft/medium/hard)

Impacto directo:
- Ritmo base por compuesto: TYRE_PACE.
- Desgaste por vuelta: TYRE_DEG.

Valores actuales:
- soft: +8 ritmo, desgaste 1.5
- medium: +0 ritmo, desgaste 0.9
- hard: -4 ritmo, desgaste 0.5

Lectura practica:
- Soft te da salida fuerte y overtakes tempranos, pero castiga mucho el stint.
- Hard protege carrera larga, pero puede costar posicion en trafico.

### 2.2 aggression (0-100)

Impacto directo:
- Bonus al score inicial de grilla: ((aggression - 50) * 0.04).
- Sube chance de sobrepaso cada 5 vueltas junto con otros factores.

Lectura practica:
- Agresividad alta ayuda a ganar posiciones, especialmente si ya tienes buen ritmo.
- Si se combina con riesgo alto y modo motor push, aumenta varianza.

### 2.3 riskLevel (0-100)

Impacto directo:
- Multiplica probabilidad de incidente del jugador por vuelta.
- Formula base usa riskLevel/100 y luego ajusta por circuito, setup, motor y staff.

Lectura practica:
- Riesgo alto no acelera directamente el pace, pero si aumenta errores/retiradas.
- Riesgo bajo es mas estable para sumar puntos consistentes.

### 2.4 engineMode (eco/normal/push)

Impacto directo por mapa:
- eco: pace -5%, risk -15%, tyre -10%
- normal: 0
- push: pace +5%, risk +15%, tyre +12%

Lectura practica:
- Push es un multiplicador fuerte de ataque, pero castiga desgaste e incidentes.
- Eco es util para defender posicion o sobrevivir tramo dificil.

### 2.5 pitPlan (single/double/adaptive)

Impacto directo:
- single: max 1 pit
- double: max 2 pits
- adaptive: 1 o 2 segun desgaste esperado y clima

Regla adaptive actual:
- Si tyreDegMult > 1.05 o clima wet: habilita 2 paradas.

Lectura practica:
- Adaptive es robusto en escenarios inciertos.
- Single funciona mejor en baja degradacion y ritmo estable.

### 2.6 pitLap (0-100)

Impacto directo:
- Se convierte a vuelta objetivo: floor(pitLap/100 * totalLaps) + 1.
- Puede correrse por tactica, VSC y clima.

Lectura practica:
- No es una vuelta fija absoluta: es un ancla que luego el motor ajusta.

### 2.7 safetyCarReaction (neutral/undercut/overcut)

Impacto directo:
- En VSC puede adelantar o atrasar pit windows.
- Efectividad depende de staff (undercutStrength, overcutStrength).

Lectura practica:
- Undercut gana valor con buen pit crew y ventana cercana.
- Overcut sirve cuando prefieres aire limpio y extender stint.

### 2.8 setup.aeroBalance (0-100)

Impacto directo en getSetupEffects:
- Ajusta paceMult segun tipo de circuito.
- Penaliza desgaste cuanto mas extremo sea el balance.

Lectura practica:
- No siempre conviene extremos: en circuitos mixed castiga desviarse mucho de 50.

### 2.9 setup.wetBias (0-100)

Impacto directo en getSetupEffects:
- Mejora pace y reduce riesgo cuando acierta con clima.
- Si te equivocas (wetBias alto en seco o viceversa), pierdes eficiencia.

Lectura practica:
- Con pronostico incierto, conviene evitar sesgo extremo.

### 2.10 interventions[]

Impacto directo:
- En porcentajes de carrera definidos, cambia engineMode y sesgo de pit (pitBias).
- Puede mover la ventana de pit en caliente.

Lectura practica:
- Es la palanca mas potente para ajustar carrera en 2 fases.

## 3) Factores de piloto, staff y circuito

### 3.1 Piloto

Atributos con mas impacto en simulacion:
- pace, racePace, consistency, rain, tyre, overtake, mental.

Notas:
- El score general del piloto es promedio simple de 10 atributos.
- En lluvia, rain tiene impacto directo en base pace del jugador.

### 3.2 Staff

getRaceStaffEffects transforma calidad del staff en modificadores:
- pitErrorChanceMult
- pitTimeGainChance
- undercutStrength
- overcutStrength
- incidentRiskMult
- overtakeBonus
- paceBonus

Lectura practica:
- Staff fuerte te da consistencia operativa, no solo stats bonitas.

### 3.3 Circuito y clima

getCircuitProfile define por layout:
- paceBias
- overtakeBias
- tyreDegMult
- riskBias

Wet agrega:
- menos pace
- menos overtakes
- mas degradacion
- mas riesgo

## 4) Rangos recomendados (guia inicial)

### 4.1 Circuito rapido en seco (high-speed/power)

- tyre: soft o medium
- aggression: 60-75
- riskLevel: 35-50
- engineMode: normal -> push en tramo final
- pitPlan: single o adaptive
- setup.aeroBalance: 35-50
- setup.wetBias: 35-50

### 4.2 Circuito tecnico o lluvia

- tyre: medium (o hard si esperas stint largo)
- aggression: 40-60
- riskLevel: 20-40
- engineMode: eco/normal gran parte de carrera
- pitPlan: adaptive
- setup.aeroBalance: 55-70 (tecnico)
- setup.wetBias: 60-80 (si pronostico wet confiable)

### 4.3 Objetivo: asegurar puntos

- aggression: 35-55
- riskLevel: 15-35
- engineMode: normal con ventanas eco
- pitPlan: adaptive
- safetyCarReaction: neutral o undercut solo con staff fuerte

### 4.4 Objetivo: buscar podium con coche inferior

- aggression: 70-85
- riskLevel: 50-70
- engineMode: push por fases
- pitPlan: double/adaptive
- interventions: 30% normal, 65-75% push + pit early

## 5) Checklist para proponer mejoras de balance

1. Separar mas claramente aggression y riskLevel para evitar solape.
2. Revisar sensibilidad de TYRE_PACE y TYRE_DEG (soft puede estar muy dominante en salida).
3. Ajustar probabilidad de VSC (hoy puede alterar mucho la varianza).
4. Afinar efecto de setup para que un set bueno gane mas en escenarios correctos.
5. Exponer en UI un expected trade-off antes de guardar estrategia.

## 6) Experimentos rapidos que te recomiendo

1. Barrido de agresividad: 30/50/70 con mismo resto de parametros.
2. Barrido de riesgo: 20/40/60 con mismo resto.
3. Single vs adaptive en 3 layouts distintos.
4. WetBias 30 vs 70 con forecast de baja/alta confianza.
5. Push early vs push late usando intervenciones.

Con esos 5 experimentos vas a tener senal clara para iterar diseno sin tocar todo a la vez.
