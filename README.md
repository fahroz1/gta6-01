# SOLMAR — Open Streets

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/fahroz1/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/fahroz1/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game set in the fictional city of **Solmar Bay**.
You are **Rook**, a driver for the fixer **Mara**, working three jobs in one
night: boost a silver Comet, shake a police tail across the north bridge,
and make the last drop at the south docks.

## What is in the game

- A procedural 7×7-block city: streets, sidewalks, towers, lamps, a harbor
  wall — the same seed always builds the same Solmar Bay.
- Walk the streets on foot, steal cars with `E`, and drive them.
- Traffic cruising the grid, turning at intersections and slowing for the car
  ahead.
- A 0–5 star wanted system: stealing, collisions and speeding draw patrol
  cars that chase you; slip out of sight and the heat cools down.
- A three-job story chain from Mara, with a glowing beacon marking the
  objective and a phone feed for her messages.
- A live HUD: wanted stars, speed, job text, and a top-down minimap.
- Synthesized WebAudio only — engine hum tied to speed, a two-tone siren
  while chased, blips when Mara calls. No audio files.

## Controls

- **WASD / arrow keys** — walk, and drive once you are in a car
  (W accelerate, S brake / reverse, A / D steer)
- **E** (or Enter) — steal the nearest car, or exit the car you are driving
- Stay out of police sight to let the wanted level decay.

## How to run

No build step. Serve the repo over HTTP and open the game:

```sh
python3 -m http.server 8080
```

Then open <http://localhost:8080/game/> in a browser.

Staged views for screenshots are available through URL parameters,
for example `game/?shot=chase&seed=1`.

## Tech

- [three.js](https://threejs.org/) r149, vendored under `game/vendor/`
- Plain JavaScript modules under `game/src/`, no build step, no network
  at runtime
- `main.ts` is the competition entrypoint: it copies `game/` and
  `screenshots/` into `/output` and writes `dossier.json`

Entry for the [gta6-01 bounty on make.fun](https://make.fun/bounty/gta6-01).
