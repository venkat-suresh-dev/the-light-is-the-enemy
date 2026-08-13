import { CONFIG } from '../utils/Constants.js';

/**
 * Top-down player silhouette with procedural animation.
 * Body faces movement; flashlight arm aims independently toward the cursor.
 */
export class PlayerRenderer {
  static render(ctx, player, cameraX, cameraY, scale, viewW, viewH, time) {
    const bob = player.getBobOffset();
    const sx = (player.x - cameraX) * scale + viewW / 2;
    const sy = (player.y - cameraY) * scale + viewH / 2 + bob * scale;
    const s = scale;
    const breathe = Math.sin(player.breathePhase) * 0.5;
    const walkPhase = player.walkPhase;
    const legSwing = player.isMoving ? Math.sin(walkPhase) * 3 * s : 0;
    const armSwing = player.isMoving ? Math.sin(walkPhase + Math.PI) * 2 * s : 0;
    const bodyAngle = player.bodyAngle ?? -Math.PI / 2;
    const flashAngle = player.flashlight.angle;
    const aimOffset = flashAngle - bodyAngle;

    // Shadow — offset opposite to movement-facing direction
    const shadowOffX = -Math.cos(bodyAngle - Math.PI / 2) * 3 * s;
    const shadowOffY = -Math.sin(bodyAngle - Math.PI / 2) * 3 * s + 6 * s;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(sx + shadowOffX, sy + shadowOffY, 9 * s, 4 * s, bodyAngle * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(bodyAngle);

    const coat = CONFIG.colors.playerCoat || '#30363D';
    const secondary = CONFIG.colors.playerSecondary || '#20252A';
    const skin = CONFIG.colors.playerSkin || '#4A4F55';

    // Legs
    ctx.fillStyle = secondary;
    ctx.fillRect(-3 * s + legSwing * 0.3, 2 * s, 2.5 * s, 5 * s);
    ctx.fillRect(0.5 * s - legSwing * 0.3, 2 * s, 2.5 * s, 5 * s);

    // Torso
    ctx.fillStyle = coat;
    ctx.fillRect(-5 * s, -4 * s + breathe, 10 * s, 8 * s);

    // Shoulders
    ctx.fillRect(-7 * s, -5 * s + breathe, 14 * s, 3 * s);

    // Left arm
    ctx.fillStyle = coat;
    ctx.fillRect(-8 * s, -3 * s + armSwing, 3 * s, 6 * s);

    // Head
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(0, -7 * s + breathe, 4 * s, 0, Math.PI * 2);
    ctx.fill();

    // Neck
    ctx.fillStyle = skin;
    ctx.fillRect(-1.5 * s, -5 * s + breathe, 3 * s, 2 * s);

    // Right arm + flashlight — world-space aim applied inside body rotation
    ctx.save();
    ctx.rotate(aimOffset);
    ctx.fillStyle = coat;
    ctx.fillRect(5 * s, -2 * s + armSwing * 0.2, 3 * s, 5 * s);
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(7.5 * s, 3 * s, 1.8 * s, 0, Math.PI * 2);
    ctx.fill();

    // Flashlight body on arm (extends along +X in arm-local space)
    if (player.flashlight.isOn) {
      ctx.fillStyle = '#2A2F35';
      ctx.fillRect(7 * s, -1 * s, 5 * s, 2 * s);
      ctx.fillStyle = CONFIG.colors.flashlight;
      ctx.globalAlpha = 0.8 + player.flashlight.flickerMultiplier * 0.2 - 0.2;
      ctx.beginPath();
      ctx.arc(12.5 * s, 0, 1.5 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    ctx.restore();
  }
}
