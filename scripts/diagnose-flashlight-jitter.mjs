/**
 * Diagnose screen-space wall hit jitter from split bob vs unified world transform.
 * Simulates sprinting parallel to a vertical wall with walk bob.
 */

const scale = 2.1;
const viewH = 720;
const wallX = 96;
const wallY = 200;

function simulateSplitBob(frames) {
  let maxJitter = 0;
  for (let i = 0; i < frames; i++) {
    const t = i * 0.016;
    const bob = Math.sin(t * 13) * 3;
    const px_world = 70;
    const py_world = 50 + i * 4.5; // sprint along wall
    const camX = px_world - 2; // camera lag
    const camY = py_world + bob * 0.85; // camera tracks bob

    const px = (px_world - camX) * scale + 640;
    const pyBase = (py_world - camY) * scale + viewH / 2;
    const py = pyBase + bob * scale;

    // Wall hit on vertical face
    const hitSx = px + (wallX - px_world) * scale;
    const hitSy = pyBase + (wallY - py_world) * scale;

    const unifiedSx = (wallX - camX) * scale + 640;
    const unifiedSy = (wallY - camY) * scale + viewH / 2;

    maxJitter = Math.max(maxJitter, Math.abs(hitSy - unifiedSy));
  }
  return maxJitter;
}

const jitter = simulateSplitBob(120);
console.log(`Split-bob mask vs unified transform max Y jitter: ${jitter.toFixed(3)} px`);
console.log(jitter > 1 ? 'CONFIRMED: split coordinate path causes visible shimmer' : 'No significant jitter');
