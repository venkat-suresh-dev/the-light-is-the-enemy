export class CameraShake {
  constructor() {
    this.offsetX = 0;
    this.offsetY = 0;
    this.intensity = 0;
    this.duration = 0;
    this._timer = 0;
    this.enabled = true;
  }

  add(amount, duration = 0.3) {
    if (!this.enabled) return;
    this.intensity = Math.max(this.intensity, amount);
    this.duration = Math.max(this.duration, duration);
    this._timer = 0;
  }

  update(deltaTime) {
    if (this.duration <= 0) {
      this.offsetX = 0;
      this.offsetY = 0;
      return;
    }

    this._timer += deltaTime;
    if (this._timer >= this.duration) {
      this.intensity = 0;
      this.duration = 0;
      this.offsetX = 0;
      this.offsetY = 0;
      return;
    }

    const decay = 1 - this._timer / this.duration;
    const shake = this.intensity * decay;
    this.offsetX = (Math.random() - 0.5) * shake * 20;
    this.offsetY = (Math.random() - 0.5) * shake * 20;
  }
}
