import { clamp } from '../utils/MathUtils.js';

export class ResourceMeter {
  constructor({ max, drainRate, rechargeRate, rechargeDelay }) {
    this.max = max;
    this.drainRate = drainRate;
    this.rechargeRate = rechargeRate;
    this.rechargeDelay = rechargeDelay;
    this.current = max;
    this._rechargeTimer = 0;
    this._draining = false;
  }

  drain(deltaTime, rate = this.drainRate) {
    this.current = clamp(this.current - rate * deltaTime, 0, this.max);
    this._rechargeTimer = 0;
    this._draining = true;
  }

  recharge(deltaTime, rate = this.rechargeRate) {
    if (this._draining) {
      this._draining = false;
      this._rechargeTimer = 0;
    }
    if (this.current >= this.max) return;
    this._rechargeTimer += deltaTime;
    if (this._rechargeTimer >= this.rechargeDelay) {
      this.current = clamp(this.current + rate * deltaTime, 0, this.max);
    }
  }

  reset() {
    this.current = this.max;
    this._rechargeTimer = 0;
    this._draining = false;
  }

  normalized() {
    return this.max > 0 ? this.current / this.max : 0;
  }

  isEmpty() {
    return this.current <= 0;
  }

  isFull() {
    return this.current >= this.max;
  }
}
