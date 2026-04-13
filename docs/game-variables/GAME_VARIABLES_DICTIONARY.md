# Diccionario de Variables de Garage Legends

## Objetivo

Este documento resume las variables mas importantes del juego y explica:

- que representa cada una
- donde se usa de verdad
- que efecto positivo puede darte
- que coste, riesgo o contrapartida tiene
- si hoy esta conectada fuerte a la simulacion o si es mas decorativa

No intenta listar cada variable local temporal del codigo. El foco esta en las variables jugables, persistentes o derivadas que afectan progresion, economia, preparacion de carrera, simulacion de carrera y resultados de temporada.

## Como leer este documento

### Etiquetas de impacto

- `Alto`: influye directamente en resultados, ritmo, economia o progresion.
- `Medio`: influye de forma clara, pero no suele decidir por si sola.
- `Bajo`: tiene efecto limitado, indirecto o muy contextual.
- `Cosmetico / poco conectado`: existe en datos o UI, pero hoy casi no cambia la simulacion real.

### Sistemas fuente principales

- Estado persistente: `js/state.js`
- Datos base: `js/data.js`
- Economia: `js/economy.js`
- Simulacion de carrera: `js/engine.js`

---

## 1. Estado global de partida

Estas variables viven en el `DEFAULT_STATE` y explican la estructura general de una partida.

| Variable | Significado | Impacto | Pros | Contras / Riesgos | Logica actual |
|---|---|---:|---|---|---|
| `meta.version` | version de save | Bajo | ayuda a migraciones | no da ventaja jugable | tecnica, no competitiva |
| `meta.created` | fecha de creacion de la partida | Bajo | sirve para trazabilidad y limites de time travel | no mejora nada | tecnica |
| `meta.saveTime` | marca de tiempo del ultimo guardado | Bajo | resuelve conflictos de save | no cambia gameplay | tecnica |
| `meta.timeOffsetMs` | desfase de tiempo simulado | Medio | permite autosim y control temporal | puede disparar eventos / ticks no deseados si se usa mal | afecta flujo temporal y autosimulacion |

---

## 2. Equipo

| Variable | Significado | Impacto | Pros | Contras / Riesgos | Logica actual |
|---|---|---:|---|---|---|
| `team.name` | nombre de la escuderia | Bajo | identidad de save y UI | ninguno | cosmetico |
| `team.country` / `team.countryFlag` | pais base | Bajo | identidad / flavor | ninguno | cosmetico |
| `team.colors.primary` / `secondary` | colores del equipo | Bajo | identidad visual | ninguno | cosmetico |
| `team.logo` | icono del equipo | Bajo | branding | ninguno | cosmetico |
| `team.origin` | origen narrativo | Bajo | flavor | ninguno | casi solo UI |
| `team.philosophy` | filosofia del equipo | Bajo | sirve como fantasy / roleplay | hoy no esta conectada con fuerza a formulas reales | principalmente decorativa ahora |
| `team.reputation` | reputacion del equipo | Medio | ayuda a sensacion de progreso y puede relacionarse con economia/eventos | cae con malas semanas financieras | se modifica sobre todo por economia |
| `team.fans` | base de fans | Alto | aumenta `fanRevenue` cada semana | cae con rachas de deficit | influye directamente en economia |
| `team.engineSupplier` | proveedor de motor | Bajo a Medio | algunos proveedores tienen identidad y promesas de estilo | hoy el efecto mecanico real esta poco conectado | en la practica, `vulcan` si reduce tiempos de I+D / construccion; el resto hoy es mas de flavor |

### Nota importante sobre `team.engineSupplier`

Hoy la conexion fuerte y comprobable es:

- `vulcan`: reduce tiempos de investigacion / construccion aproximadamente un `15%`

Los otros proveedores estan descritos en datos y onboarding, pero no todos tienen una traduccion mecanica completa en la simulacion de carrera actual.

---

## 3. Finanzas

