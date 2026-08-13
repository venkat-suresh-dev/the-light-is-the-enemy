export class Tutorial {
  constructor() {
    this.overlay = document.getElementById('tutorial-overlay');
    this.textEl = document.getElementById('tutorial-text');
    this.active = false;
    this.phase = 0;
    this.timer = 0;
    this.completed = false;
    this._onMove = false;
    this._onLight = false;
    this._onEnemy = false;
  }

  reset() {
    this.phase = 0;
    this.timer = 0;
    this.completed = false;
    this._onMove = false;
    this._onLight = false;
    this._onEnemy = false;
    this.hide();
  }

  start() {
    this.active = true;
    this.overlay.classList.remove('hidden');
    this.showText("It's too dark.");
    this.timer = 0;
    this.phase = 0;
  }

  showText(text, duration = 2) {
    this.textEl.textContent = text;
    this.textEl.classList.add('visible');
    this._textDuration = duration;
    this._textTimer = 0;
  }

  hide() {
    this.overlay.classList.add('hidden');
    this.textEl.classList.remove('visible');
    this.active = false;
  }

  update(deltaTime, player, enemyAlerted) {
    if (!this.active || this.completed) return;

    this._textTimer += deltaTime;
    if (this._textTimer >= this._textDuration) {
      this.textEl.classList.remove('visible');
    }

    this.timer += deltaTime;

    switch (this.phase) {
      case 0:
        if (this.timer > 2.5) {
          this.phase = 1;
          this.showText('Move', 3);
        }
        break;
      case 1:
        if (player.isMoving) {
          this._onMove = true;
          this.phase = 2;
          this.timer = 0;
          this.showText('You need to see.', 2);
        }
        break;
      case 2:
        if (this.timer > 2) {
          this.phase = 3;
          this.showText('Light', 3);
        }
        break;
      case 3:
        if (player.flashlight.isOn) {
          this._onLight = true;
          this.phase = 4;
          this.timer = 0;
        }
        break;
      case 4:
        if (enemyAlerted) {
          this.phase = 5;
          this.showText('...', 2);
        } else if (this.timer > 12) {
          this.phase = 5;
          this.showText('...', 2);
        }
        break;
      case 5:
        if (this.timer > 3) {
          this.completed = true;
          this.hide();
        }
        break;
    }
  }
}
