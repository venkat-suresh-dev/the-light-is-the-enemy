/**
 * Plays individual footstep slices from footsteps.mp3 with variation.
 */

/** @param {object} step @param {AudioBuffer} buffer */
export function stepOffsetSec(step, buffer) {
  if (typeof step.startSec === 'number') return step.startSec;
  const s = step.start ?? 0;
  // Legacy slices stored sample indices in `start` — detect and convert.
  if (s > buffer.duration + 0.001) return s / buffer.sampleRate;
  return s;
}

export class FootstepPlayer {
  constructor(ctx, spatial, assets) {
    this.ctx = ctx;
    this.spatial = spatial;
    this.assets = assets;
    this._lastIndex = -1;
    this.stats = {
      playerAsset: 0,
      playerFailed: 0,
      enemyAsset: 0,
      lastPlayerGain: 0,
      lastPlayerSprinting: false,
      lastPlayerAt: 0,
      lastPath: null,
      lastError: null,
    };
  }

  _pickStep(pool) {
    if (!pool?.length) return null;
    let idx = Math.floor(Math.random() * pool.length);
    if (pool.length > 2 && idx === this._lastIndex) {
      idx = (idx + 1 + Math.floor(Math.random() * (pool.length - 1))) % pool.length;
    }
    this._lastIndex = idx;
    return pool[idx];
  }

  playPlayerStep(sprinting, volume, pan, dest, busMeta = null) {
    const data = this.assets.footsteps;
    if (!data?.buffer || !this.ctx) {
      this.stats.playerFailed += 1;
      return false;
    }

    const pool = sprinting ? data.runSteps : data.walkSteps;
    const step = this._pickStep(pool);
    if (!step) {
      this.stats.playerFailed += 1;
      return false;
    }

    const rate = (sprinting ? 1.06 : 0.97) * (0.94 + Math.random() * 0.08);
    const volMul = sprinting ? 1.12 : 1;
    const vol = volume * volMul * (0.92 + Math.random() * 0.14);
    const lp = sprinting ? 5200 : 4400;

    const ok = this._playSlice(data.buffer, step, vol, pan, dest, {
      playbackRate: rate,
      lowpass: lp,
      isPlayer: true,
      route: 'mixer',
      busMeta,
    });
    if (ok) {
      this.stats.playerAsset += 1;
      this.stats.lastPlayerGain = vol;
      this.stats.lastPlayerSprinting = sprinting;
      this.stats.lastPlayerAt = this.ctx.currentTime;
    } else {
      this.stats.playerFailed += 1;
    }
    return ok;
  }

  /**
   * Debug: one footstep straight to destination — bypasses mixer/spatial/filter.
   */
  playDirectToDestination(sprinting = false, gain = 0.9) {
    const data = this.assets.footsteps;
    if (!data?.buffer || !this.ctx) {
      this.stats.lastError = 'no buffer or context';
      return false;
    }
    const pool = sprinting ? data.runSteps : data.walkSteps;
    const step = pool[0] ?? data.steps[0];
    if (!step) {
      this.stats.lastError = 'no step slice';
      return false;
    }

    try {
      const buffer = data.buffer;
      const offsetSec = stepOffsetSec(step, buffer);
      const durationSec = step.duration;
      const now = this.ctx.currentTime;

      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = 1;

      const gainNode = this.ctx.createGain();
      gainNode.gain.value = gain;
      source.connect(gainNode);
      gainNode.connect(this.ctx.destination);

      source.start(now, offsetSec, durationSec);

      this.stats.lastPath = {
        route: 'direct',
        contextState: this.ctx.state,
        currentTime: now,
        offsetSec: Number(offsetSec.toFixed(4)),
        durationSec: Number(durationSec.toFixed(4)),
        endSec: Number((offsetSec + durationSec).toFixed(4)),
        bufferDuration: Number(buffer.duration.toFixed(4)),
        sliceStartSample: step.start ?? 0,
        playbackRate: 1,
        stepGain: gain,
        filterHz: null,
        pan: 0,
        playerBusGain: null,
        masterGain: null,
        effectiveGain: gain,
        sourceStarted: true,
      };
      this.stats.lastError = null;
      this.stats.lastPlayerGain = gain;
      this.stats.lastPlayerAt = now;
      this.stats.lastPlayerSprinting = sprinting;

      if (typeof console !== 'undefined') {
        console.info('[audio-path] DIRECT footstep', this.stats.lastPath);
      }
      return true;
    } catch (err) {
      this.stats.lastError = String(err);
      this.stats.lastPath = { route: 'direct', sourceStarted: false, error: String(err) };
      console.warn('[audio-path] DIRECT footstep failed:', err);
      return false;
    }
  }

