# The Light Is the Enemy

A psychological horror browser game where **your flashlight lets you see — but anything you illuminate can see you**.

Navigate procedurally generated dark rooms, complete objectives, and survive while deliberately avoiding looking at the creatures hunting you.

## Quick Start

Open `index.html` in a modern browser, or use a local server for ES module support:

```bash
python -m http.server 8080
```

Then visit `http://localhost:8080`

## Controls

### Desktop

| Action | Control |
|--------|---------|
| Move | WASD / Arrow keys |
| Aim flashlight | Mouse |
| Flashlight | Left mouse button (hold) |
| Toggle flashlight | F |
| Sprint | Shift |
| Pause | Esc |

### Mobile / Tablet

| Action | Control |
|--------|---------|
| Move | Left virtual joystick |
| Aim flashlight | Right drag zone |
| Flashlight | Flashlight button |
| Sprint | Sprint button |

Landscape orientation is recommended on mobile.

## Core Mechanic

```
Move → Turn on flashlight → See something → Something sees you → Turn light off → Listen → Escape
```

Enemies react when illuminated. They freeze, turn toward you, then hunt. Turning off your light doesn't instantly save you — they search your last known position.

## Architecture

```
src/
├── main.js                 Entry point
├── core/
│   ├── Game.js             High-level game state & orchestration
│   ├── GameLoop.js         requestAnimationFrame loop
│   ├── Input.js            Keyboard, mouse, touch abstraction
│   ├── Time.js             Delta time management
│   └── EventBus.js         Decoupled event system
├── player/
│   ├── Player.js           Position, stamina, flashlight
│   ├── PlayerController.js Movement & input handling
│   └── Flashlight.js       Light cone, battery, flicker
├── enemies/
│   ├── Enemy.js            Entity state & movement
│   ├── EnemyAI.js          State machine (DORMANT → ILLUMINATED → ALERT → HUNTING → SEARCHING → LOST)
│   └── EnemyManager.js     Spawn & update all enemies
├── world/
│   ├── RoomGenerator.js    Seeded procedural room generation
│   ├── Room.js             Room state & objectives
│   ├── TileMap.js          Grid-based world
│   ├── Collision.js        Circle-tile collision
│   └── Visibility.js       Flashlight illumination detection
├── audio/
│   ├── AudioManager.js     Sound orchestration
│   ├── SpatialAudio.js     Stereo panning
│   └── ProceduralSounds.js Web Audio API sound generation
├── effects/
│   ├── Lighting.js         World rendering + darkness mask
│   ├── ScreenEffects.js    Vignette, grain, heartbeat pulse
│   ├── Particles.js        Dust & particles
│   └── CameraShake.js      Screen shake
├── systems/
│   ├── ObjectiveSystem.js  Find fuse → activate → escape
│   ├── DifficultySystem.js Room-based scaling
│   └── SaveSystem.js       localStorage persistence
├── ui/
│   ├── HUD.js              Minimal in-game UI
│   ├── Menu.js             Main menu, settings, intro
│   ├── DeathScreen.js      Death sequence
│   ├── Tutorial.js         Interactive tutorial
│   └── TouchControls.js    Mobile touch input
└── utils/
    ├── Constants.js        Configuration & enums
    ├── MathUtils.js        Math helpers
    ├── Random.js           Seeded PRNG
    └── Geometry.js         Cone, raycast, collision
```

## Procedural Generation

Rooms are generated from a seeded PRNG (`Mulberry32`). Given the same seed, the same room is produced.

Generation steps:
1. Carve base floor area
2. Add wall blobs for structure
3. Apply room type (corridor, open, maze, pillars, loops)
4. Ensure connectivity via flood fill
5. Place spawn, objective, exit, enemies with minimum distance validation
6. Add decorative objects

Room types rotate as you progress: narrow corridors → open rooms → mazes → pillar rooms → loop rooms.

## Enemy AI

State machine:

```
DORMANT → ILLUMINATED → ALERT → HUNTING → SEARCHING → LOST → DORMANT
```

- **DORMANT**: Idle, subtle movement. Reacts when illuminated.
- **ILLUMINATED**: Freezes briefly, head turns toward player. Builds detection timer.
- **ALERT**: Brief pause before pursuit begins.
- **HUNTING**: Chases player's last known position.
- **SEARCHING**: Patrols area around last known position when light is off.
- **LOST**: Slows down, eventually returns to dormant.

Enemies use line-of-sight, distance, and illumination duration. They are fair — predictable rules, not random attacks.

## Audio

All sounds are procedurally generated via Web Audio API:
- Footsteps (player and enemy) with distance-based volume
- Heartbeat that intensifies with enemy proximity
- Stereo panning for directional threat location
- Ambient whispers, door creaks, room tone
- Flashlight click, death sound

Audio initializes on first user interaction (browser requirement).

## Debug Mode

Add `?debug=true` to the URL:

```
http://localhost:8080?debug=true
```

Shows: FPS, room number, player position, enemy states, flashlight cone, collision radii.

## Settings

Accessible from main menu. Persisted to localStorage:
- Master / SFX / Ambience volume
- Screen shake on/off
- Visual effects on/off

## Performance

- Target: 60 FPS desktop, 30–60 FPS mobile
- Delta time clamped to prevent physics explosions
- Device pixel ratio capped at 2
- Offscreen canvases for lighting
- Minimal per-frame allocations

## Future Ideas

- Additional enemy types (sound-reactive, shadow-mimic)
- More room templates and environmental hazards
- Persistent story progression across runs
- Controller support
- Additional objective types
- Enemy that only moves when illuminated

---

*The absence of information is the art direction.*
