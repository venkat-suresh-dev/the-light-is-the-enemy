import { CONFIG, ENEMY_ARCHETYPE, ENEMY_STATE } from '../utils/Constants.js';

/**
 * Horror silhouettes only. Archetype, state, motion and visibility are all
 * supplied by existing gameplay systems; this class never changes them.
 */
export class EnemyRenderer {
  static render(ctx, enemy, player, cameraX, cameraY, scale, viewW, viewH, time) {
    const sx = (enemy.x - cameraX) * scale + viewW / 2;
    const sy = (enemy.y - cameraY) * scale + viewH / 2;
    const s = scale;
    const distance = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    const showSilhouette = distance < 132 && !enemy.visible;

    if (enemy.shadowGhost > 0) {
      EnemyRenderer._renderShadowGhost(ctx, enemy, sx, sy, s);
    }
    if (!enemy.visible && !showSilhouette) {
      if (enemy.eyeFlash > 0) EnemyRenderer._renderEyeFlash(ctx, sx, sy, s, enemy.eyeFlash);
      return;
    }

    const speed = Math.hypot(enemy.velocity?.x || 0, enemy.velocity?.y || 0);
    const facing = enemy.facingAngle ?? enemy.ai?.headAngle ?? -Math.PI / 2;
    const lit = enemy.visible;
    const active = enemy.state === ENEMY_STATE.HUNTING || enemy.state === ENEMY_STATE.ALERT;
    let alpha = lit ? 0.9 : 0.3;
    if (active) alpha = Math.min(0.94, alpha + 0.05);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(sx, sy);
    ctx.rotate(facing + Math.PI / 2);

    const material = {
      body: lit ? '#080A0B' : '#020304',
      cloth: lit ? '#14191B' : '#050607',
      worn: lit ? 'rgba(156, 172, 170, 0.18)' : 'rgba(156, 172, 170, 0.055)',
      wet: lit ? 'rgba(210, 222, 211, 0.17)' : 'rgba(210, 222, 211, 0.05)',
      face: lit ? 'rgba(181, 159, 128, 0.28)' : 'rgba(181, 159, 128, 0.08)',
    };

    switch (enemy.archetype) {
      case ENEMY_ARCHETYPE.RUNNER:
        EnemyRenderer._renderRunner(ctx, s, enemy, time, speed, material);
        break;
      case ENEMY_ARCHETYPE.WATCHER:
        EnemyRenderer._renderWatcher(ctx, s, enemy, time, material);
        break;
      case ENEMY_ARCHETYPE.STALKER:
      default:
        EnemyRenderer._renderStalker(ctx, s, enemy, time, speed, material);
        break;
    }
    ctx.restore();
  }

