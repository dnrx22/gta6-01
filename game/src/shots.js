// The screenshot scenes behind ?shot=start|play|end. Each one replays the real
// rules forward from a fresh world for a fixed number of steps, steered by a
// simple autopilot: walk toward the mission marker, steal the nearest parked
// car when close, then drive toward the marker. The same seed always gives
// the same frame. The end scene's pilot is deliberately sloppy — it charges
// straight at cops and wrecks — so it ends busted or wasted like a hurried
// player would.

import { STEP } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 34;
const END_LIMIT_SECONDS = 600;
const SAMPLE = 1 / 30;

// Steer toward a point: returns an input object the world understands.
function steerToward(world, tx, ty, sloppy) {
  const p = world.player;
  // Unstick: a car grinding into a building corner moves nowhere while its
  // speedometer still reads full. Once a second, compare against the position
  // a second ago; if it barely moved, reverse and turn for a moment instead
  // of pushing into the wall.
  const now = world.time;
  if (!world.lastCheck || now - world.lastCheck >= 1) {
    if (world.lastPos && p.inCar) {
      const moved = Math.hypot(p.x - world.lastPos.x, p.y - world.lastPos.y);
      if (moved < 40) world.unstickUntil = now + 1.2;
    }
    world.lastPos = { x: p.x, y: p.y };
    world.lastCheck = now;
  }
  const dx = tx - p.x;
  const dy = ty - p.y;
  const dist = Math.hypot(dx, dy) || 1;
  const want = Math.atan2(dy, dx);
  let diff = want - p.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const input = { up: false, down: false, left: false, right: false, enter: false, start: false };
  if (world.unstickUntil && now < world.unstickUntil && p.inCar) {
    input.down = true;
    input.left = true;
    return input;
  }
  if (p.inCar) {
    // Screen coordinates grow downward, so a positive angle difference means
    // the target sits clockwise from the heading: steer right to close it.
    input.up = true;
    if (diff > 0.25) input.right = true;
    else if (diff < -0.25) input.left = true;
    if (sloppy && world.state.wanted > 0 && world.state.mission >= 1) {
      // The sloppy pilot panics once the heat is on: bails out of the car on
      // foot, where the cops can actually catch them.
      input.enter = true;
      input.up = false;
    }
  } else {
    input.up = dy < -20;
    input.down = dy > 20;
    input.left = dx < -20;
    input.right = dx > 20;
    const car = world.nearestParked(90);
    // The sloppy pilot never steals a second car: once it bails out on foot
    // it stays on foot, which is how the end scene gets caught.
    if (car && !sloppy) input.enter = true;
  }
  return input;
}

function autopilot(world, sloppy) {
  // Mission 1 is about losing the heat, not reaching a marker: run to a far
  // interior waypoint, picked once from the four corners of the city (the one
  // farthest from the cops), and only pick a new one when it is reached or the
  // cops get close. A heading re-chosen every step would grind the car into
  // walls; a fixed waypoint lets it drive a straight, fast line.
  if (world.state.mission === 1) {
    const p = world.player;
    const WAYPOINTS = [
      { x: 600, y: 600 }, { x: 2600, y: 600 },
      { x: 600, y: 1800 }, { x: 2600, y: 1800 },
    ];
    const needNew = !world.fleeTarget
      || Math.hypot(p.x - world.fleeTarget.x, p.y - world.fleeTarget.y) < 180
      || world.time > (world.fleeUntil ?? 0);
    if (needNew) {
      let bestPoint = WAYPOINTS[0];
      let bestScore = -Infinity;
      for (const point of WAYPOINTS) {
        let score = Infinity;
        for (const cop of world.cops) {
          if (!cop.active) continue;
          score = Math.min(score, Math.hypot(point.x - cop.x, point.y - cop.y));
        }
        if (score > bestScore) { bestScore = score; bestPoint = point; }
      }
      world.fleeTarget = bestPoint;
      world.fleeUntil = world.time + 9;
    }
    return steerToward(world, world.fleeTarget.x, world.fleeTarget.y, sloppy);
  }
  const t = world.missionTarget;
  return steerToward(world, t.x, t.y, sloppy);
}

/**
 * Set `world` to the named scene (start, play or end; any other name is start)
 * and return the screen to draw over it and the best haul to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) {
      world.step(STEP, autopilot(world, false), false);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  const limit = name === 'end' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  const sloppy = name === 'end';
  for (let index = 0; index < limit / STEP; index += 1) {
    const events = world.step(STEP, autopilot(world, sloppy), false);
    if (world.state.over) break;
    void events;
  }
  const over = world.state.over;
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.money };
}
