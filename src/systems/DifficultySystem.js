import { CONFIG } from '../utils/Constants.js';

export class DifficultySystem {
  constructor() {
    this.roomNumber = 1;
  }

  setRoom(roomNumber) {
    this.roomNumber = roomNumber;
  }

  getEnemySpeedMultiplier() {
    return 1 + (this.roomNumber - 1) * CONFIG.difficulty.speedScalePerRoom;
  }

  getEnemyCount() {
    return Math.min(
      CONFIG.difficulty.baseEnemyCount + Math.floor((this.roomNumber - 1) / 3),
      CONFIG.difficulty.maxEnemyCount
    );
  }

  getBatteryDrainRate() {
    let rate = CONFIG.flashlight.drainRate * (1 + (this.roomNumber - 1) * CONFIG.difficulty.batteryDrainScale);
    if (this.roomNumber <= CONFIG.difficulty.earlyRoomCount) {
      rate *= CONFIG.difficulty.earlyRoomBatteryMultiplier;
    }
    return rate;
  }

  getHeartbeatIntensity(distance) {
    if (distance > 400) return 0;
    if (distance > 250) return 0.1;
    if (distance > 150) return 0.3;
    if (distance > 80) return 0.6;
    return 0.9;
  }

  getRoomSeed(baseSeed, roomNumber) {
    return (baseSeed + roomNumber * 7919) >>> 0;
  }
}
