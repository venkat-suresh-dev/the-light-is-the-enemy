/**
 * Headless collision regression checks for axis-separated wall sliding.
 */
import { Collision } from '../src/world/Collision.js';
import { TileMap } from '../src/world/TileMap.js';
import { TILE } from '../src/utils/Constants.js';

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

// Vertical wall at x = 96 (tile 3), corridor along Y
const map = makeMap(10, 10, (x, y) => x === 0 || x === 9 || y === 0 || y === 9 || x === 3);

const radius = 10;
const margin = 0.5;
const effectiveR = radius - margin;
const startX = 70;
const startY = 160;
const wallX = 96;

// Diagonal into wall: should slide along Y
const slide = Collision.moveCircleTileMap(startX, startY, radius, map, 20, 20, margin);
assert('diagonal into vertical wall preserves Y movement', slide.y > startY + 15);
assert('diagonal into vertical wall blocks X penetration', slide.x <= wallX - effectiveR + 0.01);
assert('reports X block', slide.blockedX);

// Pure X into wall
const blockX = Collision.moveCircleTileMap(startX, startY, radius, map, 40, 0, margin);
assert('pure X blocked at wall', blockX.blockedX);
assert('pure X does not pass wall', blockX.x <= wallX - effectiveR + 0.01);

// Slide along horizontal wall
const hMap = makeMap(10, 10, (x, y) => x === 0 || x === 9 || y === 0 || y === 9 || y === 5);
const wallY = 5 * 32;
const slideH = Collision.moveCircleTileMap(160, 140, radius, hMap, 20, 20, margin);
assert('diagonal into horizontal wall preserves X movement', slideH.x > 160 + 15);
assert('diagonal into horizontal wall blocks Y penetration', slideH.y <= wallY - effectiveR + 0.01);

// Corner: move into inner corner should not tunnel
const cornerMap = makeMap(8, 8, (x, y) => x === 0 || y === 0 || (x >= 4 && y >= 4));
const corner = Collision.moveCircleTileMap(100, 100, radius, cornerMap, 30, 30, margin);
assert('corner does not tunnel', Collision.isCircleFree(corner.x, corner.y, radius, cornerMap));

console.log(`\nCollision tests: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
