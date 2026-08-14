export class HUD {
  constructor() {
    this.hudEl = document.getElementById('hud');
    this.objectiveText = document.getElementById('hud-objective-text');
    this.objectiveHint = document.getElementById('hud-objective-hint');
    this.objectiveBadge = document.getElementById('hud-objective-badge');
    this.interactionPrompt = document.getElementById('hud-interaction');
    this.staminaFill = document.getElementById('hud-stamina-fill');
    this.flashlightFill = document.getElementById('hud-flashlight-fill');
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

  updateInteractionPrompt(text = '') {
    if (!this.interactionPrompt) return;
    if (text) {
      this.interactionPrompt.textContent = text;
      this.interactionPrompt.classList.remove('hidden');
    } else {
      this.interactionPrompt.textContent = '';
      this.interactionPrompt.classList.add('hidden');
    }
  }

  updateStamina(percent, state = 'normal') {
    this._updateMeter(this.staminaFill, percent, state);
  }

  updateFlashlight(percent, state = 'normal') {
    this._updateMeter(this.flashlightFill, percent, state);
  }

  _updateMeter(fill, percent, state) {
    if (!fill) return;
    const pct = Math.max(0, Math.min(100, percent * 100));
    fill.style.width = `${pct}%`;
    fill.classList.toggle('low', state === 'low');
    fill.classList.toggle('warning', state === 'warning');
    fill.classList.toggle('critical', state === 'critical' || state === 'empty');
  }

  showRoomTransition(roomNumber, themeLabel) {
    if (!this.roomTransition) return;
    this.roomTransitionTitle.textContent = `ROOM ${String(roomNumber).padStart(2, '0')}`;
    this.roomTransitionSub.textContent = themeLabel || '';
    this.roomTransition.classList.add('visible');
    setTimeout(() => this.roomTransition.classList.remove('visible'), 1800);
  }
}
