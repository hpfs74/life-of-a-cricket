import { CONFIG } from './config.js';

function readHighScore(storage) {
  try {
    const raw = storage?.getItem(CONFIG.score.storageKey);
    const parsed = Number.parseInt(raw ?? '0', 10);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    // Private browsing or disabled storage: fall back to a session-only record.
    return 0;
  }
}

export function createScore(storage) {
  return {
    points: 0,
    multiplier: CONFIG.score.multiplierStart,
    fed: 0,
    highScore: readHighScore(storage),
    storage,
  };
}

/** Awards one frame of song and climbs the multiplier. Returns points gained. */
export function tickSong(score, dt) {
  const gained = CONFIG.score.songPointsPerSecond * score.multiplier * dt;
  score.points += gained;

  const climbRate =
    CONFIG.score.multiplierClimbPerSecond * (score.fed > 0 ? CONFIG.score.fedClimbBonus : 1);
  score.multiplier = Math.min(CONFIG.score.multiplierMax, score.multiplier + climbRate * dt);

  return gained;
}

export function breakSong(score) {
  score.multiplier = CONFIG.score.multiplierStart;
}

export function tickFed(score, dt) {
  score.fed = Math.max(0, score.fed - dt);
}

export function eat(score, value) {
  score.points += value;
  score.fed = CONFIG.score.fedSeconds;
}

/** Persists the run's score if it beat the record. Returns true on a new record. */
export function commitHighScore(score) {
  const final = Math.floor(score.points);
  if (final <= score.highScore) return false;

  score.highScore = final;
  try {
    score.storage?.setItem(CONFIG.score.storageKey, String(final));
  } catch {
    // Keep the in-memory record even when it cannot be persisted.
  }
  return true;
}
