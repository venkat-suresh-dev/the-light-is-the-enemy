import { CONFIG } from '../utils/Constants.js';
import { clamp, distance } from '../utils/MathUtils.js';
import { hasLineOfSight } from '../utils/Geometry.js';

export class ThreatSystem {
  constructor() {
    this.intensity = 0;
    this.raw = 0;
  }

  reset() {
    this.intensity = 0;
    this.raw = 0;
  }

  update(deltaTime, enemies, player, tileMap) {
    const cfg = CONFIG.threat;
    let primary = 0;
    let extra = 0;

    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      const dist = distance(enemy.x, enemy.y, player.x, player.y);
      const span = cfg.maxDistance - cfg.nearDistance;
      const linear = span > 0 ? clamp((cfg.maxDistance - dist) / span, 0, 1) : 0;
      const proximity = linear * linear;
      if (proximity <= 0) continue;

      const weight = cfg.stateWeights[enemy.state] ?? 0.1;
      const los = tileMap
        ? hasLineOfSight(player.x, player.y, enemy.x, enemy.y, tileMap, tileMap.tileSize)
        : true;

      let contrib = proximity * weight;
      if (!los) contrib *= cfg.occludedScale;
      if (enemy.visible) {
        contrib = clamp(contrib + cfg.illuminatedBonus * proximity, 0, 1);
      }

      if (contrib > primary) {
        extra += primary * cfg.secondaryEnemyScale;
        primary = contrib;
      } else {
        extra += contrib * cfg.secondaryEnemyScale;
      }
    }

    let raw = clamp(primary + extra, 0, 1);
    if (player.isSprinting && player.isMoving) {
      raw = clamp(raw + cfg.sprintBonus, 0, 1);
    }

    this.raw = raw;

    const rate = raw > this.intensity ? cfg.riseRate : cfg.fallRate;
    const t = 1 - Math.exp(-rate * Math.max(0, deltaTime));
    this.intensity += (raw - this.intensity) * t;
    if (this.intensity < 0.002 && raw < 0.002) this.intensity = 0;
    this.intensity = clamp(this.intensity, 0, 1);
  }
}
