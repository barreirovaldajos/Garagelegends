# Matriz Numerica de Impacto en Carrera

## Objetivo

Si, se puede medir numericamente el impacto de cada variable que entra en el resultado de una carrera.

La advertencia importante es esta: el juego no usa una sola formula final. El resultado sale de varias capas:

1. fuerza de clasificacion / parrilla
2. fuerza base del coche en esa pista
3. multiplicadores de setup, clima y staff
4. tiempo por vuelta
5. desgaste, pits, incidentes, adelantamientos y ruido aleatorio

Por eso no existe un unico porcentaje universal de impacto para cada variable, pero si existe una forma muy util de medirlo:

- impacto marginal por +1 punto de atributo
- impacto marginal por +10 puntos de slider o setup
- impacto fijo en milisegundos por vuelta o por pit stop

---

## 1. Formulas base reales

### 1.1 Overall del piloto

El overall del piloto es la media simple de 10 atributos:

overall = promedio de:

- pace
- racePace
- consistency
- rain
- tyre
- aggression
- overtake
- techFB
- mental
- charisma

Eso significa que subir +1 punto cualquier atributo suma +0.1 al overall.

---

## 2. Impacto numerico en parrilla

La fuerza de parrilla actual usa:

gridStrength =

- overall x 0.26
- pace x 0.32
- racePace x 0.18
- consistency x 0.12
- techFB x 0.07
- mental x 0.05
- bonus de lluvia si llueve

Como overall ya incluye todos los atributos, cada atributo aporta dos veces:

1. su peso directo, si lo tiene
2. su parte indirecta via overall: +0.026 por cada +1 atributo

### 2.1 Impacto marginal real por +1 punto de atributo en parrilla

| Variable | Seco | Lluvia |
|---|---:|---:|
| pace | +0.346 | +0.346 |
| racePace | +0.206 | +0.206 |
| consistency | +0.146 | +0.146 |
| techFB | +0.096 | +0.096 |
| mental | +0.076 | +0.076 |
| rain | +0.026 | +0.206 |
| tyre | +0.026 | +0.026 |
| aggression | +0.026 | +0.026 |
| overtake | +0.026 | +0.026 |
| charisma | +0.026 | +0.026 |

### Lectura practica

- En clasificacion, pace es la variable mas pesada del piloto.
- En lluvia, rain pasa de casi irrelevante a una variable de primer nivel.
- racePace ayuda tambien a clasificar, pero menos que pace.

---

## 3. Impacto numerico en fuerza de carrera

La fuerza de carrera usa:

raceStrength =

- overall x 0.42
- racePace x 0.22
- consistency x 0.16
- tyre x 0.10
- overtake x 0.10
- bonus de rain en mojado
- bonus por strategy.aggression
- bonus por strategy.riskLevel
- bonus por aggression del piloto

Como el overall reparte 0.42 entre 10 atributos, cada atributo gana +0.042 indirecto por cada +1 punto.

### 3.1 Impacto marginal real por +1 punto de atributo en carrera

| Variable | Seco | Lluvia |
|---|---:|---:|
| racePace | +0.262 | +0.262 |
| consistency | +0.202 | +0.202 |
| tyre | +0.142 | +0.142 |
| overtake | +0.142 | +0.142 |
| aggression | +0.082 | +0.082 |
| pace | +0.042 | +0.042 |
| techFB | +0.042 | +0.042 |
| mental | +0.042 | +0.042 |
| charisma | +0.042 | +0.042 |
| rain | +0.042 | +0.322 |

### Lectura practica

- En carrera seca, racePace es el atributo individual mas fuerte.
- consistency es el segundo gran pilar.
- tyre y overtake pesan mucho mas en carrera que en parrilla.
- En lluvia, rain se vuelve de las variables mas fuertes del modelo.

---

## 4. Impacto de sliders estrategicos

### 4.1 Aggression del plan de carrera

En raceStrength:

- cada +1 en aggression del plan suma +0.06
- cada +10 suma +0.60

En tiempo por vuelta:

- cada +1 baja 22 ms por vuelta respecto a 50
- cada +10 baja 220 ms por vuelta

Coste:

- mas agresion suele empeorar desgaste real al combinarse con gomas, trafico y decisiones de pit

### 4.2 Risk level

En raceStrength:

- cada +1 en riskLevel suma +0.03
- cada +10 suma +0.30

En riesgo de incidente por vuelta, la base usa:

probabilidad base = 0.008 x riesgoNormalizado + 0.005

Eso significa:

- +10 puntos de riskLevel añaden +0.0008 de riesgo absoluto por vuelta antes de multiplicadores
- eso equivale a +0.08 puntos porcentuales por vuelta antes de pista, motor, setup y staff

