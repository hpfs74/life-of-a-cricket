import { CONFIG } from './config.js';

export function createAttention() {
  return {
    value: 0,
    armed: CONFIG.attention.thresholds.map(() => true),
  };
}

/**
 * Advances the attention meter and reports how many birds it summoned.
 *
 * Each threshold fires once on the way up and only re-arms after attention
 * falls a margin below it, so hovering on a boundary cannot machine-gun birds.
 */
export function tickAttention(attention, singing, dt) {
  const rate = singing ? CONFIG.attention.risePerSecond : -CONFIG.attention.decayPerSecond;
  attention.value = Math.min(1, Math.max(0, attention.value + rate * dt));

  let spawned = 0;

  CONFIG.attention.thresholds.forEach((threshold, index) => {
    if (attention.value >= threshold && attention.armed[index]) {
      attention.armed[index] = false;
      spawned += 1;
    } else if (attention.value < threshold - CONFIG.attention.rearmMargin) {
      attention.armed[index] = true;
    }
  });

  return { spawned };
}

export function resetAttention(attention) {
  attention.value = 0;
  attention.armed = CONFIG.attention.thresholds.map(() => true);
}
