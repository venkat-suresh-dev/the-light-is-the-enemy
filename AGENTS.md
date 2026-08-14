# AGENTS.md — Development Contract

This document is the **operational guide for coding agents** working on *The Light Is the Enemy*. Read it after `README.md`.

- **README.md** explains what the game is.
- **AGENTS.md** explains how to work on it safely.

---

## 1. Project Overview

**The Light Is the Enemy** is a browser-based, top-down survival horror game built with vanilla JavaScript ES modules, HTML5 Canvas, and the Web Audio API. There is **no `package.json`**, no bundler, and no build step.

### Core experience

- **Darkness and visibility** are gameplay mechanics, not just atmosphere.
- The **flashlight** is both an information tool and a resource drain.
- **Enemies** detect the player through proximity, line of sight, sprint noise, and flashlight illumination.
- **Threat** is a continuous value that drives audio tension (heartbeat, breathing, music).
- **Exploration** happens in procedurally generated rooms with themed environmental dressing.

### Current objective flow (implemented)

```
findFuse → [E] pickup fuse → findGenerator → [E] install fuse → escape (exit)
```

Phases in `ObjectiveSystem`: `findFuse` → `findGenerator` / `installFuse` → `escape`.

The exit is locked until the generator is powered. Interaction is **input-driven** (`E` key). HUD prompts must match interaction range logic (`Room.isAtFuse` / `Room.isAtGenerator`).

### Not implemented (do not document as shipped)

`OBJECTIVE_TYPE` in `Constants.js` includes `COLLECT_KEY` and `FIND_EXIT_CODE` hint strings, but **only the fuse → generator → escape flow is implemented**. Do not assume key/code objectives exist in gameplay.

---

## 2. Development Principles

### Preserve working systems

Do not rewrite stable systems because a new feature *could* be done differently.

**Prefer:**

- Targeted changes
- Extensions to existing modules
- Isolated fixes
- Regression tests (`scripts/test-*.mjs`)

**Avoid:**

- Unnecessary rewrites
- Changing multiple unrelated systems in one task
- "Cleanup" refactors bundled with feature work

### One phase at a time

When implementing a new phase:

1. Inspect current implementation
2. Define scope explicitly
3. Make the smallest appropriate change
4. Run relevant automated tests
5. Browser-test gameplay/visual/audio where applicable
6. Report files changed, behavior changed, tests run, and any limitations
7. **Stop** for approval before unrelated work

### Don't solve visual problems with gameplay changes

Do not change collision, `Geometry.js`, enemy AI, or objective placement logic merely to compensate for a visual/readability issue — unless the root cause is actually in that gameplay system.

Lighting tuning belongs in `Lighting.js` / `Constants.js` lighting section. Visibility math belongs in `Geometry.js`. Reachability belongs in `RoomGenerator.js`.

---

## 3. Architecture Overview

47 source files under `src/`. Entry point: `src/main.js` → `Game` → `GameLoop`.