  static _renderStalker(ctx, s, enemy, time, speed, m) {
    const smoothStep = Math.sin(enemy.animPhase * 1.5) * Math.min(1.3, speed / 58) * s;
    const breathing = Math.sin(time * 1.05 + enemy.id) * 0.55 * s;
    const hunch = enemy.state === ENEMY_STATE.HUNTING ? 1.7 * s : 0.9 * s;

    // Long legs and a narrow body make the creature uncomfortably vertical.
    ctx.fillStyle = m.body;
    ctx.save();
    ctx.rotate(-0.06);
    ctx.fillRect(-3.25 * s + smoothStep * 0.18, 8 * s, 2.7 * s, 12.5 * s);
    ctx.fillRect(0.65 * s - smoothStep * 0.14, 7.5 * s, 2.7 * s, 13.2 * s);
    ctx.restore();
    ctx.fillStyle = '#050708';
    ctx.fillRect(-4 * s + smoothStep * 0.18, 18.3 * s, 4.4 * s, 2 * s);
    ctx.fillRect(0.1 * s - smoothStep * 0.14, 18.8 * s, 4.4 * s, 2 * s);

    // Hunched, coat-like torso: human enough to be unnerving, too narrow to be right.
    ctx.fillStyle = m.cloth;
    ctx.beginPath();
    ctx.moveTo(-5.6 * s, -10.5 * s + hunch + breathing);
    ctx.quadraticCurveTo(-4.8 * s, 5.2 * s + breathing, -3.6 * s, 10.8 * s);
    ctx.lineTo(3.4 * s, 10.8 * s);
    ctx.quadraticCurveTo(4.9 * s, 4.8 * s + breathing, 5.2 * s, -9.5 * s + hunch + breathing);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = m.body;
    ctx.beginPath();
    ctx.moveTo(-6.7 * s, -10.7 * s + hunch);
    ctx.lineTo(5.8 * s, -10 * s + hunch);
    ctx.lineTo(4.7 * s, -5.2 * s + hunch);
    ctx.lineTo(-5.8 * s, -5.2 * s + hunch);
    ctx.closePath();
    ctx.fill();

    // Arms are intentionally too long and move with almost no urgency.
    ctx.save();
    ctx.translate(-6.2 * s, -8.8 * s + hunch);
    ctx.rotate(0.16 + smoothStep * 0.018);
    ctx.fillStyle = m.body;
    ctx.roundRect(-1.8 * s, 0, 3.5 * s, 22.5 * s, 1.5 * s);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, 22.1 * s, 2.1 * s, 3.2 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(5.6 * s, -8.8 * s + hunch);
    ctx.rotate(-0.12 - smoothStep * 0.014);
    ctx.fillStyle = '#050607';
    ctx.roundRect(-1.65 * s, 0, 3.25 * s, 19.5 * s, 1.4 * s);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, 19.3 * s, 1.95 * s, 3 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Recessed head has minimal information; only a weak glint appears while lit/active.
    ctx.fillStyle = '#030405';
    ctx.beginPath();
    ctx.ellipse(-0.8 * s, -16.1 * s + hunch * 0.2, 4.5 * s, 6.1 * s, -0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = m.worn;
    ctx.fillRect(-2.7 * s, -9.2 * s + hunch, 1 * s, 15 * s);
    ctx.strokeStyle = m.wet;
    ctx.lineWidth = 0.75 * s;
    ctx.beginPath();
    ctx.moveTo(1.6 * s, -13 * s + hunch * 0.25);
    ctx.lineTo(2.6 * s, 4.5 * s);
    ctx.stroke();
    EnemyRenderer._renderFaceGlint(ctx, s, enemy, -16 + hunch * 0.2, 0.5, 0.26);
  }

  static _renderRunner(ctx, s, enemy, time, speed, m) {
    const pace = enemy.animPhase * 2.8;
    const stride = Math.sin(pace) * (2.5 + Math.min(3.6, speed / 26)) * s;
    const jitter = Math.sin(time * 17 + enemy.id * 2.3) * (enemy.state === ENEMY_STATE.HUNTING ? 0.65 : 0.18) * s;

    // A low, forward-biased shape. The extended legs tell the player this is fast.
    ctx.save();
    ctx.rotate(-0.46);
    ctx.fillStyle = m.cloth;
    ctx.beginPath();
    ctx.ellipse(0, -2 * s + jitter, 5.6 * s, 9.2 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = m.body;
    ctx.beginPath();
    ctx.ellipse(1.8 * s, -10.2 * s + jitter, 4.5 * s, 4.1 * s, -0.24, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(-2.2 * s + stride * 0.32, 5.5 * s);
    ctx.rotate(-0.36 - stride * 0.025);
    ctx.fillStyle = m.body;
    ctx.fillRect(-2.2 * s, 0, 4.4 * s, 14.2 * s);
    ctx.fillStyle = '#050708';
    ctx.fillRect(-2.8 * s, 12.5 * s, 6 * s, 2.2 * s);
    ctx.restore();
    ctx.save();
    ctx.translate(2.5 * s - stride * 0.32, 5.1 * s);
    ctx.rotate(0.34 + stride * 0.025);
    ctx.fillStyle = '#07090A';
    ctx.fillRect(-2.15 * s, 0, 4.3 * s, 14.8 * s);
    ctx.fillStyle = '#040506';
    ctx.fillRect(-2.7 * s, 13.1 * s, 5.9 * s, 2.2 * s);
    ctx.restore();

    // Bent arms remain tight to the compact torso, like a sprinter about to break loose.
    ctx.save();
    ctx.translate(-5.2 * s, -4.1 * s + jitter);
    ctx.rotate(-0.55 + stride * 0.035);
    ctx.fillStyle = m.body;
    ctx.roundRect(-1.8 * s, 0, 3.4 * s, 10.8 * s, 1.4 * s);
    ctx.fill();
    ctx.fillRect(-1.4 * s, 8.4 * s, 7 * s, 2.8 * s);
    ctx.restore();
    ctx.save();
    ctx.translate(5.3 * s, -2.8 * s + jitter);
    ctx.rotate(0.5 - stride * 0.032);
    ctx.fillStyle = '#060708';
    ctx.roundRect(-1.7 * s, 0, 3.3 * s, 10 * s, 1.3 * s);
    ctx.fill();
    ctx.fillRect(-5.4 * s, 7.8 * s, 7 * s, 2.7 * s);
    ctx.restore();

    ctx.strokeStyle = m.wet;
    ctx.lineWidth = 0.8 * s;
    ctx.beginPath();
    ctx.moveTo(-2.7 * s, -7.5 * s + jitter);
    ctx.lineTo(3.7 * s, -3.1 * s + jitter);
    ctx.stroke();
    EnemyRenderer._renderFaceGlint(ctx, s, enemy, -10 + jitter / s, 1.1, 0.2);
  }

  static _renderWatcher(ctx, s, enemy, time, m) {
    const nearlyStill = Math.sin(time * 0.55 + enemy.id * 0.8) * 0.38 * s;
    const observing = enemy.state === ENEMY_STATE.AWARE || enemy.state === ENEMY_STATE.ILLUMINATED || enemy.state === ENEMY_STATE.ALERT || enemy.state === ENEMY_STATE.HUNTING;
    const tilt = observing ? Math.sin(time * 1.2 + enemy.id) * 0.12 : Math.sin(time * 0.35 + enemy.id) * 0.035;

    // An asymmetric hanging silhouette: initially plausible as equipment, wrong on a second look.
    ctx.fillStyle = '#050607';
    ctx.beginPath();
    ctx.moveTo(-3.2 * s, -23 * s + nearlyStill);
    ctx.lineTo(4.7 * s, -20.7 * s + nearlyStill);
    ctx.lineTo(8.5 * s, -4 * s);
    ctx.lineTo(4.1 * s, 15 * s);
    ctx.lineTo(-5.5 * s, 18.2 * s);
    ctx.lineTo(-8.2 * s, 4 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = m.cloth;
    ctx.beginPath();
    ctx.moveTo(-2.8 * s, -17.5 * s + nearlyStill);
    ctx.lineTo(3.5 * s, -15.4 * s + nearlyStill);
    ctx.lineTo(5.8 * s, 9 * s);
    ctx.lineTo(-3.8 * s, 13.8 * s);
    ctx.closePath();
    ctx.fill();

    // One thin limb hangs too far down; the other is hidden in the body mass.
    ctx.save();
    ctx.translate(-6.5 * s, -4 * s);
    ctx.rotate(0.08);
    ctx.fillStyle = m.body;
    ctx.roundRect(-1.45 * s, 0, 2.9 * s, 22 * s, 1.3 * s);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, 21.5 * s, 1.8 * s, 2.4 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // The offset head makes attention feel detached from the body.
    ctx.save();
    ctx.translate(2.9 * s, -18.8 * s + nearlyStill);
    ctx.rotate(tilt);
    ctx.fillStyle = '#020304';
    ctx.beginPath();
    ctx.ellipse(0, 0, 5.8 * s, 4.1 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = m.worn;
    ctx.fillRect(-4.4 * s, -0.7 * s, 2.5 * s, 0.7 * s);
    if (observing) {
      ctx.strokeStyle = m.wet;
      ctx.lineWidth = 0.7 * s;
      ctx.beginPath();
      ctx.moveTo(0.8 * s, -1.3 * s);
      ctx.lineTo(3.9 * s, -0.55 * s);
      ctx.stroke();
    }
    ctx.restore();

    ctx.strokeStyle = m.wet;
    ctx.lineWidth = 0.75 * s;
    ctx.beginPath();
    ctx.moveTo(4.2 * s, -11 * s);
    ctx.lineTo(5.5 * s, 8 * s);
    ctx.stroke();
    EnemyRenderer._renderFaceGlint(ctx, s, enemy, -19 + nearlyStill / s, 2.8, observing ? 0.25 : 0.1);
  }

  static _renderFaceGlint(ctx, s, enemy, y, offset, baseAlpha) {
    if (!enemy.visible || enemy.state === ENEMY_STATE.DORMANT) return;
    const hunting = enemy.state === ENEMY_STATE.HUNTING;
    ctx.save();
    ctx.globalAlpha *= baseAlpha + (hunting ? 0.11 : 0);
    ctx.fillStyle = CONFIG.colors.enemyEyes;
    ctx.beginPath();
    ctx.ellipse((offset - 1.1) * s, y * s, 0.65 * s, 0.28 * s, 0, 0, Math.PI * 2);
    ctx.ellipse((offset + 1.1) * s, y * s, 0.65 * s, 0.28 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  static _renderEyeFlash(ctx, sx, sy, s, intensity) {
    ctx.save();
    ctx.globalAlpha = intensity * 0.8;
    ctx.fillStyle = CONFIG.colors.enemyEyes;
    ctx.beginPath();
    ctx.ellipse(sx - 2.2 * s, sy - 4 * s, 0.8 * s, 0.45 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(sx + 2.2 * s, sy - 4 * s, 0.8 * s, 0.45 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  static _renderShadowGhost(ctx, enemy, sx, sy, s) {
    const gx = sx + (enemy.shadowGhostX - enemy.x) * s;
    const gy = sy + (enemy.shadowGhostY - enemy.y) * s;
    ctx.save();
    ctx.globalAlpha = Math.max(0, enemy.shadowGhost) * 0.28;
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.ellipse(gx, gy + 5 * s, 11 * s, 4 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(gx - 4 * s, gy - 13 * s);
    ctx.lineTo(gx + 5 * s, gy - 13 * s);
    ctx.lineTo(gx + 3 * s, gy + 7 * s);
    ctx.lineTo(gx - 4 * s, gy + 7 * s);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
