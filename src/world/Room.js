import { CONFIG } from '../utils/Constants.js';

export class Room {
  constructor(data) {
    this.tileMap = data.tileMap;
    this.spawn = data.spawn;
    this.exit = data.exit;
    this.fuse = data.fuse || data.objective;
    this.generator = data.generator || data.spawn;
    this.objective = this.fuse;
    this.enemySpawns = data.enemySpawns;
    this.decor = data.decor || [];
    this.landmarks = data.landmarks || [];
    this.envLights = data.envLights || [];
    this.seed = data.seed;
    this.roomType = data.roomType;
    this.theme = data.theme;
    this.themeLabel = data.themeLabel || '';
    this.roomNumber = data.roomNumber;
    this.exitUnlocked = false;
    this.fuseCollected = false;
    this.generatorActive = false;
  }

  unlockExit() {
    this.exitUnlocked = true;
  }

  isAtExit(playerX, playerY, radius = 16) {
    if (!this.exitUnlocked) return false;
    const dx = playerX - this.exit.x;
    const dy = playerY - this.exit.y;
    return dx * dx + dy * dy < (radius + 20) ** 2;
  }

  isAtObjective(playerX, playerY, radius = 16) {
    return this.isAtFuse(playerX, playerY, radius);
  }

  getFusePickupRadius(playerRadius = CONFIG.player.radius) {
    return playerRadius + CONFIG.objective.fusePickupExtra;
  }

  getGeneratorPickupRadius(playerRadius = CONFIG.player.radius) {
    return playerRadius + CONFIG.objective.generatorPickupExtra;
  }

  isAtFuse(playerX, playerY, radius = 16) {
    if (this.fuseCollected || !this.fuse) return false;
    const dx = playerX - this.fuse.x;
    const dy = playerY - this.fuse.y;
    const pickupRadius = this.getFusePickupRadius(radius);
    return dx * dx + dy * dy < pickupRadius * pickupRadius;
  }

  isNearFuse(playerX, playerY, radius = 16) {
    if (this.fuseCollected || !this.fuse) return false;
    const dx = playerX - this.fuse.x;
    const dy = playerY - this.fuse.y;
    return dx * dx + dy * dy < (radius + 86) ** 2;
  }

  isAtGenerator(playerX, playerY, radius = 16) {
    if (!this.generator || this.generatorActive) return false;
    const dx = playerX - this.generator.x;
    const dy = playerY - this.generator.y;
    const pickupRadius = this.getGeneratorPickupRadius(radius);
    return dx * dx + dy * dy < pickupRadius * pickupRadius;
  }

  isNearGenerator(playerX, playerY, radius = 16) {
    if (!this.generator || this.generatorActive) return false;
    const dx = playerX - this.generator.x;
    const dy = playerY - this.generator.y;
    return dx * dx + dy * dy < (radius + 120) ** 2;
  }
}