| Variable | Significado | Impacto | Pros | Contras / Riesgos | Logica actual |
|---|---|---:|---|---|---|
| `finances.credits` | caja disponible | Alto | te deja fichar, construir, investigar y sobrevivir | si cae demasiado, te frena en todo | variable central de progresion |
| `finances.tokens` | moneda premium / aceleradores | Medio | acelera progreso | si la gastas mal, pierdes flexibilidad | no define rendimiento puro, pero acelera tiempos |
| `finances.weeklyIncome` | ingreso semanal consolidado | Alto | muestra si el equipo se sostiene | puede crear falsa seguridad si no miras gastos/premios | se rellena en tick semanal |
| `finances.weeklyExpenses` | gasto semanal consolidado | Alto | permite leer estructura de costes | si se dispara, castiga reputacion y fans | se rellena en tick semanal |
| `finances.lastNet` | balance semanal operativo | Alto | resume salud operativa | negativo repetido castiga | motor de deficit financiero |
| `finances.history[]` | historial semanal de caja operativa | Medio | sirve para diagnostico | no incluye por si solo todo el premio de carrera | analitica / UI |
| `finances.lastRaceSettlement` | resumen del cierre financiero del ultimo GP | Alto | separa premio de carrera de operacion semanal | si no existe, puedes creer que faltan datos | clave para la nueva vista de flujo de caja |
| `finances.deficitStreak` | racha de semanas operativas en negativo | Alto | te alerta de un problema estructural | penaliza reputacion y fans si se acumula | entra en salud financiera y objetivos |
| `finances.criticalDeficit` | bandera legacy de deficit critico | Medio | marca crisis severa | sola podia ser enganosa si el premio total compensaba | hoy convive con la vista nueva de cash flow |
| `finances.bonusIncome` | ingreso extra no recurrente | Medio | da liquidez adicional | puede maquillar una operacion debil | se suma al ingreso semanal |

### Ingresos

| Variable | Impacto | Pros | Contras / Riesgos | Logica |
|---|---:|---|---|---|
| `sponsorIncome` | Alto | ingreso recurrente muy estable | depende de tener sponsors activos | suma ingresos de patrocinadores y aplica multiplicador de `hq.admin` |
| `fanRevenue` | Alto | escala con fans | si pierdes fans, cae rapido | `fans * 0.12` aprox |
| `divisionGrant` | Alto | ingreso fijo por division | divisiones bajas dan menos | tabla por division |
| `bonusIncome` | Medio | ingreso extraordinario | no es sostenible por si solo | depende de eventos o sistemas auxiliares |
| `prizeMoney` | Alto | puede salvar temporadas mediocres operativamente | es volatil y depende del resultado del GP | se liquida al cierre del fin de semana de carrera |

### Gastos

| Variable | Impacto | Pros | Contras / Riesgos | Logica |
|---|---:|---|---|---|
| `pilot.salary` | Alto | mejores pilotos suelen requerir salarios altos | castiga flujo semanal | suma directa de gasto fijo |
| `staff.salary` | Alto | mejor staff mejora setup, pits y datos | aumenta coste fijo | suma directa de gasto fijo |
| `hqCost` | Alto | niveles altos desbloquean ventajas | mantenimiento semanal creciente | coste por nivel de HQ |
| `contractCost` | Medio | puede traer beneficios tematicos o economicos | castiga presupuesto | suma semanal de contratos activos |
| `constructionUpkeep` | Medio | mantiene progreso de obras | encarece expansion | coste mientras hay construccion activa |

### Pros y contras de una economia fuerte vs agresiva

- Mas `credits` y mejor `lastNet`: mas margen para fichajes, I+D, mejoras y errores.
- Mas `weeklyExpenses`: mas techo si el dinero se traduce en mejor coche/personal, pero mas fragilidad si fallan resultados.
- Mucho premio y mala operacion: puedes sobrevivir, pero dependes de resultados deportivos.
- Buena operacion y poco premio: construyes estabilidad, pero progresas mas lento en la parte competitiva.

---

## 4. Temporada y liga

| Variable | Significado | Impacto | Pros | Contras / Riesgos | Logica actual |
|---|---|---:|---|---|---|
| `season.year` | temporada actual | Medio | sirve para hitos, campaña e historia | ninguna directa | progresion larga |
| `season.week` | semana actual | Alto | mueve economia, contratos, training y eventos | avanzar sin control puede deteriorar saves / finanzas | base del loop semanal |
| `season.raceIndex` | indice de la proxima carrera | Alto | ordena calendario y loop | si se corrompe, rompe flujo | coordina progreso deportivo |
| `season.totalRaces` | numero de carreras de la temporada | Medio | define escala de progresion anual | temporadas largas exigen mas consistencia | depende de division / calendario |
| `season.division` | division actual | Alto | divisiones mejores aumentan grant y prestigio | competencia mas dura | afecta ingresos, dificultad y objetivos |
| `season.phase` | onboarding / season / offseason | Alto | estructura el tipo de acciones disponibles | estado incorrecto rompe el flujo | variable de control del loop |
| `season.lastSummary` | resumen de ultima temporada | Medio | analitica y campaign result | no cambia carrera por si sola | persistencia e historial |
| `season.lastSummaryPending` | popup pendiente del cierre | Bajo | UX | ninguno | tecnica |
| `season.calendar[]` | calendario con circuito, clima y forecast | Alto | define contexto competitivo | un mal calendario castiga segun build del equipo | afecta pista, clima y estrategia |

