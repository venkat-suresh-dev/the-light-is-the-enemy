import { CONFIG } from '../utils/Constants.js';
import { clamp, lerp, angleDifference } from '../utils/MathUtils.js';

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
    this.battery = CONFIG.flashlight.battery;
    this.maxBattery = CONFIG.flashlight.battery;
    this.flickerMultiplier = 1;
    this.colorShift = 0;
    this._flickerPhase = 0;
    this._flickerSeed = Math.random() * 100;
    this._drainRate = CONFIG.flashlight.drainRate;
    this._rechargeRate = CONFIG.flashlight.rechargeRate;
    this._justFlickered = false;
  }

  toggle() {
    this.isOn = !this.isOn;
    return this.isOn;
  }

  setOn(value) {
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
  }

  update(deltaTime) {
    // Smooth angle follow — physical flashlight lag
    const smooth = CONFIG.flashlight.angleSmoothing;
    const diff = angleDifference(this.targetAngle, this.angle);
    this.angle += diff * Math.min(1, smooth * deltaTime);

    this._flickerPhase += deltaTime;
    this._justFlickered = false;

    if (this.isOn) {
      this.battery = clamp(this.battery - this._drainRate * deltaTime, 0, this.maxBattery);

      if (this.battery <= 0) {
        this.isOn = false;
        this.flickerMultiplier = 0;
      } else {
        const lowBattery = this.battery < 25;
        const flickerBase = lowBattery ? CONFIG.flashlight.flickerAmount * 1.5 : CONFIG.flashlight.flickerAmount;
        const flicker = Math.sin(this._flickerPhase * 8 + this._flickerSeed) * flickerBase;
        const flicker2 = Math.sin(this._flickerPhase * 17 + this._flickerSeed * 2) * flickerBase * 0.4;
        const flicker3 = Math.sin(this._flickerPhase * 31) * flickerBase * 0.15;
        this.flickerMultiplier = clamp(1 + flicker + flicker2 + flicker3, 0.75, 1.02);
        this.colorShift = flicker3 * 0.5;

        if (Math.abs(flicker2) > flickerBase * 0.3) this._justFlickered = true;

        if (lowBattery) {
          this.range = CONFIG.flashlight.range * (0.55 + this.battery / 45);
        } else {
          this.range = CONFIG.flashlight.range;
        }
      }
    } else {
      this.battery = clamp(this.battery + this._rechargeRate * deltaTime, 0, this.maxBattery);
      this.flickerMultiplier = 1;
      this.colorShift = 0;
      this.range = CONFIG.flashlight.range;
    }
  }

  getBatteryPercent() {
    return this.battery / this.maxBattery;
  }
}
