import { CONFIG, ENEMY_STATE } from '../utils/Constants.js';
import { ProceduralSounds } from './ProceduralSounds.js';
import { SpatialAudio } from './SpatialAudio.js';
import { AudioMixer } from './AudioMixer.js';
import { RoomAmbience } from './RoomAmbience.js';
import { AudioAssets } from './AudioAssets.js';
import { FootstepPlayer } from './FootstepPlayer.js';
import { hasLineOfSight } from '../utils/Geometry.js';

export class AudioManager {
  constructor(events) {
    this.events = events;
    this.ctx = null;
    this.sounds = null;
    this.spatial = null;
    this.mixer = null;
    this.roomAmbience = null;
    this.assets = null;
    this.footsteps = null;
    this.initialized = false;
    this.masterVolume = CONFIG.audio.masterVolume;
    this.sfxVolume = CONFIG.audio.sfxVolume;
    this.ambienceVolume = CONFIG.audio.ambienceVolume;

    this._heartbeatTimer = 0;
    this._heartbeatInterval = 1.09;
    this._heartbeatIntensity = 0;
    this._pendingDub = -1;
    this._playerStepAccum = 0;
    this._breathTimer = 0;
    this._breathPhase = 'inhale';
    this._exertion = 0;
    this._tileMap = null;
    this._currentTheme = null;
    this._stingTimes = new Map();
    this._gapTimer = 0;
    this._gapUntil = 0;
    this._nextGap = 11;
    this._gapMul = 1;
    this._ambienceBase = 0.78;
    this._pendingTheme = null;
    this._hbBoost = 0;
    this._lfo = 0;
    this.debug = false;
    this._loopsLive = false;
    this._gestureBound = false;
    this._lastResumeError = null;
    this._gameState = 'MENU';

    this._ambienceLooper = null;
    this._ambienceGain = null;
    this._threatSource = null;
    this._threatGain = null;
    this._menuLooper = null;
    this._menuGain = null;
    this._assetsReady = false;
    this._lastPickupAt = -999;
    this._lastPlayerSpeed = 0;
    this._lastPlayerStepSource = 'none';
    this._lastF9Probe = -999;
    this._lastHbPulseGain = 0;
    this._menuMusicPlaying = false;
    this._menuMusicWanted = false;
    this._lastEnemyStep = null;

    this._counts = {
      playerSteps: 0,
      playerStepsAsset: 0,
      playerStepsFallback: 0,
      enemySteps: 0,
      heartbeats: 0,
      pickups: 0,
      doors: 0,
      gameOvers: 0,
      probes: 0,
      oneShots: 0,
    };
  }

  _ready() {
    return !!(this.initialized && this.ctx && this.sounds && this.spatial && this.mixer);
  }

