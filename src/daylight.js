import { CONFIG } from './config.js';

/**
 * The run's clock. One "day" is a full light cycle: it dawns bright, darkens to
 * midnight halfway through, and lightens again.
 *
 * Simulation and rendering both read from here so the day counter, the sky and
 * which predator is hunting can never disagree with each other.
 */

/** Which day a moment falls on. One-based: a run starts on day 1. */
export function dayAt(elapsedSeconds) {
  return 1 + Math.floor(elapsedSeconds / CONFIG.game.secondsPerDay);
}

/** How far through the current day a moment is, from 0 to just under 1. */
export function phaseOfDay(elapsedSeconds) {
  const phase = (elapsedSeconds % CONFIG.game.secondsPerDay) / CONFIG.game.secondsPerDay;
  return phase < 0 ? phase + 1 : phase;
}

/**
 * 0 at dawn, 1 at midnight, back to 0 at the next dawn.
 *
 * A raised cosine rather than a sawtooth, so the sky never snaps from black to
 * bright at the day boundary.
 */
export function darknessAt(elapsedSeconds) {
  return (1 - Math.cos(phaseOfDay(elapsedSeconds) * Math.PI * 2)) / 2;
}

/** True through the dark half of the cycle, when bats hunt instead of birds. */
export function isNight(elapsedSeconds) {
  return darknessAt(elapsedSeconds) > 0.5;
}
