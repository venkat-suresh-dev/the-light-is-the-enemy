/**
 * Procedurally generated sounds via Web Audio API.
 * Footsteps use layered transient synthesis — not single noise bursts.
 */
export class ProceduralSounds {
  constructor(audioContext) {
    this.ctx = audioContext;
    this._cache = new Map();
  }

  _getCached(key, generator) {
    if (!this._cache.has(key)) {
      this._cache.set(key, generator());
    }
    return this._cache.get(key);
  }

  _fadeEnds(data, fadeSamples) {
    const n = data.length;
    const fade = Math.min(fadeSamples, (n / 2) | 0);
    for (let i = 0; i < fade; i++) {
      const g = i / fade;
      data[i] *= g;
      data[n - 1 - i] *= g;
    }
  }

  _softAttack(t, attack) {
    if (t <= 0) return 0;
    if (t >= attack) return 1;
    return 0.5 - 0.5 * Math.cos((Math.PI * t) / attack);
  }

  _expDecay(t, rate) {
    return Math.exp(-t * rate);
  }

  _bandpassNoise(white, state, centerHz, sampleRate) {
    const omega = 2 * Math.PI * centerHz / sampleRate;
    const alpha = Math.sin(omega) / 2;
    const cos = Math.cos(omega);
    const a0 = 1 + alpha;
    state.b0 += (white - state.b0) * alpha;
    state.b1 = state.b1 + omega * (state.b0 - state.b1);
    return state.b1 / a0;
  }

  _lowpass(white, state, coeff) {
    state.v += coeff * (white - state.v);
    return state.v;
  }

  _themeFloor(theme) {
    const table = {
      MAINTENANCE: { hardness: 1.1, ring: 210, ringDecay: 9, scrape: 0.85 },
      TUNNEL: { hardness: 0.95, ring: 145, ringDecay: 6.5, scrape: 0.7 },
      STORAGE: { hardness: 0.82, ring: 175, ringDecay: 11, scrape: 0.55 },
      OFFICE: { hardness: 0.9, ring: 240, ringDecay: 12, scrape: 0.72 },
      INDUSTRIAL: { hardness: 1.05, ring: 195, ringDecay: 8, scrape: 0.88 },
      GENERATOR: { hardness: 1.08, ring: 188, ringDecay: 7.5, scrape: 0.8 },
      LAB: { hardness: 0.88, ring: 255, ringDecay: 13, scrape: 0.68 },
    };
    return table[theme] || table.STORAGE;
  }

