import { ENEMY_ARCHETYPE, TILE, CONFIG } from '../utils/Constants.js';
import { SeededRandom } from '../utils/Random.js';
import { TileMap } from './TileMap.js';
import { THEME_ORDER, THEME_META, LANDMARK_TYPES, ROOM_THEME } from './RoomThemes.js';

const ROOM_TYPES = ['corridor', 'open', 'maze', 'pillars', 'loops'];
const MAX_GEN_ATTEMPTS = 16;

export class RoomGenerator {
  generate(seed, roomNumber = 1) {
    for (let attempt = 0; attempt < MAX_GEN_ATTEMPTS; attempt++) {
      const attemptSeed = (seed + attempt * 1337) >>> 0;
      const data = this._generateOnce(attemptSeed, roomNumber);
      if (this._validate(data)) return data;
    }
    const fallback = this._generateOnce(seed, roomNumber);
    this._forceReachableObjectives(fallback);
    return fallback;
  }

  _generateOnce(seed, roomNumber) {
    const rng = new SeededRandom(seed);
    const width = CONFIG.world.roomWidth;
    const height = CONFIG.world.roomHeight;
    const tiles = new Array(width * height).fill(TILE.WALL);

    const theme = THEME_ORDER[(roomNumber - 1) % THEME_ORDER.length];
    const themeMeta = THEME_META[theme];
    const roomType = ROOM_TYPES[Math.min(roomNumber - 1, ROOM_TYPES.length - 1)];

    this._carveBase(tiles, width, height, rng);
    this._applyRoomType(tiles, width, height, roomType, rng, roomNumber);

    const tileMap = new TileMap(width, height, tiles);
    const floorTiles = tileMap.getFloorTiles();
    const spawn = this._pickFarTile(floorTiles, null, rng);
    const reachableFromSpawn = this._getReachableTileSet(tileMap, spawn);
    const reachableFloorTiles = floorTiles.filter((t) => reachableFromSpawn.has(`${t.x},${t.y}`));

    const exit = this._pickFarTile(reachableFloorTiles.length > 0 ? reachableFloorTiles : floorTiles, spawn, rng);
    const fuse = this._pickFuseTile(reachableFloorTiles, spawn, exit, tiles, width, height, rng);
    const generator = this._pickGeneratorTile(reachableFloorTiles, spawn, exit, fuse, tiles, width, height, rng);
    const enemySpawns = this._pickEnemySpawns(floorTiles, spawn, exit, roomNumber, rng);

    tileMap.setTile(exit.x, exit.y, TILE.EXIT);
    tileMap.setTile(fuse.x, fuse.y, TILE.OBJECTIVE);
    tileMap.setTile(generator.x, generator.y, TILE.OBJECTIVE);

    const decor = this._placeThemedDecor(tiles, width, height, rng, spawn, exit, fuse, generator, themeMeta);
    const landmarks = this._placeLandmarks(floorTiles, rng, spawn, exit, fuse, generator, width, height);
    const envLights = this._placeEnvLights(floorTiles, rng, spawn, exit, fuse, generator, themeMeta);

    return {
      tileMap,
      spawn: tileMap.tileToWorld(spawn.x, spawn.y),
      exit: tileMap.tileToWorld(exit.x, exit.y),
      objective: tileMap.tileToWorld(fuse.x, fuse.y),
      fuse: tileMap.tileToWorld(fuse.x, fuse.y),
      generator: tileMap.tileToWorld(generator.x, generator.y),
      enemySpawns: enemySpawns.map((t) => ({
        ...tileMap.tileToWorld(t.x, t.y),
        archetype: t.archetype,
      })),
      decor,
      landmarks,
      envLights,
      seed,
      roomType,
      theme,
      themeLabel: themeMeta.label,
      roomNumber,
    };
  }