### Tabla / liga

| Variable | Impacto | Pros | Contras / Riesgos | Logica |
|---|---:|---|---|---|
| `standings.points` | Alto | decide ascensos y posicion | malos resultados te hunden | suma de puntos por carrera |
| `standings.position` | Alto | define narrativa y promociones | mala racha te condena | se recalcula por puntos / desempates |
| `standings.wins` | Medio | refuerza desempates y prestigio | no compensa mala consistencia | historico competitivo |
| `standings.bestResult` | Medio | lectura rapida del techo competitivo | no garantiza regularidad | metrica complementaria |

---

## 5. Pilotos

## 5.1 Variables base del piloto

| Variable | Impacto | Pros | Contras / Riesgos | Logica actual |
|---|---:|---|---|---|
| `name`, `nat`, `emoji`, `number`, `bio` | Bajo | identidad | ninguno | cosmetico |
| `age` | Bajo | flavor y fantasia deportiva | hoy no tiene formula fuerte propia | casi decorativo |
| `salary` | Alto | permite captar talento de elite | presiona gasto semanal | economia |
| `potential` | Bajo a Medio | ayuda a proyectar crecimiento futuro | hoy casi no entra directo en la simulacion de carrera | mas de scouting / UI |
| `morale` | Bajo | lectura de estado del piloto | hoy no esta fuertemente conectado a formulas de carrera | sobre todo UI |
| `contractWeeks` | Medio | control contractual y planificacion | si cae, puede abrir decisiones de plantilla | mas de gestion que de pista |

## 5.2 Atributos del piloto (`pilot.attrs`)

| Atributo | Impacto | Pros | Contras / Riesgos | Logica actual |
|---|---:|---|---|---|
| `pace` | Alto | mejora fuerza de parrilla y velocidad base | si dependes solo de esto, puedes ser fragil en carrera larga | pesa mucho en `getPilotGridStrength` |
| `racePace` | Alto | mejora ritmo sostenido y resultado final | sin apoyo de consistencia/neumaticos no siempre basta | atributo central de `getPilotRaceStrength` |
| `consistency` | Alto | reduce volatilidad y mejora fuerza general | no suele dar picos de rendimiento por si sola | entra fuerte en grid y race strength |
| `rain` | Alto en mojado, Bajo en seco | gran ventaja en carreras o stints con lluvia | casi no ayuda en seco | bono extra si `weather === wet` |
| `tyre` | Alto | mejora gestion de stints y decisiones relacionadas con neumaticos | si esta baja, el stint se degrada antes tacticamente | suma fuerza de carrera y logica de IA |
| `aggression` | Medio | ayuda a pelear posicion y construir una estrategia mas ofensiva | aumenta exposicion a riesgo si se combina con tactica agresiva | pesa algo en race strength y perfiles AI |
| `overtake` | Medio a Alto | ayuda a remontar y capitalizar carreras bloqueadas | sin ritmo base, adelantar no alcanza | suma a race strength |
| `techFB` | Medio | mejora preparacion, lectura del coche y parrilla | no te salva solo en stint largo | pesa mas en fuerza de parrilla |
| `mental` | Medio | ayuda a estabilidad previa y lectura competitiva | su efecto hoy es mas sutil que `pace` o `racePace` | entra sobre todo en parrilla |
| `charisma` | Bajo | flavor, fan appeal, valor percibido | casi no cambia resultados deportivos directos | hoy entra solo via `pilotScore` general |

### Pros y contras de builds tipicas de piloto

- Piloto de `pace` alto: sale mejor y puede arrancar delante, pero si `racePace` y `tyre` son flojos puede desinflarse.
- Piloto de `racePace` + `consistency`: suele ser el perfil mas robusto para sumar puntos.
- Piloto de `rain` alto: te gana carreras climaticas, pero puede ser normal en seco.
- Piloto de `aggression` + `overtake`: ideal para remontar, pero mas expuesto si ademas subes el riesgo tactico.
- Piloto de `techFB` + `mental`: mejora preparacion y consistencia del fin de semana, aunque no siempre da el pico de velocidad maximo.

---

## 6. Staff

## 6.1 Variables base del staff

