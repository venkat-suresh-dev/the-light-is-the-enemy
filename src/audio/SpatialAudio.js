export class SpatialAudio {
  constructor(audioContext, destination) {
    this.ctx = audioContext;
    this.destination = destination || audioContext.destination;
  }

  getRelative(listenerX, listenerY, listenerAngle, sourceX, sourceY) {
    const dx = sourceX - listenerX;
    const dy = sourceY - listenerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) {
      return { dist: 0, relativeAngle: 0, pan: 0, rear: 0 };
    }

    const angleToSource = Math.atan2(dy, dx);
    let relativeAngle = angleToSource - listenerAngle;
    while (relativeAngle > Math.PI) relativeAngle -= Math.PI * 2;
    while (relativeAngle < -Math.PI) relativeAngle += Math.PI * 2;

    const pan = Math.max(-1, Math.min(1, Math.sin(relativeAngle) * 0.92));
    const absA = Math.abs(relativeAngle);
    const rear = absA <= Math.PI / 2
      ? 0
      : Math.min(1, (absA - Math.PI / 2) / (Math.PI / 2)) * 0.85;

    return { dist, relativeAngle, pan, rear };
  }

  calculatePan(listenerX, listenerY, listenerAngle, sourceX, sourceY) {
    return this.getRelative(listenerX, listenerY, listenerAngle, sourceX, sourceY).pan;
  }

  calculateVolume(listenerX, listenerY, sourceX, sourceY, maxDist = 600) {
    const dx = sourceX - listenerX;
    const dy = sourceY - listenerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const linear = Math.max(0, 1 - dist / maxDist);
    return linear * linear;
  }

  /**
   * @param {number} occlusion 0 = muffled / behind walls, 1 = clear line of sight
   * @param {object} [extras]
   */
  playBuffer(buffer, volume, pan, duration, occlusion = 1, dest = null, extras = {}) {
    if (!this.ctx || !buffer || volume < 0.001) return;

    try {
      const occ = Math.max(0, Math.min(1, occlusion));
      const rear = extras.rear ?? 0;
      // Clear LOS stays near unity; walls/rear only soften — never crush presence.
      const muffling = occ >= 0.95
        ? 1 - rear * 0.22
        : (0.32 + occ * 0.48) * (1 - rear * 0.24);
      const playbackRate = extras.playbackRate ?? 1;
      const lowpass = extras.lowpass ?? (380 + occ * 2100 - rear * 220);

      const target = dest || this.destination;
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = playbackRate;

      const gainNode = this.ctx.createGain();
      const startGain = volume * muffling;
      gainNode.gain.value = startGain;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = Math.max(90, lowpass);
      filter.Q.value = 0.45;

      source.connect(filter);
      filter.connect(gainNode);

      let output = gainNode;
      if (typeof this.ctx.createStereoPanner === 'function') {
        const panner = this.ctx.createStereoPanner();
        panner.pan.value = Math.max(-1, Math.min(1, pan));
        gainNode.connect(panner);
        output = panner;
      }
      output.connect(target);

      const now = this.ctx.currentTime;
      source.start(now);
      if (duration && duration > 0 && !extras.noFade) {
        const startAt = Math.max(0.0008, startGain);
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(startAt, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);
      }
    } catch (err) {
      console.warn('Spatial playback failed:', err);
    }
  }
}
