export class GameLoop {
  constructor(updateFn, renderFn) {
    this.updateFn = updateFn;
    this.renderFn = renderFn;
    this.running = false;
    this._rafId = null;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._rafId = requestAnimationFrame(this._loop);
  }

  stop() {
    this.running = false;
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  _loop = (timestamp) => {
    if (!this.running) return;
    this.updateFn(timestamp);
    this.renderFn();
    this._rafId = requestAnimationFrame(this._loop);
  };
}