| Variable | Impacto | Pros | Contras / Riesgos | Logica actual |
|---|---:|---|---|---|
| `role` | Medio | define si sus stats cuentan para carrera | algunos roles casi no impactan hoy | filtro principal del sistema de staff |
| `salary` | Alto | staff mejor suele dar ventajas reales | aumenta gasto semanal | economia |
| `rarity` | Bajo | ayuda a leer calidad esperada | no influye por si sola | lectura / UX |
| `bio` | Bajo | flavor | ninguno | cosmetico |

## 6.2 Atributos del staff (`staff.attrs`)

| Atributo | Impacto | Pros | Contras / Riesgos | Logica actual |
|---|---:|---|---|---|
| `technical` | Alto | reduce riesgo de incidentes y ayuda a ritmo | requiere staff caro para escalar mucho | entra en `incidentRiskMult`, `paceBonus` y `overcutStrength` |
| `setup` | Alto | mejora `paceBonus`, `overtakeBonus` y calidad de puesta a punto | si es bajo, desaprovechas coche y circuito | atributo central del modelo de staff |
| `pitStrategy` | Alto | mejora undercut, probabilidad de pit rapido y reduce errores | si es bajo, pierdes mucho tiempo en boxes | atributo central del modelo de pits |
| `scouting` | Bajo a Medio | ayuda mas a fantasy/scouting que a carrera inmediata | poco impacto directo en simulacion de GP | poco conectado a carrera hoy |
| `commercial` | Bajo a Medio | tiene valor de fantasy/economia potencial | no pesa fuerte en formulas de carrera | conexion real limitada hoy |

## 6.3 Roles con impacto real hoy

| Rol | Impacto real |
|---|---|
| `Chief Engineer` | tecnico + setup |
| `Race Engineer` | setup + pit strategy |
| `Head of Pits` | pits |
| `Data Analyst` | setup + tecnico |

## 6.4 Roles con impacto mas debil hoy

| Rol | Estado actual |
|---|---|
| `Scout` | mas conectado a scouting/plantilla que a carrera |
| `Commercial Dir.` | mas fantasy/economia potencial que impacto fuerte inmediato |
| `Pilot Coach` | util para desarrollo, no tanto para simulacion de carrera pura |
| `Medic/Physio` | mas soporte y flavor que formula fuerte de carrera |

---

## 7. Coche

## 7.1 Variables base

| Variable | Impacto | Pros | Contras / Riesgos | Logica actual |
|---|---:|---|---|---|
| `car.name` | Bajo | identidad | ninguno | cosmetico |
| `car.rnd.points` | Medio | habilita mejora y progresion del coche | requiere inversion / tiempo | progresion tecnica |
| `car.rnd.active` / `queue` | Medio | gestion de roadmap tecnologico | mala cola retrasa crecimiento | progresion |

## 7.2 Componentes (`car.components.*.score`)

| Componente | Impacto | Pros | Contras / Riesgos | Donde pesa mas |
|---|---:|---|---|---|
| `engine` | Alto | mejora rendimiento en pistas rapidas / power | si sobreinviertes y descuidas otras areas, el coche queda sesgado | high-speed, power |
| `chassis` | Alto | da solidez en circuitos tecnicos y mixtos | menos espectacular en pistas de motor puro | technical, mixed |
| `aero` | Alto | mejora rendimiento en sectores tecnicos y equilibrio general | menos decisivo en trazados solo de potencia | technical, mixed |
| `tyreManage` | Alto | protege el stint y ayuda en endurance | no siempre se nota en una vuelta rapida | endurance, degradacion |
| `brakes` | Medio a Alto | ayuda en trazados tecnicos y control del paquete | impacto menos intuitivo que motor/aero | technical, reliability mix |
| `gearbox` | Medio | suma en circuitos power y consistencia mecanica | pocas veces luce sola | power, reliability mix |
| `reliability` | Alto | hace el paquete mas robusto y mejora layouts largos/mixtos | no siempre da una gran ganancia visible de ritmo inmediato | mixed, endurance |
| `efficiency` | Medio a Alto | ayuda en layouts rapidos y largos | efecto menos obvio que motor | high-speed, endurance |

### Variable derivada: `carScore()`

`carScore()` es la media de todos los componentes. Es una de las entradas principales para construir la fuerza base de salida y la base competitiva del coche.

Pros:

- simplifica la lectura general del paquete
- hace que un coche equilibrado rinda bien casi siempre

Contras:

- puede ocultar que tienes un punto debil muy fuerte en un layout concreto
- una media alta no garantiza ser ideal para todas las pistas

