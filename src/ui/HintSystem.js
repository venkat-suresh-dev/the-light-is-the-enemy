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
    this._phase = 'find';
    this._gameTime = 0;
  }

  reset() {
    this.shown.clear();
    this._stuckTimer = 0;
    this._hintLevel = 0;
    this._phase = 'find';
    this.hide();
  }

  update(deltaTime, player, objectivePhase, room) {
    this._phase = objectivePhase;
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

    if (objectivePhase === 'find' && !this.shown.has('objective_hint')) {
      if (this._gameTime > 40) {
        this.show('HINT', 'Search maintenance equipment and panels.', 4);
        this.shown.add('objective_hint');
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
