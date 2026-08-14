/**
 * Contextual hint system — short, temporary, escalating guidance.
 */
export class HintSystem {
  constructor() {
    this.overlay = document.getElementById('hint-overlay');
    this.textEl = document.getElementById('hint-text');
    this.subEl = document.getElementById('hint-sub');
    this.shown = new Set();
    this._timer = 0;
    this._visible = false;
    this._duration = 0;
    this._stuckTimer = 0;
    this._hintLevel = 0;
    this._phase = 'findFuse';
    this._gameTime = 0;
    this._phaseTime = 0;
  }

  reset() {
    this.shown.clear();
    this._stuckTimer = 0;
    this._hintLevel = 0;
    this._phase = 'findFuse';
    this._phaseTime = 0;
    this.hide();
  }

  update(deltaTime, player, objectivePhase, room) {
    if (objectivePhase !== this._phase) {
      this._phase = objectivePhase;
      this._phaseTime = 0;
    } else {
      this._phaseTime += deltaTime;
    }
    this._gameTime += deltaTime;

    if (this._visible) {
      this._timer += deltaTime;
      if (this._timer >= this._duration) this.hide();
    }

    if (!this.shown.has('move') && player.isMoving) {
      this.shown.add('move');
    } else if (!this.shown.has('move') && this._gameTime > 5) {
      this.show('MOVE', 'W A S D', 3);
      this.shown.add('move');
    }

    if (this.shown.has('move') && !this.shown.has('flashlight') && !player.flashlight.isOn) {
      if (this._gameTime > 10) {
        this.show('FLASHLIGHT', 'Hold left mouse to see. They can see you too.', 4);
        this.shown.add('flashlight');
      }
    }

    if (player.flashlight.isOn) this.shown.add('flashlight');

    if (objectivePhase === 'findFuse' && !this.shown.has('objective_hint')) {
      if (this._phaseTime > 35) {
        this.show('HINT', 'Look for an electrical panel or fuse housing.', 4);
        this.shown.add('objective_hint');
      }
    }

    if (objectivePhase === 'findFuse' && this.shown.has('objective_hint') && !this.shown.has('objective_hint_2')) {
      if (this._phaseTime > 70) {
        this.show('HINT', 'The fuse should be near maintenance equipment, not in an empty corner.', 5);
        this.shown.add('objective_hint_2');
      }
    }

    if (objectivePhase === 'findGenerator' && !this.shown.has('generator_hint')) {
      if (this._phaseTime > 35) {
        this.show('BACKUP POWER', 'Follow cables and electrical panels to the generator.', 4);
        this.shown.add('generator_hint');
      }
    }

    if (objectivePhase === 'findGenerator' && this.shown.has('generator_hint') && !this.shown.has('generator_hint_2')) {
      if (this._phaseTime > 70) {
        this.show('BACKUP POWER', 'Listen and look for the larger machine with the pulsing indicator.', 5);
        this.shown.add('generator_hint_2');
      }
    }
  }

  show(title, text, duration = 3) {
    if (!this.overlay) return;
    this.overlay.classList.remove('hidden');
    if (this.textEl) this.textEl.textContent = title;
    if (this.subEl) this.subEl.textContent = text;
    this.overlay.classList.add('visible');
    this._visible = true;
    this._timer = 0;
    this._duration = duration;
  }

  hide() {
    if (!this.overlay) return;
    this.overlay.classList.remove('visible');
    setTimeout(() => {
      if (!this._visible) this.overlay.classList.add('hidden');
    }, 600);
    this._visible = false;
  }
}
