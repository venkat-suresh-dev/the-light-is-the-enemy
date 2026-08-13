import { angleDifference } from './MathUtils.js';

const MIN_HIT_DIST = 1.5;
const FLASHLIGHT_RAY_STEPS = 56;

export function pointInCone(px, py, originX, originY, angle, fov, range) {
  const dx = px - originX;
  const dy = py - originY;
  const distSq = dx * dx + dy * dy;
  if (distSq > range * range) return false;

  const angleToPoint = Math.atan2(dy, dx);
  const diff = Math.abs(angleDifference(angleToPoint, angle));
  return diff <= fov / 2;
}

/**
 * Raycast from origin toward target, returns true if unobstructed.
 */
export function hasLineOfSight(originX, originY, targetX, targetY, tileMap, tileSize) {
  const dx = targetX - originX;
  const dy = targetY - originY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 1) return true;

  const steps = Math.ceil(dist / (tileSize * 0.5));
  const stepX = dx / steps;
  const stepY = dy / steps;

  for (let i = 1; i < steps; i++) {
    const x = originX + stepX * i;
    const y = originY + stepY * i;
    if (tileMap.isWallAt(x, y)) return false;
  }
  return true;
}

export function circleRectCollision(cx, cy, radius, rx, ry, rw, rh) {
  const closestX = Math.max(rx, Math.min(cx, rx + rw));
  const closestY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy < radius * radius;
}

export function circleCircleCollision(x1, y1, r1, x2, y2, r2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const minDist = r1 + r2;
  return dx * dx + dy * dy < minDist * minDist;
}

/**
 * Ray vs line segment intersection. Returns ray parameter t or null.
 */
export function raySegmentIntersect(ox, oy, dx, dy, x1, y1, x2, y2, maxT) {
  const sx = x2 - x1;
  const sy = y2 - y1;
  const denom = dx * sy - dy * sx;
  if (Math.abs(denom) < 1e-10) return null;

  const qpx = x1 - ox;
  const qpy = y1 - oy;
  const t = (qpx * sy - qpy * sx) / denom;
  const u = (qpx * dy - qpy * dx) / denom;

  if (t >= MIN_HIT_DIST && t <= maxT && u >= 0 && u <= 1) return t;
  return null;
}

/**
 * Cast a ray through the tile map and return the nearest wall hit in world space.
 */
export function raycastTileMap(ox, oy, angle, maxDist, tileMap) {
  const tileSize = tileMap.tileSize;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let closestT = maxDist;

  const minTX = Math.floor((ox - maxDist) / tileSize);
  const maxTX = Math.floor((ox + maxDist) / tileSize);
  const minTY = Math.floor((oy - maxDist) / tileSize);
  const maxTY = Math.floor((oy + maxDist) / tileSize);

  for (let ty = minTY; ty <= maxTY; ty++) {
    for (let tx = minTX; tx <= maxTX; tx++) {
      if (!tileMap.isWall(tx, ty)) continue;

      const left = tx * tileSize;
      const top = ty * tileSize;
      const right = left + tileSize;
      const bottom = top + tileSize;

      const edges = [
        [left, top, right, top],
        [right, top, right, bottom],
        [right, bottom, left, bottom],
        [left, bottom, left, top],
      ];

      for (const [x1, y1, x2, y2] of edges) {
        const t = raySegmentIntersect(ox, oy, dx, dy, x1, y1, x2, y2, closestT);
        if (t !== null && t < closestT) closestT = t;
      }
    }
  }

  return {
    x: ox + dx * closestT,
    y: oy + dy * closestT,
    dist: closestT,
  };
}

function _isSilhouetteVertex(gx, gy, tileMap) {
  const ts = tileMap.tileSize;
  const tx = Math.floor(gx / ts);
  const ty = Math.floor(gy / ts);

  const tl = tileMap.isWall(tx - 1, ty - 1);
  const tr = tileMap.isWall(tx, ty - 1);
  const bl = tileMap.isWall(tx - 1, ty);
  const br = tileMap.isWall(tx, ty);

  const pattern = (tl ? 1 : 0) + (tr ? 2 : 0) + (bl ? 4 : 0) + (br ? 8 : 0);
  if (pattern === 0 || pattern === 15) return false;
  // Collinear wall runs (not geometric corners): horizontal 3/12, vertical 5/10
  if (pattern === 3 || pattern === 12 || pattern === 5 || pattern === 10) return false;
  return true;
}

