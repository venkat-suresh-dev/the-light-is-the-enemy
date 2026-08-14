import { CONFIG } from '../utils/Constants.js';
import { ResourceMeter } from '../systems/ResourceMeter.js';
import { Flashlight } from './Flashlight.js';

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = CONFIG.player.radius;
    this.velocity = { x: 0, y: 0 };
    this.staminaMeter = new ResourceMeter(CONFIG.player.stamina);
    this.isSprinting = false;
    this.isMoving = false;
    this.flashlight = new Flashlight();
    this.alive = true;
    this.footstepTimer = 0;
    this._bobPhase = 0;
    this.breathePhase = 0;
    this.walkPhase = 0;
    this.dangerLevel = 0;
    this.bodyAngle = -Math.PI / 2;
  }

  get stamina() {
    return this.staminaMeter.current;
  }

  get maxStamina() {
    return this.staminaMeter.max;
  }

  reset(x, y) {
    this.x = x;
    this.y = y;
    this.velocity = { x: 0, y: 0 };
    this.staminaMeter.reset();
    this.isSprinting = false;
    this.isMoving = false;
    this.alive = true;
    this.flashlight = new Flashlight();
    this.footstepTimer = 0;
    this.breathePhase = 0;
    this.walkPhase = 0;
    this.dangerLevel = 0;
    this.bodyAngle = -Math.PI / 2;
  }

  update(deltaTime) {
    this.flashlight.setPosition(this.x, this.y);
    this.flashlight.update(deltaTime);

    this.breathePhase += deltaTime * 1.8;

    if (this.isMoving) {
      this._bobPhase += deltaTime * (this.isSprinting ? 14 : 9);
      this.walkPhase += deltaTime * (this.isSprinting ? 13 : 8);
      this.footstepTimer += deltaTime;
    }

    if (this.isSprinting && this.isMoving) {
      this.staminaMeter.drain(deltaTime);
      if (this.staminaMeter.isEmpty()) this.isSprinting = false;
    } else {
      this.staminaMeter.recharge(deltaTime);
    }
  }

  getBobOffset() {
    return Math.sin(this._bobPhase) * (this.isSprinting ? 3 : 1.5);
  }

  getStaminaState() {
    const pct = this.staminaMeter.normalized();
    const cfg = CONFIG.player.stamina;
    if (pct <= 0) return 'empty';
    if (pct < cfg.criticalPercent) return 'critical';
    if (pct < cfg.lowPercent) return 'low';
    return 'normal';
  }

  die() {
    this.alive = false;
  }
}