```text
src/
├── main.js                 # Boot, exposes window.__game
├── core/
│   ├── Game.js             # State machine, orchestration, room lifecycle
│   ├── GameLoop.js         # rAF loop with per-frame error isolation
│   ├── Input.js            # Keyboard, mouse, touch abstraction
│   ├── Time.js             # Delta time clamping
│   └── EventBus.js         # Pub/sub between systems
├── player/
│   ├── Player.js           # Position, stamina, alive state
│   ├── PlayerController.js # Movement, collision, sprint, aim
│   └── Flashlight.js       # Beam, battery, flicker
├── enemies/
│   ├── Enemy.js            # Entity + archetype config
│   ├── EnemyAI.js          # Awareness state machine
│   └── EnemyManager.js     # Spawn, update, attack, illumination events
├── systems/
│   ├── ObjectiveSystem.js  # Fuse/generator/escape phases
│   ├── ThreatSystem.js     # Continuous 0–1 threat
│   ├── DifficultySystem.js # Per-room scaling
│   ├── SaveSystem.js       # Settings + best run (localStorage)
│   └── ResourceMeter.js    # Shared drain/recharge meter
├── world/
│   ├── RoomGenerator.js    # Seeded layout + reachability validation
│   ├── Room.js             # Interaction radii, exit lock
│   ├── RoomThemes.js       # Theme metadata, decor, landmarks
│   ├── TileMap.js          # Tile grid
│   ├── Collision.js        # Circle vs wall sliding
│   └── Visibility.js       # Illumination tests for enemies
├── audio/
│   ├── AudioManager.js     # Lifecycle, threat mix, footsteps, heartbeat
│   ├── AudioMixer.js       # Bus gains
│   ├── AudioAssets.js      # MP3 loading (fail-soft)
│   ├── SpatialAudio.js     # Panning + distance attenuation
│   ├── FootstepPlayer.js   # Sliced footsteps from MP3
│   ├── RoomAmbience.js     # Theme beds
│   └── ProceduralSounds.js # Heartbeat, breathing, fallbacks
├── effects/
│   ├── Lighting.js         # World render, darkness, flashlight mask
│   ├── LocalLight.js       # Environmental light cutouts
│   ├── ScreenEffects.js    # Vignette, grain, chromatic, heartbeat pulse
│   ├── Particles.js
│   └── CameraShake.js
├── characters/
│   ├── PlayerRenderer.js
│   └── EnemyRenderer.js
├── ui/
│   ├── HUD.js, Menu.js, DeathScreen.js, Tutorial.js
│   ├── HintSystem.js
│   └── TouchControls.js
└── utils/
    ├── Constants.js        # All tuning values
    ├── Geometry.js         # Visibility polygon, raycasts, LOS
    ├── MathUtils.js
    └── Random.js           # Seeded RNG
```

### Data flow (simplified)

```
Input → PlayerController → Collision → Player position
Player + Flashlight → Geometry (visibility) → Lighting (render)
Enemies + Player + Flashlight → EnemyAI + Visibility → ThreatSystem → AudioManager
ObjectiveSystem ← Room positions + Input (E)
RoomGenerator → Room → Game (load room)
```

---

## 4. Critical Systems

### Game / GameLoop

**`Game.js`** owns the lifecycle:

| State | Meaning |
|-------|---------|
| `MENU` | Main menu |
| `INTRO` | Intro sequence (skipped in `?objective=fuse` debug) |
| `PLAYING` | Active gameplay |
| `PAUSED` | Pause overlay |
| `DEAD` | Death screen |
| `TRANSITIONING` | Room complete → next room |

Flow: menu → (intro) → play → death or room transition → next room or menu.

`GameLoop` wraps update and render in separate `try/catch` blocks. **The loop always schedules the next frame** even if update or render throws.

**Hard rule:** Audio or optional effects must **never** kill the render loop. `Game.init()` starts the loop before audio finishes bootstrapping. Audio init failures are caught and logged; gameplay continues.

`input.endFrame()` must be called every frame (including early returns) to clear `keysPressed` / pointer edge flags.

### Input

**`Input.js`** abstracts:

| Action | Desktop | Touch |
|--------|---------|-------|
| Move | WASD / arrows | Left joystick via `TouchControls` |
| Sprint | Shift | On-screen button |
| Flashlight hold | LMB | Touch hold |
| Flashlight toggle | `F` | — |
| Interact | `E` (`isPressed('interact')`) | — |
| Pause | Escape | — |
| Aim | Mouse position | Right drag zone |

- `isDown()` = held state
- `isPressed()` = edge-triggered (one frame)
- `flushIntroSkipKeys()` clears Escape/Enter/Space from pressed set after intro skip

Interact is **edge-triggered**. Objective pickup/install must use `isPressed('interact')`, not `isDown`.

### Player

