import { CONFIG, ENEMY_STATE, ENEMY_ARCHETYPE } from '../utils/Constants.js';
import { distance, angleBetween, clamp } from '../utils/MathUtils.js';
import { hasLineOfSight } from '../utils/Geometry.js';
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
    this.memoryTimer = 0;
    this.lastAwarenessInput = null;
  }

  update(deltaTime, player, tileMap, flashlight) {
    const e = this.enemy;
    this.stateTimer += deltaTime;

    const illuminated = Visibility.isIlluminated(e.x, e.y, flashlight, tileMap);
    const distToPlayer = distance(e.x, e.y, player.x, player.y);
    const awarenessInput = this._getAwarenessInput(player, tileMap, flashlight, illuminated, distToPlayer);
    this.lastAwarenessInput = awarenessInput;

    // State transitions
    switch (e.state) {
      case ENEMY_STATE.DORMANT:
        this._updateDormant(deltaTime, awarenessInput, player);
        break;
      case ENEMY_STATE.AWARE:
        this._updateAware(deltaTime, awarenessInput, player);
        break;
      case ENEMY_STATE.ILLUMINATED:
        this._updateIlluminated(deltaTime, awarenessInput, player);
        break;
      case ENEMY_STATE.ALERT:
        this._updateAlert(deltaTime, awarenessInput, player);
        break;
      case ENEMY_STATE.HUNTING:
        this._updateHunting(deltaTime, awarenessInput, player);
        break;
      case ENEMY_STATE.SEARCHING:
        this._updateSearching(deltaTime, awarenessInput, player);
        break;
      case ENEMY_STATE.LOST:
        this._updateLost(deltaTime, awarenessInput, player);
        break;
    }

  }

  _cfg() {
    return CONFIG.enemy.archetypes[this.enemy.archetype] || CONFIG.enemy.archetypes[ENEMY_ARCHETYPE.STALKER];
  }

  _getAwarenessInput(player, tileMap, flashlight, illuminated, distToPlayer) {
    const cfg = this._cfg();
    const hasLos = hasLineOfSight(this.enemy.x, this.enemy.y, player.x, player.y, tileMap, tileMap.tileSize);
    const playerNoisy = player.isSprinting && player.isMoving;
    const close = distToPlayer <= cfg.proximityRange;
    const visible = hasLos && distToPlayer <= cfg.losRange;
    const noisy = playerNoisy && distToPlayer <= cfg.sprintRange;
    let gain = 0;

    if (illuminated) gain += cfg.illuminationGain;
    if (close && hasLos) gain += cfg.awarenessGain * (1 - distToPlayer / cfg.proximityRange);
    if (visible) gain += cfg.losGain * (1 - distToPlayer / cfg.losRange);
    if (noisy) gain += cfg.sprintGain * (1 - distToPlayer / cfg.sprintRange) * (hasLos ? 1 : 0.38);

    return {
      gain: Math.max(0, gain),
      illuminated,
      hasLos,
      close,
      visible,
      noisy,
      distToPlayer,
    };
  }

  _rememberPlayer(player) {
    this.enemy.lastKnownPlayerX = player.x;
    this.enemy.lastKnownPlayerY = player.y;
    this.memoryTimer = CONFIG.enemy.memoryTime;
  }

  _lookAtPlayer(player) {
    this.headAngle = angleBetween(this.enemy.x, this.enemy.y, player.x, player.y);
    this.enemy.facingAngle = this.headAngle;
  }

  _enterAware(player) {
    if (this.enemy.state !== ENEMY_STATE.AWARE) {
      this.enemy.state = ENEMY_STATE.AWARE;
      this.stateTimer = 0;
      this.enemy.twitch = Math.max(this.enemy.twitch, 0.18);
    }
    this._rememberPlayer(player);
    this._lookAtPlayer(player);
  }

  _enterIlluminated(player) {
    this.freezeTimer = this.enemy.archetype === ENEMY_ARCHETYPE.RUNNER ? 0.12 : 0.25;
    this.enemy.state = ENEMY_STATE.ILLUMINATED;
    this.stateTimer = 0;
    this.detectionTimer = Math.max(0, this.detectionTimer);
    this.wasIlluminated = true;
    this._rememberPlayer(player);
    this._lookAtPlayer(player);
  }

  _enterAlert(player) {
    this.enemy.state = ENEMY_STATE.ALERT;
    this.stateTimer = 0;
    this.enemy.awareness = 1;
    this.enemy.twitch = 0.4;
    this.enemy.shouldEmitAlert = true;
    this._rememberPlayer(player);
    this._lookAtPlayer(player);
  }

  _enterSearching(playerX = this.enemy.lastKnownPlayerX, playerY = this.enemy.lastKnownPlayerY) {
    this.enemy.state = ENEMY_STATE.SEARCHING;
    this.stateTimer = 0;
    this._generateSearchPoints(playerX, playerY);
  }

  _updateDormant(deltaTime, input, player) {
    this.enemy.idlePhase += deltaTime;

    if (input.illuminated) {
      this._enterIlluminated(player);
      return;
    }

    if (input.gain > 0) {
      this.enemy.awareness = clamp(this.enemy.awareness + input.gain * deltaTime, 0, 1);
      if (input.hasLos || input.noisy) this._rememberPlayer(player);
      if (input.hasLos || input.close) this._lookAtPlayer(player);
      if (this.enemy.awareness >= this._cfg().awarenessThreshold) {
        this._enterAware(player);
      }
      return;
    }

    this.enemy.awareness = Math.max(0, this.enemy.awareness - CONFIG.enemy.awarenessDecay * deltaTime);
  }

  _updateAware(deltaTime, input, player) {
    const cfg = this._cfg();

    if (input.illuminated) {
      this._enterIlluminated(player);
      return;
    }

    if (input.gain > 0) {
      this.enemy.awareness = clamp(this.enemy.awareness + input.gain * deltaTime * 0.9, 0, 1);
      if (input.hasLos || input.noisy) this._rememberPlayer(player);
      this._lookAtPlayer(player);
    } else {
      this.enemy.awareness = Math.max(cfg.awarenessThreshold * 0.5, this.enemy.awareness - CONFIG.enemy.awarenessDecay * 0.35 * deltaTime);
    }

    const commitTime = this.enemy.archetype === ENEMY_ARCHETYPE.WATCHER ? 1.1 : 0.55;
    if (this.enemy.awareness >= 1 || (this.stateTimer >= commitTime && (input.hasLos || input.noisy || input.close))) {
      this._enterAlert(player);
      return;
    }

    this.enemy.targetX = this.enemy.lastKnownPlayerX;
    this.enemy.targetY = this.enemy.lastKnownPlayerY;
  }

  _updateIlluminated(deltaTime, input, player) {
    this._lookAtPlayer(player);
    this._rememberPlayer(player);

    if (this.freezeTimer > 0) {
      this.freezeTimer -= deltaTime;
      return;
    }

    this.detectionTimer += deltaTime * (input.illuminated ? 1 : 0.45);

    if (this.detectionTimer >= this._cfg().detectionTime) {
      this._enterAlert(player);
      return;
    }

    if (!input.illuminated && this.detectionTimer > 0.18) {
      this._enterAware(player);
    }
  }

  _updateAlert(deltaTime, input, player) {
    this._lookAtPlayer(player);
    if (input.hasLos || input.illuminated || input.noisy) this._rememberPlayer(player);

    if (this.stateTimer >= this._cfg().alertTime) {
      this.enemy.state = ENEMY_STATE.HUNTING;
      this.stateTimer = 0;
    }
  }

  _updateHunting(deltaTime, input, player) {
    if (input.hasLos || input.illuminated) {
      this._rememberPlayer(player);
      this._lookAtPlayer(player);
      return;
    }

    this.memoryTimer -= deltaTime;
    if (this.memoryTimer <= 0) {
      this._enterSearching();
    }
  }

  _updateSearching(deltaTime, input, player) {
    if (input.illuminated || (input.hasLos && (input.close || input.visible)) || input.noisy) {
      this._enterAlert(player);
      return;
    }

    if (this.stateTimer >= this._cfg().searchTime) {
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
    this.enemy.facingAngle = angleBetween(this.enemy.x, this.enemy.y, this.enemy.targetX, this.enemy.targetY);
  }

  _updateLost(deltaTime, input, player) {
    if (input.illuminated || (input.hasLos && (input.close || input.visible)) || input.noisy) {
      this._enterAware(player);
      return;
    }

    if (this.stateTimer >= this._cfg().lostTime) {
      this.enemy.state = ENEMY_STATE.DORMANT;
      this.stateTimer = 0;
      this.enemy.awareness = 0;
      this.wasIlluminated = false;
      this.enemy.shouldEmitAlert = false;
    }
  }

  _generateSearchPoints(px, py) {
    this.searchPoints = [];
    const r = this._cfg().searchRadius;
    const offsets = [
      { x: 0, y: 0 },
      { x: r, y: 0 }, { x: -r, y: 0 },
      { x: 0, y: r }, { x: 0, y: -r },
      { x: r * 0.65, y: r * 0.65 },
    ];
    for (const o of offsets) {
      this.searchPoints.push({ x: px + o.x, y: py + o.y });
    }
    this.searchIndex = 0;
  }

  getMoveTarget() {
    const e = this.enemy;
    switch (e.state) {
      case ENEMY_STATE.AWARE:
        if (e.archetype === ENEMY_ARCHETYPE.WATCHER) return null;
        return { x: e.lastKnownPlayerX, y: e.lastKnownPlayerY };
      case ENEMY_STATE.HUNTING:
        return { x: e.lastKnownPlayerX, y: e.lastKnownPlayerY };
      case ENEMY_STATE.SEARCHING:
        return { x: e.targetX, y: e.targetY };
      default:
        return null;
    }
  }

  getSpeed() {
    const cfg = this._cfg();
    switch (this.enemy.state) {
      case ENEMY_STATE.AWARE:
        return cfg.stationary ? 0 : CONFIG.enemy.walkSpeed * 0.42 * this.enemy.speedMultiplier;
      case ENEMY_STATE.HUNTING:
        return cfg.chaseSpeed * this.enemy.speedMultiplier;
      case ENEMY_STATE.SEARCHING:
        return cfg.huntSpeed * this.enemy.speedMultiplier;
      case ENEMY_STATE.ALERT:
        return 0;
      default:
        return CONFIG.enemy.walkSpeed * 0.3 * this.enemy.speedMultiplier;
    }
  }

  shouldPlayFootstep() {
    return this.enemy.state === ENEMY_STATE.HUNTING || this.enemy.state === ENEMY_STATE.SEARCHING || this.enemy.state === ENEMY_STATE.AWARE;
  }
}
