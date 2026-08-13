export class HUD {
  constructor() {
    this.hudEl = document.getElementById('hud');
    this.objectiveText = document.getElementById('hud-objective-text');
    this.objectiveHint = document.getElementById('hud-objective-hint');
    this.objectiveBadge = document.getElementById('hud-objective-badge');
    this.batteryFill = document.getElementById('hud-battery-fill');
    this.roomTransition = document.getElementById('room-transition');
    this.roomTransitionTitle = document.getElementById('room-transition-title');
    this.roomTransitionSub = document.getElementById('room-transition-sub');
  }

  show() {
    this.hudEl.classList.remove('hidden');
  }

  hide() {
    this.hudEl.classList.add('hidden');
  }

  updateObjective(text, hint = '', updated = false) {
    this.objectiveText.textContent = text;
    if (this.objectiveHint) {
      this.objectiveHint.textContent = hint;
    }
    if (updated && this.objectiveBadge) {
      this.objectiveBadge.classList.add('visible');
      setTimeout(() => this.objectiveBadge.classList.remove('visible'), 2500);
    }
  }

  updateBattery(percent) {
    const pct = Math.max(0, Math.min(100, percent * 100));
    this.batteryFill.style.width = `${pct}%`;
    this.batteryFill.classList.toggle('low', pct < 25);
  }

  showRoomTransition(roomNumber, themeLabel) {
    if (!this.roomTransition) return;
    this.roomTransitionTitle.textContent = `ROOM ${String(roomNumber).padStart(2, '0')}`;
    this.roomTransitionSub.textContent = themeLabel || '';
    this.roomTransition.classList.add('visible');
    setTimeout(() => this.roomTransition.classList.remove('visible'), 1800);
  }
}
