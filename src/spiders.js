import { CONFIG } from './config.js';
import { spawnPoint } from './world.js';

/**
 * Spiders live inside cover and never leave their tuft for long.
 *
 * They are the exception to the game's central rule. Hiding and keeping quiet
 * beats anything with wings, but a spider hunts by touch at arm's length, so
 * the very move that saves the cricket from a dive is what walks it into one.
 *
 * Every spider advertises itself: `alertness` rises as the cricket approaches
 * and the renderer glows the tell accordingly. The threat is information the
 * player acts on under time pressure, never a surprise.
 */

function makeSpider(cover) {
  return {
    cover,
    homeX: cover.x,
    homeY: cover.y,
    x: cover.x,
    y: cover.y,
    state: 'LURKING',
    stateTime: 0,
    targetX: cover.x,
    targetY: cover.y,
    alertness: 0,
  };
}

/**
 * Settles spiders into distinct cover pieces, skipping anything close to
 * `keepAwayFrom` so the cricket is never handed an unavoidable death. That is
 * the spawn point on a fresh run, and the cricket itself when the meadow
 * rearranges mid-run.
 */
export function createSpiders(world, rng = Math.random, keepAwayFrom = null) {
  const safe = keepAwayFrom ?? spawnPoint(world);

  const eligible = world.cover.filter(
    (item) => Math.hypot(item.x - safe.x, item.y - safe.y) >= CONFIG.spiders.minDistanceFromSpawn,
  );

  // Fisher-Yates over a copy, so each spider gets its own tuft.
  for (let i = eligible.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
  }

  return eligible.slice(0, CONFIG.spiders.count).map(makeSpider);
}

function enterState(spider, state) {
  spider.state = state;
  spider.stateTime = 0;
}

function moveToward(spider, x, y, speed, dt) {
  const dx = x - spider.x;
  const dy = y - spider.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 0.0001) return 0;

  const step = Math.min(distance, speed * dt);
  spider.x += (dx / distance) * step;
  spider.y += (dy / distance) * step;
  return distance - step;
}

/**
 * Advances every spider and reports what happened.
 *
 * A lunge commits to where the cricket stood when it launched — the same rule
 * the birds' dives use — so leaping or running clear of that spot beats it, and
 * the counterplay reads the same for both kinds of predator.
 */
export function updateSpiders(spiders, dt, world, cricket) {
  const { windUpSeconds, lungeSpeed, lungeSeconds, hitRadius, recoverSeconds, returnSpeed, noticeRadius } =
    CONFIG.spiders;

  const events = [];

  for (const spider of spiders) {
    spider.stateTime += dt;

    const toCricket = Math.hypot(cricket.x - spider.homeX, cricket.y - spider.homeY);
    spider.alertness = Math.max(0, Math.min(1, 1 - toCricket / noticeRadius));

    switch (spider.state) {
      case 'LURKING': {
        // Touch, not sound or sight: an airborne cricket sails over untouched.
        const disturbed = !cricket.jumping && toCricket <= spider.cover.radius;
        if (disturbed) {
          enterState(spider, 'WINDUP');
          events.push({ type: 'spider-wake', spider });
        }
        break;
      }

      case 'WINDUP': {
        if (spider.stateTime < windUpSeconds) break;

        spider.targetX = cricket.x;
        spider.targetY = cricket.y;
        enterState(spider, 'LUNGE');
        events.push({ type: 'spider-lunge', spider });
        break;
      }

      case 'LUNGE': {
        const remaining = moveToward(spider, spider.targetX, spider.targetY, lungeSpeed, dt);
        if (remaining > 1 && spider.stateTime < lungeSeconds) break;

        const reach = Math.hypot(cricket.x - spider.x, cricket.y - spider.y);
        const connects = reach <= hitRadius && !cricket.jumping;

        enterState(spider, 'RECOVER');
        events.push({ type: connects ? 'spider-hit' : 'spider-miss', spider });
        break;
      }

      case 'RECOVER': {
        moveToward(spider, spider.homeX, spider.homeY, returnSpeed, dt);
        if (spider.stateTime >= recoverSeconds) {
          spider.x = spider.homeX;
          spider.y = spider.homeY;
          enterState(spider, 'LURKING');
        }
        break;
      }

      default:
        break;
    }
  }

  return events;
}