  _validate(data) {
    const spawnDist = Math.abs(data.spawn.x - data.exit.x) + Math.abs(data.spawn.y - data.exit.y);
    if (spawnDist < 200) return false;
    if (data.enemySpawns.length === 0) return false;

    for (const esp of data.enemySpawns) {
      const d = Math.abs(esp.x - data.spawn.x) + Math.abs(esp.y - data.spawn.y);
      if (d < 150) return false;
    }

    const objDist = Math.abs(data.fuse.x - data.spawn.x) + Math.abs(data.fuse.y - data.spawn.y);
    if (objDist < 80) return false;
    const genDist = Math.abs(data.generator.x - data.spawn.x) + Math.abs(data.generator.y - data.spawn.y);
    if (genDist < 80 || genDist > 430) return false;
    if (data.tileMap.isWallAt(data.fuse.x, data.fuse.y)) return false;
    if (data.tileMap.isWallAt(data.generator.x, data.generator.y)) return false;

    const fuseTile = data.tileMap.worldToTile(data.fuse.x, data.fuse.y);
    const generatorTile = data.tileMap.worldToTile(data.generator.x, data.generator.y);
    const spawnTile = data.tileMap.worldToTile(data.spawn.x, data.spawn.y);
    if (!this._hasOpenSpace(data.tileMap.tiles, data.tileMap.width, data.tileMap.height, fuseTile.x, fuseTile.y, 1)) return false;
    if (!this._hasOpenSpace(data.tileMap.tiles, data.tileMap.width, data.tileMap.height, generatorTile.x, generatorTile.y, 1)) return false;

    const reachable = this._getReachableTileSet(data.tileMap, spawnTile);
    if (!reachable.has(`${fuseTile.x},${fuseTile.y}`)) return false;
    if (!reachable.has(`${generatorTile.x},${generatorTile.y}`)) return false;

    return data.landmarks.length >= 2;
  }

