# Formulas Matematicas de la Carrera

## Objetivo

Este documento traduce la simulacion de carrera a formulas matematicas para poder analizar:

- que variable entra en cada capa
- con que peso entra
- que multiplicadores la modifican
- donde hay ruido aleatorio o eventos discretos

La idea no es simplificar el juego a una unica ecuacion, porque el resultado final es secuencial. La carrera se construye por etapas.

---

## 1. Variables base

Definimos los atributos del piloto como:

$$
P = pace
$$

$$
R = racePace
$$

$$
C = consistency
$$

$$
W = rain
$$

$$
T = tyre
$$

$$
A = aggression_{pilot}
$$

$$
O = overtake
$$

$$
F = techFB
$$

$$
M = mental
$$

$$
H = charisma
$$

El overall del piloto es:

$$
Overall = \frac{P + R + C + W + T + A + O + F + M + H}{10}
$$

Si definimos los componentes del coche como:

$$
E = engine,
Ch = chassis,
Ae = aero,
Ty = tyreManage,
Br = brakes,
G = gearbox,
Re = reliability,
Ef = efficiency
$$

entonces el score global del coche es:

$$
CarScore = \frac{E + Ch + Ae + Ty + Br + G + Re + Ef}{8}
$$

---

## 2. Perfil de pista

Cada circuito define un layout con cuatro sesgos:

$$
Profile = (paceBias, overtakeBias, tyreDegMult, riskBias)
$$

### 2.1 Sesgos por layout

#### High-speed

$$
paceBias = 1.05,
overtakeBias = 1.08,
tyreDegMult = 0.95,
riskBias = 1.08
$$

#### Power

$$
paceBias = 1.06,
overtakeBias = 1.04,
tyreDegMult = 1.00,
riskBias = 1.05
$$

#### Technical

$$
paceBias = 0.98,
overtakeBias = 0.90,
tyreDegMult = 1.08,
riskBias = 1.00
$$

#### Mixed

$$
paceBias = 1,
overtakeBias = 1,
tyreDegMult = 1,
riskBias = 1
$$

#### Endurance

$$
paceBias = 0.96,
overtakeBias = 0.92,
tyreDegMult = 1.12,
riskBias = 0.95
$$

### 2.2 Modificador por lluvia

Si el clima es mojado:

$$
paceBias_{wet} = 0.95,
overtakeBias_{wet} = 0.90,
tyreDegMult_{wet} = 1.10,
riskBias_{wet} = 1.20
$$

Entonces el perfil final es:

$$
paceBias_{final} = paceBias_{layout} \cdot paceBias_{wetMod}
$$

$$
overtakeBias_{final} = overtakeBias_{layout} \cdot overtakeBias_{wetMod}
$$

$$
tyreDegMult_{final} = tyreDegMult_{layout} \cdot tyreDegMult_{wetMod}
$$

$$
riskBias_{final} = riskBias_{layout} \cdot riskBias_{wetMod}
$$

---

## 3. Setup

Definimos:

$$
AB = aeroBalance \in [0, 100]
$$

$$
WB = wetBias \in [0, 100]
$$

### 3.1 Ajuste por layout

#### Power o high-speed

$$
layoutFit = \frac{50 - AB}{140}
$$

#### Technical

$$
layoutFit = \frac{AB - 50}{140}
$$

#### Mixed o layouts no extremos

$$
layoutFit = \frac{-|AB - 50|}{220}
$$

### 3.2 Ajuste por clima

Si la carrera es mojada:

$$
weatherFit = \frac{WB - 50}{120}
$$

Si la carrera es seca:

$$
weatherFit = \frac{50 - WB}{120}
$$

### 3.3 Multiplicadores finales del setup

$$
paceMult = 1 + layoutFit + weatherFit
$$

$$
riskMult =
\begin{cases}
1 - \frac{WB - 50}{220}, & \text{si mojado} \\
1 - \frac{50 - WB}{280}, & \text{si seco}
\end{cases}
$$

$$
tyreMult = 1 + \frac{|AB - 50|}{260}
$$

Interpretacion:

- $paceMult$ multiplica la competitividad base.
- $riskMult$ multiplica el riesgo de incidente.
- $tyreMult$ multiplica el desgaste.

---

