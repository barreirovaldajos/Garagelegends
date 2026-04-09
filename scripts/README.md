# Scripts

## Advisor Smoke Tests

Run:

```powershell
node .\scripts\advisor-smoke-tests.js
```

**Coverage (13 test cases):**

**Core:**
- week index mapping
- suggestion cooldown window
- policy lock window
- window comparison acceptance metrics
- data health classification

**Edge cases:**
- cooldown with no prior activation
- policy lock default behavior
- window comparison with insufficient history
- low data health threshold
- ignore reason breakdown (expired vs override)
- analysis window validation (5/10/20 enforcement)

## Core Loop Smoke Tests

Run:

```powershell
node .\scripts\core-loop-smoke-tests.js
```

## Account/State Smoke Tests

Run:

```powershell
node .\scripts\account-state-smoke-tests.js
```

## Unified MVP Smoke Tests

Run both suites with one command:

```powershell
node .\scripts\mvp-smoke-tests.js
```
