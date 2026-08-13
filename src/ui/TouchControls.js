export class TouchControls {
  constructor(input) {
    this.input = input;
    this.container = document.getElementById('touch-controls');
    this.moveZone = document.getElementById('touch-move-zone');
    this.moveStick = document.getElementById('touch-move-stick');
    this.aimZone = document.getElementById('touch-aim-zone');
    this.flashlightBtn = document.getElementById('touch-flashlight');
    this.sprintBtn = document.getElementById('touch-sprint');

    this.moveTouchId = null;
    this.aimTouchId = null;
    this.moveCenter = { x: 0, y: 0 };
    this.aimCenter = { x: 0, y: 0 };
    this.maxRadius = 40;

    this._bind();
  }

  show() {
    if (window.innerWidth <= 767) {
      this.container.classList.remove('hidden');
    }
  }

  hide() {
    this.container.classList.add('hidden');
  }

  _bind() {
    this.moveZone.addEventListener('touchstart', (e) => this._onMoveStart(e), { passive: false });
    this.moveZone.addEventListener('touchmove', (e) => this._onMoveMove(e), { passive: false });
    this.moveZone.addEventListener('touchend', (e) => this._onMoveEnd(e));

    this.aimZone.addEventListener('touchstart', (e) => this._onAimStart(e), { passive: false });
    this.aimZone.addEventListener('touchmove', (e) => this._onAimMove(e), { passive: false });
    this.aimZone.addEventListener('touchend', (e) => this._onAimEnd(e));

    this.flashlightBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.input.setTouchFlashlight(true);
      this.flashlightBtn.classList.add('active');
    }, { passive: false });

    this.flashlightBtn.addEventListener('touchend', () => {
      this.input.setTouchFlashlight(false);
      this.flashlightBtn.classList.remove('active');
    });

    this.sprintBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.input.setTouchSprint(true);
      this.sprintBtn.classList.add('active');
    }, { passive: false });

    this.sprintBtn.addEventListener('touchend', () => {
      this.input.setTouchSprint(false);
      this.sprintBtn.classList.remove('active');
    });
  }

  _onMoveStart(e) {
    e.preventDefault();
    const touch = e.changedTouches[0];
    this.moveTouchId = touch.identifier;
    const rect = this.moveZone.getBoundingClientRect();
    this.moveCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    this._updateMoveStick(touch.clientX, touch.clientY);
  }

  _onMoveMove(e) {
    e.preventDefault();
    for (const touch of e.changedTouches) {
      if (touch.identifier === this.moveTouchId) {
        this._updateMoveStick(touch.clientX, touch.clientY);
      }
    }
  }

  _onMoveEnd(e) {
    for (const touch of e.changedTouches) {
      if (touch.identifier === this.moveTouchId) {
        this.moveTouchId = null;
        this.input.setTouchMove(0, 0, false);
        this.moveStick.style.transform = 'translate(-50%, -50%)';
      }
    }
  }

  _updateMoveStick(clientX, clientY) {
    let dx = clientX - this.moveCenter.x;
    let dy = clientY - this.moveCenter.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > this.maxRadius) {
      dx = (dx / dist) * this.maxRadius;
      dy = (dy / dist) * this.maxRadius;
    }
    this.moveStick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

    const nx = dx / this.maxRadius;
    const ny = dy / this.maxRadius;
    this.input.setTouchMove(nx, ny, dist > 5);
  }

  _onAimStart(e) {
    e.preventDefault();
    const touch = e.changedTouches[0];
    this.aimTouchId = touch.identifier;
    const rect = this.aimZone.getBoundingClientRect();
    this.aimCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    this._updateAim(touch.clientX, touch.clientY);
  }

  _onAimMove(e) {
    e.preventDefault();
    for (const touch of e.changedTouches) {
      if (touch.identifier === this.aimTouchId) {
        this._updateAim(touch.clientX, touch.clientY);
      }
    }
  }

  _onAimEnd(e) {
    for (const touch of e.changedTouches) {
      if (touch.identifier === this.aimTouchId) {
        this.aimTouchId = null;
        this.input.setTouchAim(0, 0, false);
      }
    }
  }

  _updateAim(clientX, clientY) {
    const dx = clientX - this.aimCenter.x;
    const dy = clientY - this.aimCenter.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 5) {
      this.input.setTouchAim(dx / dist, dy / dist, true);
    }
  }
}