function _angleInCone(a, coneMin, coneMax) {
  const center = (coneMin + coneMax) / 2;
  const half = (coneMax - coneMin) / 2;
  return Math.abs(angleDifference(a, center)) <= half + 0.001;
}

function _unwrapToCone(a, coneMin, coneMax) {
  const center = (coneMin + coneMax) / 2;
  while (a < center - Math.PI) a += Math.PI * 2;
  while (a > center + Math.PI) a -= Math.PI * 2;
  return a;
}

function _hitsAreCollinear(a, b, c) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const bcx = c.x - b.x;
  const bcy = c.y - b.y;
  const abLen = Math.hypot(abx, aby);
  const bcLen = Math.hypot(bcx, bcy);
  if (abLen < 1e-6 || bcLen < 1e-6) return true;
  const cross = abx * bcy - aby * bcx;
  return Math.abs(cross) <= 1e-3 * abLen * bcLen;
}

function _weldColinearHits(points) {
  if (points.length <= 4) return points;
  const origin = points[0];
  const hits = points.slice(1);
  const kept = [hits[0]];
  for (let i = 1; i < hits.length - 1; i++) {
    const prev = kept[kept.length - 1];
    const curr = hits[i];
    const next = hits[i + 1];
    if (!_hitsAreCollinear(prev, curr, next)) kept.push(curr);
  }
  kept.push(hits[hits.length - 1]);
  return [origin, ...kept];
}

/**
 * Build a fan visibility polygon for the flashlight cone.
 * Uniform angular rays + silhouette corner rays, raycast to wall edges.
 * Returns world-space points: [origin, ...sorted boundary hits].
 */
export function buildConeVisibilityPolygon(ox, oy, angle, halfFov, maxRange, tileMap) {
  const tileSize = tileMap.tileSize;
  const coneMin = angle - halfFov;
  const coneMax = angle + halfFov;
  const rangeSq = maxRange * maxRange;
  const angleMap = new Map();

  const addAngle = (a) => {
    if (!_angleInCone(a, coneMin, coneMax)) return;
    angleMap.set(Math.round(a * 1e5), a);
  };

  addAngle(coneMin);
  addAngle(coneMax);

  for (let i = 0; i <= FLASHLIGHT_RAY_STEPS; i++) {
    addAngle(coneMin + ((coneMax - coneMin) * i) / FLASHLIGHT_RAY_STEPS);
  }

  const minTX = Math.floor((ox - maxRange) / tileSize);
  const maxTX = Math.floor((ox + maxRange) / tileSize);
  const minTY = Math.floor((oy - maxRange) / tileSize);
  const maxTY = Math.floor((oy + maxRange) / tileSize);

  const seenCorners = new Set();

  for (let ty = minTY; ty <= maxTY; ty++) {
    for (let tx = minTX; tx <= maxTX; tx++) {
      if (!tileMap.isWall(tx, ty)) continue;

      const cx0 = tx * tileSize;
      const cy0 = ty * tileSize;
      const corners = [
        { x: cx0, y: cy0 },
        { x: cx0 + tileSize, y: cy0 },
        { x: cx0 + tileSize, y: cy0 + tileSize },
        { x: cx0, y: cy0 + tileSize },
      ];

      for (const c of corners) {
        const key = `${c.x},${c.y}`;
        if (seenCorners.has(key)) continue;
        seenCorners.add(key);
        if (!_isSilhouetteVertex(c.x, c.y, tileMap)) continue;

        const dx = c.x - ox;
        const dy = c.y - oy;
        const distSq = dx * dx + dy * dy;
        if (distSq > rangeSq || distSq < 9) continue;

        const a = _unwrapToCone(Math.atan2(dy, dx), coneMin, coneMax);
        if (!_angleInCone(a, coneMin, coneMax)) continue;

        addAngle(a - 0.0001);
        addAngle(a + 0.0001);
      }
    }
  }

  const angles = [...angleMap.values()].sort((a, b) => a - b);
  const points = [{ x: ox, y: oy }];

  for (const a of angles) {
    const hit = raycastTileMap(ox, oy, a, maxRange, tileMap);
    points.push({ x: hit.x, y: hit.y });
  }

  return _weldColinearHits(points);
}

// Backward-compatible alias
export const buildFlashlightVisibilityPolygon = buildConeVisibilityPolygon;
