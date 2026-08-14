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
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.ellipse(sx + shadowOffX, sy + shadowOffY, 10 * s, 4.5 * s, bodyAngle * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(bodyAngle);

    const coat = CONFIG.colors.playerCoat || '#30363D';
    const secondary = CONFIG.colors.playerSecondary || '#20252A';
    const skin = CONFIG.colors.playerSkin || '#4A4F55';

    // Boots and legs
    ctx.fillStyle = secondary;
    ctx.fillRect(-3.8 * s + legSwing * 0.3, 2.5 * s, 3 * s, 6.5 * s);
    ctx.fillRect(0.8 * s - legSwing * 0.3, 2.5 * s, 3 * s, 6.5 * s);
    ctx.fillStyle = '#15191E';
    ctx.fillRect(-4.1 * s + legSwing * 0.3, 8 * s, 3.6 * s, 1.8 * s);
    ctx.fillRect(0.5 * s - legSwing * 0.3, 8 * s, 3.6 * s, 1.8 * s);

    // Coat torso, slightly tapered to read as a person from above
    ctx.fillStyle = coat;
    ctx.beginPath();
    ctx.moveTo(-5.5 * s, -5 * s + breathe);
    ctx.lineTo(5.5 * s, -5 * s + breathe);
    ctx.lineTo(4.2 * s, 5.5 * s + breathe);
    ctx.lineTo(-4.2 * s, 5.5 * s + breathe);
    ctx.closePath();
    ctx.fill();

    // Shoulders
    ctx.fillRect(-8 * s, -6.2 * s + breathe, 16 * s, 3.5 * s);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(-1 * s, -4.5 * s + breathe, 1.2 * s, 9 * s);

    // Left arm
    ctx.fillStyle = coat;
    ctx.save();
    ctx.rotate(-0.12);
    ctx.fillRect(-9.3 * s, -4 * s + armSwing, 3.2 * s, 8 * s);
    ctx.restore();

    // Head
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.ellipse(0, -9 * s + breathe, 3.8 * s, 4.8 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Neck
    ctx.fillStyle = skin;
    ctx.fillRect(-1.5 * s, -6.1 * s + breathe, 3 * s, 2.5 * s);

    // Restrained top highlight so the facing direction is readable in the beam.
    if (player.flashlight.isOn) {
      ctx.strokeStyle = 'rgba(255,244,214,0.16)';
      ctx.lineWidth = 1 * s;
      ctx.beginPath();
      ctx.moveTo(-4.5 * s, -5.8 * s + breathe);
      ctx.lineTo(4.5 * s, -5.8 * s + breathe);
      ctx.stroke();
    }

    // Right arm + flashlight — world-space aim applied inside body rotation
    ctx.save();
    ctx.rotate(aimOffset);
    ctx.fillStyle = coat;
    ctx.fillRect(5.2 * s, -2.2 * s + armSwing * 0.2, 3.2 * s, 7 * s);
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(7.7 * s, 4.8 * s, 1.8 * s, 0, Math.PI * 2);
    ctx.fill();

    // Flashlight body on arm (extends along +X in arm-local space)
    ctx.fillStyle = '#20252B';
    ctx.fillRect(7.5 * s, -1.3 * s, 6.5 * s, 2.6 * s);
    ctx.fillStyle = '#111418';
    ctx.fillRect(12.5 * s, -1.7 * s, 2.2 * s, 3.4 * s);
    if (player.flashlight.isOn) {
      ctx.fillStyle = CONFIG.colors.flashlight;
      ctx.globalAlpha = 0.8 + player.flashlight.flickerMultiplier * 0.2 - 0.2;
      ctx.beginPath();
      ctx.arc(14.5 * s, 0, 1.7 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    ctx.restore();
  }
}
