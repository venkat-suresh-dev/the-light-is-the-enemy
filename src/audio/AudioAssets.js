/**
 * Loads decoded MP3 assets and derives footstep slices from footsteps.mp3.
 * All loading is fail-soft — missing assets never block gameplay.
 */
const ASSET_URLS = {
  ambience: 'assets/scary-ambience.mp3',
  threatMusic: 'assets/high-threat-music.mp3',
  menuMusic: 'assets/menu-music.mp3',
  footsteps: 'assets/footsteps.mp3',
  door: 'assets/enter-exit-door.mp3',
  pickup: 'assets/pic-up-object.mp3',
  gameOver: 'assets/game-over.mp3',
};

export class AudioAssets {
  constructor(ctx) {
    this.ctx = ctx;
    this.buffers = {};
    this.footsteps = null;
    this.ready = false;
    this.debug = false;
    this._loadPromise = null;
  }

  load() {
    if (!this._loadPromise) {
      this._loadPromise = this._loadAll().catch((err) => {
        console.warn('Audio asset load failed:', err);
        this.ready = false;
      });
    }
    return this._loadPromise;
  }

  async _loadAll() {
    const entries = Object.entries(ASSET_URLS);
    const results = await Promise.allSettled(
      entries.map(async ([key, url]) => {
        const buffer = await this._decode(url);
        return [key, buffer];
      })
    );

    for (const result of results) {
      if (result.status !== 'fulfilled' || !result.value?.[1]) continue;
      const [key, buffer] = result.value;
      this.buffers[key] = buffer;
    }

    if (this.buffers.footsteps) {
      this.footsteps = this._analyzeFootsteps(this.buffers.footsteps);
    }

    this.ready = Object.keys(this.buffers).length > 0;
    return this.ready;
  }

  async _decode(url) {
    if (!this.ctx) return null;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
      const data = await response.arrayBuffer();
      return await this.ctx.decodeAudioData(data.slice(0));
    } catch (err) {
      console.warn(`Failed to decode ${url}:`, err);
      return null;
    }
  }

  get(name) {
    return this.buffers[name] || null;
  }

  footstepsReady() {
    return !!(this.footsteps?.steps?.length && this.buffers.footsteps);
  }

  /**
   * Scan footsteps.mp3 for transient peaks and build playable slices.
   */
  _analyzeFootsteps(buffer) {
    const sampleRate = buffer.sampleRate;
    const channels = buffer.numberOfChannels;
    const length = buffer.length;
    const mono = new Float32Array(length);

    for (let i = 0; i < length; i++) {
      let sum = 0;
      for (let c = 0; c < channels; c++) {
        sum += buffer.getChannelData(c)[i];
      }
      mono[i] = sum / channels;
    }

    const win = Math.max(1, Math.floor(sampleRate * 0.008));
    const hop = Math.max(1, Math.floor(sampleRate * 0.004));
    const env = [];
    for (let i = 0; i < length - win; i += hop) {
      let sum = 0;
      for (let j = 0; j < win; j++) {
        const s = mono[i + j];
        sum += s * s;
      }
      env.push(Math.sqrt(sum / win));
    }

    let peak = 0;
    let sumSq = 0;
    for (let i = 0; i < mono.length; i++) {
      const a = Math.abs(mono[i]);
      if (a > peak) peak = a;
      sumSq += mono[i] * mono[i];
    }
    const rms = Math.sqrt(sumSq / Math.max(1, mono.length));
    const sorted = env.slice().sort((a, b) => a - b);
    const p40 = sorted[Math.floor(sorted.length * 0.4)] || rms;
    const thresh = Math.max(rms * 0.18, p40 * 1.35, peak * 0.045);

    const peaks = [];
    let lastPeak = -Infinity;
    const minGap = sampleRate * 0.11;

    for (let i = 1; i < env.length - 1; i++) {
      const idx = i * hop;
      if (env[i] <= thresh) continue;
      if (env[i] < env[i - 1] || env[i] < env[i + 1]) continue;
      if (idx - lastPeak < minGap) {
        if (peaks.length && env[i] > env[Math.floor(lastPeak / hop)]) {
          peaks[peaks.length - 1] = idx;
        }
        continue;
      }
      peaks.push(idx);
      lastPeak = idx;
    }

    const steps = [];
    for (let i = 0; i < peaks.length; i++) {
      const center = peaks[i];
      const pre = Math.floor(sampleRate * 0.03);
      const post = Math.floor(sampleRate * 0.26);
      const startSample = Math.max(0, center - pre);
      const end = Math.min(length, center + post);
      const duration = (end - startSample) / sampleRate;
      if (duration < 0.05 || duration > 0.55) continue;

      let gap = null;
      if (i < peaks.length - 1) {
        gap = (peaks[i + 1] - center) / sampleRate;
      }
      steps.push({
        start: startSample,
        startSec: startSample / sampleRate,
        duration,
        gap,
      });
    }

    let walkSteps = [];
    let runSteps = [];
    for (const step of steps) {
      if (step.gap != null && step.gap < 0.38) runSteps.push(step);
      else walkSteps.push(step);
    }

    if (runSteps.length < 3 && steps.length > 8) {
      walkSteps = [];
      runSteps = [];
      for (let i = 0; i < steps.length; i++) {
        const g = steps[i].gap;
        if (g != null && g < 0.34) runSteps.push(steps[i]);
        else walkSteps.push(steps[i]);
      }
    }

    const pool = steps.length
      ? steps
      : [{ start: 0, startSec: 0, duration: Math.min(0.18, buffer.duration), gap: null }];
    const loopCorr = this._loopCorrelation(mono, sampleRate);

    return {
      buffer,
      steps: pool,
      walkSteps: walkSteps.length ? walkSteps : pool,
      runSteps: runSteps.length ? runSteps : pool,
      peakCount: peaks.length,
      loopCorr,
      duration: buffer.duration,
    };
  }

  _loopCorrelation(mono, sampleRate) {
    const n = Math.min(Math.floor(sampleRate * 2), Math.floor(mono.length / 4));
    if (n < 128) return 0;
    const a = mono.subarray(0, n);
    const b = mono.subarray(mono.length - n);
    let ma = 0;
    let mb = 0;
    for (let i = 0; i < n; i++) {
      ma += a[i];
      mb += b[i];
    }
    ma /= n;
    mb /= n;
    let va = 0;
    let vb = 0;
    let cov = 0;
    for (let i = 0; i < n; i++) {
      const da = a[i] - ma;
      const db = b[i] - mb;
      va += da * da;
      vb += db * db;
      cov += da * db;
    }
    if (va <= 0 || vb <= 0) return 0;
    return cov / Math.sqrt(va * vb);
  }

  isLoopSeamless(buffer, corrHint = null) {
    if (!buffer) return false;
    if (corrHint != null) return corrHint > 0.55;
    const sampleRate = buffer.sampleRate;
    const mono = buffer.getChannelData(0);
    return this._loopCorrelation(mono, sampleRate) > 0.55;
  }
}