---

## 8. HQ e infraestructura

| Variable | Impacto | Pros | Contras / Riesgos | Logica actual |
|---|---:|---|---|---|
| `hq.admin` | Alto | mejora multiplicador de sponsors | aumenta upkeep semanal | economia |
| `hq.wind_tunnel` | Medio a Alto | desbloquea weather research y mejora ecosistema de setup/datos | cuesta mantenerlo | progresion tecnica |
| `hq.rnd` | Alto | desbloquea I+D y mejora velocidad de investigacion | requiere inversion | progresion del coche |
| `hq.factory` | Medio | mejora capacidad industrial y slots paralelos | coste fijo | progresion / fiabilidad |
| `hq.academy` | Medio | acelera entrenamiento y slots de academia | mantenimiento extra | progresion de pilotos |
| `construction.active` | Medio | permite crecer | durante la obra pagas mas y te inmoviliza presupuesto | coste de expansion |
| `construction.buildingId` | Bajo | indica que edificio mejora | ninguno directo | control de obra |
| `construction.startTime`, `durationMs`, `targetLevel` | Medio | controlan tiempo restante y alcance de mejora | si eliges mal, inmovilizas capital | progresion |

### Pros y contras del HQ

- HQ alto: escalas mas rapido, mejoras economia, I+D y training.
- HQ alto: mas coste fijo semanal y mayor necesidad de flujo de caja estable.

---

## 9. Sponsors y contratos

## 9.1 Sponsors

| Variable | Impacto | Pros | Contras / Riesgos | Logica actual |
|---|---:|---|---|---|
| `sponsors[]` | Alto | ingreso recurrente muy importante | expiran y pueden no renovarse | economia semanal |
| `sponsor.income` / `weeklyValue` | Alto | liquidez estable | si dependes demasiado de pocos sponsors, eres fragil | se suma al sponsorIncome |
| `sponsor.duration` / `weeksLeft` | Medio | planificacion | al vencer, pierdes ingreso | ciclo semanal |
| `sponsor.demand` | Bajo a Medio | puede servir como objetivo diegetico | si no lo conviertes en decision, es solo flavor | mezcla gameplay/narrativa |
| `sponsor.demandBonus` | Medio | premio extra si cumples | puede empujarte a estrategias suboptimas | bonus condicional |
| `sponsor.expired` | Medio | limpia sponsors terminados | te deja sin ingreso si no renuevas | se actualiza por semana |

## 9.2 Contracts

| Variable | Impacto | Pros | Contras / Riesgos | Logica actual |
|---|---:|---|---|---|
| `contracts[]` | Medio | pueden dar estructura adicional al metajuego | son coste fijo | economia |
| `contract.weeklyCost` | Medio | acceso al efecto del contrato | resta caja semanal | gasto recurrente |
| `contract.expired` | Medio | permite limpieza automatica | pierdes beneficio cuando vence | lifecycle semanal |

---

## 10. Estrategia de carrera

Estas son las variables que decides antes o durante el GP y que afectan de forma muy real los resultados.

| Variable | Impacto | Pros | Contras / Riesgos | Logica actual |
|---|---:|---|---|---|
| `strategy.tyre` | Alto | define ritmo inicial y longitud del stint | mal compuesto = carrera comprometida | compuesto de salida |
| `strategy.pitPlan` | Alto | ordena 1 o 2 paradas | un plan malo te encierra en trafico o desgaste | estructura del GP |
| `strategy.pitLap` | Alto | permite undercut/overcut y timing fino | parar fuera de ventana destruye tiempo total | vuelta objetivo de pit |
| `strategy.pitTyres[]` | Alto | define el resto del plan tras la primera parada | si el clima cambia, puede quedar desalineado | plan de compuestos |
| `strategy.aggression` | Alto | mejora ritmo / presion ofensiva | aumenta desgaste y puede empeorar estabilidad tactica | influye en fuerza, pace y overtakes |
| `strategy.riskLevel` | Alto | puede exprimir mas rendimiento | incrementa probabilidad de incidentes | entra directo en formula de riesgo |
| `strategy.engineMode` | Alto | `push` te da ritmo; `eco` protege | `push` castiga neumaticos y riesgo | modificador de pace/risk/tyre |
| `strategy.setup.aeroBalance` | Alto | si coincide con layout, da mucho pace | si te pasas, pierdes equilibrio | parte central del setup |
| `strategy.setup.wetBias` | Alto en clima cambiante | si acierta al clima, sube pace y baja riesgo | si fallas, castiga mucho | parte central del setup |
| `strategy.strategy` | Bajo a Medio | sirve como etiqueta / sesgo | pesa menos que las variables concretas | campo auxiliar |
| `strategy.safetyCarReaction` | Medio | puede ayudarte a reaccionar a VSC/SC | si es mala, pierdes oportunidad estrategica | usada sobre todo en AI/live calls |
| `strategy.interventions[]` | Medio a Alto | da control sobre ventanas de parada | si fuerzas demasiado, rompes el stint | estructura alternativa del pit logic |

