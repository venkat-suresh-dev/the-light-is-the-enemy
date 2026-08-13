import { CONFIG } from '../utils/Constants.js';

export class Particles {
  constructor() {
    this.particles = [];
    this.dustParticles = [];
    this._initDust();
  }

  _initDust() {
    for (let i = 0; i < 30; i++) {
      this.dustParticles.push({
        x: Math.random(),
        y: Math.random(),
        size: Math.random() * 2 + 0.5,
        speed: Math.random() * 0.3 + 0.1,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  add(x, y, count = 5) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 40,
        vy: (Math.random() - 0.5) * 40,
        life: 0.5 + Math.random() * 0.5,
        maxLife: 0.5 + Math.random() * 0.5,
        size: Math.random() * 3 + 1,
      });
    }
  }

  update(deltaTime) {
    for (const p of this.particles) {
      p.x += p.vx * deltaTime;
      p.y += p.vy * deltaTime;
      p.life -= deltaTime;
      p.vy += 20 * deltaTime;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    for (const d of this.dustParticles) {
      d.phase += deltaTime * d.speed;
    }
  }

  renderDust(ctx, flashlight, cameraX, cameraY, scale, viewW, viewH) {
    if (!flashlight.isOn) return;

    ctx.save();
    for (const d of this.dustParticles) {
      const worldX = cameraX + (d.x - 0.5) * viewW / scale;
      const worldY = cameraY + (d.y - 0.5) * viewH / scale;
      const screenX = (worldX - cameraX) * scale + viewW / 2;
      const screenY = (worldY - cameraY) * scale + viewH / 2;

      const brightness = Math.sin(d.phase) * 0.3 + 0.2;
      ctx.globalAlpha = brightness * flashlight.flickerMultiplier * 0.65;
      ctx.fillStyle = CONFIG.colors.flashlight;
      ctx.beginPath();
      ctx.arc(screenX, screenY, d.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  render(ctx, cameraX, cameraY, scale, viewW, viewH) {
    ctx.save();
    for (const p of this.particles) {
      const screenX = (p.x - cameraX) * scale + viewW / 2;
      const screenY = (p.y - cameraY) * scale + viewH / 2;
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillStyle = CONFIG.colors.flashlight;
      ctx.beginPath();
      ctx.arc(screenX, screenY, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