  _getReachableTileSet(tileMap, startTile) {
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

  _forceReachableObjectives(data) {
    const oldFuseTile = data.tileMap.worldToTile(data.fuse.x, data.fuse.y);
    const oldGeneratorTile = data.tileMap.worldToTile(data.generator.x, data.generator.y);
    if (!data.tileMap.isWall(oldFuseTile.x, oldFuseTile.y)) {
      data.tileMap.setTile(oldFuseTile.x, oldFuseTile.y, TILE.FLOOR);
    }
    if (!data.tileMap.isWall(oldGeneratorTile.x, oldGeneratorTile.y)) {
      data.tileMap.setTile(oldGeneratorTile.x, oldGeneratorTile.y, TILE.FLOOR);
    }

    const spawnTile = data.tileMap.worldToTile(data.spawn.x, data.spawn.y);
    const reachable = this._getReachableTileSet(data.tileMap, spawnTile);
    const reachableTiles = [];
    for (const key of reachable) {
      const [x, y] = key.split(',').map(Number);
      reachableTiles.push({ x, y });
    }
    if (reachableTiles.length === 0) return;

    const rng = new SeededRandom(data.seed);
    const fuseTile = this._pickFuseTile(reachableTiles, spawnTile, data.tileMap.worldToTile(data.exit.x, data.exit.y), data.tileMap.tiles, data.tileMap.width, data.tileMap.height, rng)
      || reachableTiles[Math.floor(reachableTiles.length / 2)];
    const generatorTile = this._pickGeneratorTile(reachableTiles, spawnTile, data.tileMap.worldToTile(data.exit.x, data.exit.y), fuseTile, data.tileMap.tiles, data.tileMap.width, data.tileMap.height, rng)
      || reachableTiles[Math.min(3, reachableTiles.length - 1)];

    data.fuse = data.tileMap.tileToWorld(fuseTile.x, fuseTile.y);
    data.objective = data.fuse;
    data.generator = data.tileMap.tileToWorld(generatorTile.x, generatorTile.y);
    data.tileMap.setTile(fuseTile.x, fuseTile.y, TILE.OBJECTIVE);
    data.tileMap.setTile(generatorTile.x, generatorTile.y, TILE.OBJECTIVE);
  }

  _carveBase(tiles, width, height, rng) {
    for (let y = 2; y < height - 2; y++) {
      for (let x = 2; x < width - 2; x++) {
        tiles[y * width + x] = TILE.FLOOR;
      }
    }

    const blobs = rng.int(3, 5);
    for (let b = 0; b < blobs; b++) {
      const cx = rng.int(5, width - 6);
      const cy = rng.int(5, height - 6);
      const rw = rng.int(2, 4);
      const rh = rng.int(2, 4);
      for (let dy = -rh; dy <= rh; dy++) {
        for (let dx = -rw; dx <= rw; dx++) {
          const tx = cx + dx;
          const ty = cy + dy;
          if (tx > 2 && ty > 2 && tx < width - 3 && ty < height - 3) {
            if (rng.bool(0.65)) tiles[ty * width + tx] = TILE.WALL;
          }
        }
      }
    }

    this._ensureConnectivity(tiles, width, height);
  }

  _applyRoomType(tiles, width, height, type, rng, roomNumber) {
    switch (type) {
      case 'corridor':
        this._makeCorridors(tiles, width, height, rng);
        break;
      case 'open':
        this._makeOpen(tiles, width, height);
        break;
      case 'maze':
        this._makeMaze(tiles, width, height, rng);
        break;
      case 'pillars':
        this._makePillars(tiles, width, height, rng);
        break;
      case 'loops':
        this._makeLoops(tiles, width, height, rng);
        break;
    }

    if (roomNumber > 4) {
      this._addDeadEnds(tiles, width, height, rng, Math.min(roomNumber, 4));
    }
  }

  _makeCorridors(tiles, width, height, rng) {
    for (let y = 3; y < height - 3; y++) {
      if (y % 5 === 0) {
        for (let x = 3; x < width - 3; x++) {
          if (rng.bool(0.22)) tiles[y * width + x] = TILE.WALL;
        }
      }
    }
  }

  _makeOpen(tiles, width, height) {
    const cx = Math.floor(width / 2);
    const cy = Math.floor(height / 2);
    for (let dy = -7; dy <= 7; dy++) {
      for (let dx = -9; dx <= 9; dx++) {
        const tx = cx + dx;
        const ty = cy + dy;
        if (tx > 2 && ty > 2 && tx < width - 3 && ty < height - 3) {
          tiles[ty * width + tx] = TILE.FLOOR;
        }
      }
    }
  }

  _makeMaze(tiles, width, height, rng) {
    for (let y = 3; y < height - 3; y++) {
      for (let x = 3; x < width - 3; x++) {
        if ((x % 4 === 0 || y % 4 === 0) && rng.bool(0.45)) {
          tiles[y * width + x] = TILE.WALL;
        }
      }
    }
  }

  _makePillars(tiles, width, height, rng) {
    for (let y = 5; y < height - 5; y += 5) {
      for (let x = 5; x < width - 5; x += 5) {
        if (rng.bool(0.55)) {
          tiles[y * width + x] = TILE.WALL;
        }
      }
    }
  }

  _makeLoops(tiles, width, height, rng) {
    for (let i = 0; i < 2; i++) {
      const y = rng.int(5, height - 6);
      const xStart = rng.int(3, width / 2);
      const xEnd = rng.int(width / 2, width - 4);
      for (let x = xStart; x <= xEnd; x++) {
        if (rng.bool(0.12)) tiles[y * width + x] = TILE.WALL;
      }
    }
  }

  _addDeadEnds(tiles, width, height, rng, count) {
    for (let i = 0; i < count; i++) {
      const x = rng.int(4, width - 5);
      const y = rng.int(4, height - 5);
      if (tiles[y * width + x] === TILE.FLOOR) {
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        const dir = dirs[rng.int(0, 3)];
        for (let d = 1; d <= 2; d++) {
          const tx = x + dir[0] * d;
          const ty = y + dir[1] * d;
          if (tx > 2 && ty > 2 && tx < width - 3 && ty < height - 3) {
            tiles[ty * width + tx] = TILE.WALL;
          }
        }
      }
    }
  }

  _ensureConnectivity(tiles, width, height) {
    const cx = Math.floor(width / 2);
    const cy = Math.floor(height / 2);
    const visited = new Set();
    const queue = [{ x: cx, y: cy }];
    visited.add(`${cx},${cy}`);

    while (queue.length > 0) {
      const { x, y } = queue.shift();
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const key = `${nx},${ny}`;
        if (visited.has(key)) continue;
        if (tiles[ny * width + nx] !== TILE.WALL) {
          visited.add(key);
          queue.push({ x: nx, y: ny });
        }
      }
    }

    for (let y = 3; y < height - 3; y++) {
      for (let x = 3; x < width - 3; x++) {
        if (tiles[y * width + x] !== TILE.WALL && !visited.has(`${x},${y}`)) {
          const midX = Math.floor((x + cx) / 2);
          tiles[cy * width + midX] = TILE.FLOOR;
          tiles[y * width + midX] = TILE.FLOOR;
        }
      }
    }
  }

