import { CONFIG } from '../utils/Constants.js';
import { hasLineOfSight } from '../utils/Geometry.js';

/**
 * Local environmental lights with color spill and occlusion-aware darkness cutouts.
 */
export class LocalLight {
  static hexToRgb(hex) {
    return {
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16),
    };
  }

  static rgba(hex, alpha) {
    const { r, g, b } = LocalLight.hexToRgb(hex);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  /**
   * Tint nearby surfaces with colored light spill.
   */
  static applyColorSpill(ctx, light, cameraX, cameraY, scale, viewW, viewH, time) {
    const sx = (light.x - cameraX) * scale + viewW / 2;
    const sy = (light.y - cameraY) * scale + viewH / 2;
    const pulse = light.pulse
      ? Math.sin(time * light.pulseSpeed + light.phase) * 0.2 + 0.8
      : 0.75;
    const radius = light.radius * scale * (1 + pulse * 0.08);
    const color = light.color || '#C94B4B';
    const irregular = Math.sin(time * 0.7 + light.phase) * 0.06;

    ctx.save();
    const grad = ctx.createRadialGradient(
      sx + irregular * radius, sy - irregular * radius * 0.5,
      0, sx, sy, radius
    );
    grad.addColorStop(0, LocalLight.rgba(color, 0.12 * pulse));
    grad.addColorStop(0.35, LocalLight.rgba(color, 0.06 * pulse));
    grad.addColorStop(0.65, LocalLight.rgba(color, 0.02 * pulse));
    grad.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(sx, sy, radius * (1 + irregular), radius * (0.85 + irregular), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /**
   * Cut darkness overlay with soft occluded local light.
   */
  static cutDarkness(darkCtx, light, tileMap, cameraX, cameraY, scale, viewW, viewH, time, playerX, playerY) {
    const sx = (light.x - cameraX) * scale + viewW / 2;
    const sy = (light.y - cameraY) * scale + viewH / 2;
    const pulse = light.pulse
      ? Math.sin(time * light.pulseSpeed + light.phase) * 0.15 + 0.85
      : 0.8;

    let occlusion = 1;
    if (playerX && playerY && tileMap) {
      const los = hasLineOfSight(light.x, light.y, playerX, playerY, tileMap, tileMap.tileSize);
      if (!los) occlusion = 0.35;
    }

    const radius = light.radius * scale * pulse * occlusion;
    const color = light.color || '#ffffff';

    darkCtx.save();
    darkCtx.globalCompositeOperation = 'destination-out';

    const grad = darkCtx.createRadialGradient(sx, sy, 0, sx, sy, radius);
    grad.addColorStop(0, LocalLight.rgba(color, 0.55 * pulse * occlusion));
    grad.addColorStop(0.25, LocalLight.rgba(color, 0.35 * pulse * occlusion));
    grad.addColorStop(0.55, LocalLight.rgba(color, 0.12 * pulse * occlusion));
    grad.addColorStop(0.8, LocalLight.rgba(color, 0.04 * pulse * occlusion));
    grad.addColorStop(1, 'rgba(255,255,255,0)');

    darkCtx.fillStyle = grad;
    darkCtx.beginPath();
    darkCtx.ellipse(sx, sy, radius, radius * 0.88, 0, 0, Math.PI * 2);
    darkCtx.fill();

    // Wall occlusion — reduce light through walls
    if (tileMap && occlusion > 0.5) {
      LocalLight._castRadialShadows(darkCtx, sx, sy, radius, light.x, light.y, tileMap, cameraX, cameraY, scale, viewW, viewH);
    }

    darkCtx.restore();
  }

  static _castRadialShadows(ctx, sx, sy, radius, worldX, worldY, tileMap, cameraX, cameraY, scale, viewW, viewH) {
    const rayCount = 16;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,0.7)';

    for (let i = 0; i < rayCount; i++) {
      const angle = (i / rayCount) * Math.PI * 2;
      const endX = worldX + Math.cos(angle) * radius / scale;
      const endY = worldY + Math.sin(angle) * radius / scale;

      if (!hasLineOfSight(worldX, worldY, endX, endY, tileMap, tileMap.tileSize)) {
        const hitDist = LocalLight._raycast(worldX, worldY, angle, radius / scale, tileMap);
        const screenX = (worldX + Math.cos(angle) * hitDist - cameraX) * scale + viewW / 2;
        const screenY = (worldY + Math.sin(angle) * hitDist - cameraY) * scale + viewH / 2;

        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.arc(sx, sy, radius, angle - 0.08, angle + 0.08);
        ctx.lineTo(screenX, screenY);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  static _raycast(ox, oy, angle, maxDist, tileMap) {
    const step = tileMap.tileSize * 0.4;
    for (let d = step; d < maxDist; d += step) {
      if (tileMap.isWallAt(ox + Math.cos(angle) * d, oy + Math.sin(angle) * d)) return d;
    }
    return maxDist;
  }

  static renderBulb(ctx, light, cameraX, cameraY, scale, viewW, viewH, time) {
    const sx = (light.x - cameraX) * scale + viewW / 2;
    const sy = (light.y - cameraY) * scale + viewH / 2;
    const pulse = light.pulse
      ? Math.sin(time * light.pulseSpeed + light.phase) * 0.3 + 0.7
      : 0.65;
    const color = light.color || '#C94B4B';

    ctx.save();
    ctx.fillStyle = LocalLight.rgba(color, pulse * 0.9);
    ctx.beginPath();
    ctx.arc(sx, sy, 3 * scale, 0, Math.PI * 2);
    ctx.fill();

    const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 12 * scale);
    glow.addColorStop(0, LocalLight.rgba(color, 0.3 * pulse));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sx, sy, 12 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
