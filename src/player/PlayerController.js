import { CONFIG } from '../utils/Constants.js';
import { lerpAngle } from '../utils/MathUtils.js';
import { Collision } from '../world/Collision.js';

export class PlayerController {
  constructor(player, input, events) {
    this.player = player;
    this.input = input;
    this.events = events;
    this.tileMap = null;
  }

  setTileMap(tileMap) {
    this.tileMap = tileMap;
  }

  update(deltaTime) {
    if (!this.player.alive || !this.tileMap) return;

    const move = this.input.getMovementVector();
    const sprinting = this.input.isDown('sprint') && this.player.stamina > 10;
    this.player.isSprinting = sprinting && (move.x !== 0 || move.y !== 0);
    this.player.isMoving = move.x !== 0 || move.y !== 0;

    const speed = this.player.isSprinting
      ? CONFIG.player.sprintSpeed
      : CONFIG.player.speed;

    const targetVelX = move.x * speed;
    const targetVelY = move.y * speed;

    const accel = CONFIG.player.acceleration;
    const friction = CONFIG.player.friction;
    const accelT = Math.min(1, accel * deltaTime / speed);
    const frictionT = Math.min(1, friction * deltaTime / CONFIG.player.speed);

    if (move.x !== 0 || move.y !== 0) {
      this.player.velocity.x += (targetVelX - this.player.velocity.x) * accelT;
      this.player.velocity.y += (targetVelY - this.player.velocity.y) * accelT;
    } else {
      this.player.velocity.x *= 1 - frictionT;
      this.player.velocity.y *= 1 - frictionT;
      if (Math.abs(this.player.velocity.x) < 0.5) this.player.velocity.x = 0;
      if (Math.abs(this.player.velocity.y) < 0.5) this.player.velocity.y = 0;
    }

    const dx = this.player.velocity.x * deltaTime;
    const dy = this.player.velocity.y * deltaTime;

    const resolved = Collision.moveCircleTileMap(
      this.player.x,
      this.player.y,
      this.player.radius,
      this.tileMap,
      dx,
      dy,
      CONFIG.player.collisionMargin
    );

    this.player.x = resolved.x;
    this.player.y = resolved.y;

    if (resolved.blockedX) this.player.velocity.x = 0;
    if (resolved.blockedY) this.player.velocity.y = 0;

    this._updateBodyAngle(deltaTime);
  }

  _updateBodyAngle(deltaTime) {
    const { x: vx, y: vy } = this.player.velocity;
    const moveSpeed = Math.sqrt(vx * vx + vy * vy);

    if (moveSpeed > 8) {
      const targetAngle = Math.atan2(vy, vx) + Math.PI / 2;
      this.player.bodyAngle = lerpAngle(
        this.player.bodyAngle,
        targetAngle,
        CONFIG.player.rotationSpeed * deltaTime
      );
    }
  }

  updateFlashlight(cameraX, cameraY, scale) {
    const angle = this.input.getAimAngle(cameraX, cameraY, scale);
    this.player.flashlight.setTargetDirection(angle);

    if (this.input.isPressed('toggleFlashlight')) {
      const on = this.player.flashlight.toggle();
      this.events.emit('flashlightToggled', { on });
      return;
    }

    const wantsLight = this.input.isDown('flashlight') && this.player.flashlight.battery > 0;

    if (wantsLight && !this.player.flashlight.isOn) {
      this.player.flashlight.setOn(true);
      this.events.emit('flashlightToggled', { on: true });
    } else if (!wantsLight && this.player.flashlight.isOn) {
      this.player.flashlight.setOn(false);
      this.events.emit('flashlightToggled', { on: false });
    }
  }
}