### Pros y contras de las estrategias extremas

- `aggression` alta + `push`: ritmo alto y mas opcion de adelantar, pero castigas neumatico y subes riesgo.
- `riskLevel` alto: puede darte carrera heroica, pero tambien DNF o trompo.
- `eco` + baja agresividad: proteges goma y riesgo, pero te cuesta remontar.
- `soft` + doble parada: buen pico de ritmo, pero muy sensible a trafico o safety car fuera de ventana.
- `hard` + una parada: estable y segura, pero puede faltarte velocidad punta competitiva.

---

## 11. Setup derivado

El setup produce tres variables derivadas muy importantes:

| Variable derivada | Impacto | Significado | Pros | Contras |
|---|---:|---|---|---|
| `paceMult` | Alto | cuanto encaja el setup con pista y clima | mejora ritmo bruto | si es bajo, pierdes tiempo toda la carrera |
| `riskMult` | Alto | multiplicador de riesgo por setup | un buen setup reduce exposicion | uno malo te vuelve fragil |
| `tyreMult` | Alto | multiplicador sobre desgaste | un buen compromiso protege el stint | uno malo destruye neumaticos antes |

---

## 12. Neumaticos

| Variable | Impacto | Pros | Contras / Riesgos | Logica actual |
|---|---:|---|---|---|
| `soft` | Alto | mas rapida en seco | dura poco, sensible a mal setup | mejor pace, peor vida util |
| `medium` | Alto | equilibrio general | menos pico de ritmo que soft | compuesto baseline |
| `hard` | Alto | largo stint y estabilidad | mas lenta | estrategia conservadora |
| `intermediate` | Alto en mojado | ideal para lluvia intermedia | en seco penaliza mucho | clave si cambia el clima |
| `wet` | Alto en lluvia extrema | unica buena en lluvia fuerte | en seco es muy mala | muy contextual |
| `durabilityPct` | Alto | determina vida util del compuesto | si es alta, alargas stint | si es baja, el desgaste llega rapido | perfil del compuesto |
| `paceDeltaMs` | Alto | ganancia o perdida de tiempo por vuelta | un compuesto correcto da ventaja directa | uno incorrecto te hunde | delta fija por clima/compuesto |
| `usefulLife` | Alto | vueltas utiles antes del cliff | te deja planificar mejor | si la excedes, la penalizacion es dura | calculada por compuesto y clima |
| `wearPenalty` | Alto | castigo al pasarte de vida util | fuerza decisiones tacticas reales | puede arruinar el stint final | se acumula por exceso |

---

## 13. Circuito y clima

| Variable | Impacto | Pros | Contras / Riesgos | Logica actual |
|---|---:|---|---|---|
| `circuit.layout` | Alto | permite especializar coche/setup | si tu paquete esta desalineado, sufres toda la fecha | define biases de ritmo, desgaste, riesgo y adelantamiento |
| `circuit.laps` | Alto | escala la carrera y el valor del stint | mas vueltas amplifican decisiones malas | define longitud del GP |
| `circuit.length` | Medio | flavor y contexto de distancia | poco impacto directo aislado | mas informativo que formula central |
| `weather` | Alto | cambia ritmo, compuestos, riesgo y peso del atributo `rain` | clima cambiante castiga malas decisiones | variable critica del GP |
| `forecast.confidence` | Medio | buena prediccion mejora decisiones tacticas AI y planning | baja confianza aumenta incertidumbre | afecta adaptacion AI |
| `forecast.windows[].wetProb` | Medio | ayuda a anticipar cambio de neumatico | forecast erroneo puede inducir mala decision | usada sobre todo en adaptacion de AI |
| `paceBias` | Alto | multiplicador de ritmo del layout | si tu paquete encaja, brillas | si no encaja, te frena globalmente | derivado de pista y clima |
| `overtakeBias` | Alto | facilidad de adelantar | favorece remontadores | si es bajo, te quedas atrapado | derivado de pista y clima |
| `tyreDegMult` | Alto | severidad de desgaste | castiga malas estrategias de goma | algunas pistas multiplican mucho el problema | derivado de pista y clima |
| `riskBias` | Alto | nivel de peligro intrinseco | puede favorecer pilotos/control prudente | aumenta castigo a setups y riesgos extremos | derivado de pista y clima |

