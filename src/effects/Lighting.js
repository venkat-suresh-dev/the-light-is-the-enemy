import { CONFIG, TILE } from '../utils/Constants.js';
import { buildConeVisibilityPolygon } from '../utils/Geometry.js';
import { LocalLight } from './LocalLight.js';
import { PlayerRenderer } from '../characters/PlayerRenderer.js';
import { EnemyRenderer } from '../characters/EnemyRenderer.js';

/**
 * World + darkness rendering with ambient visibility and two-layer flashlight.
 */
export class Lighting {
  constructor() {
    this.darkCanvas = null;
    this.darkCtx = null;
    this.lightCanvas = null;
    this.lightCtx = null;
    this.viewW = 0;
    this.viewH = 0;
    this.dpr = 1;
    this._time = 0;
    this._isMobile = false;
    this.debugFlashlight = false;
    this.debugFlashlightSimple = false;
  }

  init(viewW, viewH, dpr = 1) {
    this.viewW = viewW;
    this.viewH = viewH;
    this.dpr = dpr;
    this._isMobile = window.innerWidth <= 767;

    this.darkCanvas = document.createElement('canvas');
    this.lightCanvas = document.createElement('canvas');
    this._resizeBuffers(viewW, viewH, dpr);
  }

  _resizeBuffers(viewW, viewH, dpr) {
    const bw = Math.round(viewW * dpr);
    const bh = Math.round(viewH * dpr);

    this.darkCanvas.width = bw;
    this.darkCanvas.height = bh;
    this.darkCtx = this.darkCanvas.getContext('2d');
    this.darkCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.lightCanvas.width = bw;
    this.lightCanvas.height = bh;
    this.lightCtx = this.lightCanvas.getContext('2d');
    this.lightCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  resize(viewW, viewH, dpr = this.dpr) {
    this.viewW = viewW;
    this.viewH = viewH;
    this.dpr = dpr;
    this._isMobile = window.innerWidth <= 767;
    if (this.darkCanvas) {
      this._resizeBuffers(viewW, viewH, dpr);
    }
  }

  setDebugFlashlight(enabled, simple = false) {
    this.debugFlashlight = enabled;
    this.debugFlashlightSimple = simple;
  }

  update(deltaTime) {
    this._time += deltaTime;
  }

  renderWorld(ctx, tileMap, room, player, enemies, cameraX, cameraY, scale) {
    const tileSize = tileMap.tileSize;
    const viewW = this.viewW;
    const viewH = this.viewH;

    ctx.fillStyle = CONFIG.colors.background;
    ctx.fillRect(0, 0, viewW, viewH);

    const startTX = Math.max(0, Math.floor((cameraX - viewW / scale / 2) / tileSize));
    const endTX = Math.min(tileMap.width, Math.ceil((cameraX + viewW / scale / 2) / tileSize));
    const startTY = Math.max(0, Math.floor((cameraY - viewH / scale / 2) / tileSize));
    const endTY = Math.min(tileMap.height, Math.ceil((cameraY + viewH / scale / 2) / tileSize));

    this._renderFloor(ctx, tileMap, startTX, endTX, startTY, endTY, tileSize, cameraX, cameraY, scale, viewW, viewH, room.theme);

    // Color spill from local lights onto environment
    if (room.envLights) {
      for (const light of room.envLights) {
        LocalLight.applyColorSpill(ctx, light, cameraX, cameraY, scale, viewW, viewH, this._time);
      }
    }

    // Landmarks (large visual anchors)
    if (room.landmarks) {
      for (const lm of room.landmarks) {
        this._renderLandmark(ctx, lm, cameraX, cameraY, scale, viewW, viewH);
      }
    }

    // Decor with shadows
    this._renderDecor(ctx, room.decor, cameraX, cameraY, scale, viewW, viewH);

    // Environmental light bulbs
    if (room.envLights) {
      for (const light of room.envLights) {
        LocalLight.renderBulb(ctx, light, cameraX, cameraY, scale, viewW, viewH, this._time);
      }
    }

    this._renderWalls(ctx, tileMap, startTX, endTX, startTY, endTY, tileSize, cameraX, cameraY, scale, viewW, viewH);

    this._renderObjective(ctx, room, cameraX, cameraY, scale, viewW, viewH);
    this._renderExit(ctx, room, cameraX, cameraY, scale, viewW, viewH);

    for (const enemy of enemies) {
      EnemyRenderer.render(ctx, enemy, player, cameraX, cameraY, scale, viewW, viewH, this._time);
    }

    PlayerRenderer.render(ctx, player, cameraX, cameraY, scale, viewW, viewH, this._time);
  }

  _renderFloor(ctx, tileMap, startTX, endTX, startTY, endTY, tileSize, cameraX, cameraY, scale, viewW, viewH, theme) {
    for (let ty = startTY; ty < endTY; ty++) {
      for (let tx = startTX; tx < endTX; tx++) {
        const tile = tileMap.getTile(tx, ty);
        if (tile === TILE.WALL) continue;

        const wx = tx * tileSize;
        const wy = ty * tileSize;
        const sx = (wx - cameraX) * scale + viewW / 2;
        const sy = (wy - cameraY) * scale + viewH / 2;
        const ss = tileSize * scale;

        const alt = (tx + ty) % 2 === 0;
        ctx.fillStyle = alt ? CONFIG.colors.floor : CONFIG.colors.floorAlt;
        ctx.fillRect(sx, sy, ss + 1, ss + 1);

        // Tile grid lines
        ctx.strokeStyle = CONFIG.colors.floorLine;
        ctx.globalAlpha = 0.25;
        ctx.lineWidth = 1;
        ctx.strokeRect(sx + 0.5, sy + 0.5, ss, ss);
        ctx.globalAlpha = 1;

        // Deterministic floor detail (no Math.random per frame)
        const hash = (tx * 73 + ty * 137) % 100;
        if (hash < 8) {
          ctx.strokeStyle = 'rgba(255,255,255,0.03)';
          ctx.beginPath();
          ctx.moveTo(sx + ss * 0.15, sy + ss * 0.4);
          ctx.lineTo(sx + ss * 0.85, sy + ss * 0.55);
          ctx.stroke();
        }

        // Directional arrow markings occasionally
        if (hash === 3 && tx % 5 === 0) {
          ctx.fillStyle = 'rgba(255,255,255,0.04)';
          const cx = sx + ss / 2;
          const cy = sy + ss / 2;
          ctx.beginPath();
          ctx.moveTo(cx, cy - ss * 0.15);
          ctx.lineTo(cx + ss * 0.12, cy + ss * 0.1);
          ctx.lineTo(cx - ss * 0.12, cy + ss * 0.1);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
  }

  _renderWalls(ctx, tileMap, startTX, endTX, startTY, endTY, tileSize, cameraX, cameraY, scale, viewW, viewH) {
    for (let ty = startTY; ty < endTY; ty++) {
      for (let tx = startTX; tx < endTX; tx++) {
        if (!tileMap.isWall(tx, ty)) continue;

        const wx = tx * tileSize;
        const wy = ty * tileSize;
        const sx = (wx - cameraX) * scale + viewW / 2;
        const sy = (wy - cameraY) * scale + viewH / 2;
        const ss = tileSize * scale;

        // Outer edge (darker)
        ctx.fillStyle = CONFIG.colors.wallInner;
        ctx.fillRect(sx, sy, ss + 1, ss + 1);

        // Main wall face
        ctx.fillStyle = CONFIG.colors.wall;
        ctx.fillRect(sx + 1, sy + 1, ss - 1, ss - 1);

        // Top highlight edge
        ctx.fillStyle = CONFIG.colors.wallEdge;
        ctx.fillRect(sx, sy, ss + 1, 2 * scale);

        // Left highlight
        ctx.fillStyle = CONFIG.colors.wallHighlight;
        ctx.globalAlpha = 0.4;
        ctx.fillRect(sx, sy, 2 * scale, ss + 1);
        ctx.globalAlpha = 1;

        // Occasional crack
        const hash = (tx * 47 + ty * 83) % 100;
        if (hash < 6) {
          ctx.strokeStyle = 'rgba(0,0,0,0.3)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(sx + ss * 0.3, sy + ss * 0.2);
          ctx.lineTo(sx + ss * 0.5, sy + ss * 0.7);
          ctx.stroke();
        }
      }
    }
  }

  _renderLandmark(ctx, lm, cameraX, cameraY, scale, viewW, viewH) {
    const sx = (lm.x - cameraX) * scale + viewW / 2;
    const sy = (lm.y - cameraY) * scale + viewH / 2;
    const s = lm.scale * scale;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(lm.rotation || 0);

    switch (lm.type) {
      case 'red_pipe':
        ctx.fillStyle = CONFIG.colors.emergency;
        ctx.fillRect(-s * 1.5, -s * 0.2, s * 3, s * 0.4);
        ctx.fillStyle = CONFIG.colors.metal;
        ctx.fillRect(-s * 0.3, -s * 0.35, s * 0.6, s * 0.7);
        break;
      case 'emergency_light':
        ctx.fillStyle = CONFIG.colors.emergency;
        ctx.globalAlpha = 0.6 + Math.sin(this._time * 3) * 0.2;
        ctx.fillRect(-s * 0.4, -s * 0.3, s * 0.8, s * 0.5);
        break;
      case 'large_generator':
        ctx.fillStyle = CONFIG.colors.metal;
        ctx.fillRect(-s, -s * 0.7, s * 2, s * 1.4);
        ctx.fillStyle = CONFIG.colors.power;
        ctx.fillRect(-s * 0.3, -s * 0.2, s * 0.15, s * 0.15);
        ctx.strokeStyle = CONFIG.colors.objectHighlight;
        ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
          ctx.strokeRect(-s * 0.7 + i * s * 0.35, -s * 0.5, s * 0.25, s * 0.8);
        }
        break;
      case 'pillar':
        ctx.fillStyle = CONFIG.colors.wall;
        ctx.fillRect(-s * 0.5, -s * 0.5, s, s);
        ctx.fillStyle = CONFIG.colors.wallEdge;
        ctx.fillRect(-s * 0.5, -s * 0.5, s, s * 0.15);
        break;
      case 'shelf_wall':
        ctx.fillStyle = CONFIG.colors.object;
        for (let i = 0; i < 3; i++) {
          ctx.fillRect(-s, -s * 0.8 + i * s * 0.35, s * 2, s * 0.08);
        }
        break;
      case 'warning_sign':
        ctx.fillStyle = CONFIG.colors.power;
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.6);
        ctx.lineTo(s * 0.5, s * 0.4);
        ctx.lineTo(-s * 0.5, s * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = CONFIG.colors.background;
        ctx.font = `${s * 0.5}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('!', 0, s * 0.25);
        break;
      case 'electrical_panel':
        ctx.fillStyle = CONFIG.colors.metal;
        ctx.fillRect(-s * 0.5, -s * 0.7, s, s * 1.4);
        ctx.fillStyle = CONFIG.colors.power;
        ctx.fillRect(-s * 0.35, -s * 0.5, s * 0.7, s * 0.2);
        ctx.strokeStyle = CONFIG.colors.objectHighlight;
        ctx.strokeRect(-s * 0.35, -s * 0.5, s * 0.7, s * 0.2);
        break;
    }
    ctx.restore();
  }

  _renderDecor(ctx, decor, cameraX, cameraY, scale, viewW, viewH) {
    for (const d of decor) {
      const sx = (d.x - cameraX) * scale + viewW / 2;
      const sy = (d.y - cameraY) * scale + viewH / 2;
      const s = 10 * d.scale * scale;

      // Shadow
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(sx + s * 0.15, sy + s * 0.2, s * 0.6, s * 0.25, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(d.rotation);
      ctx.fillStyle = CONFIG.colors.object;
      ctx.strokeStyle = CONFIG.colors.objectHighlight;
      ctx.lineWidth = 1;

      switch (d.type) {
        case 'crate':
        case 'box':
          ctx.fillRect(-s * 0.5, -s * 0.5, s, s);
          ctx.strokeRect(-s * 0.5, -s * 0.5, s, s);
          ctx.strokeStyle = 'rgba(255,255,255,0.08)';
          ctx.beginPath();
          ctx.moveTo(-s * 0.5, -s * 0.5);
          ctx.lineTo(s * 0.5, s * 0.5);
          ctx.moveTo(s * 0.5, -s * 0.5);
          ctx.lineTo(-s * 0.5, s * 0.5);
          ctx.stroke();
          break;
        case 'table':
        case 'desk':
          ctx.fillRect(-s, -s * 0.25, s * 2, s * 0.5);
          ctx.fillRect(-s * 0.8, -s * 0.25, s * 0.08, s * 0.5);
          ctx.fillRect(s * 0.72, -s * 0.25, s * 0.08, s * 0.5);
          break;
        case 'chair':
          ctx.fillRect(-s * 0.35, -s * 0.35, s * 0.7, s * 0.7);
          ctx.fillRect(-s * 0.35, -s * 0.55, s * 0.7, s * 0.15);
          break;
        case 'shelf':
          ctx.fillRect(-s * 0.8, -s * 0.7, s * 1.6, s * 1.4);
          for (let i = 0; i < 3; i++) {
            ctx.fillStyle = CONFIG.colors.objectHighlight;
            ctx.fillRect(-s * 0.75, -s * 0.6 + i * s * 0.4, s * 1.5, s * 0.06);
          }
          break;
        case 'barrel':
          ctx.beginPath();
          ctx.arc(0, 0, s * 0.45, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,0.1)';
          ctx.beginPath();
          ctx.moveTo(-s * 0.45, -s * 0.15);
          ctx.lineTo(s * 0.45, -s * 0.15);
          ctx.moveTo(-s * 0.45, s * 0.15);
          ctx.lineTo(s * 0.45, s * 0.15);
          ctx.stroke();
          break;
        case 'pipe':
          ctx.fillStyle = CONFIG.colors.metal;
          ctx.fillRect(-s * 1.2, -s * 0.18, s * 2.4, s * 0.36);
          ctx.fillStyle = CONFIG.colors.objectHighlight;
          ctx.fillRect(-s * 1.2, -s * 0.18, s * 2.4, s * 0.08);
          break;
        case 'generator':
          ctx.fillStyle = CONFIG.colors.metal;
          ctx.fillRect(-s * 0.6, -s * 0.5, s * 1.2, s);
          ctx.fillStyle = CONFIG.colors.power;
          ctx.fillRect(-s * 0.15, -s * 0.15, s * 0.1, s * 0.1);
          break;
        case 'fusebox':
          ctx.fillStyle = CONFIG.colors.metal;
          ctx.fillRect(-s * 0.4, -s * 0.55, s * 0.8, s * 1.1);
          ctx.fillStyle = CONFIG.colors.power;
          ctx.fillRect(-s * 0.3, -s * 0.35, s * 0.6, s * 0.15);
          ctx.strokeRect(-s * 0.3, -s * 0.35, s * 0.6, s * 0.15);
          break;
        case 'machinery':
          ctx.fillStyle = CONFIG.colors.metal;
          ctx.fillRect(-s * 0.7, -s * 0.6, s * 1.4, s * 1.2);
          ctx.fillStyle = CONFIG.colors.objectHighlight;
          ctx.fillRect(-s * 0.5, -s * 0.4, s * 0.3, s * 0.6);
          ctx.fillRect(s * 0.2, -s * 0.4, s * 0.3, s * 0.6);
          break;
        case 'cabinet':
          ctx.fillRect(-s * 0.5, -s * 0.7, s, s * 1.4);
          ctx.strokeRect(-s * 0.5, -s * 0.7, s, s * 1.4);
          ctx.fillStyle = CONFIG.colors.objectHighlight;
          ctx.fillRect(-s * 0.4, -s * 0.55, s * 0.8, s * 0.5);
          break;
        case 'monitor':
          ctx.fillStyle = CONFIG.colors.object;
          ctx.fillRect(-s * 0.5, -s * 0.4, s, s * 0.7);
          ctx.fillStyle = CONFIG.colors.lab;
          ctx.globalAlpha = 0.4;
          ctx.fillRect(-s * 0.42, -s * 0.35, s * 0.84, s * 0.55);
          ctx.globalAlpha = 1;
          ctx.fillStyle = CONFIG.colors.object;
          ctx.fillRect(-s * 0.15, s * 0.3, s * 0.3, s * 0.15);
          break;
        case 'cable':
        case 'wire':
          ctx.strokeStyle = CONFIG.colors.metal;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-s, 0);
          ctx.bezierCurveTo(-s * 0.3, -s, s * 0.3, s, s, 0);
          ctx.stroke();
          break;
        case 'warning_stripe':
          for (let i = -3; i <= 3; i++) {
            ctx.fillStyle = i % 2 === 0 ? CONFIG.colors.power : CONFIG.colors.metal;
            ctx.fillRect(-s * 1.2, i * s * 0.25 - s * 0.1, s * 2.4, s * 0.2);
          }
          break;
        case 'vent':
          ctx.fillStyle = CONFIG.colors.metal;
          ctx.fillRect(-s * 0.5, -s * 0.25, s, s * 0.5);
          ctx.strokeStyle = 'rgba(255,255,255,0.1)';
          for (let i = -2; i <= 2; i++) {
            ctx.beginPath();
            ctx.moveTo(-s * 0.4, i * s * 0.12);
            ctx.lineTo(s * 0.4, i * s * 0.12);
            ctx.stroke();
          }
          break;
        case 'paper':
          ctx.fillStyle = '#8B9199';
          ctx.fillRect(-s * 0.2, -s * 0.25, s * 0.4, s * 0.5);
          break;
        case 'stain':
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.beginPath();
          ctx.ellipse(0, 0, s * 0.5, s * 0.35, 0, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'broken':
          ctx.beginPath();
          ctx.moveTo(-s * 0.3, -s * 0.3);
          ctx.lineTo(s * 0.2, s * 0.1);
          ctx.lineTo(-s * 0.1, s * 0.4);
          ctx.closePath();
          ctx.fill();
          break;
        default:
          ctx.fillRect(-s * 0.35, -s * 0.35, s * 0.7, s * 0.7);
      }
      ctx.restore();
    }
  }

  _renderEnvLight(ctx, light, cameraX, cameraY, scale, viewW, viewH) {
    const sx = (light.x - cameraX) * scale + viewW / 2;
    const sy = (light.y - cameraY) * scale + viewH / 2;
    const pulse = light.pulse ? Math.sin(this._time * light.pulseSpeed + light.phase) * 0.3 + 0.7 : 0.6;
    const radius = light.radius * scale;

    // Soft local glow
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius);
    const color = light.color || CONFIG.colors.emergency;
    grad.addColorStop(0, this._hexToRgba(color, pulse * 0.25));
    grad.addColorStop(0.5, this._hexToRgba(color, pulse * 0.08));
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(sx - radius, sy - radius, radius * 2, radius * 2);

    // Indicator bulb
    ctx.fillStyle = this._hexToRgba(color, pulse * 0.9);
    ctx.beginPath();
    ctx.arc(sx, sy, 3 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  _hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  _renderObjective(ctx, room, cameraX, cameraY, scale, viewW, viewH) {
    const sx = (room.objective.x - cameraX) * scale + viewW / 2;
    const sy = (room.objective.y - cameraY) * scale + viewH / 2;

    ctx.save();
    // Fuse box on floor
    ctx.fillStyle = CONFIG.colors.object;
    ctx.fillRect(sx - 8 * scale, sy - 6 * scale, 16 * scale, 12 * scale);
    ctx.strokeStyle = CONFIG.colors.objective;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(sx - 8 * scale, sy - 6 * scale, 16 * scale, 12 * scale);
    ctx.fillStyle = CONFIG.colors.objective;
    ctx.fillRect(sx - 5 * scale, sy - 3 * scale, 10 * scale, 4 * scale);
    ctx.restore();
  }

  _renderExit(ctx, room, cameraX, cameraY, scale, viewW, viewH) {
    const sx = (room.exit.x - cameraX) * scale + viewW / 2;
    const sy = (room.exit.y - cameraY) * scale + viewH / 2;
    const w = 22 * scale;
    const h = 32 * scale;

    ctx.save();
    const unlocked = room.exitUnlocked;
    const alpha = unlocked ? 0.85 : 0.35;

    // Door frame
    ctx.fillStyle = CONFIG.colors.metal;
    ctx.fillRect(sx - w / 2 - 3 * scale, sy - h / 2 - 3 * scale, w + 6 * scale, h + 6 * scale);

    // Door
    ctx.fillStyle = unlocked ? CONFIG.colors.exit : CONFIG.colors.object;
    ctx.globalAlpha = alpha;
    ctx.fillRect(sx - w / 2, sy - h / 2, w, h);

    // EXIT sign above door
    if (unlocked) {
      ctx.fillStyle = CONFIG.colors.exit;
      ctx.fillRect(sx - w / 2, sy - h / 2 - 8 * scale, w, 6 * scale);
      ctx.fillStyle = CONFIG.colors.background;
      ctx.font = `bold ${5 * scale}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('EXIT', sx, sy - h / 2 - 3 * scale);
    }

    // Green indicator light
    const glowPulse = unlocked ? 0.5 + Math.sin(this._time * 2) * 0.3 : 0.15;
    ctx.fillStyle = this._hexToRgba(CONFIG.colors.exitGlow, glowPulse);
    ctx.beginPath();
    ctx.arc(sx + w / 2 - 4 * scale, sy - h / 2 + 6 * scale, 3 * scale, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  _renderEnemy(ctx, enemy, player, cameraX, cameraY, scale, viewW, viewH) {
    const sx = (enemy.x - cameraX) * scale + viewW / 2;
    const sy = (enemy.y - cameraY) * scale + viewH / 2;
    const dist = Math.sqrt((enemy.x - player.x) ** 2 + (enemy.y - player.y) ** 2);
    const showSilhouette = dist < 100 && !enemy.visible;

    if (!enemy.visible && !showSilhouette) {
      if (enemy.eyeFlash > 0) {
        ctx.save();
        ctx.globalAlpha = enemy.eyeFlash;
        ctx.fillStyle = CONFIG.colors.enemyEyes;
        const eyeOffset = 4 * scale;
        ctx.beginPath();
        ctx.arc(sx - eyeOffset, sy - 2 * scale, 1.5 * scale, 0, Math.PI * 2);
        ctx.arc(sx + eyeOffset, sy - 2 * scale, 1.5 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      return;
    }

    ctx.save();
    const alpha = enemy.visible ? 0.92 : 0.25;
    ctx.globalAlpha = alpha;

    const bodyW = 12 * scale;
    const bodyH = 28 * scale;
    const limbPhase = Math.sin(enemy.idlePhase * 2) * 2;

    ctx.fillStyle = CONFIG.colors.enemy;
    ctx.fillRect(sx - bodyW / 2, sy - bodyH / 2, bodyW, bodyH);
    ctx.fillRect(sx - bodyW / 2 - 3 * scale, sy - bodyH / 2 + limbPhase, 3 * scale, bodyH * 0.7);
    ctx.fillRect(sx + bodyW / 2, sy - bodyH / 2 - limbPhase, 3 * scale, bodyH * 0.7);
    ctx.beginPath();
    ctx.arc(sx, sy - bodyH / 2 - 6 * scale, 7 * scale, 0, Math.PI * 2);
    ctx.fill();

    if (enemy.visible || enemy.eyeFlash > 0) {
      ctx.fillStyle = CONFIG.colors.enemyEyes;
      ctx.globalAlpha = enemy.visible ? 0.85 : enemy.eyeFlash;
      const eyeOffset = 3 * scale;
      ctx.beginPath();
      ctx.arc(sx - eyeOffset, sy - bodyH / 2 - 6 * scale, 1.5 * scale, 0, Math.PI * 2);
      ctx.arc(sx + eyeOffset, sy - bodyH / 2 - 6 * scale, 1.5 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  _renderPlayer(ctx, player, cameraX, cameraY, scale, viewW, viewH) {
    const bob = player.getBobOffset();
    const sx = (player.x - cameraX) * scale + viewW / 2;
    const sy = (player.y - cameraY) * scale + viewH / 2 + bob * scale;
    const r = player.radius * scale;

    // Shadow
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + r * 0.5, r * 0.9, r * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Body silhouette
    ctx.save();
    ctx.fillStyle = '#1A1F26';
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();

    // Rim light when flashlight on
    if (player.flashlight.isOn) {
      ctx.strokeStyle = 'rgba(255,244,214,0.2)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Direction hint
    if (player.flashlight.isOn) {
      const angle = player.flashlight.angle;
      ctx.strokeStyle = 'rgba(255,244,214,0.15)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(angle) * 18 * scale, sy + Math.sin(angle) * 18 * scale);
      ctx.stroke();
    }
    ctx.restore();
  }

  applyDarkness(ctx, flashlight, cameraX, cameraY, scale, tileMap, room) {
    const viewW = this.viewW;
    const viewH = this.viewH;
    const darkCtx = this.darkCtx;
    const lightCtx = this.lightCtx;
    const boost = this._isMobile ? CONFIG.lighting.mobileBrightnessBoost : 1;

    const darknessAlpha = CONFIG.lighting.darknessOpacity / boost;
    darkCtx.clearRect(0, 0, viewW, viewH);

    // Layered darkness — not flat black
    const grad = darkCtx.createRadialGradient(viewW / 2, viewH / 2, 0, viewW / 2, viewH / 2, Math.max(viewW, viewH) * 0.7);
    grad.addColorStop(0, `rgba(${CONFIG.lighting.darknessColor}, ${darknessAlpha * 0.92})`);
    grad.addColorStop(0.6, `rgba(${CONFIG.lighting.darknessColor}, ${darknessAlpha})`);
    grad.addColorStop(1, `rgba(0,0,0,${CONFIG.lighting.deepShadowOpacity || 0.95})`);
    darkCtx.fillStyle = grad;
    darkCtx.fillRect(0, 0, viewW, viewH);

    const px = (flashlight.x - cameraX) * scale + viewW / 2;
    const py = (flashlight.y - cameraY) * scale + viewH / 2;

    // Subtle ambient around player — reduced
    const ambientR = CONFIG.lighting.ambientPlayerRadius * scale * boost;
    const ambientGrad = darkCtx.createRadialGradient(px, py, 0, px, py, ambientR);
    const amb = CONFIG.lighting.ambientStrength * boost;
    ambientGrad.addColorStop(0, `rgba(${CONFIG.lighting.darknessColor}, ${darknessAlpha * (1 - amb * 2)})`);
    ambientGrad.addColorStop(0.6, `rgba(${CONFIG.lighting.darknessColor}, ${darknessAlpha * (1 - amb * 0.5)})`);
    ambientGrad.addColorStop(1, `rgba(${CONFIG.lighting.darknessColor}, ${darknessAlpha})`);
    darkCtx.globalCompositeOperation = 'destination-out';
    darkCtx.fillStyle = ambientGrad;
    darkCtx.beginPath();
    darkCtx.arc(px, py, ambientR, 0, Math.PI * 2);
    darkCtx.fill();
    darkCtx.globalCompositeOperation = 'source-over';

    // Local lights with occlusion
    if (room?.envLights) {
      for (const light of room.envLights) {
        LocalLight.cutDarkness(darkCtx, light, tileMap, cameraX, cameraY, scale, viewW, viewH, this._time, flashlight.x, flashlight.y);
      }
    }

    const worldX = flashlight.x;
    const worldY = flashlight.y;
    let debugPolygon = null;

    if (flashlight.isOn && flashlight.battery > 0) {
      lightCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      lightCtx.clearRect(0, 0, viewW, viewH);

      const flicker = this.debugFlashlightSimple ? 1 : flashlight.flickerMultiplier;
      const angle = flashlight.angle;
      const spillHalf = CONFIG.flashlight.spillFov / 2;
      const worldMaxRange = CONFIG.flashlight.spillRange * boost;

      const polygon = buildConeVisibilityPolygon(
        worldX, worldY, angle, spillHalf, worldMaxRange, tileMap
      );
      debugPolygon = polygon;

      lightCtx.setTransform(
        scale * this.dpr, 0, 0, scale * this.dpr,
        (viewW / 2 - cameraX * scale) * this.dpr,
        (viewH / 2 - cameraY * scale) * this.dpr
      );

      if (this.debugFlashlight && this.debugFlashlightSimple) {
        this._fillVisibilityPolygon(lightCtx, worldX, worldY, polygon, '#ffffff');
      } else {
        const spillRange = CONFIG.flashlight.spillRange * flicker * boost;
        const broadRange = CONFIG.flashlight.broadRange * flicker * boost;
        const focusedRange = CONFIG.flashlight.range * flicker * boost;

        this._drawLightConeWorld(lightCtx, worldX, worldY, angle, spillHalf, spillRange, [
          { stop: 0, alpha: 0.5 },
          { stop: 0.3, alpha: 0.25 },
          { stop: 0.6, alpha: 0.1 },
          { stop: 1, alpha: 0 },
        ]);

        this._drawLightConeWorld(lightCtx, worldX, worldY, angle, CONFIG.flashlight.broadFov / 2, broadRange, [
          { stop: 0, alpha: 0.92 },
          { stop: 0.2, alpha: 0.75 },
          { stop: 0.45, alpha: 0.4 },
          { stop: 0.7, alpha: 0.15 },
          { stop: 1, alpha: 0 },
        ], true);

        this._drawLightConeWorld(lightCtx, worldX, worldY, angle, CONFIG.flashlight.focusedFov / 2, focusedRange, [
          { stop: 0, alpha: 1 },
          { stop: 0.15, alpha: 0.9 },
          { stop: 0.4, alpha: 0.5 },
          { stop: 0.65, alpha: 0.15 },
          { stop: 1, alpha: 0 },
        ], true);

        if (!this.debugFlashlightSimple) {
          const bloomR = focusedRange * 0.22;
          const bloom = lightCtx.createRadialGradient(worldX, worldY, 0, worldX, worldY, bloomR);
          bloom.addColorStop(0, `rgba(255,251,232,${CONFIG.flashlight.bloomStrength * flicker})`);
          bloom.addColorStop(1, 'rgba(255,251,232,0)');
          lightCtx.fillStyle = bloom;
          lightCtx.beginPath();
          lightCtx.arc(worldX, worldY, bloomR, 0, Math.PI * 2);
          lightCtx.fill();
        }

        this._maskFlashlightVisibilityWorld(lightCtx, worldX, worldY, polygon);
      }

      lightCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

      darkCtx.globalCompositeOperation = 'destination-out';
      darkCtx.imageSmoothingEnabled = false;
      darkCtx.drawImage(this.lightCanvas, 0, 0, viewW, viewH);
      darkCtx.imageSmoothingEnabled = true;
      darkCtx.globalCompositeOperation = 'source-over';
    }

    ctx.drawImage(this.darkCanvas, 0, 0, viewW, viewH);

    if (this.debugFlashlight && debugPolygon) {
      this._drawDebugFlashlightMarkers(
        ctx, px, py, worldX, worldY, cameraX, cameraY, scale, viewW, viewH, debugPolygon
      );
      if (this.debugFlashlightSimple) {
        this._strokeDebugPolygonScreen(ctx, debugPolygon, cameraX, cameraY, scale, viewW, viewH);
      }
    }
  }

  _strokeDebugPolygonScreen(ctx, polygon, cameraX, cameraY, scale, viewW, viewH) {
    if (polygon.length < 2) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 60, 60, 0.95)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo((polygon[0].x - cameraX) * scale + viewW / 2, (polygon[0].y - cameraY) * scale + viewH / 2);
    for (let i = 1; i < polygon.length; i++) {
      ctx.lineTo((polygon[i].x - cameraX) * scale + viewW / 2, (polygon[i].y - cameraY) * scale + viewH / 2);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  _maskFlashlightVisibilityWorld(lightCtx, worldX, worldY, polygon) {
    if (polygon.length < 3) return;

    lightCtx.beginPath();
    lightCtx.moveTo(worldX, worldY);
    for (let i = 1; i < polygon.length; i++) {
      lightCtx.lineTo(polygon[i].x, polygon[i].y);
    }
    lightCtx.closePath();
    lightCtx.globalCompositeOperation = 'destination-in';
    lightCtx.fillStyle = '#ffffff';
    lightCtx.fill();
    lightCtx.globalCompositeOperation = 'source-over';
  }

  _drawLightConeWorld(ctx, wx, wy, angle, halfFov, rangeWorld, stops, warm = false) {
    ctx.save();
    ctx.translate(wx, wy);
    ctx.rotate(angle);

    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, rangeWorld);
    for (const s of stops) {
      const color = warm ? '255,244,214' : '255,255,255';
      gradient.addColorStop(s.stop, `rgba(${color},${s.alpha})`);
    }

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, rangeWorld, -halfFov, halfFov);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.restore();
  }

  _fillVisibilityPolygon(lightCtx, worldX, worldY, polygon, fillStyle) {
    if (polygon.length < 3) return;
    lightCtx.beginPath();
    lightCtx.moveTo(worldX, worldY);
    for (let i = 1; i < polygon.length; i++) {
      lightCtx.lineTo(polygon[i].x, polygon[i].y);
    }
    lightCtx.closePath();
    lightCtx.fillStyle = fillStyle;
    lightCtx.fill();
  }

  _drawDebugFlashlightPolygon(lightCtx, worldX, worldY, polygon) {
    this._fillVisibilityPolygon(lightCtx, worldX, worldY, polygon, 'rgba(255, 40, 40, 0.85)');
    lightCtx.strokeStyle = 'rgba(255, 80, 80, 0.9)';
    lightCtx.lineWidth = 1 / (this.dpr || 1);
    lightCtx.stroke();
  }

  _drawDebugFlashlightMarkers(ctx, px, py, worldX, worldY, cameraX, cameraY, scale, viewW, viewH, polygon) {
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fill();

    const raySx = (worldX - cameraX) * scale + viewW / 2;
    const raySy = (worldY - cameraY) * scale + viewH / 2;
    ctx.fillStyle = '#ff4444';
    ctx.beginPath();
    ctx.arc(raySx, raySy, 3, 0, Math.PI * 2);
    ctx.fill();

    if (polygon.length > 1) {
      const mid = polygon[Math.floor(polygon.length / 2)];
      const edgeSx = (mid.x - cameraX) * scale + viewW / 2;
      const edgeSy = (mid.y - cameraY) * scale + viewH / 2;
      ctx.strokeStyle = 'rgba(255, 200, 0, 0.9)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(edgeSx, edgeSy);
      ctx.stroke();
    }
    ctx.restore();
  }
}
