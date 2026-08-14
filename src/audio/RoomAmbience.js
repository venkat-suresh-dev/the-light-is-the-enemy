import { THEME_META } from '../world/RoomThemes.js';

/**
 * Slow-evolving room tone + rare environmental events. Not music.
 */
export class RoomAmbience {
  constructor(ctx, masterGain) {
    this.ctx = ctx;
    this.masterGain = masterGain;
    this.currentTheme = null;
    this._bedGain = null;
    this._sources = [];
    this._filters = [];
    this._layerGains = [];
    this._eventTimer = 0;
    this._nextEvent = 10;
    this._threat = 0;
    this._gapMul = 1;
    this._lfo = 0;
    this._roomGainBase = 0.62;
  }

  setTheme(theme, sounds, force = false) {
    if (!force && this.currentTheme === theme) return;
    this.currentTheme = theme;
    this._stopBeds();
    this._startBeds(theme, sounds);
    this._eventTimer = 0;
    this._nextEvent = 8 + Math.random() * 14;
  }

  activeSourceCount() {
    return this._sources.length;
  }

  setThreatMix(threat, gapMul = 1) {
    this._threat = threat;
    this._gapMul = gapMul;
    this._applyBedGain();
  }

  _bedLevelForThreat(threat) {
    if (threat < 0.2) return 0.88;
    if (threat < 0.4) return 0.88 - ((threat - 0.2) / 0.2) * 0.12;
    if (threat < 0.6) return 0.76 - ((threat - 0.4) / 0.2) * 0.22;
    if (threat < 0.8) return 0.54 - ((threat - 0.6) / 0.2) * 0.28;
    return 0.26 - ((threat - 0.8) / 0.2) * 0.18;
  }

