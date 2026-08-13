import { CONFIG, ENEMY_STATE } from '../utils/Constants.js';
import { distance, normalize, angleBetween } from '../utils/MathUtils.js';
import { Visibility } from '../world/Visibility.js';

export class EnemyAI {
  constructor(enemy) {
    this.enemy = enemy;
    this.stateTimer = 0;
    this.detectionTimer = 0;
    this.attackTimer = 0;
    this.searchPoints = [];
    this.searchIndex = 0;
    this.headAngle = 0;
    this.freezeTimer = 0;
    this.wasIlluminated = false;
  }

  update(deltaTime, player, tileMap, flashlight) {
    const e = this.enemy;
    this.stateTimer += deltaTime;

    const illuminated = Visibility.isIlluminated(e.x, e.y, flashlight, tileMap);
    const distToPlayer = distance(e.x, e.y, player.x, player.y);

    // State transitions
    switch (e.state) {
      case ENEMY_STATE.DORMANT:
        this._updateDormant(deltaTime, illuminated, distToPlayer, player);
        break;
      case ENEMY_STATE.ILLUMINATED:
        this._updateIlluminated(deltaTime, illuminated, player);
        break;
      case ENEMY_STATE.ALERT:
        this._updateAlert(deltaTime, player, distToPlayer);
        break;
      case ENEMY_STATE.HUNTING:
        this._updateHunting(deltaTime, player, tileMap, distToPlayer);
        break;
      case ENEMY_STATE.SEARCHING:
        this._updateSearching(deltaTime, tileMap, distToPlayer);
        break;
      case ENEMY_STATE.LOST:
        this._updateLost(deltaTime);
        break;
    }

  }

  _updateDormant(deltaTime, illuminated, distToPlayer, player) {
    if (illuminated) {
      this.freezeTimer = 0.3;
      this.enemy.state = ENEMY_STATE.ILLUMINATED;
      this.stateTimer = 0;
      this.detectionTimer = 0;
      this.wasIlluminated = true;
      this.enemy.lastKnownPlayerX = player.x;
      this.enemy.lastKnownPlayerY = player.y;
      this.headAngle = angleBetween(this.enemy.x, this.enemy.y, player.x, player.y);
    }

    this.enemy.idlePhase += deltaTime;
  }

  _updateIlluminated(deltaTime, illuminated, player) {
    this.headAngle = angleBetween(this.enemy.x, this.enemy.y, player.x, player.y);
    this.enemy.lastKnownPlayerX = player.x;
    this.enemy.lastKnownPlayerY = player.y;

    if (this.freezeTimer > 0) {
      this.freezeTimer -= deltaTime;
      return;
    }

    this.detectionTimer += deltaTime;

    if (this.detectionTimer >= CONFIG.enemy.detectionTime) {
      this.enemy.state = ENEMY_STATE.ALERT;
      this.stateTimer = 0;
      this.enemy.awareness = 1;
      this.enemy.twitch = 0.4;
      this.enemy.shouldEmitAlert = true;
      return;
    }

    if (!illuminated && this.detectionTimer > 0.2) {
      this.enemy.state = ENEMY_STATE.SEARCHING;
      this.stateTimer = 0;
      this._generateSearchPoints(player.x, player.y);
    }
  }

  _updateAlert(deltaTime, player, distToPlayer) {
    this.headAngle = angleBetween(this.enemy.x, this.enemy.y, player.x, player.y);
    this.enemy.lastKnownPlayerX = player.x;
    this.enemy.lastKnownPlayerY = player.y;

    if (this.stateTimer >= CONFIG.enemy.alertTime) {
      this.enemy.state = ENEMY_STATE.HUNTING;
      this.stateTimer = 0;
    }
  }

  _updateHunting(deltaTime, player, tileMap, distToPlayer) {
    this.enemy.lastKnownPlayerX = player.x;
    this.enemy.lastKnownPlayerY = player.y;

  }

  _updateSearching(deltaTime, tileMap, distToPlayer) {
    if (this.stateTimer >= CONFIG.enemy.searchTime) {
      this.enemy.state = ENEMY_STATE.LOST;
      this.stateTimer = 0;
      return;
    }

    if (this.searchPoints.length > 0 && this.searchIndex < this.searchPoints.length) {
      const target = this.searchPoints[this.searchIndex];
      const dist = distance(this.enemy.x, this.enemy.y, target.x, target.y);
      if (dist < 20) {
        this.searchIndex++;
      }
      this.enemy.targetX = target.x;
      this.enemy.targetY = target.y;
    } else {
      this.enemy.targetX = this.enemy.lastKnownPlayerX;
      this.enemy.targetY = this.enemy.lastKnownPlayerY;
    }
  }

  _updateLost(deltaTime) {
    if (this.stateTimer >= CONFIG.enemy.lostTime) {
      this.enemy.state = ENEMY_STATE.DORMANT;
      this.stateTimer = 0;
      this.enemy.awareness = 0;
      this.wasIlluminated = false;
      this.enemy.shouldEmitAlert = false;
    }
  }

  _generateSearchPoints(px, py) {
    this.searchPoints = [];
    const offsets = [
      { x: 60, y: 0 }, { x: -60, y: 0 },
      { x: 0, y: 60 }, { x: 0, y: -60 },
      { x: 40, y: 40 },
    ];
    for (const o of offsets) {
      this.searchPoints.push({ x: px + o.x, y: py + o.y });
    }
    this.searchIndex = 0;
  }

  getMoveTarget() {
    const e = this.enemy;
    switch (e.state) {
      case ENEMY_STATE.HUNTING:
        return { x: e.lastKnownPlayerX, y: e.lastKnownPlayerY };
      case ENEMY_STATE.SEARCHING:
        return { x: e.targetX, y: e.targetY };
      default:
        return null;
    }
  }

  getSpeed() {
    switch (this.enemy.state) {
      case ENEMY_STATE.HUNTING:
        return CONFIG.enemy.chaseSpeed * this.enemy.speedMultiplier;
      case ENEMY_STATE.SEARCHING:
        return CONFIG.enemy.huntSpeed * this.enemy.speedMultiplier;
      case ENEMY_STATE.ALERT:
        return 0;
      default:
        return CONFIG.enemy.walkSpeed * 0.3 * this.enemy.speedMultiplier;
    }
  }

  shouldPlayFootstep() {
    return this.enemy.state === ENEMY_STATE.HUNTING || this.enemy.state === ENEMY_STATE.SEARCHING;
  }
}
