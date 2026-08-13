/**
 * Procedurally generated sounds via Web Audio API.
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

  createFootstep() {
    return this._getCached('footstep', () => {
      const duration = 0.08;
      const sampleRate = this.ctx.sampleRate;
      const length = sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const env = Math.exp(-t * 40);
        const noise = (Math.random() * 2 - 1) * 0.5;
        const tone = Math.sin(t * 80 * Math.PI * 2) * 0.3;
        data[i] = (noise + tone) * env;
      }
      return buffer;
    });
  }

  createEnemyFootstep() {
    return this._getCached('enemyFootstep', () => {
      const duration = 0.12;
      const sampleRate = this.ctx.sampleRate;
      const length = sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const env = Math.exp(-t * 25);
        const noise = (Math.random() * 2 - 1) * 0.7;
        const tone = Math.sin(t * 50 * Math.PI * 2) * 0.4;
        data[i] = (noise + tone) * env * 0.8;
      }
      return buffer;
    });
  }

  createHeartbeat() {
    return this._getCached('heartbeat', () => {
      const duration = 0.15;
      const sampleRate = this.ctx.sampleRate;
      const length = sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const env = Math.exp(-t * 20) * (1 - Math.exp(-t * 200));
        const tone = Math.sin(t * 60 * Math.PI * 2) * 0.6;
        const sub = Math.sin(t * 30 * Math.PI * 2) * 0.4;
        data[i] = (tone + sub) * env;
      }
      return buffer;
    });
  }

  createClick() {
    return this._getCached('click', () => {
      const duration = 0.04;
      const sampleRate = this.ctx.sampleRate;
      const length = sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const env = Math.exp(-t * 80);
        data[i] = Math.sin(t * 3000 * Math.PI * 2) * env * 0.3;
      }
      return buffer;
    });
  }

  createWhisper() {
    return this._getCached('whisper', () => {
      const duration = 0.5;
      const sampleRate = this.ctx.sampleRate;
      const length = sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const env = Math.sin(t / duration * Math.PI) * 0.15;
        const noise = (Math.random() * 2 - 1);
        const filtered = noise * Math.sin(t * 200 * Math.PI * 2);
        data[i] = filtered * env;
      }
      return buffer;
    });
  }

  createDoorCreak() {
    return this._getCached('doorCreak', () => {
      const duration = 1.2;
      const sampleRate = this.ctx.sampleRate;
      const length = sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const env = Math.sin(t / duration * Math.PI) * 0.2;
        const freq = 80 + t * 40;
        data[i] = Math.sin(t * freq * Math.PI * 2) * env
          + (Math.random() * 2 - 1) * env * 0.3;
      }
      return buffer;
    });
  }

  createAmbience() {
    return this._getCached('ambience', () => {
      const duration = 4;
      const sampleRate = this.ctx.sampleRate;
      const length = sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const noise = (Math.random() * 2 - 1) * 0.03;
        const hum = Math.sin(t * 40 * Math.PI * 2) * 0.01;
        data[i] = noise + hum;
      }
      return buffer;
    });
  }

  createDeathSound() {
    return this._getCached('death', () => {
      const duration = 1.5;
      const sampleRate = this.ctx.sampleRate;
      const length = sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const env = Math.exp(-t * 1.5);
        const freq = 200 - t * 100;
        data[i] = Math.sin(t * freq * Math.PI * 2) * env * 0.5
          + (Math.random() * 2 - 1) * env * 0.2;
      }
      return buffer;
    });
  }

  createPipeNoise() {
    return this._getCached('pipe', () => {
      const duration = 0.8;
      const sampleRate = this.ctx.sampleRate;
      const length = sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const env = Math.sin(t / duration * Math.PI) * 0.15;
        data[i] = (Math.random() * 2 - 1) * env + Math.sin(t * 120 * Math.PI * 2) * env * 0.3;
      }
      return buffer;
    });
  }

  createElectricalPop() {
    return this._getCached('electrical', () => {
      const duration = 0.15;
      const sampleRate = this.ctx.sampleRate;
      const length = sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const env = Math.exp(-t * 30);
        data[i] = Math.sin(t * 2000 * Math.PI * 2) * env * 0.15 + (Math.random() * 2 - 1) * env * 0.1;
      }
      return buffer;
    });
  }

  createMetalImpact() {
    return this._getCached('metal', () => {
      const duration = 0.3;
      const sampleRate = this.ctx.sampleRate;
      const length = sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const env = Math.exp(-t * 12);
        data[i] = Math.sin(t * 300 * Math.PI * 2) * env * 0.3 + (Math.random() * 2 - 1) * env * 0.2;
      }
      return buffer;
    });
  }

  createVentBurst() {
    return this._getCached('vent', () => {
      const duration = 1.0;
      const sampleRate = this.ctx.sampleRate;
      const length = sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const env = Math.sin(t / duration * Math.PI) * 0.1;
        data[i] = (Math.random() * 2 - 1) * env;
      }
      return buffer;
    });
  }

  createDistantImpact() {
    return this._getCached('distant', () => {
      const duration = 0.5;
      const sampleRate = this.ctx.sampleRate;
      const length = sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const env = Math.exp(-t * 6) * 0.12;
        data[i] = Math.sin(t * 80 * Math.PI * 2) * env + (Math.random() * 2 - 1) * env;
      }
      return buffer;
    });
  }

  createBreathing() {
    return this._getCached('breathing', () => {
      const duration = 0.6;
      const sampleRate = this.ctx.sampleRate;
      const length = sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const env = Math.sin(t / duration * Math.PI);
        data[i] = (Math.random() * 2 - 1) * env * 0.08 + Math.sin(t * 8 * Math.PI * 2) * env * 0.05;
      }
      return buffer;
    });
  }
}
