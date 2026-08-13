import { TILE, CONFIG } from '../utils/Constants.js';

export class TileMap {
  constructor(width, height, tiles) {
    this.width = width;
    this.height = height;
    this.tiles = tiles;
    this.tileSize = CONFIG.world.tileSize;
  }

  getTile(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) return TILE.WALL;
    return this.tiles[ty * this.width + tx];
  }

  setTile(tx, ty, value) {
    if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) return;
    this.tiles[ty * this.width + tx] = value;
  }

  isWall(tx, ty) {
    return this.getTile(tx, ty) === TILE.WALL;
  }

  isWallAt(worldX, worldY) {
    const tx = Math.floor(worldX / this.tileSize);
    const ty = Math.floor(worldY / this.tileSize);
    return this.isWall(tx, ty);
  }

  worldToTile(worldX, worldY) {
    return {
      x: Math.floor(worldX / this.tileSize),
      y: Math.floor(worldY / this.tileSize),
    };
  }

  tileToWorld(tx, ty) {
    return {
      x: tx * this.tileSize + this.tileSize / 2,
      y: ty * this.tileSize + this.tileSize / 2,
    };
  }

  getWorldWidth() {
    return this.width * this.tileSize;
  }

  getWorldHeight() {
    return this.height * this.tileSize;
  }

  getFloorTiles() {
    const floors = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const t = this.getTile(x, y);
        if (t !== TILE.WALL) {
          floors.push({ x, y });
        }
      }
    }
    return floors;
  }
}