**`Player.js`** — position, velocity, `ResourceMeter` stamina, `Flashlight` instance, sprint/moving flags, body angle, alive state.

**`PlayerController.js`** — reads input, applies acceleration/friction, resolves wall collision via `Collision.js`, sets sprint when stamina allows.

**`PlayerRenderer.js`** — visual only; do not put physics here.

`Player.reset(x, y)` creates a **new** `Flashlight` instance and resets stamina. Called on room load / death restart.

### Flashlight

**`Flashlight.js`** — independent `ResourceMeter` for power.

| Invariant | Detail |
|-----------|--------|
| Range | Fixed at `CONFIG.flashlight.range` (400). **Does not shrink** with battery. |
| Drain | `9/s` base; scaled per room by `DifficultySystem` |
| Recharge | `6.5/s` when off, `1.5s` delay, `5%` restart threshold |
| Low power | Flicker via `flickerMultiplier`; shuts off at empty |
| Visibility | `buildConeVisibilityPolygon()` in `Geometry.js` uses beam angle + FOV |

Angle smoothing: `CONFIG.flashlight.angleSmoothing` (lag behind aim).

### Geometry / Visibility

**HIGH-SENSITIVITY.** `src/utils/Geometry.js`

Contains:

- `buildConeVisibilityPolygon()` — 56 uniform angular rays (`FLASHLIGHT_RAY_STEPS = 56`) + silhouette corner rays
- `raycastTileMap()` — wall edge intersection
- `hasLineOfSight()` — used by enemies and threat
- `pointInCone()` — cone membership test
- Silhouette vertex filtering (`_isSilhouetteVertex`) — excludes collinear wall runs
- Collinear hit welding (`_weldColinearHits`)
- Cone wrapping across ±π (`_unwrapToCone`, `_angleInCone`)

**Rules:**

- Do not modify casually
- Preserve the 56-ray system unless explicitly approved
- Preserve corner-ray behavior, ±π cone wrapping, collinear welding, L-corner visibility
- **Always run** `node scripts/test-visibility.mjs` after any visibility change

Important regression cases (covered by tests):

- Stationary rotation near walls (vertex count stability, no 1px occupancy flicker)
- Long collinear wall runs (must not explode vertex count)
- L-corners and perpendicular junctions
- Narrow corridors
- ±π cone boundary crossing

### Lighting

**`Lighting.js`** — separate concerns from `Geometry.js`:

| Layer | Purpose |
|-------|---------|
| `renderWorld()` | Floor, walls, decor, entities, ambient floor spill (`_renderPlayerAmbientGlow`) |
| Flashlight mask | Uses visibility polygon from Geometry |
| `applyDarkness()` | Heavy darkness overlay; ambient player bubble punches through via gradient cutout |
| `LocalLight` | Environmental lights from `room.envLights` |

**Do not assume** a lighting tweak fixes a geometry bug, or vice versa.

Current ambient values (`Constants.js`): `ambientStrength: 0.09`, `ambientPlayerRadius: 66`, `ambientFloorSpill: 0.09`, `darknessOpacity: 0.96`.

The small ambient player illumination is intentional. Do not remove it unless explicitly requested.

### ThreatSystem

**`ThreatSystem.js`** — continuous `intensity` 0–1, smoothed toward `raw` each frame.

Inputs per enemy:

- Distance-based proximity (quadratic falloff, `maxDistance: 640`)
- AI state weight (`DORMANT` … `HUNTING`)
- Line of sight (occluded contributions scaled by `0.68`)
- Illumination bonus when `enemy.visible`
- Sprint bonus when player sprinting + moving

Rates: rise `2.8`, fall `0.65` (exponential smoothing).

Drives in `Game.update()`: `audio.updateThreat`, `updateHeartbeat`, `updateBreathing`, `screenEffects.setHeartbeat`.

**Do not** replace with stepped distance bands without explicit approval.

### Enemy AI

