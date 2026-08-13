import { CONFIG } from '../utils/Constants.js';

export class Room {
  constructor(data) {
    this.tileMap = data.tileMap;
    this.spawn = data.spawn;
    this.exit = data.exit;
    this.objective = data.objective;
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
    const dx = playerX - this.objective.x;
    const dy = playerY - this.objective.y;
    return dx * dx + dy * dy < (radius + 16) ** 2;
  }
}
