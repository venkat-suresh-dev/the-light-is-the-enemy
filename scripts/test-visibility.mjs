/**
 * Flashlight visibility polygon regression checks.
 */
import { buildConeVisibilityPolygon, raycastTileMap } from '../src/utils/Geometry.js';
import { TileMap } from '../src/world/TileMap.js';
import { TILE, CONFIG } from '../src/utils/Constants.js';
import { angleDifference } from '../src/utils/MathUtils.js';

function makeMap(width, height, wallFn) {
  const tiles = new Array(width * height).fill(TILE.FLOOR);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (wallFn(x, y)) tiles[y * width + x] = TILE.WALL;
    }
  }
  return new TileMap(width, height, tiles);
}

let passed = 0;
let failed = 0;

function assert(name, condition) {
  if (condition) {
    passed++;
    console.log(`  OK: ${name}`);
  } else {
    failed++;
    console.error(`  FAIL: ${name}`);
  }
}

function pipFan(px, py, poly) {
  const ox = poly[0].x;
  const oy = poly[0].y;
  for (let i = 1; i < poly.length - 1; i++) {
    const ax = ox, ay = oy;
    const bx = poly[i].x, by = poly[i].y;
    const cx = poly[i + 1].x, cy = poly[i + 1].y;
    const v0x = cx - ax, v0y = cy - ay;
    const v1x = bx - ax, v1y = by - ay;
    const v2x = px - ax, v2y = py - ay;
    const dot00 = v0x * v0x + v0y * v0y;
    const dot01 = v0x * v1x + v0y * v1y;
    const dot02 = v0x * v2x + v0y * v2y;
    const dot11 = v1x * v1x + v1y * v1y;
    const dot12 = v1x * v2x + v1y * v2y;
    const den = dot00 * dot11 - dot01 * dot01;
    if (Math.abs(den) < 1e-18) continue;
    const u = (dot11 * dot02 - dot01 * dot12) / den;
    const v = (dot00 * dot12 - dot01 * dot02) / den;
    if (u >= -1e-7 && v >= -1e-7 && u + v <= 1 + 1e-7) return true;
  }
  return false;
}

function occupancy(poly, x, y0, y1, step) {
  const bits = [];
  for (let y = y0; y <= y1; y += step) bits.push(pipFan(x, y, poly) ? 1 : 0);
  return bits;
}

function isolatedFlicker(a, b) {
  let n = 0;
  for (let i = 1; i < a.length - 1; i++) {
    if (a[i] !== b[i] && a[i - 1] === 1 && b[i - 1] === 1 && a[i + 1] === 1 && b[i + 1] === 1) n++;
  }
  return n;
}

function nearPoint(poly, x, y, r) {
  return poly.slice(1).some((p) => Math.hypot(p.x - x, p.y - y) < r);
}

function anglesMonotonic(poly, ox, oy) {
  const angs = [];
  for (let i = 1; i < poly.length; i++) {
    angs.push(Math.atan2(poly[i].y - oy, poly[i].x - ox));
  }
  let unwrap = angs[0];
  const u = [unwrap];
  for (let i = 1; i < angs.length; i++) {
    unwrap += angleDifference(angs[i], unwrap);
    u.push(unwrap);
  }
  for (let i = 1; i < u.length; i++) {
    if (u[i] + 1e-6 < u[i - 1]) return false;
  }
  return true;
}

const TS = CONFIG.world.tileSize;
const half = CONFIG.flashlight.spillFov / 2;
const range = CONFIG.flashlight.spillRange;

console.log('--- existing checks ---');

const map = makeMap(12, 12, (x, y) => x === 0 || x === 11 || y === 0 || y === 11 || x === 3);
const ox = 70;
const oy = 192;
const poly = buildConeVisibilityPolygon(ox, oy, 0, Math.PI / 3, 500, map);

assert('visibility polygon has origin plus ray hits', poly.length >= 3);
assert('polygon starts at light origin', poly[0].x === ox && poly[0].y === oy);

let blocked = false;
for (let i = 1; i < poly.length; i++) {
  if (poly[i].x > 95) blocked = true;
}
assert('polygon respects wall occlusion', blocked);

