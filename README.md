[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/adeqaila/makefun-gta6/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/adeqaila/makefun-gta6/reward.svg)](https://make.fun/bounty/gta6-01)

# SOLMAR BAY — Open World

Entry for the make.fun bounty "Make GTA 6" (gta6-01): a complete 3D open-world city game in the browser, built with three.js.

A fictional sun-soaked coastal city. Rico Vale owes Marisol Kane, and three chained missions (M1–M3) are how he pays her back. Walk the streets, steal a car, outrun the police — wanted level rises, the city reacts.

## Play

- Walk: WASD + mouse orbit, run with Shift; enter/exit cars with E
- Drive: W/S + steering A/D; NPC cars can be stolen (+wanted)
- Traffic (14 cars) follows the road grid; 36 pedestrians walk the sidewalks
- Police pursuit with wanted stars; missions advance the story; progress saves to localStorage

## Tech

- three.js r149 (vendored `game/vendor/three.min.js`), 16 focused `game/src` modules, one job per file
- `main.ts` (Node 22, stdlib only) copies `game/` and `screenshots/` to `/output` and writes `/output/dossier.json` via the vendored `vendor/makefun-game.ts`
- Deterministic: two grader-style runs produce byte-identical dossiers
- `serve.ts` is a pocket static server for local play (`node serve.ts`, port 8080)

## Files

- `main.ts` — entrypoint
- `game/` — the game (index.html + 16 src modules + vendored three.js)
- `screenshots/` — 4 shots (chase/street/onfoot/start, seed 1)
- `shots.json` — the 4 camera shots
- `serve.ts` — dev static server
- `vendor/makefun-game.ts` — make.fun dossier library (kit copy, unmodified)
