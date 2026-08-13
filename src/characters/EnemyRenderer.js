import { CONFIG, ENEMY_STATE } from '../utils/Constants.js';

/**
 * Distinctive unsettling enemy silhouette with procedural animation.
 */
export class EnemyRenderer {
  static render(ctx, enemy, player, cameraX, cameraY, scale, viewW, viewH, time) {
    const sx = (enemy.x - cameraX) * scale + viewW / 2;
    const sy = (enemy.y - cameraY) * scale + viewH / 2;
    const s = scale;
    const dist = Math.sqrt((enemy.x - player.x) ** 2 + (enemy.y - player.y) ** 2);

    // Fake shadow ghost (unsettling — shadow without body)
    if (enemy.shadowGhost > 0) {
      EnemyRenderer._renderShadowGhost(ctx, enemy, sx, sy, s, time);
    }

    const showSilhouette = dist < 120 && !enemy.visible;
    if (!enemy.visible && !showSilhouette) {
      if (enemy.eyeFlash > 0) {
        EnemyRenderer._renderEyeFlash(ctx, sx, sy, s, enemy.eyeFlash);
      }
      return;
    }

    const headAngle = enemy.ai?.headAngle ?? 0;
    const gait = enemy.animPhase;
    const sway = Math.sin(gait * 1.8) * 1.5 * s;
    const twitch = enemy.twitch > 0 ? Math.sin(time * 40) * enemy.twitch * s : 0;

    let alpha = 0.2;
    if (enemy.visible) alpha = 0.92;
    else if (showSilhouette) alpha = 0.35;
    if (enemy.state === ENEMY_STATE.HUNTING) alpha = Math.min(alpha + 0.1, 0.95);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(sx + sway + twitch, sy);

    const bodyColor = enemy.visible ? '#0C0C0C' : '#060606';
    const limbPhase = Math.sin(gait * 2.2) * 2 * s;
    const irregularGait = Math.sin(gait * 1.3) * 1.5 * s;

    // Long left arm
    ctx.fillStyle = bodyColor;
    ctx.save();
    ctx.rotate(0.15 + limbPhase * 0.02);
    ctx.fillRect(-9 * s, -2 * s, 3 * s, 14 * s);
    ctx.restore();

    // Long right arm
    ctx.save();
    ctx.rotate(-0.1 - limbPhase * 0.025);
    ctx.fillRect(6 * s, -1 * s + irregularGait, 3 * s, 15 * s);
    ctx.restore();

    // Narrow torso
    ctx.fillRect(-4 * s, -8 * s, 8 * s, 14 * s);

    // Bent legs
    ctx.fillRect(-4 * s + limbPhase * 0.2, 4 * s, 3 * s, 8 * s);
    ctx.fillRect(1 * s - limbPhase * 0.2, 4 * s + irregularGait * 0.3, 3 * s, 8 * s);

    // Oversized head — tracks player when alert
    ctx.save();
    const headRot = enemy.state === ENEMY_STATE.ILLUMINATED || enemy.state === ENEMY_STATE.ALERT
      ? headAngle - Math.atan2(player.y - enemy.y, player.x - enemy.x)
      : 0;
    ctx.rotate(Math.max(-0.4, Math.min(0.4, headRot * 0.3)));
    ctx.beginPath();
    ctx.arc(0, -12 * s, 6 * s, 0, Math.PI * 2);
    ctx.fill();

    // Subtle eye reflection only when directly lit
    if (enemy.visible && (enemy.state !== ENEMY_STATE.DORMANT)) {
      ctx.fillStyle = CONFIG.colors.enemyEyes;
      ctx.globalAlpha = 0.4;
      const eyeY = -12 * s;
      ctx.beginPath();
      ctx.arc(-2 * s, eyeY, 0.8 * s, 0, Math.PI * 2);
      ctx.arc(2 * s, eyeY, 0.8 * s, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
    ctx.restore();
  }

  static _renderEyeFlash(ctx, sx, sy, s, intensity) {
    ctx.save();
    ctx.globalAlpha = intensity;
    ctx.fillStyle = CONFIG.colors.enemyEyes;
    ctx.beginPath();
    ctx.arc(sx - 3 * s, sy - 4 * s, 1 * s, 0, Math.PI * 2);
    ctx.arc(sx + 3 * s, sy - 4 * s, 1 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  static _renderShadowGhost(ctx, enemy, sx, sy, s, time) {
    const gx = sx + (enemy.shadowGhostX - enemy.x) * s;
    const gy = sy + (enemy.shadowGhostY - enemy.y) * s;
    ctx.save();
    ctx.globalAlpha = enemy.shadowGhost * 0.35;
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.ellipse(gx, gy, 10 * s, 5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    // Distorted humanoid shadow
    ctx.fillRect(gx - 4 * s, gy - 10 * s, 8 * s, 16 * s);
    ctx.restore();
  }
}
