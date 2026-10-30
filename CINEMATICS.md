# Cinematics & Animation Bible — Sansad Showdown

This is the single source of truth for every fighter state, every transition and
every super-move timeline. The renderer (`fighters3d.js`), the cinematic director
(`supers.js`) and the simulation (`engine.js`) all follow it.

---

## 1. Fighter state machine

A fighter is always in exactly one state. `engine.js` owns the transitions;
`fighters3d.js` only *draws* the state it is given through a pose object.

| State | Enter when | Leaves when | Rig animation |
| --- | --- | --- | --- |
| `intro` | round starts | 1.9 s (→ `idle`) | `applyIntro` — character-specific greeting (namaste / wave / folded arms / thumbs-up / salute) |
| `idle` | default, or after any recovery | player presses something | `applyIdle` — breathing, sway |
| `walk` | moveX ≠ 0 while grounded | moveX = 0 / jump / attack | `applyWalk` — distance-driven stride, arms counter-swing |
| `crouch` | S held, grounded | S released / jump / attack | `applyCrouch` — hips drop, knees bend, guard arms |
| `jump` | W pressed | lands (→ `idle`/`hitstun`) | `applyJump` — legs tuck, arms up |
| `attack` | a button is buffered | move total reached (→ `idle`/`crouch`) | `applyAttack` — 3 phases, see §2 |
| `blockstun` | blocked a hit | blockstun frames over | `applyBlock` — arms crossed, lean back |
| `hitstun` | took a non-knockdown hit | hitstun frames over | `applyHitstun` — recoil back |
| `knockdown` | hit by a launcher/knockdown move | 48 grounded frames (→ `getup`) | `applyKnockdown` — flat on the back, twitch |
| `getup` | after knockdown, or after a super returns you | 24 frames (→ `idle`) | `applyGetup` — rolls up to a stance |
| `super` | SHAKTI full + super pressed | cinematic ends (→ `idle`) | `applySuper` + `superAnim` hook, see §3 |
| `frozen` | opponent's super is running | super resolves (→ `getup`) | `applyFrozen`, then a `transform` collapse, see §3 |
| `victory` | you won the round | next round | `applyVictory` — dance, character specific |
| `ko` | hp reached 0 | round resets | `applyKnockdown` held |

`BLOCKED_STATES = {super, frozen, victory, intro, ko}` — while in one of these the
fighter does **not** tick its own state; the phase that put it there must release it.
The super director is responsible for releasing both fighters when it ends.

## 2. Attack states (startup / active / recovery)

Every attack is `{startup, active, recovery}` frames @60Hz. The rig plays the
matching phase of `applyAttack(id, phase)`.

| id | height | Notes |
| --- | --- | --- |
| `jab` | high | chains → `cross` (P) or `kick` (K) |
| `cross` | high | chains → `uppercut` (P) or `finisher` (K) |
| `kick` | mid | chains → `roundhouse` (K) |
| `uppercut` | mid, launches | standing uppercut (end of the punch chain) |
| `roundhouse` | high, knocks down | long whirling kick |
| `finisher` | mid, knocks down | two-fisted overhead |
| `skyUppercut` | mid, **launches** | **down + punch** — the SKY UPPERCUT |
| `lowJab` | low | crouching jab, chains → `uppercut`/`sweep` (legacy, not routed from down+punch) |
| `sweep` | low, knocks down | **down + kick** — leg scythe along the floor |
| `special1` | mid, launches | **forward + punch** — character special |
| `special2` | mid, knocks down | **forward + kick** — flying special |
| `airPunch` / `airKick` | mid | jump attacks |
| `grab` | — | grab / grab-break |

### Down-state scenario table (explicit per user request)

| Hold | Press | Result | Animation |
| --- | --- | --- | --- |
| S (crouch) | Punch | **SKY UPPERCUT** — launches the opponent overhead | `skyUppercut`: coiled deep crouch → explosive rise, right fist rockets to the sky, legs extend, opponent is launched |
| S (crouch) | Kick | **SWEEP** — knocks down | `sweep`: hips sink to the floor, rear leg scythes out, torso twists |
| S (crouch) | Punch, Punch | two sky uppercuts in a row | `skyUppercut` → `skyUppercut` |
| S (crouch) | Grab | low grab attempt | `grab` |

Standing scenarios: neutral Punch = jab chain, neutral Kick = kick chain,
forward+Punch/Kick = character specials, hold-back = block, W = jump, I = grab.

---

## 3. Super-move cinematic structure

Each super is a **director** in `supers.js`. It runs for `DURATION` seconds of
*wall-clock* time, is completely deterministic, and never touches the simulation
(the engine stays authoritative and simply waits in `phase = 'super'`).

Every director is split into **phases** with a fixed timeline. During the super:

* the **caster** is drawn with `pose.state = 'super'` **plus a `superAnim` string**
  that selects a bespoke gesture in `fighters3d.js → applySuperAnim` (see table §3.1);
* the **target** is drawn with `pose.state = 'frozen'`, and during the "transform"
  beat with `pose.transform = <kind>` so the rig collapses into the object;
* the camera is keyframed per phase (§3.2);
* props/particles/sound are spawned per phase (§3.3).

At the end the director releases both fighters, the engine resolves the damage,
the target is put into `getup` (comes back with less energy) and the caster back
into `idle`.

