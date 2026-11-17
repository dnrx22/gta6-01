// Vice Shores — the city and its rules. A seeded city is generated once per
// reset: a road grid, buildings inside each block, a beach on the west edge, a
// park in the middle and docks on the east edge. The player walks or drives;
// cops, pedestrians and traffic all live in the same world.

import {
  WORLD, ROAD, ON_FOOT, CAR, COP, PED, TRAFFIC, PARKED, WANTED, MISSIONS,
} from './config.js';
import { createRandom, pick } from './random.js';

export const EVENT_OVER = 1;
export const EVENT_MISSION = 2;
export const EVENT_WANTED = 4;

const PARK = { x: 1450, y: 1050, w: 300, h: 300 };
const DOCKS = { x: 2960, y: 200, w: 240, h: 400 };
const PICKUP = { x: 1600, y: 1200 };
const CAR_COLOURS = ['#e5534b', '#4fc3f7', '#f2c94c', '#a569bd', '#7fb3d5', '#e67e22'];

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function onRoad(x, y) {
  const rx = ((x % ROAD.gap) + ROAD.gap) % ROAD.gap;
  const ry = ((y % ROAD.gap) + ROAD.gap) % ROAD.gap;
  return rx < ROAD.width / 2 || rx > ROAD.gap - ROAD.width / 2
    || ry < ROAD.width / 2 || ry > ROAD.gap - ROAD.width / 2;
}

function inZone(x, y, z) {
  return x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// Push a circle (x, y, radius) out of every building it overlaps.
function collideBuildings(world, body) {
  for (const b of world.buildings) {
    const cx = clamp(body.x, b.x, b.x + b.w);
    const cy = clamp(body.y, b.y, b.y + b.h);
    const dx = body.x - cx;
    const dy = body.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= body.r * body.r) continue;
    if (d2 === 0) { body.y = b.y - body.r; continue; }
    const d = Math.sqrt(d2);
    body.x += (dx / d) * (body.r - d);
    body.y += (dy / d) * (body.r - d);
  }
}

function roadPoint(random, horizontal) {
  const lane = (Math.floor(random() * 7) + 1) * ROAD.gap;
  const along = 200 + random() * (WORLD.height - 400);
  return horizontal ? { x: along, y: lane } : { x: lane, y: along };
}

export class World {
  constructor(seed) {
    this.seed = seed;
    this.reset();
  }

