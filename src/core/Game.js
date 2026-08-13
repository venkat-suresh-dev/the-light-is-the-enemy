import { CONFIG, GAME_STATE } from '../utils/Constants.js';
import { EventBus } from '../core/EventBus.js';
import { Time } from '../core/Time.js';
import { GameLoop } from '../core/GameLoop.js';
import { Input } from '../core/Input.js';
import { Player } from '../player/Player.js';
import { PlayerController } from '../player/PlayerController.js';
import { EnemyManager } from '../enemies/EnemyManager.js';
import { RoomGenerator } from '../world/RoomGenerator.js';
import { Room } from '../world/Room.js';
import { AudioManager } from '../audio/AudioManager.js';
import { Lighting } from '../effects/Lighting.js';
import { ScreenEffects } from '../effects/ScreenEffects.js';
import { Particles } from '../effects/Particles.js';
import { ObjectiveSystem } from '../systems/ObjectiveSystem.js';
import { DifficultySystem } from '../systems/DifficultySystem.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { HUD } from '../ui/HUD.js';
import { Menu } from '../ui/Menu.js';
import { DeathScreen } from '../ui/DeathScreen.js';
import { Tutorial } from '../ui/Tutorial.js';
import { TouchControls } from '../ui/TouchControls.js';
import { HintSystem } from '../ui/HintSystem.js';
export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    this.events = new EventBus();
    this.time = new Time();
    this.input = new Input(canvas, this.events);
    this.saveSystem = new SaveSystem();
    this.difficulty = new DifficultySystem();
    this.roomGenerator = new RoomGenerator();

    this.player = new Player(0, 0);
    this.playerController = new PlayerController(this.player, this.input, this.events);
    this.enemyManager = new EnemyManager(this.events);
    this.audio = new AudioManager(this.events);
    this.lighting = new Lighting();
    this.screenEffects = new ScreenEffects();
    this.particles = new Particles();
    this.objectiveSystem = new ObjectiveSystem(this.events);
    this.hud = new HUD();
    this.menu = new Menu(this.saveSystem);
    this.deathScreen = new DeathScreen();
    this.tutorial = new Tutorial();
    this.hints = new HintSystem();
    this.touchControls = new TouchControls(this.input);

    this.state = GAME_STATE.BOOT;
    this.room = null;
    this.roomNumber = 1;
    this.survivalTime = 0;
    this.baseSeed = Date.now() >>> 0;
    this.camera = { x: 0, y: 0 };
    this.scale = 1;
    this.viewW = 0;
    this.viewH = 0;
    this.debug = false;
    this._enemyAlerted = false;
    this._transitionTimer = 0;
    this._firstRoom = true;

  }

  async init() {
    this._setupCanvas();
    this._applySettings();
    this._bindEvents();
    this._bindMenu();

    this.lighting.init(this.viewW, this.viewH, Math.min(window.devicePixelRatio || 1, 2));
    this.screenEffects.init(this.viewW, this.viewH);

    const params = new URLSearchParams(window.location.search);
    this.debug = params.get('debug') === 'true';
    const flashlightDebug = params.get('debug') === 'flashlight';
    const flashlightSimple = params.get('flashlight-simple') === 'true';
    this.lighting.setDebugFlashlight(flashlightDebug, flashlightSimple);

    this.state = GAME_STATE.MENU;
    this.menu.showMain();

    this.gameLoop = new GameLoop(
      (ts) => this.update(ts),
      () => this.render()
    );
    this.gameLoop.start();

    window.addEventListener('resize', () => this._setupCanvas());
  }

  _setupCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.viewW = rect.width;
    this.viewH = rect.height;

    this.canvas.width = this.viewW * dpr;
    this.canvas.height = this.viewH * dpr;
    this.canvas.style.width = `${this.viewW}px`;
    this.canvas.style.height = `${this.viewH}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this._updateScale();
    this.lighting.resize(this.viewW, this.viewH, dpr);
    this.screenEffects.resize(this.viewW, this.viewH);
  }

  _applySettings() {
    const s = this.saveSystem.getSettings();
    this.audio.setVolumes(s.masterVolume / 100, s.sfxVolume / 100, s.ambienceVolume / 100);
    this.screenEffects.cameraShake.enabled = s.screenShake;
    this.screenEffects.enabled = s.visualEffects;
  }

  _bindEvents() {
    this.events.on('flashlightToggled', ({ on }) => {
      if (on) this.audio.playFlashlightClick();
      this.screenEffects.cameraShake.add(0.05, 0.1);
    });

    this.events.on('enemyAlerted', () => {
      this._enemyAlerted = true;
      this.screenEffects.cameraShake.add(0.3, 0.4);
      this.screenEffects.chromaticOffset = 0.5;
      setTimeout(() => { this.screenEffects.chromaticOffset = 0; }, 500);
    });

    this.events.on('enemyDetectedPlayer', () => {
      this.screenEffects.cameraShake.add(0.2, 0.3);
    });

    this.events.on('playerDamaged', () => {
      this._onPlayerDeath();
    });

    this.events.on('objectiveUpdated', ({ text, hint, updated }) => {
      this.hud.updateObjective(text, hint || '', updated);
    });

    this.events.on('roomCompleted', () => {
      this._onRoomComplete();
    });
  }

  _bindMenu() {
    this.menu.on('play', async () => {
      this.menu.setPlayEnabled(false);
      try {
        await this.audio.init();
        await this.audio.resume();
        await this.menu.playIntro();
        this.startGame();
      } catch (err) {
        console.error('Failed to start game:', err);
        this.menu.showMain();
      } finally {
        this.menu.setPlayEnabled(true);
      }
    });

    this.menu.on('resume', () => {
      this.state = GAME_STATE.PLAYING;
      this.menu.hidePause();
      this.audio.resume();
    });

    this.menu.on('mainMenu', () => {
      this.state = GAME_STATE.MENU;
      this.menu.showMain();
      this.hud.hide();
      this.touchControls.hide();
      this.deathScreen.hide();
      this.audio.suspend();
    });

    this.menu.on('settingsChanged', (settings) => {
      this.audio.setVolumes(settings.masterVolume / 100, settings.sfxVolume / 100, settings.ambienceVolume / 100);
      this.screenEffects.cameraShake.enabled = settings.screenShake;
      this.screenEffects.enabled = settings.visualEffects;
    });

    this.deathScreen.onRetry(() => {
      this.deathScreen.hide();
      this.startGame();
    });

    this.deathScreen.onMenu(() => {
      this.deathScreen.hide();
      this.state = GAME_STATE.MENU;
      this.menu.showMain();
      this.hud.hide();
      this.touchControls.hide();
    });
  }

  startGame() {
    this.roomNumber = 1;
    this.survivalTime = 0;
    this.baseSeed = Date.now() >>> 0;
    this._firstRoom = true;
    this._enemyAlerted = false;
    this.tutorial.reset();
    this.hints.reset();

    this.state = GAME_STATE.PLAYING;
    this.menu.hideAll();
    this.hud.show();
    this.touchControls.show();

    this._loadRoom(this.roomNumber);

    if (this.roomNumber === 1) {
      this.tutorial.start();
    }
  }

  _updateScale() {
    this.scale = Math.min(
      this.viewW / (CONFIG.world.roomWidth * CONFIG.world.tileSize),
      this.viewH / (CONFIG.world.roomHeight * CONFIG.world.tileSize)
    ) * 1.8;
  }

  _loadRoom(roomNumber) {
    this.difficulty.setRoom(roomNumber);
    const seed = this.difficulty.getRoomSeed(this.baseSeed, roomNumber);
    const data = this.roomGenerator.generate(seed, roomNumber);
    this.room = new Room(data);

    this.player.reset(this.room.spawn.x, this.room.spawn.y);
    this.playerController.setTileMap(this.room.tileMap);
    this.enemyManager.setTileMap(this.room.tileMap);
    this.enemyManager.spawnEnemies(
      this.room.enemySpawns,
      this.difficulty.getEnemySpeedMultiplier()
    );

    // Room 1: place first enemy within flashlight range for tutorial
    if (roomNumber === 1 && this.enemyManager.enemies.length > 0) {
      const e = this.enemyManager.enemies[0];
      e.x = this.room.spawn.x + 250;
      e.y = this.room.spawn.y;
    }

    this.player.flashlight.setDrainRate(this.difficulty.getBatteryDrainRate());
    this.objectiveSystem.setup(this.room, roomNumber);
    this.audio.setRoomTheme(this.room.theme, this.room.tileMap);

    this.hud.showRoomTransition(roomNumber, this.room.themeLabel);

    this.camera.x = this.player.x;
    this.camera.y = this.player.y;

    this.events.emit('roomGenerated', { room: this.room, roomNumber });
  }

  _onRoomComplete() {
    this.state = GAME_STATE.TRANSITIONING;
    this._transitionTimer = 0;
    this.roomNumber++;
    this.saveSystem.updateBest(this.roomNumber, this.survivalTime);
  }

  _onPlayerDeath() {
    this.state = GAME_STATE.DEAD;
    this.player.die();
    this.audio.playDeath();
    this.screenEffects.cameraShake.add(0.8, 0.5);
    this.saveSystem.updateBest(this.roomNumber, this.survivalTime);
    this.deathScreen.trigger(this.roomNumber, this.survivalTime);
    this.hud.hide();
    this.touchControls.hide();
  }

  update(timestamp) {
    this.time.update(timestamp);
    const dt = this.time.deltaTime;

    if (this.state === GAME_STATE.DEAD) {
      this.deathScreen.update(dt);
      this.screenEffects.update(dt);
      return;
    }

    if (this.state === GAME_STATE.MENU || this.state === GAME_STATE.BOOT) {
      return;
    }

    if (this.state === GAME_STATE.PAUSED) {
      return;
    }

    if (this.state === GAME_STATE.TRANSITIONING) {
      this._transitionTimer += dt;
      if (this._transitionTimer >= CONFIG.timing.roomTransition) {
        this._loadRoom(this.roomNumber);
        this.state = GAME_STATE.PLAYING;
      }
      return;
    }

    // Pause check
    if (this.input.isPressed('pause')) {
      this.state = GAME_STATE.PAUSED;
      this.menu.showPause();
      this.audio.suspend();
      this.input.endFrame();
      return;
    }

    this.survivalTime += dt;
    this._enemyAlerted = false;

    // Player
    this._updateScale();

    this.playerController.update(dt);
    this.playerController.updateFlashlight(this.camera.x, this.camera.y, this.scale);
    this.player.update(dt);

    // Smooth camera follow — physics position only (walk bob stays on the sprite)
    const shake = this.screenEffects.cameraShake;
    const targetX = this.player.x + shake.offsetX / this.scale;
    const targetY = this.player.y + shake.offsetY / this.scale;
    const camSmooth = CONFIG.effects.cameraSmoothing;
    const camT = Math.min(1, camSmooth * dt);
    this.camera.x += (targetX - this.camera.x) * camT;
    this.camera.y += (targetY - this.camera.y) * camT;

    this.lighting.update(dt);

    // Enemies
    const deathResult = this.enemyManager.update(dt, this.player, this.player.flashlight);
    if (deathResult === 'playerDead') return;

    // Objective
    this.objectiveSystem.update(this.player);

    // Tutorial
    if (this.tutorial.active) {
      this.tutorial.update(dt, this.player, this._enemyAlerted);
    }

    // Audio
    const closestDist = this.enemyManager.getClosestDistance(this.player.x, this.player.y);
    const heartbeatIntensity = this.difficulty.getHeartbeatIntensity(closestDist);
    this.player.dangerLevel = heartbeatIntensity;
    this.audio.playHeartbeat(heartbeatIntensity);
    this.audio.updateHeartbeat(dt, this.player.x, this.player.y);
    this.audio.updateBreathing(dt, this.player, heartbeatIntensity);
    this.screenEffects.setHeartbeat(heartbeatIntensity);

    this.hints.update(dt, this.player, this.objectiveSystem.phase, this.room);

    if (this.player.isMoving && this.player.footstepTimer > (this.player.isSprinting ? 0.28 : 0.42)) {
      this.player.footstepTimer = 0;
      this.audio.playFootstep(this.player.x, this.player.y, this.player.flashlight.angle, this.player.isSprinting);
    }

    for (const enemy of this.enemyManager.enemies) {
      if (enemy.ai.shouldPlayFootstep() && enemy.footstepTimer > 0.4) {
        enemy.footstepTimer = 0;
        this.audio.playEnemyFootstep(
          enemy.x, enemy.y,
          this.player.x, this.player.y,
          this.player.flashlight.angle,
          enemy.state,
          this.room.tileMap
        );
      }
    }

    this.audio.updateAmbientHorror(dt, this.player, this.room);

    // HUD
    this.hud.updateBattery(this.player.flashlight.getBatteryPercent());

    // Effects
    this.screenEffects.update(dt);
    this.particles.update(dt);

    this.input.endFrame();
  }

  render() {
    if (this.state === GAME_STATE.MENU || this.state === GAME_STATE.BOOT) {
      this.ctx.fillStyle = CONFIG.colors.background;
      this.ctx.fillRect(0, 0, this.viewW, this.viewH);
      return;
    }

    if (!this.room) return;

    const shake = this.screenEffects.cameraShake;
    this.ctx.save();
    this.ctx.translate(shake.offsetX, shake.offsetY);

    this._updateScale();

    // Render world
    this.lighting.renderWorld(
      this.ctx,
      this.room.tileMap,
      this.room,
      this.player,
      this.enemyManager.enemies,
      this.camera.x,
      this.camera.y,
      this.scale
    );

    // Darkness overlay
    this.lighting.applyDarkness(
      this.ctx,
      this.player.flashlight,
      this.camera.x,
      this.camera.y,
      this.scale,
      this.room.tileMap,
      this.room
    );

    // Particles
    this.particles.renderDust(
      this.ctx, this.player.flashlight,
      this.camera.x, this.camera.y, this.scale, this.viewW, this.viewH
    );
    this.particles.render(this.ctx, this.camera.x, this.camera.y, this.scale, this.viewW, this.viewH);

    this.ctx.restore();

    // Screen effects overlay
    this.screenEffects.renderOverlay(this.ctx, this.viewW, this.viewH);

    // Transition fade
    if (this.state === GAME_STATE.TRANSITIONING) {
      const alpha = Math.min(1, this._transitionTimer / CONFIG.timing.roomTransition);
      this.ctx.fillStyle = `rgba(5,5,5,${alpha * 0.8})`;
      this.ctx.fillRect(0, 0, this.viewW, this.viewH);
    }

    // Death fade
    if (this.state === GAME_STATE.DEAD) {
      const alpha = Math.min(1, this.deathScreen._delayTimer / 2);
      this.ctx.fillStyle = `rgba(5,5,5,${alpha})`;
      this.ctx.fillRect(0, 0, this.viewW, this.viewH);
    }

    // Debug overlay
    if (this.debug) {
      this._renderDebug();
    }
  }

  _renderDebug() {
    const overlay = document.getElementById('debug-overlay');
    overlay.classList.remove('hidden');

    const lines = [
      `FPS: ${(1 / this.time.deltaTime).toFixed(0)}`,
      `Room: ${this.roomNumber}`,
      `State: ${this.state}`,
      `Player: ${this.player.x.toFixed(0)}, ${this.player.y.toFixed(0)}`,
      `Flashlight: ${this.player.flashlight.isOn ? 'ON' : 'OFF'} (${this.player.flashlight.battery.toFixed(0)}%)`,
      `Enemies: ${this.enemyManager.enemies.length}`,
    ];

    for (const e of this.enemyManager.enemies) {
      lines.push(`  E${e.id}: ${e.state} @ ${e.x.toFixed(0)},${e.y.toFixed(0)} vis=${e.visible}`);
    }

    lines.push(`Theme: ${this.room.theme} (${this.room.themeLabel})`);
    lines.push(`Objective: ${this.objectiveSystem.phase}`);
    lines.push(`Survival: ${this.survivalTime.toFixed(1)}s`);

    overlay.textContent = lines.join('\n');

    // Draw debug on canvas
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(0,255,0,0.3)';
    this.ctx.lineWidth = 1;

    if (this.player.flashlight.isOn) {
      const px = (this.player.flashlight.x - this.camera.x) * this.scale + this.viewW / 2;
      const py = (this.player.flashlight.y - this.camera.y) * this.scale + this.viewH / 2;
      const range = this.player.flashlight.range * this.scale;
      const halfFov = this.player.flashlight.fov / 2;
      const angle = this.player.flashlight.angle;

      this.ctx.beginPath();
      this.ctx.moveTo(px, py);
      this.ctx.arc(px, py, range, angle - halfFov, angle + halfFov);
      this.ctx.closePath();
      this.ctx.stroke();
    }

    for (const e of this.enemyManager.enemies) {
      const sx = (e.x - this.camera.x) * this.scale + this.viewW / 2;
      const sy = (e.y - this.camera.y) * this.scale + this.viewH / 2;
      this.ctx.beginPath();
      this.ctx.arc(sx, sy, e.radius * this.scale, 0, Math.PI * 2);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }
}
