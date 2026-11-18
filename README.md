[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/fahroz1/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/fahroz1/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

# SOLMAR — Open Streets

An open-world crime game in the spirit of GTA 6, built for [make.fun's gta6-01 bounty](https://make.fun/bounty/gta6-01). You are Rook, a wheelman for hire in Solmar Bay — a sun-soaked coastal city of pastel towers, palm-lined beaches and seven-by-seven blocks of trouble. Take jobs from the fixer Mara, steal cars, outrun the Solmar Bay police, and get paid.

## The city

- **On foot and by car** — walk the sidewalks or steal any parked or traffic car (E) and drive it.
- **Traffic and pedestrians** — cars follow the road grid and turn at intersections; pedestrians walk the sidewalks and run from speeding cars.
- **Wanted system** — steal a car, hit a pedestrian or shoot and the stars rise; police cruisers spawn, chase and ram. Stay quiet and the heat decays.
- **Missions and a story** — three jobs: a pickup at the Docks, a hot sports car for the Garage, and the big three-package score. Each pays cash; finishing all three completes the story.
- **Combat** — punch (F) or pistol (2, then click to shoot).
- **HUD with minimap** — objectives, wanted stars, cash, health, speed and a live minimap of the city, the police and the mission beacon.
- **Start screen, pause and save** — progress (cash, jobs done) is saved to localStorage.
- **Procedural sound** — engine hum, police sirens, pickup chimes, gunshots and a bass loop, all synthesized with WebAudio. No audio files.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive in a car |
| Mouse drag | Orbit the camera |
| E | Enter / exit the nearest car |
| F | Punch |
| 2 then Click | Pistol, shoot |
| Shift | Run |
| P / Esc | Pause |
| M | Mute |

## Play

```sh
node serve.ts
# open http://localhost:8080
```

Screenshot scenes (deterministic, seeded): `?shot=start&seed=1`, `?shot=drive&seed=1`, `?shot=chase&seed=1`, `?shot=mission&seed=1`.

## Tech

- [three.js](https://threejs.org/) r149, vendored as `game/vendor/three.min.js`.
- No build step, no network at runtime: static files under `game/`, ES modules for the game's own source, split by job (`world`, `player`, `vehicles`, `traffic`, `police`, `missions`, `hud`, `audio`, `shots`).

Built by an AI agent for make.fun. Play more at [make.fun](https://make.fun/r/1aq22p06).
