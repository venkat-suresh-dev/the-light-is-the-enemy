import { CONFIG } from '../utils/Constants.js';

export class Collision {
  /**
   * Move a circle through a tile map with axis-separated resolution for smooth wall sliding.
   */
  static moveCircleTileMap(x, y, radius, tileMap, dx, dy, margin = 0) {
    const r = Math.max(1, radius - margin);
    let px = x;
    let py = y;
    let blockedX = false;
    let blockedY = false;

    if (dx !== 0) {
      px += dx;
      const resX = Collision._resolveAxis(px, py, r, tileMap, 'x');
      px = resX.x;
      py = resX.y;
      blockedX = resX.blocked;
    }

    if (dy !== 0) {
      py += dy;
      const resY = Collision._resolveAxis(px, py, r, tileMap, 'y');
      px = resY.x;
      py = resY.y;
      blockedY = resY.blocked;
    }

    const worldW = tileMap.getWorldWidth();
    const worldH = tileMap.getWorldHeight();

    if (px - r < 0) {
      px = r;
      blockedX = true;
    } else if (px + r > worldW) {
      px = worldW - r;
      blockedX = true;
    }

    if (py - r < 0) {
      py = r;
      blockedY = true;
    } else if (py + r > worldH) {
      py = worldH - r;
      blockedY = true;
    }

    return { x: px, y: py, blockedX, blockedY };
  }

  /**
   * @deprecated Use moveCircleTileMap for swept axis-separated movement.
   */
  static resolveCircleTileMap(x, y, radius, tileMap, velocity) {
    const dx = velocity?.x ?? 0;
    const dy = velocity?.y ?? 0;
    const margin = CONFIG.player?.collisionMargin ?? 0;
    const result = Collision.moveCircleTileMap(x, y, radius, tileMap, dx, dy, margin);

    if (velocity) {
      if (result.blockedX) velocity.x = 0;
      if (result.blockedY) velocity.y = 0;
    }

    return { x: result.x, y: result.y, velocity, blockedX: result.blockedX, blockedY: result.blockedY };
  }

  static _resolveAxis(x, y, radius, tileMap, axis) {
    const tileSize = tileMap.tileSize;
    let px = x;
    let py = y;
    let blocked = false;

    for (let iter = 0; iter < 4; iter++) {
      let moved = false;
      const minTX = Math.floor((px - radius) / tileSize);
      const maxTX = Math.floor((px + radius) / tileSize);
      const minTY = Math.floor((py - radius) / tileSize);
      const maxTY = Math.floor((py + radius) / tileSize);

      for (let ty = minTY; ty <= maxTY; ty++) {
        for (let tx = minTX; tx <= maxTX; tx++) {
          if (!tileMap.isWall(tx, ty)) continue;

          const left = tx * tileSize;
          const top = ty * tileSize;
          const right = left + tileSize;
          const bottom = top + tileSize;

          const res = axis === 'x'
            ? Collision._resolveCircleRectX(px, py, radius, left, top, right, bottom)
            : Collision._resolveCircleRectY(px, py, radius, left, top, right, bottom);

          if (res.blocked) {
            px = res.x;
            py = res.y;
            blocked = true;
            moved = true;
          }
        }
      }

      if (!moved) break;
    }

    return { x: px, y: py, blocked };
  }

  static _resolveCircleRectX(cx, cy, r, left, top, right, bottom) {
    if (cy + r <= top || cy - r >= bottom) {
      return { x: cx, y: cy, blocked: false };
    }

    if (cx + r <= left || cx - r >= right) {
      return { x: cx, y: cy, blocked: false };
    }

    if (cx < left) {
      return { x: left - r, y: cy, blocked: true };
    }

    if (cx > right) {
      return { x: right + r, y: cy, blocked: true };
    }

    const toWest = cx - left;
    const toEast = right - cx;
    if (toWest < toEast) {
      return { x: left - r, y: cy, blocked: true };
    }

    return { x: right + r, y: cy, blocked: true };
  }

  static _resolveCircleRectY(cx, cy, r, left, top, right, bottom) {
    if (cx + r <= left || cx - r >= right) {
      return { x: cx, y: cy, blocked: false };
    }

    if (cy + r <= top || cy - r >= bottom) {
      return { x: cx, y: cy, blocked: false };
    }

    if (cy < top) {
      return { x: cx, y: top - r, blocked: true };
    }

    if (cy > bottom) {
      return { x: cx, y: bottom + r, blocked: true };
    }

    const toNorth = cy - top;
    const toSouth = bottom - cy;
    if (toNorth < toSouth) {
      return { x: cx, y: top - r, blocked: true };
    }

    return { x: cx, y: bottom + r, blocked: true };
  }

  static isCircleFree(x, y, radius, tileMap) {
    const margin = CONFIG.player?.collisionMargin ?? 0;
    const r = Math.max(1, radius - margin);
    const tileSize = tileMap.tileSize;
    const minTX = Math.floor((x - r) / tileSize);
    const maxTX = Math.floor((x + r) / tileSize);
    const minTY = Math.floor((y - r) / tileSize);
    const maxTY = Math.floor((y + r) / tileSize);

    for (let ty = minTY; ty <= maxTY; ty++) {
      for (let tx = minTX; tx <= maxTX; tx++) {
        if (!tileMap.isWall(tx, ty)) continue;

        const left = tx * tileSize;
        const top = ty * tileSize;
        const right = left + tileSize;
        const bottom = top + tileSize;

        const closestX = Math.max(left, Math.min(x, right));
        const closestY = Math.max(top, Math.min(y, bottom));
        const dx = x - closestX;
        const dy = y - closestY;

        if (dx * dx + dy * dy < r * r) return false;
      }
    }

    return true;
  }
}
