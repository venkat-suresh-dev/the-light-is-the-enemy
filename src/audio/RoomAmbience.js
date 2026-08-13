import { THEME_META } from '../world/RoomThemes.js';

/**
 * Theme-based room ambience with randomized events.
 */
export class RoomAmbience {
  constructor(ctx, masterGain) {
    this.ctx = ctx;
    this.masterGain = masterGain;
    this.currentTheme = null;
    this._toneNode = null;
    this._toneGain = null;
    this._eventTimer = 0;
    this._nextEvent = 8;
  }

  setTheme(theme) {
    if (this.currentTheme === theme) return;
    this.currentTheme = theme;
    this._stopTone();
    this._startTone(theme);
    this._eventTimer = 0;
    this._nextEvent = 5 + Math.random() * 10;
  }

  _startTone(theme) {
    const meta = THEME_META[theme];
    if (!meta || !this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    // Theme-specific base frequencies
    const freqs = {
      MAINTENANCE: 55,
      STORAGE: 48,
      OFFICE: 62,
      INDUSTRIAL: 45,
      TUNNEL: 40,
      GENERATOR: 42,
      LAB: 58,
    };
    osc.type = 'sine';
    osc.frequency.value = freqs[theme] || 50;

    filter.type = 'lowpass';
    filter.frequency.value = 120;
    filter.Q.value = 0.5;

    gain.gain.value = 0.04;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.start();

    this._toneNode = osc;
    this._toneGain = gain;
  }

  _stopTone() {
    if (this._toneNode) {
      try { this._toneNode.stop(); } catch (e) { /* already stopped */ }
      this._toneNode = null;
      this._toneGain = null;
    }
  }

  update(deltaTime, sounds, spatial, playerX, playerY, listenerAngle, sfxVol, masterVol) {
    this._eventTimer += deltaTime;
    if (this._eventTimer < this._nextEvent) return;

    this._eventTimer = 0;
    this._nextEvent = 12 + Math.random() * 25;

    const events = this._getThemeEvents();
    const event = events[Math.floor(Math.random() * events.length)];
    this._playEvent(event, sounds, spatial, playerX, playerY, listenerAngle, sfxVol, masterVol);
  }

  _getThemeEvents() {
    switch (this.currentTheme) {
      case 'MAINTENANCE': return ['creak', 'pipe', 'electrical'];
      case 'STORAGE': return ['creak', 'metal', 'vent'];
      case 'OFFICE': return ['electrical', 'creak'];
      case 'INDUSTRIAL': return ['metal', 'pipe', 'electrical'];
      case 'TUNNEL': return ['vent', 'creak', 'distant'];
      case 'GENERATOR': return ['electrical', 'metal', 'pipe'];
      case 'LAB': return ['electrical', 'vent'];
      default: return ['creak', 'vent'];
    }
  }

  _playEvent(type, sounds, spatial, px, py, angle, sfxVol, masterVol) {
    let buffer;
    switch (type) {
      case 'creak': buffer = sounds.createDoorCreak(); break;
      case 'pipe': buffer = sounds.createPipeNoise?.() || sounds.createDoorCreak(); break;
      case 'electrical': buffer = sounds.createElectricalPop?.() || sounds.createClick(); break;
      case 'metal': buffer = sounds.createMetalImpact?.() || sounds.createFootstep(); break;
      case 'vent': buffer = sounds.createVentBurst?.() || sounds.createAmbience(); break;
      case 'distant': buffer = sounds.createDistantImpact?.() || sounds.createFootstep(); break;
      default: buffer = sounds.createDoorCreak();
    }
    const offsetX = (Math.random() - 0.5) * 500;
    const offsetY = (Math.random() - 0.5) * 500;
    const pan = spatial.calculatePan(px, py, angle, px + offsetX, py + offsetY);
    const vol = (0.06 + Math.random() * 0.06) * sfxVol * masterVol;
    spatial.playBuffer(buffer, vol, pan, 1.5, 0);
  }

  stop() {
    this._stopTone();
  }
}