Three archetypes in `CONFIG.enemy.archetypes`:

| Archetype | Character |
|-----------|-----------|
| **STALKER** | Balanced; high illumination gain; long search |
| **RUNNER** | Fast chase; shorter search; high sprint gain |
| **WATCHER** | Stationary (`stationary: true`); long LOS range; slow chase |

States: `DORMANT` → `AWARE` → `ILLUMINATED` → `ALERT` → `HUNTING` → `SEARCHING` → `LOST`

Detection inputs (`EnemyAI._getAwarenessInput`):

- Proximity within `proximityRange` (with LOS)
- LOS within `losRange`
- Sprint noise within `sprintRange`
- Flashlight illumination (`Visibility.isIlluminated`)

Awareness accumulates into state transitions. Memory of last known player position during search.

`EnemyManager` spawns from `room.enemySpawns`, handles attack at `attackRange`, emits illumination/alert events.

### ObjectiveSystem

Phases: `findFuse` → `findGenerator` → `installFuse` (generator install transitions directly to `escape`) → `escape`.

| Phase | Interaction |
|-------|-------------|
| `findFuse` | `E` at fuse → `fuseCollected = true`, phase → `findGenerator` |
| `findGenerator` / `installFuse` | `E` at generator → `generatorActive = true`, `unlockExit()`, phase → `escape` |
| `escape` | Walk to exit tile when `exitUnlocked` |

**Critical invariants:**

- Fuse and generator must be **reachable from spawn** (validated in `RoomGenerator._validate`)
- `getInteractionPrompt()` and `update()` must use the **same** `Room.isAtFuse` / `Room.isAtGenerator` checks
- Pickup radii: `player.radius + fusePickupExtra (55)` / `generatorPickupExtra (60)`
- `E` must not silently fail — use debug counters and `getDebugInfo()` when debugging
- `setup(room)` resets phase; do not accidentally re-call during active play
- Regression: `node scripts/test-objective-lifecycle.mjs` (2500 rooms + lifecycle)

### Audio

**HIGH-SENSITIVITY.**

| Module | Role |
|--------|------|
| `AudioManager` | Orchestration, threat-driven mix, footsteps, heartbeat, breathing, stings |
| `AudioMixer` | Bus structure (master, ambience, sfx, heartbeat, player, etc.) |
| `SpatialAudio` | Stereo pan + distance attenuation |
| `AudioAssets` | MP3 decode via `Promise.allSettled` — missing files never throw |
| `FootstepPlayer` | Peak-detected slices from `footsteps.mp3` |
| `ProceduralSounds` | Heartbeat, breathing, flashlight click, fallbacks |

**Assets** (`assets/`, loaded by `AudioAssets.js`):

| File | Use |
|------|-----|
| `menu-music.mp3` | Menu |
| `scary-ambience.mp3` | Ambience bed |
| `high-threat-music.mp3` | Threat music |
| `footsteps.mp3` | Player footsteps (sliced) |
| `pic-up-object.mp3` | Pickup |
| `enter-exit-door.mp3` | Room transition |
| `game-over.mp3` | Death |

**Hard rules:**

- Audio must never block game startup (`bootstrap()` / `init()` catch and continue)
- Audio errors must never stop `GameLoop`
- Do not revert to full procedural noise synthesis without specific reason — MP3 assets are the primary path
- Use `FootstepPlayer` + `AudioAssets` for player steps
- Preserve spatial panning for enemy footsteps
- Avoid stacking `sfxVolume` × bus gain × master gain unintentionally
- **Verify audibility in browser with headphones** for any audio change

Sounds in current implementation: menu music, ambience, threat music, player footsteps (walk/run), enemy footsteps (spatial), heartbeat (procedural, threat-scaled), breathing (procedural), pickup, door, game over, illumination sting, flashlight click.

---

## 5. Resource Systems

Both use `ResourceMeter` — **independent instances**, not a shared pool.