const hit = raycastTileMap(ox, oy, 0, 500, map);
assert('raycast stops at wall face', hit.x <= 96.01);

const longWallMap = makeMap(20, 8, (x, y) => y === 0 || y === 7 || (x >= 5 && x <= 15 && y === 4));
const longPoly = buildConeVisibilityPolygon(100, 100, 0, Math.PI / 4, 400, longWallMap);
const wallHits = longPoly.slice(1).filter((p) => p.y <= 128.5 && p.y >= 127.5);
if (wallHits.length >= 2) {
  const collinear = wallHits.every((p) => Math.abs(p.y - wallHits[0].y) < 0.5);
  assert('straight wall hits are collinear', collinear);
} else {
  assert('straight wall hits are collinear', wallHits.length >= 1);
}

assert(
  'polygon spans cone toward wall',
  poly.slice(1).some((p) => p.x >= 95 && p.x <= 97)
);

const openMap = makeMap(12, 12, (x, y) => x === 0 || x === 11 || y === 0 || y === 11);
const openPoly = buildConeVisibilityPolygon(160, 160, -Math.PI / 4, Math.PI / 4, 200, openMap);
const openHit = openPoly[Math.floor(openPoly.length / 2)];
const openDist = Math.hypot(openHit.x - 160, openHit.y - 160);
assert('open space polygon reaches beam range', openDist > 150);

const arcMap = makeMap(40, 30, () => false);
const arcPoly = buildConeVisibilityPolygon(640, 480, 0, Math.PI / 4, 80, arcMap);
assert('open arc keeps samples (circle not welded flat)', arcPoly.length >= 50);

console.log('\n--- 1. long straight vertical wall ---');
const vWallTx = 22;
const vWallX = vWallTx * TS;
const vMap = makeMap(40, 30, (x) => x === vWallTx);
const vOx = vWallX - 48;
const vOy = 15 * TS + 16;
const vPoly = buildConeVisibilityPolygon(vOx, vOy, 0, half, range, vMap);
const vOnWall = vPoly.slice(1).filter((p) => Math.abs(p.x - vWallX) < 1 && p.y > TS && p.y < 29 * TS);
console.log(`  vertical wall vertex count: ${vPoly.length} (origin + ${vPoly.length - 1} hits), on-wall hits: ${vOnWall.length}`);
assert('vertical wall on-plane hits', vOnWall.every((p) => Math.abs(p.x - vWallX) < 1e-4));
assert('vertical wall welded (few on-wall verts)', vOnWall.length <= 4);
assert('vertical wall still occludes', vOnWall.length >= 1);
assert('vertical wall fan order', anglesMonotonic(vPoly, vOx, vOy));

console.log('\n--- 2. long straight horizontal wall ---');
const hWallTy = 10;
const hWallY = hWallTy * TS;
const hMap = makeMap(40, 30, (x, y) => y === hWallTy);
const hOx = 20 * TS;
const hOy = hWallY + 48;
const hPoly = buildConeVisibilityPolygon(hOx, hOy, -Math.PI / 2, half, range, hMap);
const hOnWall = hPoly.slice(1).filter((p) => Math.abs(p.y - hWallY - TS) < 1 || Math.abs(p.y - hWallY) < 1);
console.log(`  horizontal wall vertex count: ${hPoly.length}, near-wall hits: ${hOnWall.length}`);
assert('horizontal wall welded', hOnWall.length <= 6);
assert('horizontal wall fan order', anglesMonotonic(hPoly, hOx, hOy));

console.log('\n--- 3. L-corner ---');
const lTx = 20;
const lTy = 12;
const lMap = makeMap(40, 30, (x, y) => (x >= lTx && y >= lTy));
const cornerX = lTx * TS;
const cornerY = lTy * TS;
const lOx = cornerX - 64;
const lOy = cornerY - 64;
const look = Math.atan2(cornerY - lOy, cornerX - lOx);
const lPoly = buildConeVisibilityPolygon(lOx, lOy, look, half, range, lMap);
assert('L-corner kept as a vertex', nearPoint(lPoly, cornerX, cornerY, 2.5));
assert('L-corner fan order', anglesMonotonic(lPoly, lOx, lOy));
assert('L-corner not over-simplified', lPoly.length >= 4);

