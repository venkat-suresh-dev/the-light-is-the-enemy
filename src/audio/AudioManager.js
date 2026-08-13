import { CONFIG } from '../utils/Constants.js';
import { ProceduralSounds } from './ProceduralSounds.js';
import { SpatialAudio } from './SpatialAudio.js';
import { AudioMixer } from './AudioMixer.js';
import { RoomAmbience } from './RoomAmbience.js';
import { hasLineOfSight } from '../utils/Geometry.js';

export class AudioManager {
  constructor(events) {
    this.events = events;
    this.ctx = null;
    this.sounds = null;
    this.spatial = null;
    this.mixer = null;
    this.roomAmbience = null;
    this.initialized = false;
    this.masterVolume = CONFIG.audio.masterVolume;
    this.sfxVolume = CONFIG.audio.sfxVolume;
    this.ambienceVolume = CONFIG.audio.ambienceVolume;

    this._heartbeatTimer = 0;
    this._heartbeatInterval = 1.2;
    this._heartbeatIntensity = 0;
    this._lastPlayerFootstep = 0;
    this._lastEnemyFootsteps = new Map();
    this._breathTimer = 0;
    this._droneGain = null;
    this._tileMap = null;
    this._currentTheme = null;
  }

  async init() {
    if (this.initialized) {
      await this.resume();
      return;
    }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.sounds = new ProceduralSounds(this.ctx);
      this.mixer = new AudioMixer(this.ctx);
      this.spatial = new SpatialAudio(this.ctx, this.mixer.getBus('player'));
      this.roomAmbience = new RoomAmbience(this.ctx, this.mixer.getBus('ambience'));
      this.initialized = true;
      this._startDrone();
    } catch (e) {
      console.warn('Audio unavailable:', e);
      this.initialized = false;
    }
  }

  _startDrone() {
    if (!this.initialized) return;
    this._droneGain = this.ctx.createGain();
    this._droneGain.gain.value = 0;
    this._droneGain.connect(this.mixer.getBus('music'));
  }

  setVolumes(master, sfx, ambience) {
    this.masterVolume = master;
    this.sfxVolume = sfx;
    this.ambienceVolume = ambience;
    if (this.mixer) {
      this.mixer.setMaster(master);
      this.mixer.setBus('ambience', ambience);
      this.mixer.setBus('player', sfx);
      this.mixer.setBus('enemy', sfx * 0.9);
    }
  }

  setRoomTheme(theme, tileMap) {
    this._currentTheme = theme;
    this._tileMap = tileMap;
    if (this.roomAmbience) this.roomAmbience.setTheme(theme);
  }

  playFootstep(playerX, playerY, listenerAngle, sprinting) {
    if (!this.initialized) return;
    const now = performance.now();
    const interval = sprinting ? 260 + Math.random() * 80 : 380 + Math.random() * 120;
    if (now - this._lastPlayerFootstep < interval) return;
    this._lastPlayerFootstep = now;

    const buffer = this.sounds.createFootstep();
    const vol = (sprinting ? 0.35 : 0.22) * this.sfxVolume * this.masterVolume;
    this.spatial.playBuffer(buffer, vol, 0, 0.1, 1, this.mixer.getBus('player'));
  }

  playEnemyFootstep(enemyX, enemyY, playerX, playerY, listenerAngle, state, tileMap) {
    if (!this.initialized) return;
    const key = `e${Math.round(enemyX / 50)}_${Math.round(enemyY / 50)}`;
    const now = performance.now();
    const last = this._lastEnemyFootsteps.get(key) || 0;
    const baseInterval = state === 'HUNTING' ? 350 : 550;
    const interval = baseInterval + Math.random() * 200;
    if (now - last < interval) return;
    this._lastEnemyFootsteps.set(key, now);

    const buffer = this.sounds.createEnemyFootstep();
    const pan = this.spatial.calculatePan(playerX, playerY, listenerAngle, enemyX, enemyY);
    const distVol = this.spatial.calculateVolume(playerX, playerY, enemyX, enemyY, 500);
    let occlusion = 1;
    if (tileMap) {
      occlusion = hasLineOfSight(playerX, playerY, enemyX, enemyY, tileMap, tileMap.tileSize) ? 1 : 0.35;
    }
    const vol = distVol * 0.45 * this.sfxVolume * this.masterVolume;
    if (vol < 0.015) return;

    this.spatial.playBuffer(buffer, vol, pan, 0.18, occlusion, this.mixer.getBus('enemy'));
  }

  playHeartbeat(intensity) {
    this._heartbeatIntensity = intensity;
    if (this._droneGain) {
      const t = this.ctx.currentTime;
      this._droneGain.gain.setTargetAtTime(intensity * 0.08 * this.masterVolume, t, 0.3);
    }
  }

  updateHeartbeat(deltaTime, playerX, playerY) {
    if (!this.initialized || this._heartbeatIntensity < 0.08) return;

    this._heartbeatInterval = Math.max(0.28, 1.1 - this._heartbeatIntensity * 0.75);
    this._heartbeatTimer += deltaTime;

    if (this._heartbeatTimer >= this._heartbeatInterval) {
      this._heartbeatTimer = 0;
      const buffer = this.sounds.createHeartbeat();
      const vol = (0.15 + this._heartbeatIntensity * 0.35) * this.sfxVolume * this.masterVolume;
      this.spatial.playBuffer(buffer, vol, 0, 0.22, 1, this.mixer.getBus('player'));
    }
  }

  updateBreathing(deltaTime, player, dangerLevel) {
    if (!this.initialized) return;
    let rate = 0;
    if (player.isSprinting) rate = 0.4;
    else if (dangerLevel > 0.5) rate = 0.25 + dangerLevel * 0.3;
    else if (player.isMoving) rate = 0.1;

    if (rate <= 0) return;
    this._breathTimer += deltaTime;
    const interval = player.isSprinting ? 0.8 : 1.8 - dangerLevel * 0.6;
    if (this._breathTimer >= interval) {
      this._breathTimer = 0;
      const buffer = this.sounds.createBreathing();
      const vol = rate * 0.15 * this.sfxVolume * this.masterVolume;
      this.spatial.playBuffer(buffer, vol, 0, 0.5, 1, this.mixer.getBus('player'));
    }
  }

  playFlashlightClick() {
    if (!this.initialized) return;
    const buffer = this.sounds.createClick();
    this.spatial.playBuffer(buffer, 0.25 * this.sfxVolume * this.masterVolume, 0, 0.05, 1, this.mixer.getBus('ui'));
  }

  playWhisper(sourceX, sourceY, playerX, playerY, listenerAngle) {
    if (!this.initialized) return;
    const buffer = this.sounds.createWhisper();
    const pan = this.spatial.calculatePan(playerX, playerY, listenerAngle, sourceX, sourceY);
    const vol = 0.12 * this.sfxVolume * this.masterVolume;
    this.spatial.playBuffer(buffer, vol, pan, 0.5, 0.8, this.mixer.getBus('ambience'));
  }

  playDeath() {
    if (!this.initialized) return;
    if (this._droneGain) {
      this._droneGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.5);
    }
    if (this.roomAmbience) this.roomAmbience.stop();
    const buffer = this.sounds.createDeathSound();
    this.spatial.playBuffer(buffer, 0.55 * this.sfxVolume * this.masterVolume, 0, 1.5, 1, this.mixer.getBus('ui'));
  }

  updateAmbientHorror(deltaTime, player, room) {
    if (!this.initialized || !room) return;

    if (this.roomAmbience && room.theme !== this._currentTheme) {
      this.setRoomTheme(room.theme, room.tileMap);
    }

    this.roomAmbience?.update(
      deltaTime, this.sounds, this.spatial,
      player.x, player.y, player.flashlight.angle,
      this.sfxVolume, this.masterVolume
    );
  }

  suspend() {
    if (this.ctx?.state === 'running') this.ctx.suspend();
  }

  async resume() {
    if (this.ctx?.state === 'suspended') await this.ctx.resume();
  }
}