  reset() {
    const random = createRandom(this.seed);
    // The simulation's own generator: stepPeds and knock-ons draw from this,
    // never from Math.random, so two runs with one seed stay identical.
    this.rng = random;
    this.time = 0;
    this.state = {
      money: 0,
      health: ON_FOOT.health,
      wanted: 0,
      mission: 0,
      missionDone: false,
      over: false,
      busted: false,
      message: 'Welcome to Vice Shores. Follow the yellow marker.',
      missionTimer: 0,
    };
    // Buildings: one or two per city block, never on a road, the beach, the
    // park or the docks.
    this.buildings = [];
    for (let bx = 0; bx < 7; bx += 1) {
      for (let by = 0; by < 5; by += 1) {
        const block = { x: bx * ROAD.gap + 80, y: by * ROAD.gap + 80, w: 240, h: 240 };
        if (inZone(block.x + 120, block.y + 120, PARK)) continue;
        if (inZone(block.x + 120, block.y + 120, DOCKS)) continue;
        const n = 1 + Math.floor(random() * 2);
        for (let i = 0; i < n; i += 1) {
          const w = 90 + random() * 90;
          const h = 90 + random() * 90;
          const b = {
            x: block.x + random() * (block.w - w),
            y: block.y + random() * (block.h - h),
            w, h,
            roof: pick(random, ['#b8452f', '#3f6d8e', '#6b5b73', '#8e6f3f']),
          };
          if (!this.buildings.some((o) => rectsOverlap(o, b))) this.buildings.push(b);
        }
      }
    }
    // Parked cars sit on the roads, ready to be taken.
    this.parked = [];
    for (let i = 0; i < PARKED.count; i += 1) {
      const p = roadPoint(random, random() < 0.5);
      this.parked.push({ x: p.x, y: p.y, angle: random() * Math.PI * 2, colour: pick(random, CAR_COLOURS), taken: false });
    }
    this.traffic = [];
    for (let i = 0; i < TRAFFIC.count; i += 1) {
      const horizontal = random() < 0.5;
      const p = roadPoint(random, horizontal);
      this.traffic.push({
        x: p.x, y: p.y, angle: horizontal ? (random() < 0.5 ? 0 : Math.PI) : (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2),
        speed: TRAFFIC.speed * (0.8 + random() * 0.4), colour: pick(random, CAR_COLOURS),
      });
    }
    this.peds = [];
    for (let i = 0; i < PED.count; i += 1) {
      this.peds.push({
        x: 300 + random() * (WORLD.width - 600),
        y: 300 + random() * (WORLD.height - 600),
        angle: random() * Math.PI * 2, speed: PED.speed * (0.7 + random() * 0.6),
        timer: 1 + random() * 3,
      });
    }
    this.cops = [];
    for (let i = 0; i < COP.count; i += 1) {
      const p = roadPoint(random, random() < 0.5);
      this.cops.push({ x: p.x, y: p.y, angle: 0, speed: 0, onFoot: false, active: false });
    }
    this.player = {
      x: 1600, y: 2100, angle: -Math.PI / 2, speed: 0,
      inCar: false, car: null, invulnerable: 0,
    };
    this.missionTarget = { ...PICKUP };
    this.wantedTimer = 0;
    this.events = 0;
  }

  missionTargetFor(index) {
    if (index === 0) return { ...PICKUP };
    if (index === 1) return { x: this.player.x, y: this.player.y };
    return { x: 3050, y: 400 };
  }

  setWanted(stars) {
    const s = this.state;
    if (stars > s.wanted) {
      s.wanted = Math.min(WANTED.max, stars);
      this.wantedTimer = 0;
      // A short head start: the cops take a moment to react, so the player
      // can reach a car before the chase begins.
      this.copDelay = 2;
      this.events |= EVENT_WANTED;
      if (s.wanted >= 3) s.message = 'The whole force is after you!';
      else if (s.wanted >= 1) s.message = 'Cops spotted you. Lose them!';
    }
  }

