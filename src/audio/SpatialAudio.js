export class SpatialAudio {
  constructor(audioContext, destination) {
    this.ctx = audioContext;
    this.destination = destination || audioContext.destination;
  }

  calculatePan(listenerX, listenerY, listenerAngle, sourceX, sourceY) {
    const dx = sourceX - listenerX;
    const dy = sourceY - listenerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return 0;

    const angleToSource = Math.atan2(dy, dx);
    let relativeAngle = angleToSource - listenerAngle;
    while (relativeAngle > Math.PI) relativeAngle -= Math.PI * 2;
    while (relativeAngle < -Math.PI) relativeAngle += Math.PI * 2;

    return Math.sin(relativeAngle);
  }

  calculateVolume(listenerX, listenerY, sourceX, sourceY, maxDist = 600) {
    const dx = sourceX - listenerX;
    const dy = sourceY - listenerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const linear = Math.max(0, 1 - dist / maxDist);
    return linear * linear;
  }

  /**
   * @param {number} occlusion 0 = fully occluded, 1 = clear line of sight
   */
  playBuffer(buffer, volume, pan, duration, occlusion = 1, dest = null) {
    if (!this.ctx || !buffer || volume < 0.001) return;

    const target = dest || this.destination;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const gainNode = this.ctx.createGain();
    gainNode.gain.value = volume * occlusion;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800 + occlusion * 3200;
    filter.Q.value = 0.7;

    const panner = this.ctx.createStereoPanner();
    panner.pan.value = pan;

    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(panner);
    panner.connect(target);

    source.start(0);
    if (duration) {
      gainNode.gain.setValueAtTime(volume * occlusion, this.ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    }
  }
}