En una carrera de 30 vueltas, solo ese cambio ya sube varios puntos porcentuales el riesgo acumulado.

---

## 5. Impacto del modo motor

El modo motor usa tres efectos:

| Modo | Pace | Risk | Tyre |
|---|---:|---:|---:|
| eco | -0.05 | -0.15 | -0.10 |
| normal | 0 | 0 | 0 |
| push | +0.05 | +0.15 | +0.12 |

### Traduccion a tiempo por vuelta

El tiempo por vuelta resta:

engineFx.pace x 2600 ms

Eso da:

- eco: aproximadamente +130 ms por vuelta
- normal: 0 ms
- push: aproximadamente -130 ms por vuelta

Traduccion practica:

- push te da unas 0.13 s por vuelta
- eco te hace unas 0.13 s mas lento por vuelta
- push tambien aumenta el riesgo multiplicando por 1.15 y el desgaste por 1.12

---

## 6. Impacto numerico del setup

### 6.1 Aero balance

El slider va de 0 a 100.

- en pistas power o high-speed, bajar aeroBalance por debajo de 50 ayuda
- en pistas technical, subirlo por encima de 50 ayuda
- en pistas mixed, alejarte de 50 empeora

Impacto marginal:

- cada 10 puntos en la direccion correcta en power o high-speed mejora paceMult en aproximadamente +0.071
- cada 10 puntos en la direccion correcta en technical mejora paceMult en aproximadamente +0.071
- en mixed, alejarte 10 puntos de 50 empeora paceMult en aproximadamente -0.045

Coste sobre desgaste:

- cada 10 puntos que te alejan de 50 aumentan tyreMult en aproximadamente +0.038

### 6.2 Wet bias

Impacto en paceMult:

- en lluvia, cada +10 puntos de wetBias mejoran paceMult en aproximadamente +0.083
- en seco, cada +10 puntos de wetBias empeoran paceMult en aproximadamente -0.083

Impacto en riskMult:

- en lluvia, cada +10 puntos de wetBias reducen riskMult en aproximadamente -0.045
- en seco, cada +10 puntos de wetBias aumentan riskMult en aproximadamente +0.036

### Lectura practica

- acertar el wetBias vale mucho mas que muchos puntos pequenos de piloto.
- un setup extremo puede darte mucho ritmo, pero tambien dispara desgaste.

---

## 7. Impacto del coche

La base de parrilla del jugador usa aproximadamente:

playerBase =

- carScore x 0.56
- pilotGridStrength x 0.44
- trackCarBonus
- multiplicadores de clima, pista y setup

### 7.1 Impacto de carScore global

- cada +1 punto de carScore suma +0.56 a la base antes de multiplicadores

### 7.2 Como se forma carScore

carScore es la media de 8 componentes:

- engine
- chassis
- aero
- tyreManage
- brakes
- gearbox
- reliability
- efficiency

Eso significa:

- cada +1 punto en cualquier componente suma +0.125 a carScore
- por la parte global, eso vale +0.07 de base aproximadamente

### 7.3 Bonus especifico por layout

Ademas del promedio global, algunas piezas suman extra segun la pista:

| Layout | Componentes clave | Bonus adicional por +1 en componente |
|---|---|---:|
| high-speed | engine, efficiency | +0.06 |
| power | engine, gearbox | +0.06 |
| technical | brakes, chassis, aero | +0.04 |
| mixed | chassis, aero, reliability | +0.04 |
| endurance | reliability, tyreManage, efficiency | +0.04 |

### 7.4 Impacto total aproximado por +1 en un componente

| Tipo de componente | Impacto total aproximado en base |
|---|---:|
| componente no favorecido por el layout | +0.07 |
| componente favorecido en layout de 2 piezas | +0.13 |
| componente favorecido en layout de 3 piezas | +0.11 |

### Lectura practica

- mejorar engine vale siempre, pero vale todavia mas en power y high-speed.
- mejorar reliability no luce tanto en una vuelta, pero gana peso claro en mixed y endurance.

---

## 8. Impacto de staff

El staff no entra como un unico numero. Se transforma en multiplicadores y probabilidades reales.

### 8.1 Pit strategy

Usa el promedio de los roles de pits y race engineer.

Por cada +10 en pitStrategy, aproximadamente:

- pitErrorChanceMult baja 0.083
- pitTimeGainChance sube 0.05
- undercutStrength sube 0.045

### 8.2 Setup

Usa el promedio de race engineer, data analyst y chief engineer.

Por cada +10 en setup, aproximadamente:

- undercutStrength sube 0.045
- overcutStrength sube 0.045
- overtakeBonus sube 0.033
- paceBonus sube 0.02