  _pickFarTile(floorTiles, avoid, rng) {
    let best = floorTiles[rng.int(0, floorTiles.length - 1)];
    let bestDist = 0;
    for (let i = 0; i < 40; i++) {
      const t = floorTiles[rng.int(0, floorTiles.length - 1)];
      if (avoid) {
        const dist = Math.abs(t.x - avoid.x) + Math.abs(t.y - avoid.y);
        if (dist > bestDist) { bestDist = dist; best = t; }
      } else { best = t; break; }
    }
    return best;
  }

  _pickMidTile(floorTiles, spawn, exit, rng) {
    const midX = (spawn.x + exit.x) / 2;
    const midY = (spawn.y + exit.y) / 2;
    let best = floorTiles[0];
    let bestDist = Infinity;
    for (const t of floorTiles) {
      const dist = Math.abs(t.x - midX) + Math.abs(t.y - midY);
      const spawnDist = Math.abs(t.x - spawn.x) + Math.abs(t.y - spawn.y);
      if (spawnDist > 6 && dist < bestDist) { bestDist = dist; best = t; }
    }
    return best;
  }

  _pickFuseTile(floorTiles, spawn, exit, tiles, width, height, rng) {
    const midX = (spawn.x + exit.x) / 2;
    const midY = (spawn.y + exit.y) / 2;
    let best = null;
    let bestScore = -Infinity;

    for (const t of floorTiles) {
      const spawnDist = Math.abs(t.x - spawn.x) + Math.abs(t.y - spawn.y);
      const exitDist = Math.abs(t.x - exit.x) + Math.abs(t.y - exit.y);
      if (spawnDist < 8 || exitDist < 6) continue;
      if (!this._hasOpenSpace(tiles, width, height, t.x, t.y, 1)) continue;

      const midDist = Math.abs(t.x - midX) + Math.abs(t.y - midY);
      const wallBonus = this._isNearWall(tiles, width, height, t.x, t.y) ? 10 : 0;
      const score = wallBonus + Math.max(0, 18 - midDist) + Math.min(spawnDist, 18) * 0.2 + rng.range(0, 2);
      if (score > bestScore) {
        bestScore = score;
        best = t;
      }
    }

    return best || this._pickMidTile(floorTiles, spawn, exit, rng);
  }

