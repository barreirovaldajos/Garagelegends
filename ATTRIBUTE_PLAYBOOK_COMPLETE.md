# Complete Attribute Playbook (MVP v1)

This document maps all major attributes in the game, what they affect today, and what is still descriptive/UI only.

Scope reviewed from code:
- js/state.js
- js/engine.js
- js/economy.js
- js/academy.js
- js/screens.js
- js/data.js
- js/divisions.js

## 1) Status legend

- ACTIVE: directly used in formulas/logic.
- PARTIAL: used in limited places, or only in one subsystem.
- DESCRIPTIVE: shown in UI/data but not connected to meaningful simulation logic yet.

## 2) Team attributes

### 2.1 team.reputation
Status: ACTIVE

Current effects:
- Increases by +1 on positive weekly net.
- Decreases on deficit weeks:
  - -3 when deficit streak < 3
  - -8 when deficit streak >= 3

Source: Economy.handleDeficitStatus.

### 2.2 team.fans
Status: ACTIVE

Current effects:
- Weekly fan revenue is calculated as:
  fanRevenue = floor(fans * 0.12)
- Fans also decrease on deficit streak:
  - -45 when deficit streak < 3
  - -120 when deficit streak >= 3

Sources: Economy.calculateTeamIncomeBreakdown, Economy.handleDeficitStatus.

### 2.3 team.engineSupplier
Status: PARTIAL

Current effects:
- If engineSupplier is vulcan:
  - HQ upgrade duration * 0.85 (startHqUpgrade)
  - Research duration * 0.8 (startResearch)

Notes:
- Onboarding now starts neutral (empty supplier).
- No broader balancing ecosystem by supplier yet.

### 2.4 team.philosophy, team.origin, team.countryFlag/logo/colors
Status:
- colors: ACTIVE in UI branding
- philosophy/origin/countryFlag/logo: DESCRIPTIVE/PARTIAL UI identity

Notes:
- These are mostly presentation and identity fields right now.
- No strong gameplay formulas tied to philosophy yet.

## 3) Finance attributes

### 3.1 Income model
Status: ACTIVE

Weekly income breakdown:
- sponsorIncome = sum(active sponsor weeklyValue or income) * sponsorMultiplier(admin)
- fanRevenue = floor(team.fans * 0.12)
- divisionGrant = table by division (1..8)
- bonusIncome = finances.bonusIncome (if any)
- income = sponsorIncome + fanRevenue + divisionGrant + bonusIncome

Admin HQ sponsor multiplier:
- +10% at admin >= 2
- +5% at admin >= 3
- +5% at admin >= 4
- +10% at admin >= 5

Source: Economy.calculateTeamIncomeBreakdown.

### 3.2 Expense model
Status: ACTIVE

Weekly expenses breakdown:
- salaries = pilot salaries + staff salaries
- hqCost = level-based upkeep for admin, wind_tunnel, rnd, factory, academy
- contractCost = sum(active contracts weeklyCost)
- constructionUpkeep = 500 while construction.active
- expenses = salaries + hqCost + contractCost + constructionUpkeep

Source: Economy.calculateTeamExpenseBreakdown.

### 3.3 Deficit pressure
Status: ACTIVE

- deficitStreak increments when net < 0, recovers gradually when net >= 0.
- criticalDeficit becomes true at streak >= 3.
- Reputation and fan penalties scale with streak severity.

Source: Economy.handleDeficitStatus.

## 4) Car attributes

### 4.1 Base car components
Status: ACTIVE

Current components:
- engine
- chassis
- aero
- tyreManage
- brakes
- gearbox
- reliability
- efficiency

Effects:
- carScore() is average of all component scores.
- Track layout uses specific component mixes for race base performance:
  - high-speed: engine + efficiency
  - power: engine + gearbox
  - technical: brakes + chassis + aero
  - mixed: chassis + aero + reliability
  - endurance: reliability + tyreManage + efficiency

Sources: engine.js carScore, buildRaceGrid.

### 4.2 R&D attributes
Status: ACTIVE

Research trees:
- acceleration -> boosts chassis
- power -> boosts engine
- reliability -> boosts reliability
- weather -> boosts aero

R&D gates:
- rndUnlocked requires hq.rnd >= 2
- weather research requires hq.wind_tunnel >= 2

R&D speed:
- hq.rnd speed multiplier from capability function
- vulcan supplier applies extra duration reduction

Sources: RESEARCH_TREES, startResearch, processResearch, getHqCapabilities.

## 5) HQ attributes

Status: ACTIVE

HQ fields:
- wind_tunnel
- rnd
- factory
- academy
- admin

Current capability effects:
- admin: sponsor income multiplier
- rnd:
  - unlocks R&D at level 2
  - increases research speed at level 3 and 5
- wind_tunnel:
  - unlocks weather research at level 2
- academy:
  - training slots (2 slots at level >= 3)
  - training speed multiplier increases across levels
  - injury risk multiplier defined at level 5
- factory:
  - exposes parallel slot capability in API (not fully exploited in all production queues)

Costs:
- all HQ levels also increase weekly hqCost.

Sources: getHqCapabilities, Economy.calculateTeamExpenseBreakdown, Academy.getAcademyCaps.

## 6) Pilot attributes

### 6.1 Core driver attrs
Status: PARTIAL -> mostly ACTIVE via aggregate score

Pilot attr set:
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

Current effects:
- pilotScore is average of all 10 attrs and is used in race base score.
- rain has extra direct wet multiplier in race base.
- overtake is not directly isolated in formula, but contributes via pilotScore.

Important nuance:
- Many attrs affect race indirectly through the aggregate average.
- If you want stronger differentiation, attrs should get explicit per-phase formulas.