## 4. Fuerza de parrilla del piloto

La fuerza de clasificacion del piloto es:

$$
GridStrength = 0.26 \cdot Overall + 0.32 \cdot P + 0.18 \cdot R + 0.12 \cdot C + 0.07 \cdot F + 0.05 \cdot M + WetGridBonus
$$

donde:

$$
WetGridBonus =
\begin{cases}
0.18 \cdot (W - 60), & \text{si mojado} \\
0, & \text{si seco}
\end{cases}
$$

y luego se aplica clamp:

$$
GridStrength_{final} = clamp(GridStrength, 40, 96)
$$

---

## 5. Fuerza de carrera del piloto

La fuerza de carrera es:

$$
RaceStrength = 0.42 \cdot Overall + 0.22 \cdot R + 0.16 \cdot C + 0.10 \cdot T + 0.10 \cdot O + WetRaceBonus + StrategyAggBonus + StrategyRiskBonus + PilotAggBonus
$$

donde:

$$
WetRaceBonus =
\begin{cases}
0.28 \cdot (W - 60), & \text{si mojado} \\
0, & \text{si seco}
\end{cases}
$$

$$
StrategyAggBonus = 0.06 \cdot (Agg_{strategy} - 50)
$$

$$
StrategyRiskBonus = 0.03 \cdot (Risk_{strategy} - 40)
$$

$$
PilotAggBonus = 0.04 \cdot (A - 60)
$$

y luego:

$$
RaceStrength_{final} = clamp(RaceStrength, 40, 96)
$$

---

## 6. Bonus del coche por tipo de pista

Definimos un score especifico por layout:

### High-speed

$$
LayoutCar = \frac{E + Ef}{2}
$$

### Power

$$
LayoutCar = \frac{E + G}{2}
$$

### Technical

$$
LayoutCar = \frac{Br + Ch + Ae}{3}
$$

### Mixed

$$
LayoutCar = \frac{Ch + Ae + Re}{3}
$$

### Endurance

$$
LayoutCar = \frac{Re + Ty + Ef}{3}
$$

El bonus de coche por pista del jugador es:

$$
TrackCarBonus_{player} = 0.12 \cdot (LayoutCar - 50)
$$

Para la IA es parecido, pero usa:

$$
TrackCarBonus_{ai} = 0.11 \cdot (LayoutCar - 50) + RandomTrackNoise
$$

---

## 7. Fuerza base de parrilla del coche del jugador

La fuerza base del coche del jugador antes del ruido de clasificacion es:

$$
PlayerBase = \left(0.56 \cdot CarScore + 0.44 \cdot GridStrength + TrackCarBonus\right) \cdot WeatherDriverMult \cdot paceBias \cdot paceMult
$$

donde:

$$
WeatherDriverMult =
\begin{cases}
0.92, & \text{si mojado} \\
1, & \text{si seco}
\end{cases}
$$

La puntuacion de clasificacion queda:

$$
QualyScore = PlayerBase + U(-6, 6)
$$

y luego una segunda perturbacion para el orden de salida:

$$
GridScore = QualyScore + U(-4, 4)
$$

donde $U(a,b)$ es ruido uniforme entre $a$ y $b$.

---

## 8. Staff tecnico

Definimos promedios:

$$
PitSkill = promedio(pitStrategy)
$$

$$
SetupSkill = promedio(setup)
$$

$$
TechSkill = promedio(technical)
$$

Entonces:

$$
pitErrorChanceMult = clamp\left(1.2 - \frac{PitSkill}{120}, 0.68, 1.15\right)
$$

$$
pitTimeGainChance = clamp\left(0.2 + \frac{PitSkill}{200}, 0.25, 0.78\right)
$$

$$
undercutStrength = clamp\left(\frac{PitSkill + SetupSkill}{220}, 0.3, 1.0\right)
$$

$$
overcutStrength = clamp\left(\frac{SetupSkill + TechSkill}{220}, 0.3, 1.0\right)
$$

$$
incidentRiskMult = clamp\left(1.1 - \frac{TechSkill}{180}, 0.74, 1.05\right)
$$

$$
overtakeBonus = clamp\left(\frac{SetupSkill - 60}{300}, -0.05, 0.12\right)
$$