### Stamina (`CONFIG.player.stamina`)

| Parameter | Value |
|-----------|-------|
| Max | 100 |
| Drain (sprint) | 26 / s |
| Recharge | 30 / s |
| Recharge delay | 0.7 s |
| Restart threshold | 10% |

### Flashlight power (`CONFIG.flashlight.power`)

| Parameter | Value |
|-----------|-------|
| Max | 100 |
| Drain | 9 / s (while on) |
| Recharge | 6.5 / s (while off) |
| Recharge delay | 1.5 s |
| Restart threshold | 5% |
| Early rooms | `DifficultySystem` applies `earlyRoomBatteryMultiplier: 0.55` for rooms 1–3 |

**Do not** tie flashlight range to battery level. **Do not** merge stamina and flashlight into one meter.

---

## 6. World Generation

**`RoomGenerator.js`** — seeded procedural rooms.

Process:

1. Carve base floor, apply room type (`corridor`, `open`, `maze`, `pillars`, `loops`)
2. Flood-fill reachable tiles from spawn
3. Place exit, fuse, generator on **reachable** floor only
4. Place enemies (distance constraints from spawn)
5. Add themed decor (`RoomThemes`), landmarks, env lights
6. Validate via `_validate()` — up to `MAX_GEN_ATTEMPTS` (16) retries
7. Fallback: `_forceReachableObjectives()` if all attempts fail

**Reachability invariant:** Fuse and generator tile positions must be in the BFS reachable set from spawn tile. Tested by `test-objective-lifecycle.mjs` across 2500 seeds.

**Decor:** `room.decor` is visual data rendered in `Lighting.js`. Only `TILE.WALL` blocks movement in `Collision.js`. **Do not** add decor to the collision grid unless intentionally designing solid gameplay geometry.

**Themes:** `RoomThemes.js` — `THEME_ORDER`, `THEME_META`, landmark types, decor density.

---

## 7. Visual Direction

Current intent:

- **Dark** — `darknessOpacity: 0.96`, near-black palette
- **Atmospheric** — grain, vignette, themed decor, environmental lights
- **Silhouette-driven** — enemies render as dark shapes with subtle eye highlights
- **Readable through flashlight** — cone is the primary information channel
- **Limited ambient player visibility** — small bubble at feet (not a lit map)
- **Strong flashlight contrast** — warm beam against cold darkness
- **Environmental uncertainty** — objectives discovered through exploration and landmarks
- **Restrained highlights** — fuse/generator/exit use subtle color cues, not bright quest markers

**Do not** turn the game into a brightly readable top-down map. **Do not** remove the ambient player bubble without explicit request.

---

## 8. Audio Direction

Guide future audio work toward:

- Ambient horror should feel **atmospheric** (MP3 beds), not grainy procedural noise
- Footsteps should sound like **human movement** — walk vs run clearly distinct
- Enemy footsteps should be **spatially distinct** from player footsteps
- Heartbeat should have a **quiet baseline** at low threat, faster/stronger as threat rises, calming as threat falls
- Threat music should enter **early enough** to communicate danger (see `threatMusicCurve` in `Constants.js`)
- Important one-shots (pickup, door, game over) must remain **audible**
- Tension without becoming an irritating wall of sound — respect bus levels and cooldowns (`stingCooldown: 4.2`)

---

## 9. Testing Requirements

### Automated (headless Node)

Run from project root:

```bash
node scripts/test-movement.mjs
node scripts/test-collision.mjs
node scripts/test-visibility.mjs
node scripts/test-objective-lifecycle.mjs
```

| Script | Validates |
|--------|-----------|
| `test-movement.mjs` | Diagonal speed cap, body angle smoothing, flashlight aim offset |
| `test-collision.mjs` | Circle–tile wall sliding, axis separation, corner tunneling |
| `test-visibility.mjs` | Polygon correctness, occlusion, L-corners, ±π wrapping, collinear welding, rotation stability |
| `test-objective-lifecycle.mjs` | 2500-room fuse/generator reachability, E pickup state machine |