  /**
   * Multi-layer footstep: heel strike + body thump + floor scrape + surface ring.
   */
  _synthesizeFootstep(opts) {
    const {
      duration,
      heelHz,
      heelDecay,
      heelAmt,
      thumpStartHz,
      thumpEndHz,
      thumpDecay,
      thumpAmt,
      scrapeAmt,
      scrapeDelay,
      scrapeDecay,
      ringHz,
      ringDecay,
      ringAmt,
      ringDelay,
      contactAmt,
      stereoBias = 0,
    } = opts;

    const sampleRate = this.ctx.sampleRate;
    const length = Math.max(1, Math.floor(sampleRate * duration));
    const channels = stereoBias !== 0 ? 2 : 1;
    const buffer = this.ctx.createBuffer(channels, length, sampleRate);
    const left = buffer.getChannelData(0);
    const right = channels > 1 ? buffer.getChannelData(1) : null;

    const heelLp = { v: 0 };
    const thumpLp = { v: 0 };
    const scrapeBp = { b0: 0, b1: 0 };
    const ringState = { v: 0 };
    const contactLp = { v: 0 };
    let ringPhase = 0;

    const heelAttack = 0.004 + Math.random() * 0.003;
    const thumpAttack = 0.006 + Math.random() * 0.004;
    const scrapeCenter = heelHz * (0.9 + Math.random() * 0.25);

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const white = Math.random() * 2 - 1;

      const heelEnv = this._softAttack(t, heelAttack) * this._expDecay(t, heelDecay);
      const heelNoise = this._lowpass(white, heelLp, 0.14);
      const heel = heelNoise * heelEnv * heelAmt;

      const thumpT = Math.max(0, t - 0.002);
      const thumpFreq = thumpStartHz + (thumpEndHz - thumpStartHz) * Math.min(1, thumpT * 18);
      const thumpEnv = this._softAttack(thumpT, thumpAttack) * this._expDecay(thumpT, thumpDecay);
      const thumpNoise = this._lowpass(white, thumpLp, 0.06) * 0.35;
      const thumpOsc = Math.sin(t * thumpFreq * Math.PI * 2) * 0.65;
      const thump = (thumpNoise + thumpOsc) * thumpEnv * thumpAmt;

      const ct = t - scrapeDelay;
      const scrapeEnv = ct > 0
        ? this._softAttack(ct, 0.008) * this._expDecay(ct, scrapeDecay)
        : 0;
      const scrape = this._bandpassNoise(white, scrapeBp, scrapeCenter, sampleRate) * scrapeEnv * scrapeAmt;

      const rt = t - ringDelay;
      let ring = 0;
      if (rt > 0 && ringAmt > 0) {
        const ringEnv = this._softAttack(rt, 0.012) * this._expDecay(rt, ringDecay);
        ringPhase += (ringHz * Math.PI * 2) / sampleRate;
        const ringNoise = this._lowpass(white, ringState, 0.08);
        ring = (Math.sin(ringPhase) * 0.55 + ringNoise * 0.45) * ringEnv * ringAmt;
      }

      const contactEnv = t < 0.012 ? this._softAttack(t, 0.002) * this._expDecay(t, 55) : 0;
      const contact = this._lowpass(white, contactLp, 0.35) * contactEnv * contactAmt;

      const sample = heel + thump + scrape + ring + contact;
      const bias = stereoBias;
      left[i] = sample * (1 + bias);
      if (right) right[i] = sample * (1 - bias);
    }