  unlockFromGesture() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) {
          console.warn('AudioContext is not available in this browser.');
          return;
        }
        this.ctx = new AC();
        this.ctx.addEventListener('statechange', () => {
          if (this.ctx?.state === 'running') this._startLoopingSources();
        });
      }
      this._bindGestureResume();
      if (this.ctx.state === 'suspended') {
        const p = this.ctx.resume();
        p.catch((err) => {
          this._lastResumeError = String(err);
          console.warn('Audio resume blocked:', err);
        });
      }
    } catch (err) {
      console.warn('AudioContext unavailable:', err);
      this.ctx = null;
    }
  }

  _bindGestureResume() {
    if (this._gestureBound) return;
    this._gestureBound = true;
    const kick = () => {
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().then(() => this._startLoopingSources()).catch((err) => {
          this._lastResumeError = String(err);
          if (this.debug) console.warn('[audio-debug] resume failed:', err);
        });
      } else if (this.ctx.state === 'running') {
        this._startLoopingSources();
        if (this._gameState === 'MENU' && this._menuMusicWanted) {
          this.playMenuMusic();
        }
      }
    };
    window.addEventListener('pointerdown', kick);
    window.addEventListener('keydown', kick);
    window.addEventListener('touchstart', kick, { passive: true });
  }

  async bootstrap() {
    try {
      await this.init();
      this.setGameState('MENU');
    } catch (err) {
      console.warn('Audio bootstrap failed:', err);
    }
  }

  async init() {
    if (this.initialized) {
      await this.resume();
      this._startLoopingSources();
      return;
    }
    try {
      this.unlockFromGesture();
      if (!this.ctx) {
        this.initialized = false;
        return;
      }
      this.sounds = new ProceduralSounds(this.ctx);
      this.mixer = new AudioMixer(this.ctx);
      this.spatial = new SpatialAudio(this.ctx, this.mixer.getBus('player'));
      this.roomAmbience = new RoomAmbience(this.ctx, this.mixer.getBus('ambience'));
      this.assets = new AudioAssets(this.ctx);
      this.assets.debug = this.debug;
      this.footsteps = new FootstepPlayer(this.ctx, this.spatial, this.assets);
      this.setVolumes(this.masterVolume, this.sfxVolume, this.ambienceVolume);
      this.initialized = true;
      this._loadAssets();
      await this.resume();
      this._startLoopingSources();
    } catch (e) {
      console.warn('Audio unavailable:', e);
      this.initialized = false;
    }
  }

  _loadAssets() {
    if (!this.assets) return;
    this.assets.load().then(() => {
      this._assetsReady = this.assets.ready;
      this.assets.debug = this.debug;
      if (this.debug && this.assets.footsteps) {
        console.info('[audio-debug] footsteps analysis', {
          loaded: !!this.assets.buffers.footsteps,
          peaks: this.assets.footsteps.peakCount,
          steps: this.assets.footsteps.steps.length,
          walk: this.assets.footsteps.walkSteps.length,
          run: this.assets.footsteps.runSteps.length,
          loopCorr: this.assets.footsteps.loopCorr,
        });
      }
      if (this.ctx?.state === 'running') {
        this._startAmbienceBed();
        this._startThreatMusicBed();
        this._syncMusicForState();
      }
    }).catch((err) => {
      console.warn('Asset load failed:', err);
    });
  }

  _startLoopingSources() {
    if (!this.initialized || !this.ctx || this.ctx.state !== 'running') return;
    try {
      if (!this._loopsLive) {
        this._startAmbienceBed();
        this._startThreatMusicBed();
        this._loopsLive = true;
      }
      const theme = this._pendingTheme || this._currentTheme;
      if (theme && this.roomAmbience && this.sounds) {
        const needsBeds = !this.roomAmbience.activeSourceCount();
        this.roomAmbience.setTheme(theme, this.sounds, needsBeds);
        this._pendingTheme = null;
      }
      this._syncMusicForState();
    } catch (bedErr) {
      console.warn('Audio beds failed:', bedErr);
    }
  }

  _startAmbienceBed() {
    if (!this.ctx || !this.mixer || this._ambienceGain) return;
    const buffer = this.assets?.get('ambience');
    if (!buffer) return;

    this._ambienceGain = this.ctx.createGain();
    this._ambienceGain.gain.value = 0;
    this._ambienceGain.connect(this.mixer.getBus('ambience'));

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.connect(this._ambienceGain);
    src.start();
    this._ambienceLooper = { src, simple: true };
    this._applyAmbienceLevel(this._heartbeatIntensity);
  }

  _startThreatMusicBed() {
    if (!this.ctx || !this.mixer || this._threatGain) return;
    const buffer = this.assets?.get('threatMusic');
    if (!buffer) return;

    this._threatGain = this.ctx.createGain();
    this._threatGain.gain.value = 0;
    this._threatGain.connect(this.mixer.getBus('music'));

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.connect(this._threatGain);
    src.start();
    this._threatSource = src;
    this._applyThreatMusicLevel(0);
  }

  _applyAmbienceLevel(intensity) {
    const base = this._ambienceBase * CONFIG.audio.mix.ambienceBed;
    let duck = 1;
    if (intensity < 0.2) duck = 1;
    else if (intensity < 0.4) duck = 0.94;
    else if (intensity < 0.6) duck = 0.78;
    else if (intensity < 0.8) duck = 0.48;
    else duck = 0.22;
    const target = base * duck * this._gapMul;

    if (this._ambienceGain) {
      this._ambienceGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.9);
    }
  }

  _threatMusicLevel(intensity) {
    const pts = CONFIG.audio.mix.threatMusicCurve;
    const t = Math.max(0, Math.min(1, intensity));
    if (!pts?.length) return 0;
    if (t <= pts[0][0]) return pts[0][1] * CONFIG.audio.mix.threatMusicMax;
    for (let i = 1; i < pts.length; i++) {
      const [x1, y1] = pts[i - 1];
      const [x2, y2] = pts[i];
      if (t <= x2) {
        const u = (t - x1) / Math.max(0.001, x2 - x1);
        const level = y1 + (y2 - y1) * u;
        return level * CONFIG.audio.mix.threatMusicMax;
      }
    }
    return pts[pts.length - 1][1] * CONFIG.audio.mix.threatMusicMax;
  }

  _applyThreatMusicLevel(intensity) {
    if (!this._threatGain || !this.ctx) return;
    const vol = this._threatMusicLevel(intensity) * this._gapMul;
    this._threatGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.75);
  }

  setGameState(state) {
    this._gameState = state;
    this._syncMusicForState();
  }

  _syncMusicForState() {
    if (!this._ready()) return;
    if (this._gameState === 'MENU') {
      this._menuMusicWanted = true;
      if (this._assetsReady) this.playMenuMusic();
    } else {
      this._menuMusicWanted = false;
      this.stopMenuMusic();
    }
  }

  playMenuMusic() {
    if (!this._ready() || this._menuLooper) return;
    const buffer = this.assets?.get('menuMusic');
    if (!buffer) return;
    if (this.ctx.state !== 'running') {
      this._menuMusicWanted = true;
      return;
    }
    try {
      this._menuGain = this.ctx.createGain();
      this._menuGain.gain.value = 0;
      this._menuGain.connect(this.mixer.getBus('music'));
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.connect(this._menuGain);
      src.start();
      this._menuLooper = src;
      this._menuMusicPlaying = true;
      const target = CONFIG.audio.mix.menuMusic * Math.max(0.5, this.ambienceVolume);
      this._menuGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.6);
    } catch (err) {
      console.warn('Menu music failed:', err);
      this._menuMusicPlaying = false;
    }
  }

  stopMenuMusic() {
    if (!this._menuLooper || !this.ctx) {
      this._menuMusicPlaying = false;
      return;
    }
    try {
      const t = this.ctx.currentTime;
      if (this._menuGain) {
        this._menuGain.gain.cancelScheduledValues(t);
        this._menuGain.gain.setValueAtTime(this._menuGain.gain.value, t);
        this._menuGain.gain.linearRampToValueAtTime(0, t + 0.8);
      }
      const src = this._menuLooper;
      setTimeout(() => {
        try { src.stop(); } catch (e) { /* */ }
      }, 900);
    } catch (err) {
      console.warn('Stop menu music failed:', err);
    }
    this._menuLooper = null;
    this._menuGain = null;
    this._menuMusicPlaying = false;
  }

  setVolumes(master, sfx, ambience) {
    this.masterVolume = master;
    this.sfxVolume = sfx;
    this.ambienceVolume = ambience;
    this._ambienceBase = ambience;
    if (this.mixer) {
      this.mixer.setMaster(master);
      this.mixer.setBus('ambience', ambience);
      this.mixer.setBus('music', ambience * 0.88);
      this.mixer.setBus('player', sfx * CONFIG.audio.mix.playerStepBus);
      this.mixer.setBus('enemy', sfx * CONFIG.audio.mix.enemySafe);
      this.mixer.setBus('heartbeat', sfx * CONFIG.audio.mix.heartbeatBus);
      this.mixer.setBus('breathing', sfx * 0.62);
      this.mixer.setBus('sfx', sfx * CONFIG.audio.mix.sfxBus);
      this.mixer.setBus('ui', sfx * 0.78);
      this.mixer.setBus('atmosphere', 0);
    }
    if (this._menuGain && this.ctx) {
      this._menuGain.gain.setTargetAtTime(
        CONFIG.audio.mix.menuMusic * ambience,
        this.ctx.currentTime,
        0.5
      );
    }
  }

  setRoomTheme(theme, tileMap) {
    this._currentTheme = theme;
    this._tileMap = tileMap;
    if (!this._ready() || !this.roomAmbience) {
      this._pendingTheme = theme;
      return;
    }
    if (!this.ctx || this.ctx.state !== 'running') {
      this._pendingTheme = theme;
      return;
    }
    try {
      this.roomAmbience.setTheme(theme, this.sounds);
    } catch (err) {
      console.warn('Room ambience failed:', err);
    }
  }

  resetForRoom() {
    this._stingTimes.clear();
    this._heartbeatTimer = 0;
    this._pendingDub = -1;
    this._exertion = 0;
    this._heartbeatIntensity = 0;
    this._hbBoost = 0;
    this._gapMul = 1;
    this._gapUntil = 0;
    this._playerStepAccum = 0;
    this._applyAmbienceLevel(0);
    this._applyThreatMusicLevel(0);
  }

  updatePlayerFootsteps(deltaTime, player) {
    if (!this._ready() || !player) return;
    try {
      if (!player.isMoving) {
        this._playerStepAccum = 0;
        return;
      }
      const speed = Math.hypot(player.velocity.x, player.velocity.y);
      this._lastPlayerSpeed = speed;
      if (speed < 12) {
        this._playerStepAccum = 0;
        return;
      }

      const sprinting = !!(player.isSprinting && speed > CONFIG.player.speed * 1.05);
      const stride = sprinting ? 62 : 72;
      let interval = stride / speed;
      if (sprinting) interval = Math.max(0.22, Math.min(0.32, interval));
      else interval = Math.max(0.38, Math.min(0.72, interval));

      this._playerStepAccum += deltaTime;
      if (this._playerStepAccum < interval) return;
      this._playerStepAccum = 0;
      this._counts.playerSteps += 1;
      this._counts.oneShots += 1;
      this._playPlayerFootstep(sprinting);
    } catch (err) {
      console.warn('Player footstep failed:', err);
    }
  }

  playFootstep(playerX, playerY, listenerAngle, sprinting) {
    this._playPlayerFootstep(sprinting);
  }

  _playPlayerFootstep(sprinting) {
    if (!this._ready()) return;
    const base = sprinting ? CONFIG.audio.mix.playerRunStep : CONFIG.audio.mix.playerWalkStep;
    const vol = base * (0.94 + Math.random() * 0.12);
    const pan = (Math.random() - 0.5) * 0.08;

    const footstepsReady = this.assets?.footstepsReady?.() ?? false;
    const busMeta = {
      playerBus: this.mixer.getBusGain('player'),
      master: this.mixer.getBusGain('master'),
    };
    if (footstepsReady && this.footsteps?.playPlayerStep(
      sprinting, vol, pan, this.mixer.getBus('player'), busMeta
    )) {
      this._counts.playerStepsAsset += 1;
      this._lastPlayerStepSource = 'asset';
      return;
    }

    this._counts.playerStepsFallback += 1;
    this._lastPlayerStepSource = 'fallback';
    const buffer = this.sounds.createPlayerFootstep(sprinting, this._currentTheme, false);
    this.spatial.playBuffer(buffer, vol * 0.7, pan, 0, 1, this.mixer.getBus('player'), {
      playbackRate: (sprinting ? 1.02 : 0.98) * (0.96 + Math.random() * 0.06),
      lowpass: sprinting ? 1950 : 1550,
      noFade: true,
    });
  }

  _enemyFootstepPresence(dist, hunting) {
    const maxAudible = 400;
    const mid = 220;
    const near = 90;
    if (dist > maxAudible) return 0;
    if (dist <= near) {
      return (hunting ? 0.82 : 0.62) + (1 - dist / near) * 0.12;
    }
    if (dist <= mid) {
      const t = (dist - near) / (mid - near);
      const nearVol = hunting ? 0.82 : 0.62;
      return nearVol * (1 - t) + 0.22 * t;
    }
    const t = (dist - mid) / (maxAudible - mid);
    return 0.22 * (1 - t * t);
  }

  playEnemyFootstep(enemyX, enemyY, playerX, playerY, listenerAngle, state, tileMap, enemySpeed = 0) {
    if (!this._ready()) return;
    if (enemySpeed < 12) return;

    const hunting = state === ENEMY_STATE.HUNTING;
    const searching = state === ENEMY_STATE.SEARCHING;
    if (!hunting && !searching) return;

    const rel = this.spatial.getRelative(playerX, playerY, listenerAngle, enemyX, enemyY);
    const dist = rel.dist;

    const presence = this._enemyFootstepPresence(dist, hunting);
    if (presence < 0.04) return;

    let occlusion = 1;
    if (tileMap) {
      occlusion = hasLineOfSight(playerX, playerY, enemyX, enemyY, tileMap, tileMap.tileSize)
        ? 1
        : 0.38;
    }

    const volJitter = 0.88 + Math.random() * 0.16;
    const vol = presence * volJitter * CONFIG.audio.mix.enemyStepMul;

    this._lastEnemyStep = {
      dist: Math.round(dist),
      speed: Math.round(enemySpeed),
      state,
      gain: Number(vol.toFixed(3)),
      hunting,
    };

    try {
      this._counts.enemySteps += 1;
      this._counts.oneShots += 1;

      if (this.assets?.footstepsReady?.() && this.footsteps?.playEnemyStep(
        vol, rel.pan, occlusion, rel.rear, this.mixer.getBus('enemy'), hunting
      )) {
        return;
      }

      this.spatial.playBuffer(
        this.sounds.createEnemyFootstep(),
        vol,
        rel.pan,
        0,
        occlusion,
        this.mixer.getBus('enemy'),
        {
          playbackRate: hunting ? 0.9 + Math.random() * 0.05 : 0.84 + Math.random() * 0.06,
          lowpass: Math.max(180, (280 + (1 - Math.min(1, dist / 400)) * 800) * (0.45 + occlusion * 0.55) - rel.rear * 80),
          rear: rel.rear,
          noFade: true,
        }
      );
    } catch (err) {
      console.warn('Enemy footstep failed:', err);
    }
  }

  playHeartbeat(intensity) {
    this._heartbeatIntensity = intensity;
  }

  updateThreat(deltaTime, intensity) {
    if (!this._ready()) {
      this._heartbeatIntensity = intensity;
      return;
    }
    try {
      this._heartbeatIntensity = intensity;
      this._hbBoost *= Math.exp(-deltaTime * 1.7);
      this._lfo += deltaTime;
      this._updateSilenceGaps(deltaTime, intensity);
      this._applyAmbienceLevel(intensity);
      this._applyThreatMusicLevel(intensity);
      this._updateThreatMix(intensity);
    } catch (err) {
      console.warn('Threat audio failed:', err);
    }
  }

  _updateSilenceGaps(deltaTime, intensity) {
    const now = this.ctx ? this.ctx.currentTime : 0;
    if (now < this._gapUntil) {
      this._gapMul = 0.1;
      return;
    }
    this._gapMul = 1;
    if (intensity < 0.78) return;

    this._gapTimer += deltaTime;
    if (this._gapTimer >= this._nextGap) {
      this._gapTimer = 0;
      this._nextGap = 6.5 + Math.random() * 9;
      this._gapUntil = now + 0.35 + Math.random() * 0.4;
      this._gapMul = 0.1;
    }
  }

  _updateThreatMix(intensity) {
    if (!this.mixer) return;
    const mix = CONFIG.audio.mix;
    const t = Math.max(0, Math.min(1, intensity));

    const player = this.sfxVolume * mix.playerStepBus;
    const enemy = this.sfxVolume * mix.enemySafe;
    const heartbeat = this.sfxVolume * mix.heartbeatBus;
    const breathing = this.sfxVolume * (0.38 + t * 0.55);

    this.mixer.setBusTarget('player', player, 0.75);
    this.mixer.setBusTarget('enemy', enemy, 0.65);
    this.mixer.setBusTarget('heartbeat', heartbeat, 0.85);
    this.mixer.setBusTarget('breathing', breathing, 0.7);
    this.mixer.setBusTarget('sfx', this.sfxVolume * mix.sfxBus, 0.4);
    this.roomAmbience?.setThreatMix(intensity, this._gapMul);
  }

  _bpmFromThreat(intensity) {
    const pts = CONFIG.audio.heartbeatBpm;
    if (!pts || !pts.length) return 70;
    if (intensity <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) {
      const [x1, y1] = pts[i - 1];
      const [x2, y2] = pts[i];
      if (intensity <= x2) {
        const u = (intensity - x1) / Math.max(0.001, x2 - x1);
        return y1 + (y2 - y1) * u;
      }
    }
    return pts[pts.length - 1][1];
  }

  updateHeartbeat(deltaTime) {
    if (!this._ready()) return;

    const intensity = Math.min(1, this._heartbeatIntensity + this._hbBoost);
    const bpm = this._bpmFromThreat(intensity);
    const dubGap = 0.17 - intensity * 0.055 + (Math.random() - 0.5) * 0.012;

    if (this._pendingDub >= 0) {
      this._pendingDub -= deltaTime;
      if (this._pendingDub <= 0) {
        this._pendingDub = -1;
        this._playHeartPulse('dub', intensity);
      }
    }

    this._heartbeatTimer += deltaTime;
    if (this._heartbeatTimer >= this._heartbeatInterval) {
      this._heartbeatTimer = 0;
      this._heartbeatInterval = (60 / bpm) * (0.96 + Math.random() * 0.08);
      this._playHeartPulse('lub', intensity);
      this._pendingDub = Math.max(0.07, dubGap);
    }
  }

  _heartbeatVoice(intensity) {
    const mix = CONFIG.audio.mix;
    const t = Math.max(0, Math.min(1, intensity));
    const curve = t * t * (3 - 2 * t);
    return mix.heartbeatBaseline + (mix.heartbeatCritical - mix.heartbeatBaseline) * curve;
  }

  _heartbeatEffectiveGain(intensity) {
    const voice = this._heartbeatVoice(intensity);
    const bus = this.mixer ? this.mixer.getBusGain('heartbeat') : CONFIG.audio.mix.heartbeatBus;
    const master = this.mixer ? this.mixer.getBusGain('master') : this.masterVolume;
    return voice * CONFIG.audio.mix.heartbeatPulseGain * bus * master;
  }

  _playHeartPulse(kind, intensity) {
    const voice = this._heartbeatVoice(intensity);
    const buffer = this.sounds.createHeartbeat(kind);
    this._counts.heartbeats += 1;
    this._counts.oneShots += 1;
    const lubMul = kind === 'lub' ? 1 : 0.72;
    const vol = voice * lubMul * CONFIG.audio.mix.heartbeatPulseGain * (0.98 + Math.random() * 0.04);
    const rate = (kind === 'lub' ? 0.96 : 1.02) + intensity * 0.05;
    this._lastHbPulseGain = vol;
    this.spatial.playBuffer(buffer, vol, 0, 0, 1, this.mixer.getBus('heartbeat'), {
      playbackRate: rate * (0.99 + Math.random() * 0.02),
      lowpass: 5200,
      noFade: true,
    });
  }

  updateBreathing(deltaTime, player, dangerLevel) {
    if (!this._ready()) return;

    const staminaNorm = player.staminaMeter ? player.staminaMeter.normalized() : 1;
    let targetExertion = 0;
    if (player.isSprinting && player.isMoving) targetExertion = 0.92;
    else if (staminaNorm < 0.3) targetExertion = 0.4 + (1 - staminaNorm) * 0.35;
    else if (dangerLevel > 0.8) targetExertion = 0.58;
    else if (dangerLevel > 0.55) targetExertion = 0.3 + (dangerLevel - 0.55) * 0.5;
    else if (dangerLevel > 0.3) targetExertion = 0.12 + (dangerLevel - 0.3) * 0.35;
    else if (player.isMoving) targetExertion = 0.05;

    const rate = targetExertion > this._exertion ? 2.2 : 0.85;
    const u = 1 - Math.exp(-rate * deltaTime);
    this._exertion += (targetExertion - this._exertion) * u;

    if (this._exertion < 0.14) return;

    this._breathTimer += deltaTime;
    const interval = 1.85 - this._exertion * 0.7;
    if (this._breathTimer >= interval) {
      this._breathTimer = 0;
      const kind = this._breathPhase;
      this._breathPhase = kind === 'inhale' ? 'exhale' : 'inhale';
      const buffer = this.sounds.createBreathing(kind);
      const vol = this._exertion * 0.26;
      this.spatial.playBuffer(buffer, vol, 0, kind === 'inhale' ? 1.15 : 1.35, 1, this.mixer.getBus('breathing'), {
        playbackRate: 0.9 + this._exertion * 0.1 + (Math.random() - 0.5) * 0.04,
        lowpass: 920,
      });
    }
  }

  playIlluminationSting(enemy, player) {
    if (!this._ready() || !enemy) return;

    const now = this.ctx.currentTime;
    const last = this._stingTimes.get(enemy.id) || -999;
    if (now - last < CONFIG.audio.stingCooldown) return;
    this._stingTimes.set(enemy.id, now);
    this._hbBoost = Math.max(this._hbBoost, 0.28);
    this._heartbeatInterval = Math.min(this._heartbeatInterval, 0.58);

    const rel = this.spatial.getRelative(
      player.x, player.y, player.flashlight.angle, enemy.x, enemy.y
    );
    const distVol = this.spatial.calculateVolume(player.x, player.y, enemy.x, enemy.y, 520);
    const vol = 0.08 + distVol * 0.07;
    this.spatial.playBuffer(
      this.sounds.createIlluminationSting(),
      vol,
      rel.pan,
      0.42,
      1,
      this.mixer.getBus('ui'),
      {
        playbackRate: 0.97 + Math.random() * 0.05,
        lowpass: 720,
        rear: rel.rear,
      }
    );
  }

  playFlashlightClick() {
    if (!this._ready()) return;
    const buffer = this.sounds.createClick();
    this.spatial.playBuffer(buffer, 0.38, 0, 0.05, 1, this.mixer.getBus('ui'));
  }

  playDoor() {
    this._counts.doors += 1;
    this._playOneShot('door', CONFIG.audio.mix.doorVolume, 0, 0, true);
  }

  playPickup() {
    if (!this._ready() || !this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this._lastPickupAt < 0.4) return;
    this._lastPickupAt = now;
    this._counts.pickups += 1;
    this._playOneShot('pickup', CONFIG.audio.mix.pickupVolume, 0, 0, true);
  }

  _playOneShot(assetName, volume, pan, duration, noFade = false) {
    if (!this._ready()) return;
    try {
      const buffer = this.assets?.get(assetName);
      if (buffer) {
        this._counts.oneShots += 1;
        this.spatial.playBuffer(buffer, volume, pan, duration, 1, this.mixer.getBus('sfx'), { noFade });
        return;
      }
    } catch (err) {
      console.warn(`${assetName} playback failed:`, err);
    }
  }

  playWhisper(sourceX, sourceY, playerX, playerY, listenerAngle) {
    if (!this._ready()) return;
    const buffer = this.sounds.createWhisper();
    const pan = this.spatial.calculatePan(playerX, playerY, listenerAngle, sourceX, sourceY);
    const vol = 0.12;
    this.spatial.playBuffer(buffer, vol, pan, 0.5, 0.8, this.mixer.getBus('ambience'));
  }

  playDeath() {
    if (!this._ready()) return;
    try {
      this._hbBoost = 0;
      const t = this.ctx.currentTime;
      if (this._ambienceGain) {
        this._ambienceGain.gain.setTargetAtTime(0.14, t, 0.6);
      }
      if (this._threatGain) {
        this._threatGain.gain.setTargetAtTime(0, t, 0.5);
      }

      const buffer = this.assets?.get('gameOver');
      this._counts.gameOvers += 1;
      if (buffer) {
        this.spatial.playBuffer(
          buffer,
          CONFIG.audio.mix.gameOverVolume,
          0,
          0,
          1,
          this.mixer.getBus('sfx'),
          { noFade: true }
        );
      } else {
        this.spatial.playBuffer(
          this.sounds.createDeathSound(),
          0.72,
          0,
          0,
          1,
          this.mixer.getBus('sfx'),
          { noFade: true }
        );
      }
    } catch (err) {
      console.warn('Death audio failed:', err);
    }
  }

  updateAmbientHorror(deltaTime, player, room) {
    if (!this._ready() || !room) return;

    try {
      if (this.roomAmbience && room.theme !== this._currentTheme) {
        this.setRoomTheme(room.theme, room.tileMap);
      }

      this.roomAmbience?.update(
        deltaTime, this.sounds, this.spatial,
        player.x, player.y, player.flashlight.angle,
        this.sfxVolume, this.masterVolume
      );
    } catch (err) {
      console.warn('Ambient audio failed:', err);
    }
  }

  notifyGameplayStart() {
    this.setGameState('PLAYING');
    this.unlockFromGesture();
    this.resume().then(() => this._startLoopingSources());
  }

  playDebugProbe() {
    this.playDebugDirectFootstep();
  }

  /**
   * F9 debug: one walking footstep directly to AudioContext.destination.
   * Bypasses filter, panner, and mixer to isolate asset/browser playback.
   */
  playDebugDirectFootstep(sprinting = false) {
    if (!this._ready()) {
      console.warn('[audio-debug] direct step skipped: audio not ready');
      return;
    }
    const now = this.ctx.currentTime;
    if (now - this._lastF9Probe < 0.35) return;
    this._lastF9Probe = now;
    this.unlockFromGesture();
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    try {
      const ok = this.footsteps?.playDirectToDestination(sprinting, 0.9);
      this._counts.probes += 1;
      if (ok) {
        this._lastPlayerStepSource = 'direct';
        if (this.debug) console.info('[audio-debug] F9 direct step', this.getDebugSnapshot());
      }
    } catch (err) {
      console.warn('[audio-debug] direct step failed:', err);
    }
  }

  _playDebugPlayerStep(loud = false) {
    if (!this._ready()) {
      console.warn('[audio-debug] player step skipped: audio not ready');
      return;
    }
    this.unlockFromGesture();
    try {
      const vol = loud ? 0.85 : 0.55;
      const busMeta = {
        playerBus: this.mixer.getBusGain('player'),
        master: this.mixer.getBusGain('master'),
      };
      if (this.assets?.footstepsReady?.() && this.footsteps?.playPlayerStep(
        false, vol, 0, this.mixer.getBus('player'), busMeta
      )) {
        this._counts.playerSteps += 1;
        this._counts.probes += 1;
        if (this.debug) console.info('[audio-debug] player step (asset)', this.getDebugSnapshot());
        return;
      }
      const buffer = this.sounds.createPlayerFootstep(false, this._currentTheme || 'STORAGE', false);
      this.spatial.playBuffer(buffer, vol, 0, 0.3, 1, this.mixer.getBus('player'), {
        playbackRate: 1,
        lowpass: 2200,
      });
      this._counts.playerSteps += 1;
      this._counts.probes += 1;
      if (this.debug) console.info('[audio-debug] player step', this.getDebugSnapshot());
    } catch (err) {
      console.warn('[audio-debug] player step failed:', err);
    }
  }

  _playDebugEnemyStep(pan = -0.75) {
    if (!this._ready()) return;
    this.unlockFromGesture();
    try {
      if (this.assets?.footstepsReady?.() && this.footsteps?.playEnemyStep(0.78, pan, 1, pan < 0 ? 0.35 : 0.1, this.mixer.getBus('enemy'), true)) {
        this._counts.enemySteps += 1;
        this._counts.probes += 1;
        if (this.debug) console.info('[audio-debug] enemy step pan', pan, this.getDebugSnapshot());
        return;
      }
      const buffer = this.sounds.createEnemyFootstep();
      this.spatial.playBuffer(buffer, 0.78, pan, 0.38, 1, this.mixer.getBus('enemy'), {
        playbackRate: 0.96,
        lowpass: 1600,
        rear: pan < 0 ? 0.35 : 0.1,
      });
      this._counts.enemySteps += 1;
      this._counts.probes += 1;
      if (this.debug) console.info('[audio-debug] enemy step pan', pan, this.getDebugSnapshot());
    } catch (err) {
      console.warn('[audio-debug] enemy step failed:', err);
    }
  }

  _playDebugHeartbeat(intensity = 0.5) {
    if (!this._ready()) return;
    this.unlockFromGesture();
    try {
      this._playHeartPulse('lub', intensity);
      this._pendingDub = 0.14;
      this._counts.probes += 1;
      if (this.debug) console.info('[audio-debug] heartbeat', intensity, this.getDebugSnapshot());
    } catch (err) {
      console.warn('[audio-debug] heartbeat failed:', err);
    }
  }

  _playDebugAmbient() {
    if (!this._ready()) return;
    this.unlockFromGesture();
    try {
      const buffer = this.assets?.get('ambience');
      if (buffer) {
        this.spatial.playBuffer(buffer, 0.35, 0, 2.5, 1, this.mixer.getBus('ambience'), { lowpass: 1200 });
      }
      this._counts.probes += 1;
      if (this.debug) console.info('[audio-debug] ambient probe', this.getDebugSnapshot());
    } catch (err) {
      console.warn('[audio-debug] ambient probe failed:', err);
    }
  }

  getDebugSnapshot() {
    const mix = this.mixer ? this.mixer.getDebugSnapshot() : {};
    const threat = this._heartbeatIntensity;
    const fs = this.footsteps?.stats ?? {};
    const ft = this.assets?.footsteps;
    const path = fs.lastPath ?? {};
    return {
      context: this.ctx ? this.ctx.state : 'none',
      currentTime: this.ctx ? Number(this.ctx.currentTime.toFixed(2)) : 0,
      initialized: this.initialized,
      assetsReady: this._assetsReady,
      footstepsLoaded: !!this.assets?.buffers?.footsteps,
      footstepsReady: this.assets?.footstepsReady?.() ?? false,
      footstepsPeaks: ft?.peakCount ?? 0,
      footstepsSlices: ft?.steps?.length ?? 0,
      walkSlices: ft?.walkSteps?.length ?? 0,
      runSlices: ft?.runSteps?.length ?? 0,
      loopsLive: this._loopsLive,
      ambienceStarted: !!(this._ambienceLooper || this._ambienceGain),
      lastResumeError: this._lastResumeError,
      master: mix.master ?? 0,
      ambience: mix.ambience ?? 0,
      music: mix.music ?? 0,
      player: mix.player ?? 0,
      enemy: mix.enemy ?? 0,
      heartbeat: mix.heartbeat ?? 0,
      sfx: mix.sfx ?? 0,
      threat,
      threatMusic: this._threatMusicLevel(threat),
      heartbeatVoice: this._heartbeatVoice(threat),
      heartbeatBpm: this._bpmFromThreat(threat),
      heartbeatPulseGain: this._lastHbPulseGain,
      heartbeatEffective: Number(this._heartbeatEffectiveGain(threat).toFixed(3)),
      menuMusicPlaying: this._menuMusicPlaying,
      menuMusicWanted: this._menuMusicWanted,
      menuMusicLoaded: !!this.assets?.buffers?.menuMusic,
      lastEnemyStep: this._lastEnemyStep,
      gapMul: this._gapMul,
      lastPlayerSpeed: Math.round(this._lastPlayerSpeed),
      lastPlayerStepSource: this._lastPlayerStepSource,
      lastPlayerStepGain: fs.lastPlayerGain ?? 0,
      lastPlayerStepAt: fs.lastPlayerAt ?? 0,
      lastPathRoute: path.route ?? 'none',
      lastPathOffset: path.offsetSec ?? null,
      lastPathDuration: path.durationSec ?? null,
      lastPathRate: path.playbackRate ?? null,
      lastPathStepGain: path.stepGain ?? null,
      lastPathEffective: path.effectiveGain ?? null,
      lastPathPlayerBus: path.playerBusGain ?? null,
      lastPathMaster: path.masterGain ?? null,
      lastPathError: fs.lastError ?? null,
      counts: { ...this._counts },
      footstepStats: { ...fs },
    };
  }

  suspend() {
    if (this.ctx?.state === 'running') {
      this.ctx.suspend().catch(() => {});
    }
  }

  async resume() {
    if (!this.ctx) return;
    if (this.ctx.state === 'running') {
      this._startLoopingSources();
      return;
    }
    if (this.ctx.state !== 'suspended') return;
    try {
      await Promise.race([
        this.ctx.resume().then(() => {
          this._lastResumeError = null;
          this._startLoopingSources();
        }),
        new Promise((resolve) => setTimeout(resolve, 250)),
      ]);
      if (this.ctx.state !== 'running' && this.debug) {
        console.warn('[audio-debug] context still', this.ctx.state, 'after resume attempt');
      }
    } catch (err) {
      this._lastResumeError = String(err);
      console.warn('Audio resume failed:', err);
    }
  }
}