---

## 14. Variables derivadas de carrera

Estas no siempre son configurables por el jugador, pero son las que terminan empujando el resultado final.

| Variable | Impacto | Significado |
|---|---:|---|
| `pilotScore()` | Alto | media general del piloto. Resume todos sus atributos. |
| `getPilotGridStrength()` | Alto | fuerza de salida / parrilla. Usa mas `pace`, `racePace`, `consistency`, `techFB`, `mental`. |
| `getPilotRaceStrength()` | Alto | fuerza competitiva durante carrera. Usa mas `racePace`, `consistency`, `tyre`, `overtake`, `rain` y agresion. |
| `carScore()` | Alto | media global del coche. Entrada principal de competitividad base. |
| `trackCarBonus` | Alto | bonus del coche segun layout concreto. |
| `staffFx` | Alto | paquete derivado del staff: pits, risk, pace, overcut, undercut. |
| `base` / `gridScore` / `score` | Alto | fuerza sintetica usada para ordenar coches antes de carrera. |
| `pitLossMs` | Alto | tiempo perdido en boxes; puede decidir posiciones. |
| `lapTimeMs` | Alto | tiempo por vuelta final tras ritmo, modo motor, goma, desgaste, ruido y contexto. |
| `timeMs` | Alto | tiempo total acumulado en carrera. Variable final de clasificacion. |
| `gapMs` | Alto | diferencia respecto al lider. Sirve para evaluar rendimiento y flags de balance. |

---

## 15. Advisor y telemetria

| Variable | Impacto | Pros | Contras / Riesgos | Logica actual |
|---|---:|---|---|---|
| `advisor.mode` | Medio | cambia el tono/criterio de recomendacion | seguirlo sin contexto puede no ser optimo | conservative / balanced / aggressive |
| `advisor.recent[]` | Bajo a Medio | memoria reciente del rendimiento | sin volumen de datos puede dar lectura pobre | analitica |
| `advisor.layoutWeatherStats` | Medio | aprende por layout y clima | necesita historial | sistema de recomendaciones |
| `advisor.practice.sessions` | Bajo a Medio | mide trabajo de practica | impacto indirecto via telemetria/UX | no define carrera por si solo |
| `telemetry.byMode.*` | Bajo | estadistica historica | ningun beneficio directo instantaneo | analitica |
| `suggestion.cooldownWeeks` | Bajo | evita spam de sugerencias | puede retrasar ayuda util | UX / advisor |

---

## 16. Campana, objetivos e historia

| Variable | Impacto | Pros | Contras / Riesgos | Logica actual |
|---|---:|---|---|---|
| `campaign.phase` | Medio | ordena macroprogresion | si te estancas, sientes bloqueo | narrativa de progreso |
| `campaign.activeObjectiveId` | Alto | define la meta actual | puede empujarte a jugar suboptimo a corto plazo | afecta recompensas y foco |
| `campaign.history[]` | Medio | registra hitos y recompensas | no mejora el presente por si sola | progreso historico |
| `objectives[]` | Medio | fuente general de retos y recompensas | mal calibrados pueden frustrar | sistema de metas |
| `seasonHistory[]` | Bajo a Medio | historial de temporadas | valor narrativo y de hall of fame | analitica / prestigio |

### Objetivos de campana actuales

- `phase1_survive_prove`: acabar top 3 sin crisis financiera severa.
- `phase2_climb`: llegar a Division 5 o mejor.
- `phase3_dynasty`: ganar Division 1.

Pros:

- dan direccion al save
- añaden recompensa economica

Contras:

- pueden empujarte a priorizar solo una variable
- algunos obligan a balancear deporte y finanzas al mismo tiempo

---

## 17. Eventos aleatorios

| Variable | Impacto | Pros | Contras / Riesgos | Logica actual |
|---|---:|---|---|---|
| `randomEvents[]` | Medio | añade variacion y narrativa | introduce ruido en el plan a largo plazo | sistema de eventos pendientes |
| `RANDOM_EVENT_TEMPLATES` | Medio | mete oportunidades y crisis | puede desordenar economia o plantilla | plantillas de evento |

Estos eventos no son una variable de rendimiento puro en pista, pero si pueden afectar caja, riesgo, plantilla y moral de la partida.