### Dev tools (not CI)

| File | Purpose |
|------|---------|
| `scripts/analyze-audio.html` | Browser: peak/RMS/duration analysis of loaded MP3s |
| `scripts/diagnose-flashlight-jitter.mjs` | Numeric screen-space jitter check |
| `scripts/browser-fuse-pickup.mjs` | Optional Puppeteer test; needs Chrome; port 8766 — **environment-dependent** |

### Browser / manual validation

Required when changes affect perception or interaction — headless tests are not sufficient alone.

**Gameplay changes:** WASD, sprint, stamina drain/recharge, flashlight on/off/toggle, wall collision, room transitions, death/restart.

**Visibility / lighting:** Stationary beam rotation at walls, corners, corridors, ±π aim crossing, darkness vs flashlight readability, ambient bubble visibility.

**Enemy changes:** Dormant proximity, LOS, sprint detection, illumination response, search/lost behavior, per-archetype differences, footstep spatial audio.

**Objective changes:** Fuse exists and is reachable, E pickup in range, generator reachable, E install, exit unlock, escape transition. Use `?debug=true&objective=fuse` for fast iteration.

**Audio changes (browser + headphones):** Menu music, ambience, walk/run footsteps, enemy footsteps L/R, heartbeat at low/high threat, threat music curve, pickup, door, game over.

**When to stop and ask for browser validation:** Any change to `Lighting.js`, `Geometry.js`, `AudioManager.js`, `ObjectiveSystem.js`, or `RoomGenerator.js` that cannot be fully verified by headless tests.

---

## 10. Debug Modes

Verified in `Game.parseLaunchParams()`:

| URL | Purpose |
|-----|---------|
| `?debug=true` | Gameplay overlay: FPS, state, fuse/generator distances, interaction counters, canvas markers |
| `?debug=true&objective=fuse` | Skips intro; places fuse ~6 tiles from spawn |
| `?debug=audio` | Audio overlay; `window.__audio`; F9–F12, `=`, `-` probe keys |
| `?debug=flashlight` | Draws visibility polygon overlay |
| `?flashlight-simple=true` | Simple flashlight fill (use with `?debug=flashlight`) |

Console: `window.__game` (always), `window.__audio` (when `?debug=audio`).

Audio probe keys (only with `?debug=audio`):

- F9: direct player footstep
- F10/F11: enemy step left/right
- F12/`=`: heartbeat at 0.5/0.9
- `-`: ambient probe

---

## 11. Known Historical Bugs / Lessons

Documented so future agents do not recreate them.

### Visibility

Collinear wall runs previously produced hundreds of redundant polygon vertices and screen flicker. **Fix:** silhouette vertex filtering + collinear hit welding in `Geometry.js`. Do not remove these without re-running full visibility tests.

### Audio startup

Audio initialization previously blocked PLAY and could leave a black/unresponsive screen. **Fix:** fail-soft init; `bootstrap().catch()`; game loop starts regardless. Never `await` audio in a way that blocks gameplay startup.

### Game loop

Audio exceptions previously killed the render loop. **Fix:** `GameLoop` try/catch per frame. Optional subsystems must not propagate uncaught errors to stop rAF.

### Footsteps

Footstep slices previously stored **sample indices** where **seconds** were expected, causing invalid `AudioBufferSourceNode.start()` offsets. **Fix:** `FootstepPlayer.stepOffsetSec()` detects and converts. When slicing decoded audio, keep sample indices and seconds explicitly separate.

### Audio gain staging

Stacking `sfxVolume`, bus gain, and master gain multiple times made sounds effectively inaudible. **Fix:** centralized bus structure in `AudioMixer`. Avoid accidental multiplicative attenuation when adding new sounds.

