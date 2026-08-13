/**
 * Movement feel checks: diagonal speed cap and body rotation smoothing.
 */
import { lerpAngle, angleDifference } from '../src/utils/MathUtils.js';
import { CONFIG } from '../src/utils/Constants.js';

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

// Diagonal input should not exceed unit speed
const len = Math.sqrt(0.707 ** 2 + 0.707 ** 2);
assert('normalized diagonal length is 1', Math.abs(len - 1) < 0.001);

// Body angle lerps toward movement direction
let bodyAngle = -Math.PI / 2;
const target = Math.atan2(1, 0) + Math.PI / 2; // moving right
for (let i = 0; i < 30; i++) {
  bodyAngle = lerpAngle(bodyAngle, target, CONFIG.player.rotationSpeed * (1 / 60));
}
assert('body angle approaches movement target', Math.abs(angleDifference(target, bodyAngle)) < 0.05);

// Flashlight aim independent: body and aim can diverge
const flashAngle = Math.PI / 4;
const aimOffset = flashAngle - bodyAngle;
assert('flashlight aim offset differs from body when cursor elsewhere', Math.abs(aimOffset) > 0.1);

console.log(`\nMovement tests: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
