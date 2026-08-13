import { pointInCone, hasLineOfSight } from '../utils/Geometry.js';
import { smoothstep } from '../utils/MathUtils.js';

export class Visibility {
  /**
   * Check if a world position is illuminated by the flashlight.
   */
  static isIlluminated(worldX, worldY, flashlight, tileMap) {
    if (!flashlight.isOn) return false;

    const intensity = Visibility.getIntensityAt(worldX, worldY, flashlight, tileMap);
    return intensity > 0.15;
  }

  static getIntensityAt(worldX, worldY, flashlight, tileMap) {
    if (!flashlight.isOn) return 0;

    const { x: ox, y: oy, angle, range, fov, intensity: baseIntensity } = flashlight;

    if (!pointInCone(worldX, worldY, ox, oy, angle, fov, range)) return 0;

    if (!hasLineOfSight(ox, oy, worldX, worldY, tileMap, tileMap.tileSize)) return 0;

    const dx = worldX - ox;
    const dy = worldY - oy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const distFalloff = 1 - smoothstep(range * 0.3, range, dist);
    const angleToPoint = Math.atan2(dy, dx);
    const angleDiff = Math.abs(angleToPoint - angle);
    const normalizedAngle = Math.min(angleDiff, Math.PI * 2 - angleDiff);
    const angleFalloff = 1 - smoothstep(fov / 2 * 0.7, fov / 2, normalizedAngle);

    return baseIntensity * distFalloff * angleFalloff * flashlight.flickerMultiplier;
  }

  static isPointingAt(entityX, entityY, entityRadius, flashlight, tileMap) {
    return Visibility.isIlluminated(entityX, entityY, flashlight, tileMap);
  }
}