  playEnemyStep(volume, pan, occlusion, rear, dest, hunting = false) {
    const data = this.assets.footsteps;
    if (!data?.buffer || !this.ctx) return false;

    const pool = hunting ? data.runSteps : data.walkSteps;
    const step = this._pickStep(pool);
    if (!step) return false;

    const rate = (hunting ? 0.88 : 0.82) * (0.93 + Math.random() * 0.08);
    const vol = volume * (0.88 + Math.random() * 0.14);
    const lp = 650 + occlusion * 1000 - rear * 260;

    const ok = this._playSlice(data.buffer, step, vol, pan, dest, {
      playbackRate: rate,
      lowpass: Math.max(220, lp),
      rear,
      occlusion,
      isPlayer: false,
      route: 'enemy',
    });
    if (ok) this.stats.enemyAsset += 1;
    return ok;
  }

  _playSlice(buffer, step, volume, pan, dest, extras) {
    if (!this.ctx || volume < 0.001) return false;
    try {
      const offsetSec = stepOffsetSec(step, buffer);
      const durationSec = step.duration;
      const playbackRate = extras.playbackRate ?? 1;

      if (offsetSec >= buffer.duration - 0.001) {
        throw new Error(`offset ${offsetSec}s >= buffer ${buffer.duration}s`);
      }

      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = playbackRate;

      const gainNode = this.ctx.createGain();
      const occ = Math.max(0, Math.min(1, extras.occlusion ?? 1));
      const rear = extras.rear ?? 0;
      const muffling = extras.isPlayer
        ? 1
        : occ >= 0.95
          ? 1 - rear * 0.24
          : (0.38 + occ * 0.5) * (1 - rear * 0.22);
      const peak = Math.max(0.0008, volume * muffling);
      gainNode.gain.value = peak;

      const filterHz = Math.max(180, extras.lowpass ?? 1800);
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterHz;
      filter.Q.value = 0.45;

      source.connect(filter);
      filter.connect(gainNode);

      let output = gainNode;
      let panner = null;
      if (typeof this.ctx.createStereoPanner === 'function') {
        panner = this.ctx.createStereoPanner();
        panner.pan.value = Math.max(-1, Math.min(1, pan));
        gainNode.connect(panner);
        output = panner;
      }
      output.connect(dest);

      const now = this.ctx.currentTime;
      const tail = durationSec / playbackRate;
      source.start(now, offsetSec, durationSec);

      const fadeStart = now + Math.max(0.02, tail * 0.72);
      gainNode.gain.setValueAtTime(peak, now);
      gainNode.gain.setValueAtTime(peak, fadeStart);
      gainNode.gain.exponentialRampToValueAtTime(0.0008, now + tail);

      const playerBusGain = extras.busMeta?.playerBus ?? dest?.gain?.value ?? null;
      const masterGain = extras.busMeta?.master ?? null;
      const effective = peak * (playerBusGain ?? 1) * (masterGain ?? 1);

      this.stats.lastPath = {
        route: extras.route ?? 'mixer',
        contextState: this.ctx.state,
        currentTime: Number(now.toFixed(4)),
        offsetSec: Number(offsetSec.toFixed(4)),
        durationSec: Number(durationSec.toFixed(4)),
        endSec: Number((offsetSec + durationSec).toFixed(4)),
        bufferDuration: Number(buffer.duration.toFixed(4)),
        sliceStartSample: step.start ?? 0,
        playbackRate: Number(playbackRate.toFixed(4)),
        stepGain: Number(peak.toFixed(4)),
        filterHz,
        pan: Number(pan.toFixed(3)),
        playerBusGain: playerBusGain != null ? Number(playerBusGain.toFixed(4)) : null,
        masterGain: masterGain != null ? Number(masterGain.toFixed(4)) : null,
        effectiveGain: Number(effective.toFixed(4)),
        sourceStarted: true,
      };
      this.stats.lastError = null;

      if (this.debug || this.assets?.debug) {
        console.info('[audio-path] footstep', this.stats.lastPath);
      }
      return true;
    } catch (err) {
      this.stats.lastError = String(err);
      this.stats.lastPath = {
        route: extras.route ?? 'mixer',
        sourceStarted: false,
        error: String(err),
        offsetSec: step ? Number(stepOffsetSec(step, buffer).toFixed(4)) : null,
        sliceStartSample: step?.start ?? null,
      };
      console.warn('Footstep slice failed:', err);
      return false;
    }
  }
}