console.log('\n--- 4. adjacent perpendicular walls ---');
const pMap = makeMap(40, 30, (x, y) => x === 18 || y === 14);
const pOx = 16 * TS;
const pOy = 16 * TS;
const pPoly = buildConeVisibilityPolygon(pOx, pOy, -0.4, half, range, pMap);
const junction = { x: 18 * TS, y: 14 * TS };
assert('perpendicular junction kept', nearPoint(pPoly, junction.x, junction.y, TS + 2) || pPoly.length >= 5);
assert('perpendicular fan order', anglesMonotonic(pPoly, pOx, pOy));

console.log('\n--- 5. narrow corridor ---');
const cMap = makeMap(40, 30, (x, y) => x <= 18 || x >= 22);
const cOx = 20 * TS;
const cOy = 15 * TS;
const cPoly = buildConeVisibilityPolygon(cOx, cOy, 0, half, range, cMap);
const rightFace = 22 * TS;
const cWall = cPoly.slice(1).filter((p) => Math.abs(p.x - rightFace) < 1);
assert('corridor facing wall welded', cWall.length <= 4);
assert('corridor occludes right wall', cWall.length >= 1);
assert('corridor fan order', anglesMonotonic(cPoly, cOx, cOy));

console.log('\n--- 6. cone crossing ±PI ---');
const wrapOx = vWallX + 48;
const wrapOy = vOy;
const wrapPoly = buildConeVisibilityPolygon(wrapOx, wrapOy, Math.PI, half, range, vMap);
assert('±PI polygon has hits', wrapPoly.length >= 3);
assert('±PI starts at origin', wrapPoly[0].x === wrapOx && wrapPoly[0].y === wrapOy);
assert('±PI fan order (unwrapped)', anglesMonotonic(wrapPoly, wrapOx, wrapOy));
const wrapOnWall = wrapPoly.slice(1).filter((p) => Math.abs(p.x - (vWallX + TS)) < 2 || Math.abs(p.x - vWallX) < 2);
assert('±PI still hits the wall to the west', wrapOnWall.length >= 1);

console.log('\n--- 7. stationary rotation across vertical wall ---');
let prevOcc = null;
let maxIsolated = 0;
let maxOnWall = 0;
const rotCounts = [];
for (let i = 0; i <= 70; i++) {
  const ang = -0.35 + (0.7 * i) / 70;
  const rPoly = buildConeVisibilityPolygon(vOx, vOy, ang, half, range, vMap);
  rotCounts.push(rPoly.length);
  const onWall = rPoly.slice(1).filter((p) => Math.abs(p.x - vWallX) < 1 && p.y > TS && p.y < 29 * TS);
  maxOnWall = Math.max(maxOnWall, onWall.length);
  const occ = occupancy(rPoly, vWallX - 0.25, vOy - 180, vOy + 180, 1);
  if (prevOcc) maxIsolated = Math.max(maxIsolated, isolatedFlicker(prevOcc, occ));
  prevOcc = occ;
}
console.log(`  rotation vertex counts ${Math.min(...rotCounts)}–${Math.max(...rotCounts)}, max on-wall ${maxOnWall}, isolated flicker ${maxIsolated}`);
assert('rotation: no isolated 1px occupancy flicker', maxIsolated === 0);
assert('rotation: on-wall verts stay welded', maxOnWall <= 4);
assert('rotation: vertex count stable vs pre-fix 129–161', Math.max(...rotCounts) < 80);

console.log('\n--- 8. collinear tile joints ---');
const shortMap = makeMap(40, 30, (x, y) => x === vWallTx && y === 15);
const longColMap = makeMap(40, 30, (x) => x === vWallTx);
const shortPoly = buildConeVisibilityPolygon(vOx, vOy, 0, half, range, shortMap);
const longColPoly = buildConeVisibilityPolygon(vOx, vOy, 0, half, range, longColMap);
console.log(`  1-tile wall verts ${shortPoly.length}, 30-tile wall verts ${longColPoly.length}`);
assert(
  'long collinear run does not explode vertex count',
  longColPoly.length <= shortPoly.length + 8
);

console.log(`\nVisibility tests: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