### 3.1 `superAnim` gestures (caster)

| Gesture | Used by | Description |
| --- | --- | --- |
| `charge` | all | arms out, chest up, energy gathers |
| `pointUp` | MODI | raises the right arm, index finger to the sky |
| `pointAt` | MODI | swings the pointing hand down at the opponent |
| `throw` | MODI | hurls the chakra forward off the fingertip |
| `punchHead` | RAHUL | flying punch aimed at the opponent's head |
| `carry` | RAHUL | holds the potato with both hands |
| `feed` | RAHUL | pushes the potato into the machine hopper |
| `admire` | RAHUL | holds a gold bar up, grins |
| `stir` | DIDI | stirs the cauldron with a ladle |
| `chant` | DIDI | arms up, "humba humba" |
| `stomp` | DIDI | stamps a shockwave into the floor |
| `sign` | TRUMP | signs the executive order with a flourish |
| `whirl` | TRUMP | sweeps the arm to send the crate vortex |
| `slam` | TRUMP | brings the giant stamp down |
| `glare` | YOGI | eyes glow, points forward |
| `beckon` | YOGI | calls the bulldozer in |
| `bow` | YOGI | folds arms, bows as the dozer works |
| `feedCane` | NITIN | feeds sugarcane into the E20 machine |
| `pour` | NITIN | pours the fuel into the pothole |
| `flick` | NITIN | flicks a lit match |
| `walkOff` | NITIN | coolly walks away from the blast |

### 3.2 Camera grammar

| Beat | Camera | Effect |
| --- | --- | --- |
| charge | wide, slightly low, slow push-in | vignette + meter banner already on screen |
| rise | tilt up with the caster | fov widens, sun flare |
| gesture (point/carry/stir…) | tight over-the-shoulder on the caster | fov 38, shallow depth via vignette |
| travel (throw / vortex / charge) | whip-pan following the projectile | motion via rapid lerp |
| impact | close on the target | full-screen flash, screen shake 0.7 |
| aftermath | pull back to a neutral fight framing | vignette off |

### 3.3 FX / sound per super

| Super | Key props | Particles | Sound |
| --- | --- | --- | --- |
| MODI SUDARSHAN CHAKRA | spinning chakra wheel grown on the fingertip | gold burst, ring shockwave | charge riser → chakra whoosh → boom |
| RAHUL ALOO SE SONA | potato, hopper machine, gold beam, raining gold bars | gold rain, steam, sparkle | charge → thunk → kaching → coins |
| DIDI JADU HOBE | black cauldron, ladle, green smoke, frog | green bubbles, poison mist | poof, bubbling |
| TRUMP TARIFF TSUNAMI | golden order, TARIFF crates, giant stamp | crate debris, gold confetti | crash, stamp slam |
| YOGI BABA KA BULLDOZER | bulldozer with a slamming bucket, red pool | dust, embers, blood pool | horn, engine loop, three metal crunches |
| NITIN GADDHA BLAST | pothole, sugarcane, E20 machine, flame | smoke, fire plume | machine loop, whoosh, explosion |

## 4. Super timelines

### MODI — SUDARSHAN CHAKRA (4.6 s)

| t (s) | Beat | Caster anim | Camera | FX |
| --- | --- | --- | --- | --- |
| 0.0 | ignition | `charge`, rises 0→2.6 | wide, tilt up | chakra ignites over the head, aura |
| 1.2 | point to sky | `pointUp` | tight, low | chakra flies to the raised fingertip and locks |
| 2.0 | aim | `pointAt` | over-shoulder | chakra slides down the arm, spins up |
| 2.6 | throw | `throw` | whip-pan to target | chakra rockets off the finger |
| 3.2 | impact | — | close, shake 0.7 | explosion, screen flash |
| 3.8 | landing | `charge`→land | wide | Modi drifts back to the floor |

### RAHUL — ALOO SE SONA (4.6 s)

| t (s) | Beat | Caster anim | Camera | FX |
| --- | --- | --- | --- | --- |
| 0.0 | dash + punch | `punchHead` | tight, on the head | fist contact flash, contact shake |
| 0.6 | transform | — (target `transform:'aloo'`) | push on target | target collapses into a giant potato |
| 1.2 | carry | `carry` | track | potato pops into his hands |
| 1.9 | feed | `feed` | close on hopper | potato drops in, machine lights up |
| 2.6 | gold eruption | `admire` | tilt up, off-axis | golden beam to the sky, machine shakes |
| 3.1 | gold launch | `admire` | wide pull | gold bars erupt from the chute to the sky |
| 3.1–4.3 | gold rain | `admire` | wide pull | bars arc over the stage and settle on the ground |
| 4.3 | return | — | pull back | poof, the opponent reappears on their feet with less energy |

*(The remaining four supers follow the same phase grammar — see `supers.js`.)*

## 5. Invariants

1. No super may leave a fighter in a blocked state. The engine releases the
   caster to `idle` and the target to `getup` in `resolveSuper`.
2. The target always returns standing with reduced HP — never left on the floor.
3. Every director must `dispose()` its scene graph on end or quit.
4. Damage is applied exactly once, by the engine, not by the director.
5. The match clock is frozen during a super; the cinematic uses wall-clock time.
