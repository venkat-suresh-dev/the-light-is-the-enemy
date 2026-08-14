/**
 * Objective lifecycle + fuse reachability checks (runtime module path).
 */
import { RoomGenerator } from '../src/world/RoomGenerator.js';
import { Room } from '../src/world/Room.js';
import { ObjectiveSystem } from '../src/systems/ObjectiveSystem.js';
import { CONFIG } from '../src/utils/Constants.js';
import { Collision } from '../src/world/Collision.js';

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

function getReachableTiles(tileMap, startTile) {
  const visited = new Set();
  const queue = [{ x: startTile.x, y: startTile.y }];
  visited.add(`${startTile.x},${startTile.y}`);

  while (queue.length > 0) {
    const { x, y } = queue.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      const key = `${nx},${ny}`;
      if (visited.has(key)) continue;
      if (nx < 0 || ny < 0 || nx >= tileMap.width || ny >= tileMap.height) continue;
      if (tileMap.isWall(nx, ny)) continue;
      visited.add(key);
      queue.push({ x: nx, y: ny });
    }
  }
  return visited;
}

function canPlayerReachFuse(room, playerRadius = CONFIG.player.radius) {
  const tileMap = room.tileMap;
  const spawnTile = tileMap.worldToTile(room.spawn.x, room.spawn.y);
  const reachable = getReachableTiles(tileMap, spawnTile);
  const pickupRadius = room.getFusePickupRadius(playerRadius);
  const pickupRadiusSq = pickupRadius * pickupRadius;

  for (const key of reachable) {
    const [tx, ty] = key.split(',').map(Number);
    const pos = tileMap.tileToWorld(tx, ty);
    const dx = pos.x - room.fuse.x;
    const dy = pos.y - room.fuse.y;
    if (dx * dx + dy * dy <= pickupRadiusSq) {
      if (Collision.isCircleFree(pos.x, pos.y, playerRadius, tileMap)) {
        return { ok: true, standPos: pos };
      }
    }
  }
  return { ok: false, standPos: null };
}

const generator = new RoomGenerator();
const events = { emit() {} };
let unreachableFuse = 0;
let unreachableGenerator = 0;
let noPickupStand = 0;

for (let seed = 1; seed <= 500; seed++) {
  for (let roomNumber = 1; roomNumber <= 5; roomNumber++) {
    const data = generator.generate(seed * 997 + roomNumber, roomNumber);
    const room = new Room(data);
    const spawnTile = room.tileMap.worldToTile(room.spawn.x, room.spawn.y);
    const fuseTile = room.tileMap.worldToTile(room.fuse.x, room.fuse.y);
    const generatorTile = room.tileMap.worldToTile(room.generator.x, room.generator.y);
    const reachable = getReachableTiles(room.tileMap, spawnTile);

    if (!reachable.has(`${fuseTile.x},${fuseTile.y}`)) unreachableFuse++;
    if (!reachable.has(`${generatorTile.x},${generatorTile.y}`)) unreachableGenerator++;

    const reach = canPlayerReachFuse(room);
    if (!reach.ok) noPickupStand++;
  }
}

assert('0 unreachable fuse tiles from spawn (2500 rooms)', unreachableFuse === 0);
assert('0 unreachable generator tiles from spawn (2500 rooms)', unreachableGenerator === 0);
assert('0 rooms where player cannot stand within fuse pickup radius', noPickupStand === 0);

// Lifecycle: E pickup at fuse stand position
const data = generator.generate(42, 1);
const room = new Room(data);
const objective = new ObjectiveSystem(events);
objective.setup(room, 1);

const reach = canPlayerReachFuse(room);
assert('sample room has fuse pickup stand position', reach.ok);

const player = { x: reach.standPos.x, y: reach.standPos.y, radius: CONFIG.player.radius };
assert('prompt visible when in range', objective.getInteractionPrompt(player) === 'PICK UP FUSE [E]');
assert('isAtFuse matches prompt', room.isAtFuse(player.x, player.y, player.radius));

objective.update(0, player, true);
assert('fuse collected after E press', room.fuseCollected === true);
assert('phase transitions to findGenerator', objective.phase === 'findGenerator');
assert('pickup success counter incremented', objective.debugCounters.pickupSuccess === 1);

// Out of range E should not collect
const data2 = generator.generate(99, 2);
const room2 = new Room(data2);
const objective2 = new ObjectiveSystem(events);
objective2.setup(room2, 2);
const farPlayer = { x: room2.spawn.x, y: room2.spawn.y, radius: CONFIG.player.radius };
objective2.update(0, farPlayer, true);
assert('E out of range does not collect fuse', !room2.fuseCollected && objective2.phase === 'findFuse');

console.log(`\nObjective lifecycle tests: ${passed} passed, ${failed} failed`);
if (unreachableFuse || unreachableGenerator || noPickupStand) {
  console.error(`Reachability stats: fuse=${unreachableFuse}, generator=${unreachableGenerator}, noStand=${noPickupStand}`);
}
process.exit(failed > 0 ? 1 : 0);