### Fuse reachability

`RoomGenerator` previously placed fuse/generator on any floor tile, including regions disconnected after maze/pillar carving. **Fix:** flood-fill from spawn; objectives only on reachable tiles; `_validate()` checks; `_forceReachableObjectives()` fallback.

### Fuse interaction

Prompt visibility and interaction range diverged; E presses could silently do nothing; `input.endFrame()` was skipped on early update returns. **Fix:** shared `Room.isAtFuse`/`isAtGenerator` for prompt and pickup; debug counters; always call `endFrame()`.

### Menu play handler

Play button failures could return to menu without clearing state; intro-skip keys leaked into gameplay. **Fix:** try/catch with state logging; `flushIntroSkipKeys()`; menu bound in constructor.

---

## 12. Change Boundaries

Sensitive systems — changes require scoped justification and regression testing:

| System | Risk |
|--------|------|
| `Geometry.js` | Flashlight polygon, LOS, enemy detection — foundational |
| `Lighting.js` | Darkness, ambient bubble, flashlight rendering — perceptual |
| `ThreatSystem.js` | Audio tension curve — continuous model |
| `AudioManager.js` / `AudioMixer.js` / `SpatialAudio.js` | Startup safety, audibility, spatial behavior |
| `RoomGenerator.js` | Reachability, objective placement |
| `ObjectiveSystem.js` | Phase transitions, interaction contract |
| `GameLoop.js` | Frame survival guarantee |
| `Collision.js` | Movement feel |
| `Input.js` | Interaction edge detection |

These **can** be legitimately changed — but not casually. State why, keep diff small, run tests, browser-verify when needed.

Lower-risk areas for isolated tweaks: `HUD.js`, `HintSystem.js`, `Constants.js` tuning (with test runs), `PlayerRenderer.js` / `EnemyRenderer.js` visuals.

---

## 13. Git / Commit Guidance

Use [Conventional Commits](https://www.conventionalcommits.org/):

```text
feat: ...
fix: ...
refactor: ...
docs: ...
test: ...
chore: ...
```

Examples from this project:

```text
feat: add enemy archetypes
fix: restore reachable fuse placement
fix: stabilize audio startup
docs: refresh project README
test: add objective lifecycle coverage
```

Keep commits focused. Do not mix unrelated gameplay, refactoring, docs, and formatting in one commit unless they are genuinely one atomic change.

Do not commit unless explicitly asked.

---

## 14. Agent Workflow

1. Read `README.md`
2. Read `AGENTS.md` (this file)
3. Inspect relevant existing code — identify current behavior **before** changing it
4. State intended scope
5. Implement the smallest appropriate change
6. Run relevant automated tests
7. Perform browser validation for visual/audio/gameplay changes
8. Review `git diff`
9. Report:
   - Files changed
   - Behavior changed
   - Tests run (with pass/fail)
   - Browser validation performed (honestly)
   - Known limitations
10. **Stop** when requested scope is complete — do not silently continue into the next phase

---

## 15. Do Not Do This

- Do not rewrite stable systems unnecessarily
- Do not modify `Geometry.js` to solve unrelated visual issues
- Do not replace real audio assets with procedural noise without a reason
- Do not place objectives on spawn-inaccessible tiles
- Do not add giant UI quest markers to hide bad objective placement
- Do not make darkness bright just to improve navigation
- Do not let audio failures break gameplay or stop the render loop
- Do not claim browser testing was performed when it wasn't
- Do not declare perceptual features complete based only on headless tests
- Do not modify unrelated systems during a scoped feature task
- Do not fabricate tests or test results
- Do not document `COLLECT_KEY` / `FIND_EXIT_CODE` objectives as implemented
- Do not add decor to the collision grid without explicit design intent
- Do not shrink flashlight range with battery drain unless explicitly requested

---

*Last aligned with repository state: 47 files under `src/`, no `package.json`, static server workflow.*
