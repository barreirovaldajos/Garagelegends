# Division Tree Design (Numeric Node IDs)

## 1) Goal
Build a scalable division system where multiple leagues exist in parallel per tier, with configurable promotion and relegation flows.

Example node IDs:
- D8-12
- D8-13
- D7-12

No letter suffixes are used.

## 2) Core Concepts

### 2.1 Node
A node is one competition group in a specific tier.

```json
{
  "id": "D8-12",
  "tier": 8,
  "slot": 12,
  "name": "Division 8 / League 12",
  "capacity": 10,
  "rules": {
    "promoteTop": 2,
    "relegateBottom": 0
  },
  "edges": {
    "up": ["D7-12"],
    "down": []
  }
}
```

### 2.2 Edge
Directed connection used for movement at season end.
- up edge: where promoted teams can go
- down edge: where relegated teams can go

### 2.3 Tier Plan
Defines how many parallel nodes exist per tier and their default movement rules.

```json
{
  "tiers": {
    "8": { "parallel": 20, "capacity": 10, "promoteTop": 2, "relegateBottom": 0 },
    "7": { "parallel": 16, "capacity": 10, "promoteTop": 2, "relegateBottom": 2 },
    "6": { "parallel": 12, "capacity": 10, "promoteTop": 2, "relegateBottom": 2 },
    "5": { "parallel": 8,  "capacity": 12, "promoteTop": 2, "relegateBottom": 2 },
    "4": { "parallel": 6,  "capacity": 12, "promoteTop": 2, "relegateBottom": 2 },
    "3": { "parallel": 4,  "capacity": 14, "promoteTop": 2, "relegateBottom": 2 },
    "2": { "parallel": 2,  "capacity": 16, "promoteTop": 2, "relegateBottom": 2 },
    "1": { "parallel": 1,  "capacity": 20, "promoteTop": 0, "relegateBottom": 3 }
  }
}
```

## 3) ID Convention

### 3.1 Format
`D{tier}-{slot}`

Examples:
- D8-12
- D8-13
- D7-12

### 3.2 Validation
- tier in [1..8]
- slot >= 1
- unique per graph

## 4) Data Model (Game State)

Add a competition object in state:

```json
{
  "competition": {
    "graphVersion": 1,
    "currentNodeId": "D8-12",
    "season": {
      "year": 1,
      "nodeId": "D8-12"
    },
    "history": [
      {
        "year": 1,
        "fromNode": "D8-12",
        "toNode": "D7-12",
        "finish": 2,
        "result": "promoted"
      }
    ]
  }
}
```

Standings remain local to current node season, but node transitions are driven by competition graph.

## 5) Season-End Transition Algorithm

Input:
- final standings in current node
- node rules (promoteTop, relegateBottom)
- graph edges (up/down)

Output:
- transition result: promoted/stable/relegated
- nextNodeId

### Steps
1. Rank teams in current node.
2. Determine if player is in promotion/relegation zone.
3. Build candidate destination pool from edges.
4. Assign destination deterministically:
   - primary: mapped slot index (same slot if edge exists)
   - fallback: nearest slot by numeric distance
   - final fallback: lowest-load node in target tier
5. Return transition + next node.
6. Regenerate season calendar and standings for next node.

## 6) Tie-Break Rules
Use deterministic order:
1. Points
2. Wins
3. Best finish
4. Head-to-head points
5. Seeded stable hash(teamId + year + nodeId)

## 7) Capacity and Overflow Handling

When many teams move at once:
1. Fill reserved promoted slots first.
2. Fill relegated slots second.
3. If overflow:
   - move extra teams to nearest sibling node (same tier)
   - if all full, expand capacity by temporary +1 slot and mark maintenance warning

## 8) Migration Plan from Current System

Current system uses a single numeric division in season object.

### One-time migration
1. Map old `season.division` to a default node:
   - div 8 -> D8-1
   - div 7 -> D7-1
   - ...
2. Create competition.currentNodeId.
3. Keep old `season.division` temporarily for compatibility.
4. During runtime, derive `season.division` from currentNodeId tier.
5. After stable release, remove old single-division source of truth.

## 9) Integration Points

- js/divisions.js:
  - own graph generation/loading
  - expose getNodeConfig(nodeId), getNeighbors(nodeId), resolveTransition(...)

- js/engine.js:
  - replace getDivisionTransition() with node-based transition
  - season reset should use nextNodeId and then derive tier from node

- js/state.js:
  - add migration for competition object
  - clamp invalid node IDs to defaults

- UI screens:
  - show both tier and node, eg: Division 8 / League 12

## 10) Rollout Phases

### Phase 1 (Safe)
- Introduce graph model and migration.
- Keep current single-league behavior by creating 1 node per tier.

### Phase 2
- Enable parallel nodes in D8/D7 only.
- Validate promotions/relegations and capacity.

### Phase 3
- Enable full tree all tiers.
- Add balancing tools and debug dashboard.

## 11) QA Checklist

- Can finish season and always continue to next race.
- Promotion from D8-x never relegates below D8.
- Relegation from D1-x never promotes above D1.
- Node assignment deterministic across reloads.
- No orphan teams after transitions.
- Calendar and standings regenerate correctly in destination node.

## 12) Example Transition

Player in D8-12 finishes P2.
- Rule: promoteTop=2
- Edge up: D7-12 exists
- Result: promoted to D7-12
- New season starts at week 1 with fresh calendar and standings for D7-12.
