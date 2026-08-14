import { Enemy } from './Enemy.js';
import { ENEMY_STATE } from '../utils/Constants.js';
import { Visibility } from '../world/Visibility.js';
import { distance } from '../utils/MathUtils.js';

export class EnemyManager {
  constructor(events) {
    this.events = events;
    this.enemies = [];
    this.tileMap = null;
  }

  spawnEnemies(spawns, speedMultiplier = 1) {
    this.enemies = spawns.map((pos, i) => {
      const enemy = new Enemy(pos.x, pos.y, i);
      enemy.speedMultiplier = speedMultiplier;
      return enemy;
    });
  }

  setTileMap(tileMap) {
    this.tileMap = tileMap;
  }

  update(deltaTime, player, flashlight) {
    if (!this.tileMap) return;

    let closestDist = Infinity;
    let closestEnemy = null;

    for (const enemy of this.enemies) {
      const result = enemy.update(deltaTime, player, this.tileMap, flashlight);
      enemy.visible = Visibility.isIlluminated(enemy.x, enemy.y, flashlight, this.tileMap);

      if (enemy.visible && !enemy.wasVisible) {
        this.events.emit('enemyIlluminated', { enemy, player });
      }
      enemy.wasVisible = enemy.visible;

      const dist = distance(enemy.x, enemy.y, player.x, player.y);
      if (dist < closestDist) {
        closestDist = dist;
        closestEnemy = enemy;
      }

      if (enemy.shouldEmitAlert) {
        enemy.shouldEmitAlert = false;
        enemy.eyeFlash = 0.5;
        this.events.emit('enemyAlerted', { enemy, player });
      }

      if (enemy.state === ENEMY_STATE.HUNTING && enemy.ai.stateTimer < 0.05) {
        this.events.emit('enemyDetectedPlayer', { enemy, player });
      }

      if (result === 'attack') {
        this.events.emit('playerDamaged', { enemy, player });
        return 'playerDead';
      }
    }

    this.events.emit('enemyProximity', {
      distance: closestDist,
      enemy: closestEnemy,
    });

    return null;
  }

  getClosestDistance(playerX, playerY) {
    let min = Infinity;
    for (const e of this.enemies) {
      const d = distance(e.x, e.y, playerX, playerY);
      if (d < min) min = d;
    }
    return min;
  }

  getActiveCount() {
    return this.enemies.filter((e) => e.isActive()).length;
  }
}
