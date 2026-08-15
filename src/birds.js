import { CONFIG } from './config.js';

/**
 * Creates a bird just outside a random edge of the meadow.
 * `difficulty` (1 upward) scales every speed, which is how the game ramps.
 */
export function spawnBird(world, rng = Math.random, difficulty = 1) {
  const edge = Math.floor(rng() * 4) % 4;
  const margin = 120;

  const positions = [
    { x: rng() * world.width, y: -margin },
    { x: world.width + margin, y: rng() * world.height },
    { x: rng() * world.width, y: world.height + margin },
    { x: -margin, y: rng() * world.height },
  ];

  const start = positions[edge];

  return {
    x: start.x,
    y: start.y,
    vx: 0,
    vy: 0,
    state: 'ENTER',
    stateTime: 0,
    angle: rng() * Math.PI * 2,
    targetX: 0,
    targetY: 0,
    speedScale: difficulty,
    centerX: world.width / 2,
    centerY: world.height / 2,
    exitX: start.x,
    exitY: start.y,
  };
}

function moveToward(bird, targetX, targetY, speed, dt) {
  const dx = targetX - bird.x;
  const dy = targetY - bird.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 0.0001) return 0;

  const step = Math.min(distance, speed * dt);
  bird.vx = (dx / distance) * speed;
  bird.vy = (dy / distance) * speed;
  bird.x += (dx / distance) * step;
  bird.y += (dy / distance) * step;

  return distance - step;
}

function enterState(bird, state) {
  bird.state = state;
  bird.stateTime = 0;
}

/**
 * Advances one bird and reports what happened this frame.
 *
 * The dive commits to the cricket's position at scan time. That is deliberate:
 * it means a player who breaks off and runs the instant they hear the cry can
 * still escape, which is what makes the warning readable rather than decorative.
 */
export function updateBird(bird, dt, context) {
  bird.stateTime += dt;

  switch (bird.state) {
    case 'ENTER': {
      const orbitX = bird.centerX + Math.cos(bird.angle) * CONFIG.bird.circleRadius;
      const orbitY = bird.centerY + Math.sin(bird.angle) * CONFIG.bird.circleRadius * 0.6;
      const remaining = moveToward(bird, orbitX, orbitY, CONFIG.bird.enterSpeed * bird.speedScale, dt);

      if (remaining <= 1) enterState(bird, 'CIRCLE');
      return 'none';
    }

    case 'CIRCLE': {
      bird.angle += CONFIG.bird.circleSpeed * bird.speedScale * dt;
      const nextX = bird.centerX + Math.cos(bird.angle) * CONFIG.bird.circleRadius;
      const nextY = bird.centerY + Math.sin(bird.angle) * CONFIG.bird.circleRadius * 0.6;
      bird.vx = (nextX - bird.x) / Math.max(dt, 0.0001);
      bird.vy = (nextY - bird.y) / Math.max(dt, 0.0001);
      bird.x = nextX;
      bird.y = nextY;

      if (bird.stateTime < CONFIG.bird.circleSeconds) return 'none';

      // Scan: cover only saves a cricket that keeps quiet.
      if (context.hidden && !context.singing) {
        enterState(bird, 'RETREAT');
        return 'scanned-lost';
      }

      bird.targetX = context.cricket.x;
      bird.targetY = context.cricket.y;
      enterState(bird, 'DIVE');
      return 'none';
    }

    case 'DIVE': {
      const remaining = moveToward(
        bird,
        bird.targetX,
        bird.targetY,
        CONFIG.bird.diveSpeed * bird.speedScale,
        dt,
      );
      if (remaining > 1) return 'none';

      const distanceToCricket = Math.hypot(
        context.cricket.x - bird.x,
        context.cricket.y - bird.y,
      );
      enterState(bird, 'RETREAT');
      return distanceToCricket <= CONFIG.bird.hitRadius ? 'hit' : 'missed';
    }

    case 'RETREAT': {
      const remaining = moveToward(
        bird,
        bird.exitX,
        bird.exitY,
        CONFIG.bird.retreatSpeed * bird.speedScale,
        dt,
      );
      if (remaining <= 1) {
        enterState(bird, 'GONE');
        return 'gone';
      }
      return 'none';
    }

    default:
      return 'none';
  }
}
