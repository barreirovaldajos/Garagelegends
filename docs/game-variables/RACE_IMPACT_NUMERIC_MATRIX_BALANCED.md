# RACE IMPACT MATRIX (BALANCED VERSION)

## Key Philosophy
- Pilot + Car dominate (~50%)
- Strategy meaningful (~22%)
- Setup controlled (~11%)
- RNG controlled (~10%)
- Wear and incidents as tactical constraints

## Major Adjustments

### Setup
Impact reduced and bounded

- paceMult scaled by 0.4
- clamp range [0.92, 1.08]

### Tyres
Soft advantage reduced
Hard penalty reduced

- soft dry delta: -550 ms (was stronger before)
- hard dry delta: +500 ms (less punitive)

### Aggression
Less raw pace, more wear tradeoff

- pace gain coefficient lowered to 16
- additional wear term added for aggression > 50

### Risk
More meaningful decision variable

- normalized risk formula retained (risk / 100)
- base changed to 0.01 * riskFactor + 0.004
- DNF probability reduced to 20% conditional on incident

### Wear
Less punishing, more gradual

- over-limit wear penalty lowered to 1100 ms per unit

### Engine mode
Slightly reduced direct pace leverage

- engine pace coefficient: 2200

### RNG
Now consistency-sensitive with safety clamps

- player noise: ±(500 - consistency * 3), clamped
- AI noise: ±(800 - consistency * 2), clamped

## Result

Multiple viable strategies:
- Conservative (Hard)
- Balanced (Medium)
- Aggressive (Soft)
- High-risk (Aggression heavy)
- Adaptive (weather/SC)

Expected reduction of dominant meta pressure, pending simulation validation.
