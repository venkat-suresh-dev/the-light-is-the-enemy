import { CONFIG } from '../utils/Constants.js';

/**
 * Top-down survivor silhouette. Rendering intentionally stays anchored at the
 * player's physics position; body movement and flashlight aim remain owned by
 * Player / PlayerController.
 */
export class PlayerRenderer {
  static render(ctx, player, cameraX, cameraY, scale, viewW, viewH, time) {
    const bob = player.getBobOffset();
    const sx = (player.x - cameraX) * scale + viewW / 2;
    const sy = (player.y - cameraY) * scale + viewH / 2 + bob * scale;
    const s = scale;
    const bodyAngle = player.bodyAngle ?? -Math.PI / 2;
    const flashAngle = player.flashlight.angle;
    const aimOffset = flashAngle - bodyAngle;
    const moving = player.isMoving;
    const stride = moving ? Math.sin(player.walkPhase) : 0;
    const breathe = Math.sin(player.breathePhase) * 0.45 * s;
    const sprint = player.isSprinting ? 1 : 0;
    const legSwing = stride * (2.1 + sprint * 1.25) * s;
    const armSwing = stride * (1.1 + sprint * 0.45) * s;

    // A low, directional shadow keeps the figure grounded without adding a glow.
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.58)';
    ctx.beginPath();
    ctx.ellipse(sx - Math.cos(bodyAngle) * 2 * s, sy + 6 * s, 11.5 * s, 4.7 * s, bodyAngle * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(bodyAngle);

    const coat = CONFIG.colors.playerCoat || '#30363D';
    const coatDark = '#1B2026';
    const coatDeep = '#14191F';
    const clothHighlight = 'rgba(196, 208, 214, 0.10)';
    const leather = '#171B20';
    const rubber = '#0D1115';
    const skin = CONFIG.colors.playerSkin || '#4A4F55';

    // Rear leg first: separated feet make the stride legible at gameplay zoom.
    ctx.save();
    ctx.translate(-2.7 * s + legSwing * 0.32, 4.5 * s);
    ctx.rotate(-0.08 - stride * 0.035);
    ctx.fillStyle = coatDeep;
    ctx.fillRect(-2.1 * s, 0, 4.2 * s, 7.2 * s);
    ctx.fillStyle = leather;
    ctx.fillRect(-2.25 * s, 5.7 * s, 4.5 * s, 2.5 * s);
    ctx.fillStyle = rubber;
    ctx.fillRect(-2.5 * s, 7.2 * s, 5.5 * s, 2.1 * s);
    ctx.restore();

    ctx.save();
    ctx.translate(2.7 * s - legSwing * 0.32, 4.2 * s);
    ctx.rotate(0.08 + stride * 0.035);
    ctx.fillStyle = '#22282E';
    ctx.fillRect(-2.15 * s, 0, 4.3 * s, 7.7 * s);
    ctx.fillStyle = leather;
    ctx.fillRect(-2.35 * s, 6.15 * s, 4.7 * s, 2.45 * s);
    ctx.fillStyle = rubber;
    ctx.fillRect(-2.65 * s, 7.55 * s, 5.75 * s, 2.1 * s);
    // Damp boot-edge reflection, visible only as a small material cue.
    ctx.fillStyle = 'rgba(195, 209, 216, 0.13)';
    ctx.fillRect(-1.85 * s, 7.8 * s, 2.5 * s, 0.55 * s);
    ctx.restore();

    // Backpack peeks behind one shoulder, broadening the silhouette without a halo.
    ctx.fillStyle = '#161B20';
    ctx.beginPath();
    ctx.roundRect(-7.8 * s, -5.4 * s + breathe, 4.6 * s, 11 * s, 1.4 * s);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(-7.1 * s, -3.9 * s + breathe, 0.7 * s, 7.5 * s);

    // Long, tapered coat mass with a split hem rather than a flat rectangle.
    ctx.fillStyle = coatDark;
    ctx.beginPath();
    ctx.moveTo(-7.7 * s, -5.5 * s + breathe);
    ctx.quadraticCurveTo(-6.8 * s, 4.2 * s + breathe, -4.6 * s, 7.4 * s + breathe);
    ctx.lineTo(-1.1 * s, 8.6 * s + breathe);
    ctx.lineTo(0, 5.7 * s + breathe);
    ctx.lineTo(1.1 * s, 8.6 * s + breathe);
    ctx.lineTo(4.8 * s, 7.4 * s + breathe);
    ctx.quadraticCurveTo(7.1 * s, 4.2 * s + breathe, 7.8 * s, -5.5 * s + breathe);
    ctx.closePath();
    ctx.fill();

    // Shoulder yoke and inner coat panel create clothing layers while keeping contrast restrained.
    ctx.fillStyle = coat;
    ctx.beginPath();
    ctx.moveTo(-8.8 * s, -6.4 * s + breathe);
    ctx.quadraticCurveTo(0, -9.2 * s + breathe, 8.8 * s, -6.4 * s + breathe);
    ctx.lineTo(7.4 * s, -2.1 * s + breathe);
    ctx.lineTo(-7.4 * s, -2.1 * s + breathe);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#272E35';
    ctx.beginPath();
    ctx.moveTo(-5.4 * s, -2.4 * s + breathe);
    ctx.lineTo(5.4 * s, -2.4 * s + breathe);
    ctx.lineTo(4.3 * s, 6.8 * s + breathe);
    ctx.lineTo(0, 7.7 * s + breathe);
    ctx.lineTo(-4.3 * s, 6.8 * s + breathe);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = clothHighlight;
    ctx.fillRect(-4.9 * s, -4.9 * s + breathe, 9.8 * s, 0.8 * s);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(-0.55 * s, -2.4 * s + breathe, 1.1 * s, 9.3 * s);
    ctx.fillStyle = 'rgba(190, 200, 203, 0.08)';
    ctx.fillRect(2.8 * s, 1.1 * s + breathe, 0.8 * s, 3.6 * s);

    // Non-flashlight arm hangs naturally and counter-swings with movement.
    ctx.save();
    ctx.translate(-7.2 * s, -4.4 * s + breathe);
    ctx.rotate(-0.16 - stride * 0.06);
    ctx.fillStyle = coatDark;
    ctx.roundRect(-2.15 * s, 0, 4.3 * s, 9.4 * s + armSwing * 0.22, 1.5 * s);
    ctx.fill();
    ctx.fillStyle = '#242B31';
    ctx.fillRect(-1.5 * s, 1.1 * s, 0.75 * s, 6.2 * s);
    ctx.fillStyle = '#252A2E';
    ctx.beginPath();
    ctx.arc(0, 9.2 * s + armSwing * 0.22, 1.65 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Small head and collar: human-scale, protected by a raised industrial jacket collar.
    ctx.fillStyle = '#11161B';
    ctx.beginPath();
    ctx.ellipse(0, -9.5 * s + breathe, 5.5 * s, 3.25 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.ellipse(0.2 * s, -10.8 * s + breathe, 3.8 * s, 4.4 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(222, 211, 190, 0.10)';
    ctx.beginPath();
    ctx.ellipse(-1.1 * s, -12.1 * s + breathe, 1.2 * s, 1.7 * s, -0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = coat;
    ctx.beginPath();
    ctx.moveTo(-5.8 * s, -7.7 * s + breathe);
    ctx.lineTo(-2.5 * s, -6.4 * s + breathe);
    ctx.lineTo(0, -7.2 * s + breathe);
    ctx.lineTo(2.5 * s, -6.4 * s + breathe);
    ctx.lineTo(5.8 * s, -7.7 * s + breathe);
    ctx.lineTo(4.2 * s, -4.2 * s + breathe);
    ctx.lineTo(-4.2 * s, -4.2 * s + breathe);
    ctx.closePath();
    ctx.fill();

    // Aiming arm is independent from the body. It reaches toward, supports, and grips the flashlight.
    ctx.save();
    ctx.rotate(aimOffset);
    const handlingSway = moving ? armSwing * 0.16 : 0;
    ctx.save();
    ctx.translate(6.9 * s, -3.9 * s + breathe);
    ctx.rotate(0.18 + handlingSway * 0.025);
    ctx.fillStyle = coatDark;
    ctx.roundRect(-1.95 * s, 0, 3.9 * s, 9.1 * s, 1.4 * s);
    ctx.fill();
    ctx.fillStyle = '#2A3138';
    ctx.fillRect(-1.35 * s, 0.9 * s, 0.68 * s, 5.5 * s);
    ctx.fillStyle = '#252A2E';
    ctx.beginPath();
    ctx.arc(0, 8.8 * s, 1.75 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Metal torch: stock, grip, lens bezel and low-key reflections establish a held object.
    ctx.fillStyle = '#12171C';
    ctx.roundRect(8.4 * s, 4.9 * s + handlingSway, 7.8 * s, 3.25 * s, 0.75 * s);
    ctx.fill();
    ctx.fillStyle = '#2A333B';
    ctx.fillRect(9.1 * s, 5.25 * s + handlingSway, 5.7 * s, 0.7 * s);
    ctx.fillStyle = '#0A0E12';
    ctx.fillRect(14.7 * s, 4.45 * s + handlingSway, 2.45 * s, 4.15 * s);
    ctx.fillStyle = 'rgba(214, 225, 224, 0.16)';
    ctx.fillRect(9.7 * s, 5.45 * s + handlingSway, 2.4 * s, 0.45 * s);
    if (player.flashlight.isOn) {
      ctx.fillStyle = CONFIG.colors.flashlight;
      ctx.globalAlpha = 0.58 + player.flashlight.flickerMultiplier * 0.22;
      ctx.beginPath();
      ctx.arc(17.1 * s, 6.5 * s + handlingSway, 1.65 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // A beam-facing coat seam is a material highlight, never an outline.
    if (player.flashlight.isOn) {
      ctx.strokeStyle = 'rgba(255,244,214,0.15)';
      ctx.lineWidth = 0.8 * s;
      ctx.beginPath();
      ctx.moveTo(-5.5 * s, -5.2 * s + breathe);
      ctx.quadraticCurveTo(0, -6.6 * s + breathe, 5.5 * s, -5.2 * s + breathe);
      ctx.stroke();
    }

    ctx.restore();
  }
}
