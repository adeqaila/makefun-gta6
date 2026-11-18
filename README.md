[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/adeqaila/makefun-gta6/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/adeqaila/makefun-gta6/reward.svg)](https://make.fun/bounty/gta6-01)

# SOLMAR BAY — An Open-World Story in the Sun

An open-world crime game in the spirit of GTA 6, built for the make.fun
[gta6-01](https://make.fun/bounty/gta6-01) bounty. A fictional sun-soaked
coastal city. Rico Vale owes Marisol Kane more money than he has — three jobs
stand between him and a clean slate.

## Play

Serve `game/` with any static HTTP server and open `game/index.html` in
desktop Chrome. No build step, no network requests at runtime.

- **On foot:** WASD move, Shift run, mouse drag to look, F punch, click shoot
- **Driving:** E enter/exit a car, W/S drive, A/D steer — any traffic car can
  be stolen (raises your wanted level)
- **Wanted:** 0–5 stars; police chase, ram, and bust you. Lay low to cool off
- **Missions:** 3 chained jobs (M1–M3) with beacons, HUD objectives and
  minimap markers; rewards $400 / $600 / $1,000
- **Systems:** traffic, pedestrians, combat, HUD + 2D minimap, start/pause/
  game-over screens, localStorage saves, synthesized WebAudio (M to mute)

## Entry

`main.ts` (Node 22) copies `game/` and `screenshots/` to `/output` and writes
`/output/dossier.json` with `buildDossier` from `vendor/makefun-game.ts`.
Deterministic: two runs produce a byte-identical dossier.

## Structure

- `game/index.html` — page, HUD, start/pause/game-over screens
- `game/src/` — 17 modules, one clear job each (city, traffic, pedestrians,
  player, vehicles, police, combat, missions, hud, audio, save, shots, ...)
- `game/vendor/three.min.js` — three.js r149 (vendored)
- `screenshots/` — 4 real renders of the game (cover first)
- `shots.json` — deterministic shot staging (seed 1)
