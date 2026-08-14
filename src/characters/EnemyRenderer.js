import { CONFIG, ENEMY_ARCHETYPE, ENEMY_STATE } from '../utils/Constants.js';

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

    const facingAngle = enemy.facingAngle ?? enemy.ai?.headAngle ?? -Math.PI / 2;
    const gait = enemy.animPhase;
    const sway = Math.sin(gait * 1.8) * 0.8 * s;
    const twitch = enemy.twitch > 0 ? Math.sin(time * 40) * enemy.twitch * s : 0;

    let alpha = 0.16;
    if (enemy.visible) alpha = 0.88;
    else if (showSilhouette) alpha = 0.28;
    if (enemy.state === ENEMY_STATE.HUNTING) alpha = Math.min(alpha + 0.08, 0.92);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(sx + sway + twitch, sy);
    ctx.rotate(facingAngle + Math.PI / 2);

    const bodyColor = enemy.visible ? '#090A0B' : '#030404';
    const highlight = enemy.visible ? 'rgba(184,160,128,0.2)' : 'rgba(184,160,128,0.06)';

    switch (enemy.archetype) {
      case ENEMY_ARCHETYPE.RUNNER:
        EnemyRenderer._renderRunner(ctx, s, gait, bodyColor, highlight, enemy);
        break;
      case ENEMY_ARCHETYPE.WATCHER:
        EnemyRenderer._renderWatcher(ctx, s, gait, bodyColor, highlight, enemy, time);
        break;
      case ENEMY_ARCHETYPE.STALKER:
      default:
        EnemyRenderer._renderStalker(ctx, s, gait, bodyColor, highlight, enemy);
        break;
    }
    ctx.restore();
  }

  static _renderStalker(ctx, s, gait, bodyColor, highlight, enemy) {
    const limbPhase = Math.sin(gait * 2.1) * 2 * s;
    const drag = Math.sin(gait * 1.1) * 1.4 * s;
    ctx.fillStyle = bodyColor;

    ctx.fillRect(-4.5 * s, -11 * s, 9 * s, 20 * s);
    ctx.fillRect(-6.5 * s, -9 * s, 13 * s, 5 * s);

    ctx.save();
    ctx.rotate(0.18);
    ctx.fillRect(-10 * s, -7 * s + limbPhase * 0.25, 3 * s, 22 * s);
    ctx.restore();
    ctx.save();
    ctx.rotate(-0.12);
    ctx.fillRect(7 * s, -6 * s - limbPhase * 0.2, 3 * s, 19 * s);
    ctx.restore();

    ctx.fillRect(-4 * s + limbPhase * 0.15, 7 * s, 3 * s, 9 * s + drag);
    ctx.fillRect(1 * s - limbPhase * 0.15, 7 * s, 3 * s, 8 * s - drag * 0.4);

    ctx.beginPath();
    ctx.ellipse(0, -15 * s, 5.5 * s, 7 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    EnemyRenderer._renderSubtleFace(ctx, s, enemy, -15);

    ctx.strokeStyle = highlight;
    ctx.lineWidth = 1 * s;
    ctx.beginPath();
    ctx.moveTo(-3 * s, -9 * s);
    ctx.lineTo(-1 * s, 7 * s);
    ctx.stroke();
  }

  static _renderRunner(ctx, s, gait, bodyColor, highlight, enemy) {
    const stride = Math.sin(gait * 2.8) * 4 * s;
    ctx.fillStyle = bodyColor;

    ctx.save();
    ctx.rotate(-0.25);
    ctx.fillRect(-3.5 * s, -9 * s, 7 * s, 15 * s);
    ctx.restore();

    ctx.fillRect(-8 * s, -5 * s + stride * 0.25, 4 * s, 12 * s);
    ctx.fillRect(4 * s, -7 * s - stride * 0.2, 4 * s, 11 * s);
    ctx.fillRect(-3 * s + stride * 0.25, 4 * s, 3 * s, 10 * s);
    ctx.fillRect(1 * s - stride * 0.25, 3 * s, 3 * s, 12 * s);

    ctx.beginPath();
    ctx.ellipse(1 * s, -12 * s, 4.2 * s, 5.3 * s, -0.2, 0, Math.PI * 2);
    ctx.fill();
    EnemyRenderer._renderSubtleFace(ctx, s, enemy, -12);

    ctx.strokeStyle = highlight;
    ctx.lineWidth = 1 * s;
    ctx.beginPath();
    ctx.moveTo(2 * s, -8 * s);
    ctx.lineTo(5 * s, 2 * s);
    ctx.stroke();
  }

  static _renderWatcher(ctx, s, gait, bodyColor, highlight, enemy, time) {
    const pulse = Math.sin(time * 1.7 + enemy.id) * 0.6 * s;
    ctx.fillStyle = bodyColor;

    ctx.beginPath();
    ctx.moveTo(0, -18 * s - pulse);
    ctx.lineTo(8 * s, -4 * s);
    ctx.lineTo(5 * s, 12 * s);
    ctx.lineTo(-5 * s, 12 * s);
    ctx.lineTo(-8 * s, -4 * s);
    ctx.closePath();
    ctx.fill();

    ctx.fillRect(-2 * s, 8 * s, 1.8 * s, 9 * s);
    ctx.fillRect(0.2 * s, 8 * s, 1.8 * s, 9 * s);

    ctx.beginPath();
    ctx.ellipse(0, -12 * s, 7 * s, 5 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = highlight;
    ctx.lineWidth = 1 * s;
    ctx.beginPath();
    ctx.moveTo(-5 * s, -5 * s);
    ctx.lineTo(5 * s, -5 * s);
    ctx.moveTo(-3 * s, 1 * s);
    ctx.lineTo(3 * s, 1 * s);
    ctx.stroke();
    EnemyRenderer._renderSubtleFace(ctx, s, enemy, -12);
  }

  static _renderSubtleFace(ctx, s, enemy, y) {
    if (!enemy.visible || enemy.state === ENEMY_STATE.DORMANT) return;
    ctx.save();
    ctx.globalAlpha = enemy.state === ENEMY_STATE.HUNTING ? 0.35 : 0.22;
    ctx.fillStyle = CONFIG.colors.enemyEyes;
    ctx.beginPath();
    ctx.ellipse(-1.8 * s, y * s, 0.7 * s, 0.35 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(1.8 * s, y * s, 0.7 * s, 0.35 * s, 0, 0, Math.PI * 2);
    ctx.fill();
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
