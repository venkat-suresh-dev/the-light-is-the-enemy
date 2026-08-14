import { CONFIG, ENEMY_STATE, ENEMY_ARCHETYPE } from '../utils/Constants.js';
import { normalize, distance } from '../utils/MathUtils.js';
import { Collision } from '../world/Collision.js';
import { EnemyAI } from './EnemyAI.js';

export class Enemy {
  constructor(x, y, id = 0, archetype = ENEMY_ARCHETYPE.STALKER) {
    this.id = id;
    this.archetype = archetype;
    const archetypeConfig = CONFIG.enemy.archetypes[archetype] || CONFIG.enemy.archetypes[ENEMY_ARCHETYPE.STALKER];
    this.x = x;
    this.y = y;
    this.radius = archetypeConfig.radius || CONFIG.enemy.radius;
    this.state = ENEMY_STATE.DORMANT;
    this.velocity = { x: 0, y: 0 };
    this.targetX = x;
    this.targetY = y;
    this.lastKnownPlayerX = x;
    this.lastKnownPlayerY = y;
    this.awareness = 0;
    this.speedMultiplier = 1;
    this.idlePhase = 0;
    this.footstepTimer = 0;
    this.nextFootstepInterval = 0.48;
    this.visible = false;
    this.wasVisible = false;
    this.eyeFlash = 0;
    this.shouldEmitAlert = false;
    this.animPhase = 0;
    this.twitch = 0;
    this.shadowGhost = 0;
    this.shadowGhostX = x;
    this.shadowGhostY = y;
    this.facingAngle = -Math.PI / 2;
    this.ai = new EnemyAI(this);
  }

  update(deltaTime, player, tileMap, flashlight) {
    this.ai.update(deltaTime, player, tileMap, flashlight);

    const velSpeed = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2);
    if (velSpeed > 5) {
      this.animPhase += deltaTime * (velSpeed / 40) * 3;
    } else {
      this.animPhase += deltaTime * 0.5;
    }

    if (this.twitch > 0) this.twitch -= deltaTime;

    // Occasional unsettling shadow ghost while hunting
    if (this.state === ENEMY_STATE.HUNTING && Math.random() < 0.002) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 80 + Math.random() * 60;
      this.shadowGhostX = this.x + Math.cos(angle) * dist;
      this.shadowGhostY = this.y + Math.sin(angle) * dist;
      this.shadowGhost = 0.6;
    }
    if (this.shadowGhost > 0) this.shadowGhost -= deltaTime * 0.15;

    const moveTarget = this.ai.getMoveTarget();
    const speed = this.ai.getSpeed();

    if (moveTarget && speed > 0) {
      const dir = normalize(moveTarget.x - this.x, moveTarget.y - this.y);
      this.velocity.x = dir.x * speed;
      this.velocity.y = dir.y * speed;
      if (Math.abs(dir.x) + Math.abs(dir.y) > 0.001) {
        this.facingAngle = Math.atan2(dir.y, dir.x);
      }

      const dx = this.velocity.x * deltaTime;
      const dy = this.velocity.y * deltaTime;

      const resolved = Collision.moveCircleTileMap(
        this.x, this.y, this.radius, tileMap, dx, dy, 0
      );
      this.x = resolved.x;
      this.y = resolved.y;
      if (resolved.blockedX) this.velocity.x = 0;
      if (resolved.blockedY) this.velocity.y = 0;

      this.footstepTimer += deltaTime;
    } else {
      this.velocity.x = 0;
      this.velocity.y = 0;
    }

    if (this.eyeFlash > 0) this.eyeFlash -= deltaTime;

    const distToPlayer = distance(this.x, this.y, player.x, player.y);
    const attackRange = this.ai._cfg?.().attackRange || CONFIG.enemy.attackRange;
    if (distToPlayer < attackRange && this.state === ENEMY_STATE.HUNTING) {
      return 'attack';
    }
    return null;
  }

  scheduleNextFootstep() {
    const hunting = this.state === ENEMY_STATE.HUNTING;
    const speed = Math.max(this.ai.getSpeed(), 1);
    const stride = hunting ? 36 : 52;
    let interval = stride / speed;
    interval *= hunting ? (0.88 + Math.random() * 0.16) : (0.92 + Math.random() * 0.28);
    if (Math.random() < (hunting ? 0.08 : 0.22)) {
      interval += 0.12 + Math.random() * 0.28;
    }
    this.nextFootstepInterval = interval;
  }

  isActive() {
    return this.state !== ENEMY_STATE.DORMANT && this.state !== ENEMY_STATE.LOST;
  }

  isDangerous() {
    return this.state === ENEMY_STATE.HUNTING || this.state === ENEMY_STATE.ALERT || this.state === ENEMY_STATE.AWARE;
  }
}
