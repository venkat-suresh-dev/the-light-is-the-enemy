import { CONFIG } from '../utils/Constants.js';
import { clamp, angleDifference } from '../utils/MathUtils.js';
import { ResourceMeter } from '../systems/ResourceMeter.js';

export class Flashlight {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.angle = 0;
    this.targetAngle = 0;
    this.isOn = false;
    this.range = CONFIG.flashlight.range;
    this.fov = CONFIG.flashlight.fov;
    this.intensity = CONFIG.flashlight.intensity;
    this.power = new ResourceMeter(CONFIG.flashlight.power);
    this.flickerMultiplier = 1;
    this.colorShift = 0;
    this._flickerPhase = 0;
    this._flickerSeed = Math.random() * 100;
    this._drainRate = CONFIG.flashlight.power.drainRate;
    this._justFlickered = false;
  }

  get battery() {
    return this.power.current;
  }

  get maxBattery() {
    return this.power.max;
  }

  canActivate() {
    if (this.isOn) return this.power.current > 0;
    return this.power.current >= CONFIG.flashlight.power.restartThreshold;
  }

  toggle() {
    if (!this.isOn && !this.canActivate()) return false;
    this.isOn = !this.isOn;
    return this.isOn;
  }

  setOn(value) {
    if (value && !this.canActivate()) {
      this.isOn = false;
      return;
    }
    this.isOn = value;
  }

  setTargetDirection(angle) {
    this.targetAngle = angle;
  }

  setDirection(angle) {
    this.angle = angle;
    this.targetAngle = angle;
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }

  setDrainRate(rate) {
    this._drainRate = rate;
    this.power.drainRate = rate;
  }

  update(deltaTime) {
    // Smooth angle follow — physical flashlight lag
    const smooth = CONFIG.flashlight.angleSmoothing;
    const diff = angleDifference(this.targetAngle, this.angle);
    this.angle += diff * Math.min(1, smooth * deltaTime);

    this._flickerPhase += deltaTime;
    this._justFlickered = false;
    this.range = CONFIG.flashlight.range;

    if (this.isOn) {
      this.power.drain(deltaTime, this._drainRate);

      if (this.power.isEmpty()) {
        this.isOn = false;
        this.flickerMultiplier = 0;
      } else {
        this._updateLowPowerFlicker();
      }
    } else {
      this.power.recharge(deltaTime);
      this.flickerMultiplier = 1;
      this.colorShift = 0;
    }
  }

  _updateLowPowerFlicker() {
    const state = this.getPowerState();
    const cfg = CONFIG.flashlight;
    let flickerScale = 1;
    let base = 1;

    if (state === 'low') {
      flickerScale = 1.2;
    } else if (state === 'warning') {
      flickerScale = 1.55;
      base = 0.96;
    } else if (state === 'critical') {
      flickerScale = 1.85;
      base = 0.9;
    }

    const flickerBase = cfg.flickerAmount * flickerScale;
    const flicker = Math.sin(this._flickerPhase * 8 + this._flickerSeed) * flickerBase;
    const flicker2 = Math.sin(this._flickerPhase * 17 + this._flickerSeed * 2) * flickerBase * 0.4;
    const flicker3 = Math.sin(this._flickerPhase * 31) * flickerBase * 0.15;
    this.flickerMultiplier = clamp(base + flicker + flicker2 + flicker3, 0.75, 1.02);
    this.colorShift = flicker3 * 0.5;

    if (Math.abs(flicker2) > flickerBase * 0.3) this._justFlickered = true;
  }

  getBatteryPercent() {
    return this.power.normalized();
  }

  getPowerState() {
    const pct = this.power.normalized();
    const cfg = CONFIG.flashlight.power;
    if (pct <= 0) return 'empty';
    if (pct < cfg.criticalPercent) return 'critical';
    if (pct < cfg.warningPercent) return 'warning';
    if (pct < cfg.lowPercent) return 'low';
    return 'normal';
  }
}
