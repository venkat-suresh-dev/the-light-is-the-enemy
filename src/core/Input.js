export class Input {
  constructor(canvas, events) {
    this.canvas = canvas;
    this.events = events;
    this.keys = new Set();
    this.keysPressed = new Set();
    this.keysReleased = new Set();

    this.pointer = { x: 0, y: 0, down: false, justPressed: false, justReleased: false };
    this.touchMove = { x: 0, y: 0, active: false };
    this.touchAim = { x: 0, y: 0, active: false };
    this.touchFlashlight = false;
    this.touchFlashlightHeld = false;
    this.touchSprint = false;
    this.isTouchDevice = false;

    this._bindEvents();
  }

  _bindEvents() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (!this.keys.has(e.code)) {
        this.keys.add(e.code);
        this.keysPressed.add(e.code);
      }
      if (e.code === 'Escape') e.preventDefault();
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      this.keysReleased.add(e.code);
    });

    this.canvas.addEventListener('mousemove', (e) => {
      this.pointer.x = e.clientX;
      this.pointer.y = e.clientY;
    });

    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.pointer.down = true;
        this.pointer.justPressed = true;
        this.pointer.x = e.clientX;
        this.pointer.y = e.clientY;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.pointer.down = false;
        this.pointer.justReleased = true;
      }
    });

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Touch via TouchControls module — methods called externally
    document.addEventListener('touchstart', () => {
      this.isTouchDevice = true;
    }, { once: true });
  }

  setTouchMove(x, y, active) {
    this.touchMove.x = x;
    this.touchMove.y = y;
    this.touchMove.active = active;
    if (active) this.isTouchDevice = true;
  }

  setTouchAim(x, y, active) {
    this.touchAim.x = x;
    this.touchAim.y = y;
    this.touchAim.active = active;
    if (active) this.isTouchDevice = true;
  }

  setTouchFlashlight(active) {
    this.touchFlashlightHeld = active;
    if (active) this.isTouchDevice = true;
  }

  setTouchSprint(active) {
    this.touchSprint = active;
    if (active) this.isTouchDevice = true;
  }

  isDown(action) {
    const map = {
      moveUp: ['KeyW', 'ArrowUp'],
      moveDown: ['KeyS', 'ArrowDown'],
      moveLeft: ['KeyA', 'ArrowLeft'],
      moveRight: ['KeyD', 'ArrowRight'],
      sprint: ['ShiftLeft', 'ShiftRight'],
      flashlight: [],
      pause: ['Escape'],
      toggleFlashlight: ['KeyF'],
    };

    if (action === 'sprint' && this.touchSprint) return true;
    if (action === 'flashlight') {
      if (this.touchFlashlightHeld) return true;
      return this.pointer.down;
    }

    const codes = map[action];
    if (!codes) return false;
    return codes.some((c) => this.keys.has(c));
  }

  isPressed(action) {
    const map = {
      moveUp: ['KeyW', 'ArrowUp'],
      moveDown: ['KeyS', 'ArrowDown'],
      moveLeft: ['KeyA', 'ArrowLeft'],
      moveRight: ['KeyD', 'ArrowRight'],
      sprint: ['ShiftLeft', 'ShiftRight'],
      pause: ['Escape'],
      toggleFlashlight: ['KeyF'],
      flashlight: [],
    };

    if (action === 'toggleFlashlight') {
      return map.toggleFlashlight.some((c) => this.keysPressed.has(c));
    }
    if (action === 'flashlight') {
      return this.pointer.justPressed || this.touchFlashlight;
    }
    if (action === 'pause') {
      return map.pause.some((c) => this.keysPressed.has(c));
    }

    const codes = map[action];
    if (!codes) return false;
    return codes.some((c) => this.keysPressed.has(c));
  }

  getMovementVector() {
    let x = 0;
    let y = 0;

    if (this.isDown('moveLeft')) x -= 1;
    if (this.isDown('moveRight')) x += 1;
    if (this.isDown('moveUp')) y -= 1;
    if (this.isDown('moveDown')) y += 1;

    if (this.touchMove.active) {
      x = this.touchMove.x;
      y = this.touchMove.y;
    }

    const len = Math.sqrt(x * x + y * y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { x, y };
  }

  getAimAngle(cameraX, cameraY, scale) {
    if (this.touchAim.active) {
      const len = Math.sqrt(this.touchAim.x ** 2 + this.touchAim.y ** 2);
      if (len > 0.1) {
        return Math.atan2(this.touchAim.y, this.touchAim.x);
      }
    }

    const rect = this.canvas.getBoundingClientRect();
    const screenX = this.pointer.x - rect.left;
    const screenY = this.pointer.y - rect.top;
    const worldX = (screenX - rect.width / 2) / scale + cameraX;
    const worldY = (screenY - rect.height / 2) / scale + cameraY;
    return Math.atan2(worldY - cameraY, worldX - cameraX);
  }

  endFrame() {
    this.keysPressed.clear();
    this.keysReleased.clear();
    this.pointer.justPressed = false;
    this.pointer.justReleased = false;
  }
}