### 8.3 Technical

Usa el promedio de chief engineer y data analyst.

Por cada +10 en technical, aproximadamente:

- incidentRiskMult baja 0.056
- overcutStrength sube 0.045
- paceBonus sube 0.02

### Lectura practica

- setup y technical son muy potentes porque mejoran ritmo y reducen errores.
- pitStrategy no acelera el coche directamente, pero puede decidir muchas posiciones por pit window y errores.

---

## 9. Impacto de neumaticos

Los compuestos meten una penalizacion o ganancia fija por vuelta.

### 9.1 Pace delta fijo por vuelta

#### En seco

| Compuesto | Delta por vuelta |
|---|---:|
| soft | -750 ms |
| medium | 0 ms |
| hard | +650 ms |
| intermediate | +4200 ms |
| wet | +6500 ms |

#### En mojado

| Compuesto | Delta por vuelta |
|---|---:|
| intermediate | 0 ms |
| wet | +1000 ms |
| soft | +4200 ms |
| medium | +5200 ms |
| hard | +6200 ms |

### 9.2 Vida util media del compuesto

La vida util se calcula como porcentaje medio de vueltas totales:

| Compuesto | Seco | Mojado |
|---|---:|---:|
| soft | 22.5% de la carrera | 15% |
| medium | 40% | 20% |
| hard | 60% | 25% |
| intermediate | 17.5% | 55% |
| wet | 10% | 30% |

### 9.3 Penalizacion por pasarte de vida util

Cuando superas la vida util:

- cada unidad extra de desgaste añade 1900 ms por vuelta

Eso es una penalizacion enorme. Por eso una goma teoricamente rapida puede hundirse muy fuerte al final del stint.

---

## 10. Tiempo por vuelta: conversion final a milisegundos

La formula del jugador es aproximadamente:

lapTimeMs =

- 94500
- rawPace x 175
- aggressionDelta x 22
- engineModePace x 2600
+ tyreDelta
+ wearPenalty
+ noise

### Lectura directa

- +1 en rawPace equivale a aproximadamente -175 ms por vuelta en el jugador
- +10 en aggression equivale a aproximadamente -220 ms por vuelta
- push equivale a aproximadamente -130 ms por vuelta
- soft en seco equivale a -750 ms por vuelta frente a medium mientras dure
- pasarte del stint correcto puede meter +1900 ms por vuelta o mas

El ruido aleatorio existe:

- jugador: aproximadamente +/-700 ms
- IA: aproximadamente +/-1100 ms

Eso significa que diferencias pequenas pueden quedar tapadas por azar, pero diferencias medianas y grandes no.

---

## 11. Adelantamientos e incidentes

### Adelantamientos del jugador

La probabilidad depende de:

- aggression del plan
- overtakeBias del circuito
- overtakeBonus del staff
- engine mode
- setup paceMult

Si el adelantamiento sale bien:

- se mueven aproximadamente 950 ms entre ambos coches

### Trompo del jugador

Si no es DNF:

- pierde entre 1 y 3 posiciones
- cada posicion perdida suma aproximadamente 2600 ms

### DNF del jugador

La retirada depende de:

- riskLevel
- riskBias de la pista
- engine mode
- technical staff
- wetBias correcto o incorrecto

---

## 12. Que variables pesan mas de verdad hoy

### 12.1 Para clasificar mejor

1. pace
2. racePace
3. consistency
4. piezas clave del layout actual
5. setup correcto para layout y clima
6. rain si llueve

### 12.2 Para ritmo de carrera

1. racePace
2. consistency
3. tyre
4. overtake
5. rain en mojado
6. setup correcto
7. neumatico correcto
8. modo motor
9. staff tecnico

### 12.3 Para evitar perder carreras por ejecucion

1. pitStrategy del staff
2. technical del staff
3. wetBias correcto
4. control del stint y vida util de goma
5. no sobreactuar con riskLevel y push al mismo tiempo

---

## 13. Conclusiones utiles

- Si quieres una tabla numerica, si: el juego ya tiene coeficientes suficientes para construirla.
- La mejor unidad para comparacion real no es solo porcentaje, sino impacto marginal por +1 punto y milisegundos por vuelta.
- Hoy las variables mas cuantificables son: atributos del piloto, componentes del coche, setup, staff tecnico, compuestos, modo motor, agresion y riesgo.

## 14. Siguiente paso recomendado

Si quieres, el siguiente nivel util es generar una matriz automatica con estas tres salidas:

1. peso por atributo en parrilla
2. peso por atributo en carrera
3. traduccion aproximada a ms por vuelta y a probabilidad de incidente

Esa matriz podria renderizarse en una pantalla debug o exportarse a CSV.