Source: pilotScore, buildRaceGrid.

### 6.2 potential, morale, contractWeeks
Status:
- potential: DESCRIPTIVE today
- morale: DESCRIPTIVE/PARTIAL UI today
- contractWeeks: DESCRIPTIVE today

Notes:
- These appear in UI and data models.
- No weekly decrement or contract expiry logic is currently wired.
- No clear morale-to-performance multiplier currently applied.

Sources: screens.js rendering, searches across js/**.

### 6.3 Daily training
Status: ACTIVE

- trainPilot(pid) can run once per real day per pilot.
- Increases one random attr by +1 or +2, capped at 99.

Source: trainPilot in engine.js.

## 7) Staff attributes

Staff attrs in data:
- technical
- setup
- pitStrategy
- scouting
- commercial

Status:
- technical/setup/pitStrategy: ACTIVE
- scouting/commercial: DESCRIPTIVE today

Active race impacts from staff:
- pitErrorChanceMult
- pitTimeGainChance
- undercutStrength
- overcutStrength
- incidentRiskMult
- overtakeBonus
- paceBonus

These are built from weighted role-based averages of pitStrategy/setup/technical.

Source: getRaceStaffEffects.

## 8) Race strategy attributes

Status: ACTIVE

Main strategy fields currently wired:
- tyre
- aggression
- riskLevel
- engineMode
- pitPlan
- pitLap
- safetyCarReaction
- setup.aeroBalance
- setup.wetBias
- interventions[]

These influence:
- race base score
- tyre degradation and stint plan
- incident probability
- overtake chance
- VSC reaction behavior
- setup pace/risk/tyre modifiers

Detailed race-only formulas are documented in:
- RACE_STRATEGY_PLAYBOOK.md

## 9) Sponsors and contracts

### 9.1 Sponsor fields
Status:
- income/weeklyValue: ACTIVE
- name/logo/color/bg: ACTIVE UI identity
- duration/weeksLeft: ACTIVE
- demand/demandBonus: PARTIAL or DESCRIPTIVE

Current behavior:
- Sponsor income contributes weekly while sponsor is not expired.
- Each weekly tick decrements weeksLeft by 1.
- If weeksLeft reaches 0, sponsor is marked expired and stops contributing income.
- demand and demandBonus are mostly data/UI-level (not fully enforced by race outcomes).

Sources: economy.js sponsor filtering and income sum, screens.js sponsor add flow.

### 9.2 Contracts array
Status: ACTIVE (lifecycle) / PARTIAL (gameplay depth)

- contracts.weeklyCost is included in weekly expenses.
- Weekly lifecycle is now active:
  - weeksLeft is decremented each week.
  - contract is marked expired when weeksLeft reaches 0.
- Missing depth remains in renewal/negotiation systems.

Source: Economy.calculateTeamExpenseBreakdown.

## 10) Season, standings, campaign attributes

Status: ACTIVE

Main seasonal fields affecting progression:
- season.year, season.week, season.raceIndex, season.division, season.phase
- standings points/wins/position
- seasonHistory snapshots
- campaign.phase, objectives and rewards

Active behavior:
- Promotion/relegation based on final position and division config.
- Season transition resets R&D queue and rebuilds standings/calendar.
- Campaign objectives evaluate at season end and can grant credits.

Sources: weeklyTick, endSeason, getDivisionTransition, evaluateCampaignObjective.

## 11) Advisor attributes

Status: ACTIVE

Stored advisor telemetry (mode performance, recent strategies, layout-weather memory) affects future recommendations:
- mode profiles: conservative / balanced / aggressive
- layoutWeatherStats memory
- confidence and guardrails for recommendations

Sources: recommendStrategyForRace, recordStrategyOutcome, getAdvisorTelemetry.

## 12) Active vs descriptive matrix (quick table)

Fully ACTIVE now:
- team.reputation, team.fans
- finances.* weekly model
- car.components + R&D
- hq levels and capability gates
- strategy fields for race simulation
- seasonal progression, standings, campaign objectives
- advisor telemetry and recommendations

PARTIAL now:
- team.engineSupplier
- pilot attrs (many indirect via pilotScore, few direct)
- contracts renewal/negotiation depth
- sponsor demand/demandBonus enforcement
- factory parallel slots exposure

Mostly DESCRIPTIVE now:
- pilot potential
- pilot morale as performance multiplier
- pilot contractWeeks lifecycle
- staff scouting/commercial formula effect
- sponsor demand and demandBonus enforcement
- team.philosophy gameplay effect

## 13) Recommended priority backlog (impact first)

1. Wire sponsor lifecycle:
- decrement weeksLeft weekly
- auto set expired
- remove or renew contracts in UI flow

2. Enforce sponsor demands:
- evaluate per race/week/season
- apply demandBonus and penalties clearly

3. Convert pilot morale into race effect:
- e.g. small pace/incident modifiers by morale brackets

4. Make pilot attrs more differentiated:
- explicit race phase formulas for consistency, tyre, overtake, mental
- reduce over-reliance on simple average pilotScore

5. Activate staff scouting/commercial:
- scouting quality -> better scouting pool quality/discovery odds
- commercial -> better sponsor offers / income multipliers

6. Add contract system end-to-end:
- weekly decrement for pilot/staff contracts
- renewal, release, auto-negotiation states

## 14) Practical KPI dashboard for balancing

Track these after each tuning pass:
- average finishing position (last 5 races)
- DNF rate
- weekly net CR trend
- deficitStreak frequency
- fan and reputation drift
- sponsor portfolio quality (total weekly sponsor income)

If you want, next step I can produce a second file with exact implementation specs (data schema + pseudocode) for each backlog item above, ready to code in order.