  _pickGeneratorTile(floorTiles, spawn, exit, fuse, tiles, width, height, rng) {
    let best = null;
    let bestScore = -Infinity;
    for (const t of floorTiles) {
      const spawnDist = Math.abs(t.x - spawn.x) + Math.abs(t.y - spawn.y);
      const fuseDist = Math.abs(t.x - fuse.x) + Math.abs(t.y - fuse.y);
      const exitDist = Math.abs(t.x - exit.x) + Math.abs(t.y - exit.y);
      if (spawnDist < 4 || spawnDist > 12 || fuseDist < 7 || exitDist < 5) continue;
      if (!this._hasOpenSpace(tiles, width, height, t.x, t.y, 1)) continue;
      const wallBonus = this._isNearWall(tiles, width, height, t.x, t.y) ? 5 : 0;
      const score = wallBonus + (12 - Math.abs(spawnDist - 7)) + rng.range(0, 2);
      if (score > bestScore) {
        bestScore = score;
        best = t;
      }
    }
    return best || this._pickMidTile(floorTiles, spawn, exit, rng);
  }

  _isNearWall(tiles, width, height, x, y) {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const tx = x + dx;
      const ty = y + dy;
      if (tx < 0 || ty < 0 || tx >= width || ty >= height) continue;
      if (tiles[ty * width + tx] === TILE.WALL) return true;
    }
    return false;
  }

  _hasOpenSpace(tiles, width, height, x, y, radius = 1) {
    if (x < 0 || y < 0 || x >= width || y >= height) return false;
    if (tiles[y * width + x] === TILE.WALL) return false;

    let openCardinals = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const tx = x + dx * radius;
      const ty = y + dy * radius;
      if (tx < 0 || ty < 0 || tx >= width || ty >= height) continue;
      if (tiles[ty * width + tx] !== TILE.WALL) openCardinals++;
    }
    return openCardinals >= 3;
  }

  _pickEnemySpawns(floorTiles, spawn, exit, roomNumber, rng) {
    const count = Math.min(
      CONFIG.difficulty.baseEnemyCount + Math.floor((roomNumber - 1) / 3),
      CONFIG.difficulty.maxEnemyCount
    );
    const spawns = [];
    for (let i = 0; i < count; i++) {
      let best = null;
      let bestScore = 0;
      for (let attempt = 0; attempt < 25; attempt++) {
        const t = floorTiles[rng.int(0, floorTiles.length - 1)];
        const spawnDist = Math.abs(t.x - spawn.x) + Math.abs(t.y - spawn.y);
        const exitDist = Math.abs(t.x - exit.x) + Math.abs(t.y - exit.y);
        const score = Math.min(spawnDist, exitDist);
        if (score > 10 && score > bestScore) { bestScore = score; best = t; }
      }
      if (best) {
        const archetypes = [ENEMY_ARCHETYPE.STALKER, ENEMY_ARCHETYPE.WATCHER, ENEMY_ARCHETYPE.RUNNER];
        spawns.push({ ...best, archetype: archetypes[(roomNumber + i - 1) % archetypes.length] });
      }
    }
    return spawns;
  }

  _placeThemedDecor(tiles, width, height, rng, spawn, exit, fuse, generator, themeMeta) {
    const decor = [];
    const protectedTiles = new Set([
      `${spawn.x},${spawn.y}`, `${exit.x},${exit.y}`, `${fuse.x},${fuse.y}`, `${generator.x},${generator.y}`,
    ]);
    const types = themeMeta.decorTypes;

    for (let y = 3; y < height - 3; y++) {
      for (let x = 3; x < width - 3; x++) {
        if (tiles[y * width + x] !== TILE.FLOOR) continue;
        if (protectedTiles.has(`${x},${y}`)) continue;
        if (rng.bool(themeMeta.decorDensity * 0.45)) {
          decor.push({
            x: x * CONFIG.world.tileSize + CONFIG.world.tileSize / 2,
            y: y * CONFIG.world.tileSize + CONFIG.world.tileSize / 2,
            type: rng.pick(types),
            rotation: rng.range(0, Math.PI * 2),
            scale: rng.range(0.85, 1.25),
          });
        }
      }
    }
    this._placeDressingClusters(decor, tiles, width, height, rng, fuse, generator, themeMeta, protectedTiles);
    return decor;
  }

  _placeLandmarks(floorTiles, rng, spawn, exit, fuse, generator, width, height) {
    const landmarks = [];
    const used = new Set([
      `${spawn.x},${spawn.y}`, `${exit.x},${exit.y}`, `${fuse.x},${fuse.y}`, `${generator.x},${generator.y}`,
    ]);
    landmarks.push({
      x: generator.x * CONFIG.world.tileSize + CONFIG.world.tileSize / 2,
      y: generator.y * CONFIG.world.tileSize + CONFIG.world.tileSize / 2,
      type: 'backup_generator',
      scale: 24,
      rotation: 0,
    });
    landmarks.push({
      x: fuse.x * CONFIG.world.tileSize + CONFIG.world.tileSize / 2,
      y: fuse.y * CONFIG.world.tileSize + CONFIG.world.tileSize / 2,
      type: 'fuse_station',
      scale: 18,
      rotation: 0,
    });
    const count = rng.int(2, 4);

    for (let i = 0; i < count; i++) {
      let best = null;
      let bestScore = 0;
      for (let attempt = 0; attempt < 20; attempt++) {
        const t = floorTiles[rng.int(0, floorTiles.length - 1)];
        if (used.has(`${t.x},${t.y}`)) continue;
        const spawnDist = Math.abs(t.x - spawn.x) + Math.abs(t.y - spawn.y);
        if (spawnDist > 5 && spawnDist < 25) {
          if (spawnDist > bestScore) { bestScore = spawnDist; best = t; }
        }
      }
      if (!best) continue;
      used.add(`${best.x},${best.y}`);

      landmarks.push({
        x: best.x * CONFIG.world.tileSize + CONFIG.world.tileSize / 2,
        y: best.y * CONFIG.world.tileSize + CONFIG.world.tileSize / 2,
        type: rng.pick(LANDMARK_TYPES),
        scale: rng.range(14, 22),
        rotation: rng.range(0, Math.PI * 2),
      });
    }
    return landmarks;
  }

  _placeEnvLights(floorTiles, rng, spawn, exit, fuse, generator, themeMeta) {
    const lights = [];
    const used = new Set([
      `${spawn.x},${spawn.y}`, `${exit.x},${exit.y}`, `${fuse.x},${fuse.y}`, `${generator.x},${generator.y}`,
    ]);
    const count = rng.int(3, 6);

    for (let i = 0; i < count; i++) {
      const t = floorTiles[rng.int(0, floorTiles.length - 1)];
      if (used.has(`${t.x},${t.y}`)) continue;
      used.add(`${t.x},${t.y}`);

      const isExit = t.x === exit.x && t.y === exit.y;
      lights.push({
        x: t.x * CONFIG.world.tileSize + CONFIG.world.tileSize / 2,
        y: t.y * CONFIG.world.tileSize + CONFIG.world.tileSize / 2,
        radius: rng.range(50, 90),
        color: isExit ? CONFIG.colors.exitGlow : themeMeta.accentColor,
        pulse: rng.bool(0.6),
        pulseSpeed: rng.range(1.5, 3.5),
        phase: rng.range(0, Math.PI * 2),
      });
    }

    // Always light near exit
    lights.push({
      x: exit.x * CONFIG.world.tileSize + CONFIG.world.tileSize / 2,
      y: exit.y * CONFIG.world.tileSize + CONFIG.world.tileSize / 2 - 20,
      radius: 70,
      color: CONFIG.colors.exitGlow,
      pulse: true,
      pulseSpeed: 2,
      phase: 0,
    });

    lights.push({
      x: generator.x * CONFIG.world.tileSize + CONFIG.world.tileSize / 2 + 12,
      y: generator.y * CONFIG.world.tileSize + CONFIG.world.tileSize / 2 - 18,
      radius: 48,
      color: CONFIG.colors.power,
      pulse: true,
      pulseSpeed: 1.2,
      phase: Math.PI,
    });

    lights.push({
      x: fuse.x * CONFIG.world.tileSize + CONFIG.world.tileSize / 2 - 10,
      y: fuse.y * CONFIG.world.tileSize + CONFIG.world.tileSize / 2 - 12,
      radius: 42,
      color: CONFIG.colors.objective,
      pulse: true,
      pulseSpeed: 1.8,
      phase: Math.PI / 2,
    });

    return lights;
  }

  _placeDressingClusters(decor, tiles, width, height, rng, fuse, generator, themeMeta, protectedTiles) {
    const clusters = [
      { center: fuse, types: ['electrical_panel', 'fusebox', 'cable', 'wire', 'warning_stripe'], radius: 2, count: 8 },
      { center: generator, types: ['cable', 'wire', 'maintenance_panel', 'pipe', 'toolbox', 'debris'], radius: 3, count: 12 },
    ];

    for (let i = 0; i < 3; i++) {
      const cx = rng.int(4, width - 5);
      const cy = rng.int(4, height - 5);
      if (tiles[cy * width + cx] !== TILE.FLOOR) continue;
      const palette = rng.pick([
        ['crate', 'box', 'barrel', 'debris', 'stain'],
        ['pipe', 'vent', 'cable', 'maintenance_panel', 'damaged_floor'],
        ['desk', 'chair', 'paper', 'cabinet', 'broken'],
      ]);
      clusters.push({ center: { x: cx, y: cy }, types: palette, radius: rng.int(2, 4), count: rng.int(7, 12) });
    }

    for (const cluster of clusters) {
      for (let i = 0; i < cluster.count; i++) {
        const tx = cluster.center.x + rng.int(-cluster.radius, cluster.radius);
        const ty = cluster.center.y + rng.int(-cluster.radius, cluster.radius);
        if (tx < 3 || ty < 3 || tx >= width - 3 || ty >= height - 3) continue;
        if (tiles[ty * width + tx] !== TILE.FLOOR) continue;
        if (protectedTiles.has(`${tx},${ty}`)) continue;
        decor.push({
          x: tx * CONFIG.world.tileSize + CONFIG.world.tileSize / 2 + rng.range(-6, 6),
          y: ty * CONFIG.world.tileSize + CONFIG.world.tileSize / 2 + rng.range(-6, 6),
          type: rng.pick(cluster.types),
          rotation: rng.range(0, Math.PI * 2),
          scale: rng.range(0.75, 1.25),
        });
      }
    }

    this._placeCableBreadcrumb(decor, tiles, width, height, rng, fuse, generator, protectedTiles);
  }

  _placeCableBreadcrumb(decor, tiles, width, height, rng, fuse, generator, protectedTiles) {
    const steps = Math.max(Math.abs(generator.x - fuse.x), Math.abs(generator.y - fuse.y));
    if (steps <= 0) return;

    for (let i = 2; i < steps - 1; i += 3) {
      const t = i / steps;
      const tx = Math.round(fuse.x + (generator.x - fuse.x) * t);
      const ty = Math.round(fuse.y + (generator.y - fuse.y) * t);
      if (tx < 3 || ty < 3 || tx >= width - 3 || ty >= height - 3) continue;
      if (tiles[ty * width + tx] !== TILE.FLOOR) continue;
      if (protectedTiles.has(`${tx},${ty}`)) continue;

      decor.push({
        x: tx * CONFIG.world.tileSize + CONFIG.world.tileSize / 2 + rng.range(-4, 4),
        y: ty * CONFIG.world.tileSize + CONFIG.world.tileSize / 2 + rng.range(-4, 4),
        type: rng.bool(0.72) ? 'cable' : 'conduit_floor',
        rotation: Math.atan2(generator.y - fuse.y, generator.x - fuse.x) + rng.range(-0.35, 0.35),
        scale: rng.range(0.9, 1.25),
      });
    }
  }
}
