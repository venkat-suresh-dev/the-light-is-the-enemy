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
    let rate = CONFIG.flashlight.power.drainRate * (1 + (this.roomNumber - 1) * CONFIG.difficulty.batteryDrainScale);
    if (this.roomNumber <= CONFIG.difficulty.earlyRoomCount) {
      rate *= CONFIG.difficulty.earlyRoomBatteryMultiplier;
    }
    return rate;
  }

  getRoomSeed(baseSeed, roomNumber) {
    return (baseSeed + roomNumber * 7919) >>> 0;
  }
}
