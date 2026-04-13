# RACE FORMULAS (BALANCED VERSION)

## Key Changes Applied:
- Reduced setup impact
- Increased pilot influence
- Balanced tyres
- Smoothed wear penalty
- Improved risk vs reward
- Consistency-based RNG

## Setup
paceMult = 1 + 0.4 * (layoutFit + weatherFit)
paceMult clamped between 0.92 and 1.08

## Race Strength
RaceStrength =
0.48 * Overall +
0.26 * racePace +
0.16 * consistency +
0.10 * tyre +
0.10 * overtake +
bonuses

## Aggression
AggressionMs = 16 * (Agg - 50)

Additional wear:
Wear += max(0, (Agg - 50) * 0.003)

## Risk
P(incident) = (0.01 * (risk / 100) + 0.004) * multipliers

## Tyres (dry)
soft = -550 ms
medium = 0
hard = +500 ms

## Wear penalty
WearPenalty = 1100 ms per unit over limit

## Engine mode
EngineMs = 2200 * EnginePace

## RNG
PlayerNoise = ±(500 - consistency * 3)
AINoise = ±(800 - consistency * 2)

Noise clamped to avoid zero variance:
- player half-range clamp: [120, 520]
- AI half-range clamp: [220, 900]

## Incidents
DNF = 20%
Spin = 80%

Note: DNF/Spin split is conditional on an incident already happening.
