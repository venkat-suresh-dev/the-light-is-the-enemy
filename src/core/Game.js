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
import { ThreatSystem } from '../systems/ThreatSystem.js';
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
    this.threat = new ThreatSystem();
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
    this.debugAudio = false;
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
    this.debugAudio = params.get('debug') === 'audio';
    this.audio.debug = this.debugAudio;
    if (this.audio.assets) this.audio.assets.debug = this.debugAudio;
    if (this.debugAudio) window.__audio = this.audio;
    const flashlightDebug = params.get('debug') === 'flashlight';
    const flashlightSimple = params.get('flashlight-simple') === 'true';
    this.lighting.setDebugFlashlight(flashlightDebug, flashlightSimple);

    this.state = GAME_STATE.MENU;
    this.menu.showMain();
    this.audio.bootstrap().catch((err) => console.warn('Audio bootstrap failed:', err));

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

    this.events.on('enemyIlluminated', ({ enemy, player }) => {
      this.audio.playIlluminationSting(enemy, player);
    });

    this.events.on('playerDamaged', () => {
      this._onPlayerDeath();
    });

    this.events.on('objectiveItemFound', () => {
      this.audio.playPickup();
    });

    this.events.on('objectiveUpdated', ({ text, hint, updated }) => {
      this.hud.updateObjective(text, hint || '', updated);
    });

    this.events.on('roomCompleted', () => {
      this.audio.playDoor();
      this._onRoomComplete();
    });
  }

  _bindMenu() {
    this.menu.on('play', async () => {
      this.menu.setPlayEnabled(false);
      try {
        this.audio.unlockFromGesture();
        this.audio.init().catch((err) => {
          console.warn('Audio initialization failed:', err);
        });
        await this.menu.playIntro();
        this.startGame();
        this.audio.notifyGameplayStart();
        this.input.endFrame();
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
      this.audio.setGameState('MENU');
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
      this.audio.setGameState('MENU');
      this.audio.resume();
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
    this.threat.reset();
    this.audio.resetForRoom();

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
      this.input.endFrame();
      return;
    }

    if (this.state === GAME_STATE.PAUSED) {
      this.input.endFrame();
      return;
    }

    if (this.state === GAME_STATE.TRANSITIONING) {
      this._transitionTimer += dt;
      if (this._transitionTimer >= CONFIG.timing.roomTransition) {
        this.audio.playDoor();
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

    // Audio + threat
    this.threat.update(dt, this.enemyManager.enemies, this.player, this.room.tileMap);
    const threat = this.threat.intensity;
    this.player.dangerLevel = threat;
    this.audio.updateThreat(dt, threat);
    this.audio.updateHeartbeat(dt);
    this.audio.updateBreathing(dt, this.player, threat);
    this.screenEffects.setHeartbeat(threat);

    this.hints.update(dt, this.player, this.objectiveSystem.phase, this.room);

    if (this.debugAudio && this.input.keysPressed.has('F9')) {
      this.audio.playDebugDirectFootstep(false);
    }
    if (this.debugAudio && this.input.keysPressed.has('F10')) {
      this.audio._playDebugEnemyStep(-0.82);
    }
    if (this.debugAudio && this.input.keysPressed.has('F11')) {
      this.audio._playDebugEnemyStep(0.82);
    }
    if (this.debugAudio && this.input.keysPressed.has('F12')) {
      this.audio._playDebugHeartbeat(0.5);
    }
    if (this.debugAudio && this.input.keysPressed.has('=')) {
      this.audio._playDebugHeartbeat(0.9);
    }
    if (this.debugAudio && this.input.keysPressed.has('-')) {
      this.audio._playDebugAmbient();
    }

    this.audio.updatePlayerFootsteps(dt, this.player);

    for (const enemy of this.enemyManager.enemies) {
      const enemySpeed = Math.hypot(enemy.velocity.x, enemy.velocity.y);
      const distToPlayer = Math.hypot(enemy.x - this.player.x, enemy.y - this.player.y);

      if (enemySpeed < 12 || !enemy.ai.shouldPlayFootstep() || distToPlayer > 400) {
        enemy.footstepTimer = 0;
        continue;
      }

      if (enemy.footstepTimer >= enemy.nextFootstepInterval) {
        enemy.footstepTimer = 0;
        enemy.scheduleNextFootstep();
        this.audio.playEnemyFootstep(
          enemy.x, enemy.y,
          this.player.x, this.player.y,
          this.player.flashlight.angle,
          enemy.state,
          this.room.tileMap,
          enemySpeed
        );
      }
    }

    this.audio.updateAmbientHorror(dt, this.player, this.room);

    // HUD
    this.hud.updateStamina(this.player.staminaMeter.normalized(), this.player.getStaminaState());
    this.hud.updateFlashlight(this.player.flashlight.getBatteryPercent(), this.player.flashlight.getPowerState());

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
    if (this.debug || this.debugAudio) {
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
      `Stamina: ${this.player.stamina.toFixed(0)}%`,
      `Threat: ${this.threat.intensity.toFixed(2)} (${this.threat.raw.toFixed(2)})`,
      `Flashlight: ${this.player.flashlight.isOn ? 'ON' : 'OFF'} (${this.player.flashlight.battery.toFixed(0)}%)`,
      `Enemies: ${this.enemyManager.enemies.length}`,
    ];

    for (const e of this.enemyManager.enemies) {
      lines.push(`  E${e.id}: ${e.state} @ ${e.x.toFixed(0)},${e.y.toFixed(0)} vis=${e.visible}`);
    }

    lines.push(`Theme: ${this.room.theme} (${this.room.themeLabel})`);
    lines.push(`Objective: ${this.objectiveSystem.phase}`);
    lines.push(`Survival: ${this.survivalTime.toFixed(1)}s`);

    if (this.debugAudio) {
      const a = this.audio.getDebugSnapshot();
      lines.push('');
      lines.push('AUDIO');
      lines.push(`Context: ${a.context} t=${a.currentTime}`);
      lines.push(`Master: ${a.master.toFixed(2)} amb=${a.ambience.toFixed(2)} music=${(a.music ?? 0).toFixed(2)}`);
      lines.push(`Player: ${a.player.toFixed(2)} Enemy: ${a.enemy.toFixed(2)} HB: ${a.heartbeat.toFixed(2)}`);
      lines.push(`Threat: ${a.threat.toFixed(2)} hb=${(a.heartbeatVoice ?? 0).toFixed(2)} bpm=${a.heartbeatBpm ?? 0}`);
      lines.push(` HB pulse=${(a.heartbeatPulseGain ?? 0).toFixed(2)} eff=${(a.heartbeatEffective ?? 0).toFixed(3)} threatMus=${(a.threatMusic ?? 0).toFixed(3)}`);
      lines.push(`Menu: loaded=${a.menuMusicLoaded} playing=${a.menuMusicPlaying} ctx=${a.context}`);
      lines.push(`Footsteps loaded=${a.footstepsLoaded} ready=${a.footstepsReady}`);
      lines.push(` Slices: ${a.footstepsSlices} walk=${a.walkSlices} run=${a.runSlices}`);
      lines.push(` Steps asset/fallback: ${a.counts.playerStepsAsset}/${a.counts.playerStepsFallback}`);
      lines.push(` Last step: ${a.lastPlayerStepSource} gain=${(a.lastPlayerStepGain ?? 0).toFixed(2)} spd=${a.lastPlayerSpeed}`);
      if (a.lastEnemyStep) {
        const e = a.lastEnemyStep;
        lines.push(` Enemy step: dist=${e.dist} spd=${e.speed} gain=${e.gain} ${e.state}`);
      }
      lines.push(` Pickups=${a.counts.pickups} Doors=${a.counts.doors} GameOver=${a.counts.gameOvers}`);
      lines.push(` Enemy steps: ${a.counts.enemySteps} heartbeats: ${a.counts.heartbeats} sfx=${(a.sfx ?? 0).toFixed(2)}`);
      if (a.lastPathError) lines.push(` PATH ERR: ${a.lastPathError}`);
      lines.push(` Failed: ${a.footstepStats?.playerFailed ?? 0}`);
      if (a.lastResumeError) lines.push(`ResumeErr: ${a.lastResumeError}`);
      lines.push('F9=direct F10/F11=enemy F12/==hb -=amb');
    }

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
