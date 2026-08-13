import { CONFIG } from '../utils/Constants.js';
import { clamp } from '../utils/MathUtils.js';
import { CameraShake } from './CameraShake.js';

export class ScreenEffects {
  constructor() {
    this.cameraShake = new CameraShake();
    this.vignetteIntensity = CONFIG.effects.vignetteIntensity;
    this.grainIntensity = CONFIG.effects.grainIntensity;
    this.chromaticOffset = 0;
    this.heartbeatPulse = 0;
    this.darknessPulse = 0;
    this.enabled = true;
    this._grainCanvas = null;
    this._grainCtx = null;
    this._grainFrame = 0;
  }

  init(viewW, viewH) {
    this._grainCanvas = document.createElement('canvas');
    this._grainCanvas.width = viewW;
    this._grainCanvas.height = viewH;
    this._grainCtx = this._grainCanvas.getContext('2d');
  }

  resize(viewW, viewH) {
    if (this._grainCanvas) {
      this._grainCanvas.width = viewW;
      this._grainCanvas.height = viewH;
    }
  }

  setHeartbeat(intensity) {
    this.heartbeatPulse = clamp(intensity, 0, 1);
    this.vignetteIntensity = CONFIG.effects.vignetteIntensity + intensity * 0.4;
  }

  update(deltaTime) {
    this.cameraShake.update(deltaTime);
    this.darknessPulse = Math.sin(Date.now() * 0.002) * 0.02;
    this._grainFrame++;
  }

  apply(ctx, viewW, viewH) {
    if (!this.enabled) return;

    // Vignette
  }

  renderOverlay(ctx, viewW, viewH) {
    if (!this.enabled) return;

    // Heartbeat vignette pulse
    if (this.heartbeatPulse > 0.1) {
      const pulse = Math.sin(Date.now() * (0.005 + this.heartbeatPulse * 0.01)) * this.heartbeatPulse * 0.15;
      const gradient = ctx.createRadialGradient(
        viewW / 2, viewH / 2, viewW * 0.2,
        viewW / 2, viewH / 2, viewW * 0.7
      );
      gradient.addColorStop(0, 'rgba(0,0,0,0)');
      gradient.addColorStop(1, `rgba(40,0,0,${this.vignetteIntensity * 0.5 + pulse})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, viewW, viewH);
    }

    // Film grain
    if (this.grainIntensity > 0 && this._grainCtx) {
      if (this._grainFrame % 3 === 0) {
        const imageData = this._grainCtx.createImageData(viewW, viewH);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          const v = Math.random() * 255;
          data[i] = v;
          data[i + 1] = v;
          data[i + 2] = v;
          data[i + 3] = this.grainIntensity * 255;
        }
        this._grainCtx.putImageData(imageData, 0, 0);
      }
      ctx.globalAlpha = 1;
      ctx.drawImage(this._grainCanvas, 0, 0);
    }

    // Chromatic aberration hint at edges
    if (this.chromaticOffset > 0) {
      ctx.globalAlpha = this.chromaticOffset * 0.1;
      ctx.fillStyle = 'rgba(139,32,32,0.1)';
      ctx.fillRect(2, 0, viewW, viewH);
      ctx.fillStyle = 'rgba(32,32,139,0.1)';
      ctx.fillRect(-2, 0, viewW, viewH);
      ctx.globalAlpha = 1;
    }
  }
}
