import { CONFIG } from '../utils/Constants.js';

export class Time {
  constructor() {
    this.deltaTime = 0;
    this.elapsed = 0;
    this.totalTime = 0;
    this._lastTimestamp = 0;
  }

  update(timestamp) {
    if (this._lastTimestamp === 0) {
      this._lastTimestamp = timestamp;
      this.deltaTime = 0;
      return;
    }

    const raw = (timestamp - this._lastTimestamp) / 1000;
    this.deltaTime = Math.min(raw, CONFIG.timing.maxDeltaTime);
    this.elapsed += this.deltaTime;
    this.totalTime += this.deltaTime;
    this._lastTimestamp = timestamp;
  }

  reset() {
    this._lastTimestamp = 0;
    this.deltaTime = 0;
    this.elapsed = 0;
  }
}
