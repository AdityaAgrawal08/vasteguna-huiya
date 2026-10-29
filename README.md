# Sansad Showdown

A Tekken-style 3D browser fighting game — a light-hearted political parody with six
caricature "netas", three stages, a full frame-data combat system, specials, combos,
grabs, a SHAKTI super meter and cinematic super moves.

Built with three.js, vanilla ES modules and Vite. No external art or audio assets:
characters, stages, portraits and sound are generated procedurally at runtime.

## Run

```bash
npm install
npm run dev        # http://localhost:4173
npm run build
npm run preview
```

## Controls

| Action | Keyboard |
| --- | --- |
| Move / block | A / D (hold back to block) |
| Jump / crouch | W / S |
| Punch | J |
| Kick | K |
| Grab | I or J+K |
| Super (SHAKTI full) | L or Space |
| Pause | Esc |
| Music / mute | M / N |

Specials: →Punch, →Kick, ↓Kick (sweep). Combos: J,J,J · J,J,J,K · J,K,K · K,K ·
↓J,J · ↓J,K. Touch devices get an on-screen stick and PUNCH / KICK / GRAB / SUPER.

## Roster

| Neta | Party | Super |
| --- | --- | --- |
| MODI | Team Saffron | SUDARSHAN CHAKRA |
| RAHUL | Team Tiranga | ALOO SE SONA |
| DIDI | Team Bangla | JADU HOBE |
| TRUMP | Team Tariff | TARIFF TSUNAMI |
| YOGI | Team Bhagwa | BABA KA BULLDOZER |
| NITIN | Team Highway | GADDHA BLAST |

Stages: Sansad Bhavan, Jantar Mantar, Desi Sadak. CPU difficulty: Easy / Normal / Hard.

## Architecture

- `src/game/data.js` — roster, frame data, stage palettes, commentary copy
- `src/game/engine.js` — deterministic 60 Hz fighter + match simulation
- `src/game/ai.js` — CPU planner with difficulty profiles
- `src/game/fighters3d.js` — procedural character rigs and animation
- `src/game/arena.js` — procedural stage geometry, lighting, camera
- `src/game/supers.js` — six cinematic super-move sequences
- `src/game/cow.js` — the stray-cow stage interruption
- `src/game/audio.js` — WebAudio SFX and procedural music
- `src/ui.js`, `src/style.css`, `index.html` — screens, HUD, newsdesk, newspaper
- `src/input.js` — keyboard + touch input
- `src/portraits.js` — canvas caricature portraits

## Tests

```bash
npm run test:engine   # deterministic combat assertions (hit, block, special, sweep, super, KO, grab, scaling, time-up)
npm run test:ai       # CPU vs CPU matches on all three difficulties
npm run test:supers   # all six cinematic super sequences build, animate and dispose
npm run test:e2e      # Playwright: title → select → fight → hit → pause → result → rematch → super
npm run test:local2p  # Playwright: friend-room → same-device 2P controls
npm run test:cow      # Playwright: the stray-cow stage interruption
npm run test:stages   # Playwright: all three stages render and start a fight
```

The e2e run writes screenshots to `tests/screenshots/`. The browser tests use
`?quality=low` so they run at a usable speed under software WebGL; the game itself
defaults to the full-quality renderer (shadows, particles, high pixel ratio).

## Note on online play

The original site pairs two browsers through a WebRTC relay service. This build ships
CPU play plus a same-device 2-player mode (P2: arrow keys to move, numpad 1/2/3 to
punch/kick/grab, numpad 0 for super). The friend-room screen keeps the room-code flow
and explains that a relay server is required for cross-device play. The deterministic
match simulation is ready to be driven by a netcode adapter (the engine consumes two
input structs per frame).
