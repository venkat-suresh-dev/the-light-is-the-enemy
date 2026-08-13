import { formatTime } from '../utils/MathUtils.js';

export class DeathScreen {
  constructor() {
    this.screen = document.getElementById('death-screen');
    this.mainText = document.getElementById('death-main-text');
    this.statsText = document.getElementById('death-stats');
    this.btnRetry = document.getElementById('btn-retry');
    this.btnMenu = document.getElementById('btn-death-menu');
    this.visible = false;
    this._delayTimer = 0;
    this._showing = false;
    this._pendingData = null;
  }

  onRetry(callback) {
    this.btnRetry.addEventListener('click', callback);
  }

  onMenu(callback) {
    this.btnMenu.addEventListener('click', callback);
  }

  trigger(roomNumber, survivalTime) {
    this._pendingData = { roomNumber, survivalTime };
    this._delayTimer = 0;
    this._showing = false;
    this.screen.classList.add('hidden');
    this.visible = true;
  }

  update(deltaTime) {
    if (!this.visible || this._showing) return;

    this._delayTimer += deltaTime;
    if (this._delayTimer >= 2.5) {
      this._showing = true;
      const { roomNumber, survivalTime } = this._pendingData;
      this.mainText.textContent = 'YOU WERE SEEN';
      this.statsText.textContent = `ROOM ${String(roomNumber).padStart(2, '0')}\nSURVIVAL TIME ${formatTime(survivalTime)}`;
      this.screen.classList.remove('hidden');
    }
  }

  hide() {
    this.screen.classList.add('hidden');
    this.visible = false;
    this._showing = false;
  }
}
