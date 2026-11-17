// Vice Shores — entry point. A fixed-step loop (60 updates a second, whatever
// the display's rate) drives the world; the renderer draws the current screen.
// ?shot=start|play|end&seed=N stages a deterministic screenshot scene instead
// of waiting for a key press, so the same URL always shows the same frame.

import { VIEW, STEP, BEST_KEY } from './config.js';
import { World } from './world.js';
import { createInput } from './input.js';
import {
  SCREEN_TITLE, SCREEN_PLAY, SCREEN_OVER,
  drawWorld, drawTitle, drawOver,
} from './render.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');

function fitCanvas() {
  const ratio = window.devicePixelRatio || 1;
  canvas.width = VIEW.width * ratio;
  canvas.height = VIEW.height * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') || '1') || 1;
const shot = params.get('shot');
const world = new World(seed);
const input = createInput();

let screen = SCREEN_TITLE;
let best = 0;
try {
  best = Number(window.localStorage.getItem(BEST_KEY) || '0') || 0;
} catch {
  best = 0;
}

function saveBest() {
  if (world.state.money > best) {
    best = world.state.money;
    try {
      window.localStorage.setItem(BEST_KEY, String(best));
    } catch {
      // Private mode: the haul just is not remembered.
    }
  }
}

function announce() {
  const s = world.state;
  status.textContent = s.over
    ? (s.busted ? `Busted. You made $${s.money}.` : `Wasted. You made $${s.money}.`)
    : `Money $${s.money}, health ${Math.round(s.health)}, wanted ${s.wanted} stars. ${s.message}`;
}

if (shot) {
  const staged = stageShot(shot, world);
  screen = staged.screen;
  best = Math.max(best, staged.best);
  drawWorld(ctx, world);
  if (screen === SCREEN_TITLE) drawTitle(ctx, best);
  if (screen === SCREEN_OVER) drawOver(ctx, world);
  announce();
} else {
  let last = performance.now();
  let accumulator = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const elapsed = Math.min(0.25, (now - last) / 1000);
    last = now;
    accumulator += elapsed;
    const pressed = input.consume();
    if (screen === SCREEN_TITLE && pressed.start) screen = SCREEN_PLAY;
    else if (screen === SCREEN_OVER && pressed.start) {
      world.reset();
      screen = SCREEN_PLAY;
    }
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP) {
        world.step(STEP, input, false);
        accumulator -= STEP;
      }
      if (world.state.over) {
        screen = SCREEN_OVER;
        saveBest();
      }
    }
    ctx.clearRect(0, 0, VIEW.width, VIEW.height);
    drawWorld(ctx, world);
    if (screen === SCREEN_TITLE) drawTitle(ctx, best);
    if (screen === SCREEN_OVER) drawOver(ctx, world);
    announce();
  }
  requestAnimationFrame(frame);
}