    this._fadeEnds(left, Math.floor(sampleRate * 0.01));
    if (right) this._fadeEnds(right, Math.floor(sampleRate * 0.01));
    return buffer;
  }

  createPlayerFootstep(sprinting = false, theme = 'STORAGE', heavy = false) {
    const floor = this._themeFloor(theme);
    const heavyMul = heavy ? 1.14 : 1;
    const sprintMul = sprinting ? 1.18 : 1;

    if (sprinting) {
      return this._synthesizeFootstep({
        duration: 0.17 + Math.random() * 0.05,
        heelHz: 280 + Math.random() * 80,
        heelDecay: 22 + Math.random() * 8,
        heelAmt: 0.38 * floor.hardness * heavyMul,
        thumpStartHz: 95 + Math.random() * 15,
        thumpEndHz: 48 + Math.random() * 12,
        thumpDecay: 11 + Math.random() * 4,
        thumpAmt: 0.52 * sprintMul * heavyMul,
        scrapeAmt: 0.06 * floor.scrape * (0.85 + Math.random() * 0.3),
        scrapeDelay: 0.01 + Math.random() * 0.008,
        scrapeDecay: 28 + Math.random() * 10,
        ringHz: floor.ring * (0.95 + Math.random() * 0.1),
        ringDecay: floor.ringDecay * 0.75,
        ringAmt: 0.045 * floor.hardness,
        ringDelay: 0.022 + Math.random() * 0.012,
        contactAmt: 0.08 * floor.hardness,
      });
    }

    return this._synthesizeFootstep({
      duration: 0.12 + Math.random() * 0.04,
      heelHz: 220 + Math.random() * 60,
      heelDecay: 28 + Math.random() * 10,
      heelAmt: 0.28 * floor.hardness * heavyMul,
      thumpStartHz: 78 + Math.random() * 12,
      thumpEndHz: 42 + Math.random() * 10,
      thumpDecay: 16 + Math.random() * 5,
      thumpAmt: 0.34 * heavyMul,
      scrapeAmt: 0.035 * floor.scrape * (0.8 + Math.random() * 0.35),
      scrapeDelay: 0.014 + Math.random() * 0.012,
      scrapeDecay: 32 + Math.random() * 12,
      ringHz: floor.ring * (0.92 + Math.random() * 0.14),
      ringDecay: floor.ringDecay,
      ringAmt: 0.028 * floor.hardness,
      ringDelay: 0.028 + Math.random() * 0.015,
      contactAmt: 0.05 * floor.hardness,
    });
  }

  createFootstep() {
    return this.createPlayerFootstep(false, 'STORAGE', false);
  }

  createEnemyFootstep() {
    const bias = (Math.random() - 0.5) * 0.18;
    return this._synthesizeFootstep({
      duration: 0.22 + Math.random() * 0.08,
      heelHz: 165 + Math.random() * 45,
      heelDecay: 14 + Math.random() * 5,
      heelAmt: 0.36 + Math.random() * 0.1,
      thumpStartHz: 72 + Math.random() * 10,
      thumpEndHz: 32 + Math.random() * 8,
      thumpDecay: 8.5 + Math.random() * 3,
      thumpAmt: 0.58 + Math.random() * 0.14,
      scrapeAmt: 0.055 + Math.random() * 0.03,
      scrapeDelay: 0.018 + Math.random() * 0.016,
      scrapeDecay: 18 + Math.random() * 6,
      ringHz: 130 + Math.random() * 40,
      ringDecay: 6 + Math.random() * 2.5,
      ringAmt: 0.04 + Math.random() * 0.02,
      ringDelay: 0.035 + Math.random() * 0.02,
      contactAmt: 0.07 + Math.random() * 0.03,
      stereoBias: bias,
    });
  }

  createLoopNoise(seconds, color = 'brown') {
    const sampleRate = this.ctx.sampleRate;
    const length = Math.max(1, Math.floor(sampleRate * seconds));
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      if (color === 'brown') {
        b0 = (b0 + 0.02 * white) / 1.02;
        data[i] = b0 * 3.5;
      } else if (color === 'pink') {
        b0 = 0.99765 * b0 + white * 0.099046;
        b1 = 0.963 * b1 + white * 0.2965164;
        b2 = 0.57 * b2 + white * 1.052691;
        data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.12;
      } else {
        data[i] = white * 0.2;
      }
    }
    this._fadeEnds(data, Math.floor(sampleRate * 0.08));
    return buffer;
  }

  createHeartbeat(kind = 'lub') {
    const isLub = kind === 'lub';
    const duration = isLub ? 0.26 + Math.random() * 0.04 : 0.17 + Math.random() * 0.03;
    const sampleRate = this.ctx.sampleRate;
    const length = Math.max(1, Math.floor(sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    const lubFreq = 58 + Math.random() * 6;
    const dubFreq = 88 + Math.random() * 10;
    const freq = isLub ? lubFreq : dubFreq;
    const attack = isLub ? 0.006 + Math.random() * 0.004 : 0.005 + Math.random() * 0.003;
    const decay = isLub ? 7.5 + Math.random() * 2 : 11 + Math.random() * 2.5;
    const amp = isLub ? 1 : 0.55;
    const subFreq = freq * 0.5;

    const lp = { v: 0 };
    let phase = 0;
    let subPhase = 0;

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const env = this._softAttack(t, attack) * this._expDecay(t, decay);

      phase += (freq * Math.PI * 2) / sampleRate;
      subPhase += (subFreq * Math.PI * 2) / sampleRate;
      const body = Math.sin(phase) * 0.62 + Math.sin(subPhase) * 0.48;
      const click = t < 0.018 ? this._expDecay(t, 120) * 0.22 : 0;
      const white = Math.random() * 2 - 1;
      const texture = this._lowpass(white, lp, 0.08) * 0.06;

      data[i] = (body + click + texture) * env * amp;
    }
    this._fadeEnds(data, Math.floor(sampleRate * 0.008));
    return buffer;
  }

  createBreathing(kind = 'inhale') {
    const duration = kind === 'inhale'
      ? 0.9 + Math.random() * 0.18
      : 1.1 + Math.random() * 0.22;
    const sampleRate = this.ctx.sampleRate;
    const length = Math.floor(sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    const lp = { v: 0 };
    let pink = 0;

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const env = Math.sin((t / duration) * Math.PI);
      const shaped = env * env * env;
      const white = Math.random() * 2 - 1;
      pink = 0.97 * pink + 0.03 * white;
      lp.v += 0.05 * (pink - lp.v);
      data[i] = lp.v * shaped * 0.13;
    }
    this._fadeEnds(data, Math.floor(sampleRate * 0.04));
    return buffer;
  }

  createIlluminationSting() {
    const duration = 0.42;
    const sampleRate = this.ctx.sampleRate;
    const length = Math.max(1, Math.floor(sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    const lp = { v: 0 };
    const f1 = 44 + Math.random() * 5;
    const f2 = 67 + Math.random() * 6;

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const click = t < 0.015
        ? this._softAttack(t, 0.003) * this._expDecay(t, 100) * 0.08
        : 0;
      const env = this._softAttack(t, 0.04) * this._expDecay(t, 5.8);
      const tone =
        Math.sin(t * f1 * Math.PI * 2) * 0.07
        + Math.sin(t * f2 * Math.PI * 2) * 0.045;
      const n = Math.random() * 2 - 1;
      lp.v += 0.07 * (n - lp.v);
      data[i] = tone * env + lp.v * click;
    }
    this._fadeEnds(data, Math.floor(sampleRate * 0.02));
    return buffer;
  }

  createClick() {
    return this._getCached('click', () => {
      const duration = 0.035;
      const sampleRate = this.ctx.sampleRate;
      const length = Math.max(1, Math.floor(sampleRate * duration));
      const buffer = this.ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);
      const lp = { v: 0 };

      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const env = this._expDecay(t, 90);
        const white = Math.random() * 2 - 1;
        lp.v += 0.25 * (white - lp.v);
        data[i] = lp.v * env * 0.35 + Math.sin(t * 2800 * Math.PI * 2) * env * 0.12;
      }
      return buffer;
    });
  }

  createWhisper() {
    return this._getCached('whisper', () => {
      const duration = 0.55;
      const sampleRate = this.ctx.sampleRate;
      const length = Math.max(1, Math.floor(sampleRate * duration));
      const buffer = this.ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);
      const bp = { b0: 0, b1: 0 };

      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const env = Math.sin(t / duration * Math.PI) * 0.14;
        const white = Math.random() * 2 - 1;
        const filtered = this._bandpassNoise(white, bp, 180 + t * 120, sampleRate);
        data[i] = filtered * env;
      }
      return buffer;
    });
  }

  createDoorCreak() {
    return this._getCached('doorCreak', () => {
      const duration = 1.4 + Math.random() * 0.4;
      const sampleRate = this.ctx.sampleRate;
      const length = Math.max(1, Math.floor(sampleRate * duration));
      const buffer = this.ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);
      const lp = { v: 0 };
      let phase = 0;
      const startFreq = 72 + Math.random() * 20;

      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const env = Math.sin(t / duration * Math.PI);
        const freq = startFreq + t * (28 + Math.random() * 15);
        phase += (freq * Math.PI * 2) / sampleRate;
        const white = Math.random() * 2 - 1;
        const noise = this._lowpass(white, lp, 0.12) * 0.35;
        data[i] = (Math.sin(phase) * 0.25 + noise) * env * 0.22;
      }
      return buffer;
    });
  }

  createAmbience() {
    return this._getCached('ambience', () => {
      const duration = 5;
      const sampleRate = this.ctx.sampleRate;
      const length = Math.max(1, Math.floor(sampleRate * duration));
      const buffer = this.ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);
      const lp = { v: 0 };

      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const white = Math.random() * 2 - 1;
        data[i] = this._lowpass(white, lp, 0.04) * 0.035;
      }
      return buffer;
    });
  }

  createDeathSound() {
    return this._getCached('death', () => {
      const duration = 1.6;
      const sampleRate = this.ctx.sampleRate;
      const length = Math.max(1, Math.floor(sampleRate * duration));
      const buffer = this.ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);
      const lp = { v: 0 };
      let phase = 0;

      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const env = this._expDecay(t, 1.2);
        const freq = 180 - t * 95;
        phase += (freq * Math.PI * 2) / sampleRate;
        const white = Math.random() * 2 - 1;
        lp.v += 0.08 * (white - lp.v);
        data[i] = Math.sin(phase) * env * 0.45 + lp.v * env * 0.22;
      }
      return buffer;
    });
  }

  createPipeNoise() {
    const duration = 0.9 + Math.random() * 0.3;
    const sampleRate = this.ctx.sampleRate;
    const length = Math.max(1, Math.floor(sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    const lp = { v: 0 };
    let phase = 0;

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const env = Math.sin(t / duration * Math.PI) * 0.14;
      phase += (105 + Math.sin(t * 3) * 18) * Math.PI * 2 / sampleRate;
      const white = Math.random() * 2 - 1;
      lp.v += 0.1 * (white - lp.v);
      data[i] = (Math.sin(phase) * 0.28 + lp.v * 0.4) * env;
    }
    this._fadeEnds(data, Math.floor(sampleRate * 0.03));
    return buffer;
  }

  createElectricalPop() {
    const duration = 0.12 + Math.random() * 0.06;
    const sampleRate = this.ctx.sampleRate;
    const length = Math.max(1, Math.floor(sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    const lp = { v: 0 };

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const env = this._expDecay(t, 35);
      const white = Math.random() * 2 - 1;
      lp.v += 0.2 * (white - lp.v);
      data[i] = lp.v * env * 0.14 + Math.sin(t * 1800 * Math.PI * 2) * env * 0.08;
    }
    return buffer;
  }

  createMetalImpact() {
    return this._getCached('metal', () => {
      const duration = 0.35;
      const sampleRate = this.ctx.sampleRate;
      const length = Math.max(1, Math.floor(sampleRate * duration));
      const buffer = this.ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);
      const lp = { v: 0 };
      let phase = 0;

      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const env = this._expDecay(t, 10);
        phase += (280 + Math.exp(-t * 8) * 120) * Math.PI * 2 / sampleRate;
        const white = Math.random() * 2 - 1;
        lp.v += 0.12 * (white - lp.v);
        data[i] = (Math.sin(phase) * 0.28 + lp.v * 0.22) * env;
      }
      return buffer;
    });
  }

  createVentBurst() {
    const duration = 1.2 + Math.random() * 0.4;
    const sampleRate = this.ctx.sampleRate;
    const length = Math.max(1, Math.floor(sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    const lp = { v: 0 };

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const env = Math.sin(t / duration * Math.PI);
      const white = Math.random() * 2 - 1;
      lp.v += 0.06 * (white - lp.v);
      data[i] = lp.v * env * 0.11;
    }
    return buffer;
  }

  createDistantImpact() {
    const duration = 0.55 + Math.random() * 0.2;
    const sampleRate = this.ctx.sampleRate;
    const length = Math.max(1, Math.floor(sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    const lp = { v: 0 };
    let phase = 0;

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const env = this._expDecay(t, 5.5) * 0.14;
      phase += (68 + Math.random() * 8) * Math.PI * 2 / sampleRate;
      const white = Math.random() * 2 - 1;
      lp.v += 0.08 * (white - lp.v);
      data[i] = (Math.sin(phase) * 0.35 + lp.v * 0.55) * env;
    }
    return buffer;
  }

  createResonance() {
    const duration = 2.2 + Math.random() * 1.5;
    const sampleRate = this.ctx.sampleRate;
    const length = Math.max(1, Math.floor(sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    const lp = { v: 0 };
    let phase = 0;
    const freq = 38 + Math.random() * 22;

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const env = Math.sin(t / duration * Math.PI);
      phase += freq * Math.PI * 2 / sampleRate;
      const white = Math.random() * 2 - 1;
      lp.v += 0.05 * (white - lp.v);
      data[i] = (Math.sin(phase) * 0.15 + lp.v * 0.25) * env * 0.18;
    }
    return buffer;
  }
}
