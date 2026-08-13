import { CONFIG } from '../utils/Constants.js';
import { clamp } from '../utils/MathUtils.js';
import { Flashlight } from './Flashlight.js';

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = CONFIG.player.radius;
    this.velocity = { x: 0, y: 0 };
    this.stamina = CONFIG.player.stamina;
    this.maxStamina = CONFIG.player.stamina;
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

  reset(x, y) {
    this.x = x;
    this.y = y;
    this.velocity = { x: 0, y: 0 };
    this.stamina = this.maxStamina;
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
      this.stamina = clamp(this.stamina - CONFIG.player.staminaDrain * deltaTime, 0, this.maxStamina);
      if (this.stamina <= 0) this.isSprinting = false;
    } else {
      this.stamina = clamp(this.stamina + CONFIG.player.staminaRegen * deltaTime, 0, this.maxStamina);
    }
  }

  getBobOffset() {
    return Math.sin(this._bobPhase) * (this.isSprinting ? 3 : 1.5);
  }

  die() {
    this.alive = false;
  }
}