$$
paceBonus = clamp\left(\frac{SetupSkill + TechSkill - 120}{500}, 0, 0.12\right)
$$

Ese $paceBonus$ se aplica directamente al score del jugador al arrancar la carrera:

$$
Score_{start,player} = Score_{grid} \cdot (1 + paceBonus)
$$

---

## 9. Modo motor

Definimos:

### Eco

$$
Engine = (-0.05, -0.15, -0.10)
$$

### Normal

$$
Engine = (0, 0, 0)
$$

### Push

$$
Engine = (0.05, 0.15, 0.12)
$$

donde la tupla es:

$$
(pace, risk, tyre)
$$

---

## 10. Neumaticos

Cada compuesto define dos cosas claves:

1. delta fija de tiempo por vuelta
2. porcentaje de durabilidad de la carrera

### 10.1 Vida util

Si un compuesto tiene rango de durabilidad $[d_{min}, d_{max}]$, entonces:

$$
UsefulLife = clamp\left(TotalLaps \cdot \frac{d_{min} + d_{max}}{2}, 4, max(6, 0.85 \cdot TotalLaps)\right)
$$

### 10.2 Delta de ritmo por clima

$$
TyreDelta = paceDeltaMs(tyre, weather)
$$

Ejemplos:

#### Seco

$$
soft = -750,
medium = 0,
hard = +650
$$

#### Mojado

$$
intermediate = 0,
wet = +1000,
soft = +4200,
medium = +5200,
hard = +6200
$$

### 10.3 Desgaste acumulado

Cada vuelta:

$$
Wear_{t+1} = Wear_t + 1 \cdot tyreDegMult \cdot (1 + EngineTyre) \cdot tyreMult
$$

### 10.4 Penalizacion por pasarse del stint

$$
WearOveruse = max(0, Wear - UsefulLife)
$$

$$
WearPenaltyMs = 1900 \cdot WearOveruse
$$

---

## 11. Tiempo por vuelta

Para el jugador, el tiempo por vuelta es:

$$
LapTime = LapBase - PaceMs - AggressionMs - EngineMs + TyreDelta + WearPenaltyMs + Noise
$$

donde:

$$
LapBase =
\begin{cases}
110000, & \text{si Safety Car} \\
94500, & \text{si carrera normal}
\end{cases}
$$

$$
PaceMs = 175 \cdot RawPace
$$

$$
AggressionMs = 22 \cdot (Agg_{strategy} - 50)
$$

$$
EngineMs = 2600 \cdot EnginePace
$$

$$
Noise = U(-700, 700)
$$

Para la IA, cambia solo:

$$
PaceMs_{ai} = 160 \cdot RawPace
$$

$$
Noise_{ai} = U(-1100, 1100)
$$

### 11.1 Que es $RawPace$

En la simulacion actual, $RawPace$ sale del score base de parrilla/carrera ya multiplicado por coche, piloto, setup, pista y condiciones previas.

Es decir, el juego primero sintetiza fuerza competitiva y luego la traduce a milisegundos.

---

## 12. Pit stop

Definimos eficiencia de crew:

### Jugador

$$
CrewEfficiency = clamp\left(\frac{pitTimeGainChance - 0.25}{0.53}, 0, 1\right)
$$

### IA

$$
CrewEfficiency_{ai} = clamp\left(\frac{PitSkill_{ai} - 46}{46}, 0, 1\right)
$$

Error multiplier:

$$
ErrorMult =
\begin{cases}
pitErrorChanceMult, & \text{jugador} \\
clamp\left(1.18 - \frac{PitSkill_{ai}}{120}, 0.72, 1.12\right), & \text{IA}
\end{cases}
$$

Tiempo de pit:

$$
PitTime = Lane + Weather + ServiceBase + ServiceNoise + QuickStopBonus + ErrorPenalty
$$

donde:

$$
Lane =
\begin{cases}
13200, & \text{si Safety Car} \\
18400, & \text{normal}
\end{cases}
$$

$$
Weather =
\begin{cases}
900, & \text{si mojado} \\
0, & \text{si seco}
\end{cases}
$$

$$
ServiceBase = 5150 - 1100 \cdot CrewEfficiency
$$

$$
ServiceNoise = U(-350, 350)
$$

Si hay quick stop:

