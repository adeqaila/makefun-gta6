# SOLMAR BAY — Open World

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/adeqaila/makefun-gta6/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/adeqaila/makefun-gta6/reward.svg)](https://make.fun/bounty/gta6-01)

An open-world crime game in the spirit of GTA 6, built for the make.fun
gta6-01 bounty. It runs entirely from static files in a desktop browser —
no network, no build step. Open `game/index.html` and play.

## The story

Rico Vale owes Marisol Kane $2,000. Three jobs stand between him and a
clean slate: pick up a package at the Harbor Steps ($400), deliver it to
the North Docks ($600), and settle the debt at Club Neon Palms ($1,000) —
where Marisol's armed crew is waiting.

## The city

Solmar Bay is a sun-soaked coastal city: a grid of avenues, the Solmar
Tower, a neon club, a beach and the ocean. Fourteen cars cruise the
traffic grid and thirty-six pedestrians stroll the sidewalks, all placed
by a seeded random generator so the city is the same every time.

## What is in the game

- Explore on foot (WASD, mouse orbit, Shift to run) or by car (steal one
  with E, drive with W/S and steer with A/D)
- A wanted system, 0–5 stars: stealing, shooting and hitting pedestrians
  raise the heat; up to four police cruisers chase, ram and — on foot —
  cuff Rico if they corner him. Lay low and the stars fade.
- Combat: punch with F, shoot with a mouse click (ammo, muzzle flash,
  tracers); rivals shoot back during the final job.
- Three chained missions with a glowing 3D beacon, HUD objective text and
  a 2D minimap that tracks the player, traffic, police and the target.
- A full HUD (money, health, ammo, wanted stars, clock, speed), start /
  pause / game-over screens, synthesized WebAudio sound (engine, sirens,
  gunshots, fanfare — M mutes), and automatic saving to localStorage.
- Deterministic screenshots: the four staged shots in `shots.json`
  reproduce byte-identical JPEGs across independent captures.

## Layout

- `game/index.html` — the page, HUD and menus
- `game/vendor/three.min.js` — three.js r149 (vendored)
- `game/src/` — seventeen modules, one job each: `config`, `random`,
  `city`, `carMesh`, `traffic`, `pedestrians`, `player`, `vehicles`,
  `police`, `combat`, `missions`, `hud`, `audio`, `save`, `shots`,
  `three` (shim) and `main` (bootstrap and fixed-step loop)
- `main.ts` — the hand-in program (Node 22), copies `game/` and
  `screenshots/` to the output directory and writes `dossier.json`
- `screenshots/` — four renders of the game itself, 1280×720

## Play it

Serve `game/` with any static file server and open `index.html`, or run
`node serve.ts` if a server script is present. Everything the game loads
is a file under `game/` or a `data:` URI.
