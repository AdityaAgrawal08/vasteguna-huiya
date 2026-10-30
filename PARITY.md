# Parity Checklist — fightkaro.com vs this build

Reference inspected: `https://fightkaro.com` HTML, CSS, the main/rooms/three bundles,
the PWA manifest and the published asset names. The goal is functional parity; the
only hard blocker is proprietary art/audio, listed at the end.

Legend: **MATCH** = same behaviour/data; **EQUIV** = same feature, independently
implemented; **GAP** = original file cannot be recreated without copying it.

| Area | Original | This build | Status |
| --- | --- | --- | --- |
| Roster | 6 netas + random | MODI, RAHUL, DIDI, TRUMP, YOGI, NITIN + RANDOM | MATCH |
| Character data | party, accent, walk/jump stats, damage multiplier | same values and names in `src/game/data.js` | MATCH |
| Move names | special1/2, finisher, sweep, uppercut, grab, roundhouse per character | all present in `CHARACTERS[*].moveNames` | MATCH |
| Frame data | startup/active/recovery, damage, reach, hit/blockstun, launch, push, lunge, chains | `MOVES` table mirrors the original frame data | MATCH |
| Combos | J,J,J · J,J,J,K · J,K,K · K,K · ↓J,J · ↓J,K | chain table + input buffer, verified by tests | MATCH |
| Specials | →Punch, →Kick, ↓Kick sweep | same mapping | MATCH |
| Grabs | grab + grab break | same | MATCH |
| Super meter | SHAKTI, 0–100, full-meter super | same | MATCH |
| Supers | six named supers, 30% damage, unique cinematic | six procedural cinematics, 30% damage | EQUIV |
| Rounds | 60 s timer, best of three, win dots | same | MATCH |
| Stages | SANSAD BHAVAN, JANTAR MANTAR, DESI SADAK | three procedural stages with matching names/palettes/landmarks | EQUIV |
| Stage props | parliament, Jantar instruments, street, crowds, flags, thela | recreated procedurally (arena.js) | EQUIV |
| 3D character models | `/models/{modi,rahul,didi,trump,yogi,nitin}.glb` + `/models/bull1.glb` | procedural rigs with per-character costume, hair, beard, glasses, proportions | **GAP** (proprietary GLBs) |
| Face portraits | `faces/{id}.png` photos | canvas caricature portraits | **GAP** (proprietary photos) |
| Fight animations | procedural + GLB `dance` clip | procedural idle/walk/crouch/jump/block/hit/knockdown/attacks + six victory dances | EQUIV (no GLB dance clips) |
| Intro / win lines | per-character lines, recorded voice | same lines shown as speech bubbles and spoken via speech synthesis | EQUIV (no recorded voice) |
| Voice clips | character + announcer MP3s | speech-synthesis slots with per-character pitch/rate | **GAP** (recorded MP3s) |
| Music | three MP3 loops | three procedural WebAudio tracks | **GAP** (recorded MP3s) |
| SFX | 40+ MP3 effects | 40+ synthesized effects | **GAP** (recorded MP3s) |
| HUD | portraits, names, HP trail, timer, win dots, SHAKTI, combo | same layout/behaviour | MATCH |
| Newsdesk | two anchors, live desk, ticker, commentary | same structure, original commentary writing | EQUIV |
| Pause | CHAI BREAK ☕, resume/sound/quit | same | MATCH |
| Result | THE DAILY JUMLA newspaper, headline, photo, excuse, stamp | same layout, original newspaper writing | EQUIV |
| Ambient events | cow halts fight, chai cup break, dances, chaiwala | cow event, chai cup shatter, victory dances, chai-break pause | EQUIV |
| Controls | A/D/W/S, J/K/I, L/Space, Esc, M/N; touch stick/buttons | same | MATCH |
| CPU | EASY / NORMAL / HARD | same three profiles with reaction/block/aggression differences | MATCH |
| Character select | 3D previews, VS plates, tiles, stage/CPU options | same flow, 3D previews | MATCH |
| Online rooms | WebRTC + `/api/room` relay, 6-char code | WebSocket authoritative room server, 6-char code, host/join/picks/stage/rematch/disconnect | EQUIV (different transport) |
| Local 2P | — | same-device P2 (arrows + numpad) | EXTRA |
| PWA | manifest, icons, fullscreen, landscape | same + generated icons | MATCH |
| iOS fullscreen | swipe-up hint, add-to-home-screen tip | same hint on iOS Safari | MATCH |
| Loading | progress bar | same | MATCH |

## Hard blocker

The **GAP** rows require copying files published by the original site:

- `/models/*.glb` (six fighters + bulldozer)
- `/faces/*.png` (six caricature photos)
- character/announcer voice MP3s and the 40+ SFX/music MP3s

Those files are copyrighted assets. Re-downloading and shipping them would be
redistribution, not a clean-room clone. Everything else in the table is implemented.

## Decision (recorded)

**Accepted: faithful procedural clone.** On 2026-10-30 the user chose option 2 — keep
the tested build with original procedural art/audio rather than downloading or
redistributing the original proprietary GLB/PNG/MP3 files. The **GAP** rows above are
therefore intentional; all functional parity items are implemented and tested.