---

## 18. Ajustes del jugador

| Variable | Impacto | Pros | Contras / Riesgos | Logica actual |
|---|---:|---|---|---|
| `settings.mode` | Bajo a Medio | puede cambiar como se presenta ayuda / asistencia | hoy no reescribe la formula nuclear de carrera | `assisted` vs `expert`, mas UX que simulacion |
| `settings.notifications` | Bajo | mejora seguimiento | ninguna ventaja jugable directa | UX |

---

## 19. Variables principalmente cosmeticas o poco conectadas hoy

Estas existen, pero conviene saber que hoy no son palancas mayores de balance real:

| Variable | Estado actual |
|---|---|
| `team.philosophy` | mucho flavor, poca traduccion mecanica directa hoy |
| `pilot.potential` | importante para fantasia de progresion, poca influencia directa inmediata en carrera |
| `pilot.morale` | visible en UI, pero hoy no decide la simulacion de GP de forma fuerte |
| `pilot.age` | flavor, sin gran formula propia |
| `pilot.charisma` | entra indirectamente en media general, pero con impacto pequeno |
| varios roles de staff no tecnicos | utiles para fantasy o futuras expansiones, impacto real actual mas bajo |
| varios pros descriptivos de `ENGINE_SUPPLIERS` | no todos estan plenamente cableados en formulas reales |

---

## 20. Variables mas importantes para ganar carreras hoy

Si tu objetivo es rendimiento deportivo puro, estas son las palancas mas fuertes en el estado actual del juego:

1. `car.components.engine/chassis/aero/reliability/tyreManage`
2. `pilot.attrs.racePace`
3. `pilot.attrs.pace`
4. `pilot.attrs.consistency`
5. `pilot.attrs.tyre`
6. `pilot.attrs.rain` en carreras mojadas
7. `staff.attrs.setup`
8. `staff.attrs.technical`
9. `staff.attrs.pitStrategy`
10. `strategy.setup.aeroBalance`
11. `strategy.setup.wetBias`
12. `strategy.aggression`
13. `strategy.riskLevel`
14. `strategy.engineMode`
15. eleccion de `tyre`, `pitPlan`, `pitLap` y `pitTyres`

---

## 21. Variables mas importantes para no destruir la economia

1. `finances.credits`
2. `finances.lastNet`
3. `finances.deficitStreak`
4. `pilot.salary`
5. `staff.salary`
6. `hq.admin` y el coste total del HQ
7. `sponsors[].income`
8. `team.fans`
9. `season.division`
10. `lastRaceSettlement.prizeMoney`

---

## 22. Lectura rapida de pros y contras por estilo de equipo

### Equipo de ritmo puro

- Pros: clasifica/sale mejor, presiona desde delante.
- Contras: si descuida fiabilidad, neumaticos o pits, pierde carreras largas.

### Equipo consistente

- Pros: suma puntos con regularidad, sobrevive mejor a temporadas largas.
- Contras: puede faltar techo para dominar.

### Equipo agresivo

- Pros: mas adelantamientos, mas opcion de remontada o sorpresa.
- Contras: mas desgaste, mas riesgo, mas volatilidad.

### Equipo tecnico y de datos

- Pros: setup mas fino, menos incidentes, mejor lectura del fin de semana.
- Contras: si el coche base es flojo, el dato no hace milagros.

### Equipo economico / estable

- Pros: crece sin entrar en crisis, sostiene el proyecto largo.
- Contras: si no convierte esa estabilidad en mejoras reales, se queda corto deportivamente.

---

## 23. Resumen ejecutivo

### Variables que hoy si estan muy conectadas

- atributos deportivos del piloto
- calidad del coche por componentes
- setup de carrera
- staff tecnico
- estrategia de gomas / pits / agresion / riesgo / engine mode
- pista, clima y desgaste
- flujo economico semanal y premio de carrera

### Variables que existen pero hoy pesan menos de lo que la UI sugiere

- filosofia
- potencial
- moral
- varios roles no tecnicos de staff
- parte de los pros narrativos de proveedores de motor

### Si quieres balancear el juego, mira primero

1. pesos de `getPilotRaceStrength()`
2. pesos de `getPilotGridStrength()`
3. composicion de `buildRaceGrid()`
4. efectos de `getSetupEffects()`
5. tablas de `TYRE_COMPOUNDS`
6. `getPitStopTimeMs()`
7. `getRaceStaffEffects()`
8. `calculateTeamIncomeBreakdown()` y `calculateTeamExpenseBreakdown()`