  _applyBedGain() {
    if (!this._bedGain || !this.ctx) return;
    const level = this._bedLevelForThreat(this._threat);
    const target = 0.48 * level * this._gapMul;
    this._bedGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.9);
  }

  _themeProfile(theme) {
    const profiles = {
      TUNNEL: { room: 1.05, air: 1.35, hum: 0.42, airFreq: 245 },
      MAINTENANCE: { room: 1, air: 0.78, hum: 0.65, airFreq: 380 },
      STORAGE: { room: 0.85, air: 0.48, hum: 0.18, airFreq: 220 },
      OFFICE: { room: 0.9, air: 0.68, hum: 0.5, airFreq: 455 },
      INDUSTRIAL: { room: 1.08, air: 0.88, hum: 0.72, airFreq: 295 },
      GENERATOR: { room: 1.02, air: 0.58, hum: 0.85, airFreq: 325 },
      LAB: { room: 0.88, air: 0.82, hum: 0.55, airFreq: 495 },
    };
    return profiles[theme] || profiles.STORAGE;
  }

  _startLoop(buffer, playbackRate, filterSetup, gainValue, dest) {
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.playbackRate.value = playbackRate;

    let node = src;
    const filters = [];
    const gains = [];

    if (filterSetup) {
      for (const f of filterSetup) {
        const filter = this.ctx.createBiquadFilter();
        filter.type = f.type;
        filter.frequency.value = f.freq;
        filter.Q.value = f.q ?? 0.5;
        node.connect(filter);
        node = filter;
        filters.push(filter);
      }
    }

    const gain = this.ctx.createGain();
    gain.gain.value = gainValue;
    node.connect(gain);
    gain.connect(dest);
    src.start();

    this._sources.push(src);
    this._filters.push(...filters);
    this._layerGains.push(gain);
    return { src, filters, gain };
  }

  _startBeds(theme, sounds) {
    if (!this.ctx || !sounds) return;
    try {
      if (!THEME_META[theme] && !this._themeProfile(theme)) return;
      // Horror ambience bed is handled by AudioManager (scary-ambience.mp3).
      // RoomAmbience only schedules rare environmental one-shots.
      this._bedGain = null;
      this._airFilter = null;
    } catch (err) {
      console.warn('Room ambience beds failed:', err);
      this._stopBeds();
    }
  }

  _stopBeds() {
    for (const src of this._sources) {
      try { src.stop(); } catch (e) { /* already stopped */ }
    }
    this._sources = [];
    this._filters = [];
    this._layerGains = [];
    this._airFilter = null;
    if (this._bedGain) {
      try { this._bedGain.disconnect(); } catch (e) { /* */ }
      this._bedGain = null;
    }
  }

  update(deltaTime, sounds, spatial, playerX, playerY, listenerAngle, sfxVol, masterVol) {
    this._lfo += deltaTime;
    const t = this.ctx ? this.ctx.currentTime : 0;
    if (this._airFilter) {
      const freq = this._airBase + Math.sin(this._lfo * 0.06) * 48 + Math.sin(this._lfo * 0.017) * 22;
      this._airFilter.frequency.setTargetAtTime(Math.max(130, freq), t, 0.9);
    }
    if (this._layerGains[0] && this._roomGainBase) {
      const wobble = 1 + Math.sin(this._lfo * 0.028) * 0.06;
      this._layerGains[0].gain.setTargetAtTime(this._roomGainBase * wobble, t, 1.5);
    }

    const threat = this._threat;
    const minGap = threat > 0.75 ? 22 : threat > 0.45 ? 14 : 9;
    const maxGap = threat > 0.75 ? 38 : threat > 0.45 ? 30 : 24;

    this._eventTimer += deltaTime;
    if (this._eventTimer < this._nextEvent) return;

    this._eventTimer = 0;
    this._nextEvent = minGap + Math.random() * (maxGap - minGap);

    if (threat > 0.85 && Math.random() < 0.55) return;
    if (this._gapMul < 0.4) return;

    const events = this._getThemeEvents();
    const event = events[Math.floor(Math.random() * events.length)];
    this._playEvent(event, sounds, spatial, playerX, playerY, listenerAngle, sfxVol, masterVol);
  }

  _getThemeEvents() {
    switch (this.currentTheme) {
      case 'MAINTENANCE': return ['creak', 'pipe', 'electrical', 'resonance'];
      case 'STORAGE': return ['creak', 'distant', 'resonance'];
      case 'OFFICE': return ['electrical', 'creak', 'resonance'];
      case 'INDUSTRIAL': return ['pipe', 'distant', 'creak'];
      case 'TUNNEL': return ['vent', 'pipe', 'distant', 'resonance'];
      case 'GENERATOR': return ['electrical', 'pipe', 'distant'];
      case 'LAB': return ['electrical', 'vent', 'resonance'];
      default: return ['creak', 'distant', 'resonance'];
    }
  }

  _playEvent(type, sounds, spatial, px, py, angle, sfxVol, masterVol) {
    let buffer;
    let duration = 1.8;
    let lowpass = 480;
    switch (type) {
      case 'creak': buffer = sounds.createDoorCreak(); duration = 2.2; lowpass = 620; break;
      case 'pipe': buffer = sounds.createPipeNoise(); duration = 1.4; lowpass = 520; break;
      case 'electrical': buffer = sounds.createElectricalPop(); duration = 0.5; lowpass = 900; break;
      case 'vent': buffer = sounds.createVentBurst(); duration = 1.6; lowpass = 380; break;
      case 'distant': buffer = sounds.createDistantImpact(); duration = 1.2; lowpass = 320; break;
      case 'resonance': buffer = sounds.createResonance(); duration = 2.8; lowpass = 180; break;
      default: buffer = sounds.createDoorCreak();
    }
    const offsetX = (Math.random() - 0.5) * 750;
    const offsetY = (Math.random() - 0.5) * 750;
    const pan = spatial.calculatePan(px, py, angle, px + offsetX, py + offsetY);
    const vol = (0.06 + Math.random() * 0.05) * this._gapMul;
    spatial.playBuffer(buffer, vol, pan, duration, 0.1, this.masterGain, { lowpass });
  }

  stop() {
    this._stopBeds();
  }
}