  nearestParked(maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const c of this.parked) {
      if (c.taken) continue;
      const d = Math.hypot(c.x - this.player.x, c.y - this.player.y);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  step(dt, input, autopilot) {
    const s = this.state;
    const p = this.player;
    if (s.over) return 0;
    this.time += dt;
    this.events = 0;
    const ix = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const iy = (input.down ? 1 : 0) - (input.up ? 1 : 0);

    if (p.inCar && p.car) {
      // Simple arcade car: forward speed, steering that bites harder slowly.
      const car = p.car;
      if (input.up) car.speed += CAR.accel * dt;
      else if (input.down) car.speed -= (car.speed > 0 ? CAR.brake : CAR.accel * 0.6) * dt;
      else car.speed -= car.speed * 0.8 * dt;
      car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
      const steer = ix * CAR.turn * clamp(Math.abs(car.speed) / 220, 0, 1) * (car.speed < 0 ? -1 : 1);
      car.angle += steer * dt;
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      // Hitting the world's edge scrubs speed off, so a car grinding along a
      // wall can turn away instead of sliding at full speed forever.
      const clampedX = clamp(car.x, 40, WORLD.width - 40);
      const clampedY = clamp(car.y, 40, WORLD.height - 40);
      if (clampedX !== car.x || clampedY !== car.y) car.speed *= 0.55;
      car.x = clampedX;
      car.y = clampedY;
      p.x = car.x; p.y = car.y; p.angle = car.angle; p.speed = car.speed;
      const body = { x: car.x, y: car.y, r: 34 };
      collideBuildings(this, body);
      car.x = body.x; car.y = body.y; p.x = car.x; p.y = car.y;
      if (Math.abs(car.speed) > 300) this.checkHitPed(car.x, car.y, 40);
    } else {
      const len = Math.hypot(ix, iy) || 1;
      p.x += (ix / len) * ON_FOOT.speed * dt * (ix || iy ? 1 : 0);
      p.y += (iy / len) * ON_FOOT.speed * dt * (ix || iy ? 1 : 0);
      if (ix || iy) p.angle = Math.atan2(iy, ix);
      p.x = clamp(p.x, 20, WORLD.width - 20);
      p.y = clamp(p.y, 20, WORLD.height - 20);
      const body = { x: p.x, y: p.y, r: ON_FOOT.radius };
      collideBuildings(this, body);
      p.x = body.x; p.y = body.y;
    }

    if (input.enter) {
      if (p.inCar) {
        p.inCar = false;
        p.car = null;
        p.x += Math.cos(p.angle + Math.PI / 2) * 60;
        p.y += Math.sin(p.angle + Math.PI / 2) * 60;
      } else {
        const car = this.nearestParked(90);
        if (car) {
          car.taken = true;
          p.inCar = true;
          p.car = { x: car.x, y: car.y, angle: car.angle, speed: 0, colour: car.colour };
          p.x = car.x; p.y = car.y;
          this.setWanted(Math.max(s.wanted, WANTED.stealStars));
          s.message = 'Car stolen! The cops noticed.';
        }
      }
    }

    this.stepTraffic(dt);
    this.stepPeds(dt);
    this.stepCops(dt);
    this.stepMissions(dt);
    if (p.invulnerable > 0) p.invulnerable -= dt;
    if (s.health <= 0 && !s.over) {
      s.over = true; s.busted = false;
      this.events |= EVENT_OVER;
    }
    const out = this.events;
    this.events = 0;
    return out;
  }

  checkHitPed(x, y, r) {
    for (const ped of this.peds) {
      if (Math.hypot(ped.x - x, ped.y - y) < r + 14) {
        // Knocked aside to a fixed spot derived from the seeded generator,
        // so the same run always puts the pedestrian in the same place.
        ped.x = 400 + this.rng() * 2400;
        ped.y = 400 + this.rng() * 1600;
        ped.angle = this.rng() * Math.PI * 2;
        this.setWanted(WANTED.hitCopStars);
      }
    }
  }

  stepTraffic(dt) {
    for (const t of this.traffic) {
      t.x += Math.cos(t.angle) * t.speed * dt;
      t.y += Math.sin(t.angle) * t.speed * dt;
      if (t.x < 120 || t.x > WORLD.width - 120 || t.y < 120 || t.y > WORLD.height - 120) {
        t.angle += Math.PI / 2;
        t.x = clamp(t.x, 140, WORLD.width - 140);
        t.y = clamp(t.y, 140, WORLD.height - 140);
      }
    }
  }

  stepPeds(dt) {
    for (const ped of this.peds) {
      ped.timer -= dt;
      if (ped.timer <= 0) {
        ped.angle = this.rng() * Math.PI * 2;
        ped.timer = 2 + this.rng() * 4;
      }
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
      ped.x = clamp(ped.x, 280, WORLD.width - 40);
      ped.y = clamp(ped.y, 40, WORLD.height - 40);
      if (onRoad(ped.x, ped.y)) ped.angle += Math.PI / 2;
    }
  }

  stepCops(dt) {
    const s = this.state;
    const p = this.player;
    const want = s.wanted > 0;
    for (const cop of this.cops) cop.active = want;
    if (!want) return;
    if (this.copDelay > 0) {
      this.copDelay -= dt;
      return;
    }
    // Wanted fades only while every cop is far away — "stay out of sight".
    // A cop closing in resets the clock, so hiding is the way out.
    let nearest = Infinity;
    for (const cop of this.cops) {
      nearest = Math.min(nearest, Math.hypot(p.x - cop.x, p.y - cop.y));
    }
    if (nearest > 400) {
      this.wantedTimer += dt;
      if (this.wantedTimer > WANTED.decaySeconds) {
        s.wanted = 0;
        this.wantedTimer = 0;
        s.message = 'You lost them. Stay clean.';
        return;
      }
    } else {
      this.wantedTimer = 0;
    }
    for (const cop of this.cops) {
      const d = Math.hypot(p.x - cop.x, p.y - cop.y);
      if (d >= 800) {
        // Out of sight, out of mind: the cop drifts back toward the city
        // centre instead of homing in from across the map. This is what makes
        // losing the heat possible at all — a straight fast getaway works.
        cop.onFoot = true;
        const cx = WORLD.width / 2;
        const cy = WORLD.height / 2;
        cop.angle = Math.atan2(cy - cop.y, cx - cop.x);
        cop.x += Math.cos(cop.angle) * 80 * dt;
        cop.y += Math.sin(cop.angle) * 80 * dt;
        continue;
      }
      if (p.inCar && d > 420) {
        // Cop car closes in fast; on foot a cop runs the player down.
        cop.onFoot = false;
        const sp = COP.carSpeed;
        cop.angle = Math.atan2(p.y - cop.y, p.x - cop.x);
        cop.x += Math.cos(cop.angle) * sp * dt;
        cop.y += Math.sin(cop.angle) * sp * dt;
      } else {
        cop.onFoot = true;
        const sp = COP.speed;
        cop.angle = Math.atan2(p.y - cop.y, p.x - cop.x);
        cop.x += Math.cos(cop.angle) * sp * dt;
        cop.y += Math.sin(cop.angle) * sp * dt;
      }
      if (d < COP.bustRadius && p.invulnerable <= 0) {
        if (p.inCar && Math.abs(p.speed) > 240) {
          // Rammed through: the cop is shaken off. No extra star — the cop
          // ran into the car, not the other way round.
          cop.x += Math.cos(cop.angle) * -500;
          cop.y += Math.sin(cop.angle) * -500;
          p.invulnerable = 1.5;
        } else if (!p.inCar) {
          s.over = true; s.busted = true;
          this.events |= EVENT_OVER;
        } else {
          s.health -= 25 * dt * 10;
          p.invulnerable = 1;
          if (s.health <= 0) { s.over = true; this.events |= EVENT_OVER; }
        }
      }
    }
  }

  stepMissions(dt) {
    const s = this.state;
    if (s.missionDone || s.over) return;
    const target = this.missionTarget;
    const d = Math.hypot(this.player.x - target.x, this.player.y - target.y);
    if (s.mission === 0 && d < 70) {
      s.money += MISSIONS[0].pay;
      s.mission = 1;
      s.message = 'Package picked up — but the cops saw you. Lose the heat!';
      this.setWanted(2);
      // The pickup was a setup: the cops close in from nearby roads, so the
      // chase starts at once instead of depending on where they happened to
      // spawn. They still take a moment to react (see setWanted).
      for (const cop of this.cops) {
        const angle = this.rng() * Math.PI * 2;
        const dist = 320 + this.rng() * 200;
        cop.x = clamp(this.player.x + Math.cos(angle) * dist, 100, WORLD.width - 100);
        cop.y = clamp(this.player.y + Math.sin(angle) * dist, 100, WORLD.height - 100);
        cop.onFoot = true;
      }
      this.events |= EVENT_MISSION;
      return;
    }
    if (s.mission === 1) {
      if (s.wanted === 0) {
        s.money += MISSIONS[1].pay;
        s.mission = 2;
        this.missionTarget = this.missionTargetFor(2);
        s.message = 'Clean! Now deliver the package to the east docks.';
        this.events |= EVENT_MISSION;
      }
      return;
    }
    if (s.mission === 2 && d < 90) {
      s.money += MISSIONS[2].pay;
      s.missionDone = true;
      s.message = `Delivered! You made $${s.money}. Play on or restart.`;
      this.events |= EVENT_MISSION;
    }
  }
}