$$
QuickStopBonus = -550
$$

con probabilidad:

$$
P(quickStop) =
\begin{cases}
pitTimeGainChance, & \text{jugador} \\
clamp(0.24 + 0.45 \cdot CrewEfficiency, 0.22, 0.72), & \text{IA}
\end{cases}
$$

Si hay error:

$$
ErrorPenalty = 1600 + U(0, 1400)
$$

con probabilidad:

$$
P(error) = BaseErrorChance \cdot ErrorMult
$$

$$
BaseErrorChance =
\begin{cases}
0.03, & \text{si Safety Car} \\
0.06, & \text{normal}
\end{cases}
$$

Finalmente:

$$
PitTime_{final} = clamp(PitTime, min, max)
$$

---

## 13. Incidentes del jugador

La probabilidad por vuelta de un incidente del jugador es:

$$
P(incident) = \left(0.008 \cdot \frac{Risk_{strategy}}{100} + 0.005\right) \cdot riskBias \cdot (1 + EngineRisk) \cdot incidentRiskMult \cdot riskMult
$$

Si ocurre un incidente:

- con probabilidad $0.3$, DNF
- con probabilidad $0.7$, trompo

En trompo:

$$
LostPositions \in \{1,2,3\}
$$

$$
TimeLoss_{spin} = 2600 \cdot LostPositions
$$

---

## 14. Adelantamientos del jugador

Cada 5 vueltas, si el coche no esta en pit ni retirado, se evalua un adelantamiento al coche de delante.

La probabilidad es:

$$
P(overtake) = \left(0.3 + \frac{Agg_{strategy}}{200}\right) \cdot overtakeBias + overtakeBonus
$$

y luego se multiplica por:

$$
(1 + max(0, EnginePace)) \cdot max(0.9, paceMult)
$$

Queda:

$$
P(overtake) = \left[\left(0.3 + \frac{Agg_{strategy}}{200}\right) \cdot overtakeBias + overtakeBonus\right] \cdot (1 + max(0, EnginePace)) \cdot max(0.9, paceMult)
$$

Si sale bien:

$$
\Delta time_{player} = -950
$$

$$
\Delta time_{rival} = +950
$$

---

## 15. Safety Car

Si sale Safety Car, el lider queda igual y el resto del grupo se comprime:

$$
Gap_{new} = 0.55 \cdot Gap_{old}
$$

Ademas, la vuelta base se mueve a:

$$
LapBase = 110000
$$

---

## 16. Lectura estructural del modelo

La carrera puede resumirse asi:

### 16.1 Capa de competitividad base

$$
CompetitividadBase \approx f(CarScore, LayoutCar, GridStrength, RaceStrength, paceBias, paceMult, paceBonus)
$$

### 16.2 Capa de conversion a ritmo

$$
LapTime \approx f(CompetitividadBase, Agg_{strategy}, EngineMode, Tyre, Wear)
$$

### 16.3 Capa de ejecucion y caos

$$
ResultadoFinal \approx f(LapTimes acumulados, PitTimes, Overtakes, Incidents, SafetyCar, Noise)
$$

---

## 17. Variables de mayor sensibilidad

En el estado actual del codigo, las mas sensibles son:

1. $R$ por su peso en fuerza de carrera
2. $P$ por su peso en parrilla
3. $C$ por su doble efecto de consistencia en grid y race
4. $T$ por fuerza de carrera y porque la goma define ritmo real del stint
5. $W$ cuando la carrera es mojada
6. $CarScore$ y sobre todo los componentes alineados al layout
7. $AB$ y $WB$ por los multiplicadores de setup
8. $Agg_{strategy}$ y `engineMode` por su traduccion directa a ms por vuelta
9. `pitStrategy`, `setup` y `technical` del staff por sus multiplicadores operativos

---

## 18. Conclusiones

No hay una sola formula cerrada del resultado final porque el modelo es iterativo y probabilistico. Pero si hay formulas exactas para cada capa importante.

Eso te permite analizar el juego de tres maneras:

1. sensibilidad local: cuanto cambia el rendimiento si subes una variable
2. sinergias: cuando una variable multiplica a otra
3. riesgo: cuando una mejora de ritmo mete a la vez mas desgaste o incidentes
