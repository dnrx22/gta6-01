// Vice Shores — canvas renderer. One camera follows the player across the
// city; the HUD, the wanted stars, the mission line and the minimap are drawn
// in screen space on top. Screens: title, play, over (busted or wasted).

import { VIEW, WORLD, ROAD, PALETTE, FONT, MISSIONS } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_OVER = 'over';

function drawCar(ctx, x, y, angle, colour, isCop) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = '#111';
  ctx.fillRect(-46, -26, 92, 52);
  ctx.fillStyle = colour;
  ctx.fillRect(-44, -24, 88, 48);
  ctx.fillStyle = 'rgba(20,30,45,0.85)';
  ctx.fillRect(-12, -20, 26, 40);
  ctx.fillStyle = isCop ? '#ffffff' : 'rgba(255,255,255,0.25)';
  ctx.fillRect(28, -20, 10, 40);
  if (isCop) {
    ctx.fillStyle = '#ff3b30';
    ctx.fillRect(-30, -24, 12, 8);
    ctx.fillStyle = '#2f6fd0';
    ctx.fillRect(-30, 16, 12, 8);
  }
  ctx.restore();
}

function drawPerson(ctx, x, y, angle, colour, radius) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = '#1c1c1c';
  ctx.beginPath();
  ctx.arc(0, 0, radius + 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1c1c1c';
  ctx.fillRect(radius - 2, -4, 10, 8);
  ctx.restore();
}

export function drawWorld(ctx, world) {
  const s = world.state;
  const p = world.player;
  const camX = Math.max(0, Math.min(WORLD.width - VIEW.width, p.x - VIEW.width / 2));
  const camY = Math.max(0, Math.min(WORLD.height - VIEW.height, p.y - VIEW.height / 2));
  ctx.save();
  ctx.translate(-camX, -camY);

  // Ground: sea and sand on the west edge, grass everywhere else.
  ctx.fillStyle = PALETTE.sea;
  ctx.fillRect(camX - 20, camY - 20, 150, VIEW.height + 40);
  ctx.fillStyle = PALETTE.beach;
  ctx.fillRect(camX + 130, camY - 20, 130, VIEW.height + 40);
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(Math.max(camX, WORLD.beachX), camY, VIEW.width, VIEW.height);

  // Park and docks.
  ctx.fillStyle = PALETTE.park;
  ctx.fillRect(1450, 1050, 300, 300);
  ctx.fillStyle = '#2a4d6e';
  ctx.fillRect(2960, 200, 240, 400);
  ctx.fillStyle = '#8a6d3b';
  ctx.fillRect(2960, 200, 240, 26);
  ctx.fillStyle = '#c9a227';
  ctx.font = `bold 22px ${FONT}`;
  ctx.fillText('DOCKS', 2990, 420);

  // Roads: dark strips with a dashed centre line.
  ctx.fillStyle = PALETTE.road;
  for (let x = ROAD.gap; x < WORLD.width; x += ROAD.gap) {
    ctx.fillRect(x - ROAD.width / 2, camY - 20, ROAD.width, VIEW.height + 40);
  }
  for (let y = ROAD.gap; y < WORLD.height; y += ROAD.gap) {
    ctx.fillRect(camX - 20, y - ROAD.width / 2, VIEW.width + 40, ROAD.width);
  }
  ctx.strokeStyle = PALETTE.roadLine;
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 26]);
  ctx.beginPath();
  for (let x = ROAD.gap; x < WORLD.width; x += ROAD.gap) {
    ctx.moveTo(x, camY - 20);
    ctx.lineTo(x, camY + VIEW.height + 20);
  }
  for (let y = ROAD.gap; y < WORLD.height; y += ROAD.gap) {
    ctx.moveTo(camX - 20, y);
    ctx.lineTo(camX + VIEW.width + 20, y);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Buildings with a roof colour and a darker outline.
  for (const b of world.buildings) {
    if (b.x > camX + VIEW.width || b.x + b.w < camX || b.y > camY + VIEW.height || b.y + b.h < camY) continue;
    ctx.fillStyle = PALETTE.building;
    ctx.fillRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, 10);
  }

  // Mission marker: a pulsing yellow diamond with a beam.
  const t = world.missionTarget;
  const pulse = 1 + 0.12 * Math.sin(world.time * 4);
  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = PALETTE.marker;
  ctx.beginPath();
  ctx.moveTo(0, -26);
  ctx.lineTo(20, 0);
  ctx.lineTo(0, 26);
  ctx.lineTo(-20, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#7a5b00';
  ctx.font = `bold 15px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('!', 0, 5);
  ctx.restore();
  ctx.fillStyle = 'rgba(255,210,63,0.18)';
  ctx.fillRect(t.x - 3, t.y - 260, 6, 260);

  for (const car of world.parked) {
    if (car.taken) continue;
    drawCar(ctx, car.x, car.y, car.angle, car.colour, false);
  }
  for (const car of world.traffic) drawCar(ctx, car.x, car.y, car.angle, car.colour, false);
  for (const ped of world.peds) drawPerson(ctx, ped.x, ped.y, ped.angle, PALETTE.ped, 10);
  for (const cop of world.cops) {
    if (!cop.active) continue;
    if (cop.onFoot) drawPerson(ctx, cop.x, cop.y, cop.angle, PALETTE.cop, 12);
    else drawCar(ctx, cop.x, cop.y, cop.angle, PALETTE.copCar, true);
  }

  // The player: a car when driving, a person on foot.
  if (p.inCar && p.car) drawCar(ctx, p.car.x, p.car.y, p.car.angle, p.car.colour, false);
  else drawPerson(ctx, p.x, p.y, p.angle, PALETTE.player, 13);

  ctx.restore();
  drawHud(ctx, world, camX, camY);
}

function drawHud(ctx, world, camX, camY) {
  const s = world.state;
  const p = world.player;
  ctx.fillStyle = 'rgba(16,20,27,0.82)';
  ctx.fillRect(12, 12, 300, 108);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `bold 26px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(`$${s.money}`, 26, 46);
  ctx.font = `16px ${FONT}`;
  ctx.fillText(`Health ${Math.max(0, Math.round(s.health))}`, 26, 72);
  ctx.fillStyle = s.health > 40 ? '#58d68d' : PALETTE.danger;
  ctx.fillRect(26, 80, 180 * Math.max(0, s.health) / 100, 10);
  // Wanted stars.
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < s.wanted ? PALETTE.marker : '#3a4150';
    ctx.font = '22px sans-serif';
    ctx.fillText('★', 26 + i * 26, 112);
  }
  const mission = MISSIONS[Math.min(s.mission, MISSIONS.length - 1)];
  ctx.fillStyle = 'rgba(16,20,27,0.82)';
  ctx.fillRect(12, 130, 430, 56);
  ctx.fillStyle = PALETTE.marker;
  ctx.font = `bold 17px ${FONT}`;
  ctx.fillText(s.missionDone ? 'All missions done!' : `Mission ${s.mission + 1}: ${mission.name}`, 26, 154);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `15px ${FONT}`;
  ctx.fillText(s.missionDone ? 'Free roam — enjoy Vice Shores.' : mission.text, 26, 176);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `14px ${FONT}`;
  ctx.fillText(s.message, 26, 690);
  ctx.fillText(p.inCar ? 'E: leave car · WASD: drive' : 'E: steal car · WASD: walk', 26, 712);

  // Minimap: the whole city shrunk to a corner, with player, cops and marker.
  const mw = 190;
  const mh = 142;
  const mx = VIEW.width - mw - 12;
  const my = 12;
  const sx = mw / WORLD.width;
  const sy = mh / WORLD.height;
  ctx.fillStyle = 'rgba(16,20,27,0.85)';
  ctx.fillRect(mx - 4, my - 4, mw + 8, mh + 8);
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(mx, my, mw, mh);
  ctx.fillStyle = PALETTE.sea;
  ctx.fillRect(mx, my, 260 * sx, mh);
  ctx.fillStyle = PALETTE.road;
  for (let x = ROAD.gap; x < WORLD.width; x += ROAD.gap) ctx.fillRect(mx + x * sx - 2, my, 4, mh);
  for (let y = ROAD.gap; y < WORLD.height; y += ROAD.gap) ctx.fillRect(mx, my + y * sy - 2, mw, 4);
  ctx.fillStyle = PALETTE.marker;
  ctx.beginPath();
  ctx.arc(mx + world.missionTarget.x * sx, my + world.missionTarget.y * sy, 5, 0, Math.PI * 2);
  ctx.fill();
  for (const cop of world.cops) {
    if (!cop.active) continue;
    ctx.fillStyle = PALETTE.cop;
    ctx.fillRect(mx + cop.x * sx - 3, my + cop.y * sy - 3, 6, 6);
  }
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(mx + p.x * sx, my + p.y * sy, 4, 0, Math.PI * 2);
  ctx.fill();
}

export function drawTitle(ctx, best) {
  ctx.fillStyle = '#0d1526';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.fillStyle = '#ff9f1c';
  ctx.font = `bold 92px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('VICE SHORES', VIEW.width / 2, 220);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `28px ${FONT}`;
  ctx.fillText('A tiny open-world crime game — walk, steal a car, run missions, dodge the cops.', VIEW.width / 2, 280);
  ctx.fillStyle = PALETTE.marker;
  ctx.font = `bold 22px ${FONT}`;
  ctx.fillText('WASD / arrows — move & drive · E — enter / leave a car · Enter — start', VIEW.width / 2, 340);
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `20px ${FONT}`;
  ctx.fillText('3 missions · wanted stars · minimap · $1,400 on the line', VIEW.width / 2, 380);
  if (best > 0) {
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`Best haul so far: $${best}`, VIEW.width / 2, 430);
  }
  ctx.fillStyle = PALETTE.text;
  ctx.font = `bold 26px ${FONT}`;
  ctx.fillText('Press Enter to play', VIEW.width / 2, 500);
}

export function drawOver(ctx, world) {
  const s = world.state;
  ctx.fillStyle = 'rgba(10,10,14,0.78)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.fillStyle = s.busted ? PALETTE.cop : PALETTE.danger;
  ctx.font = `bold 72px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(s.busted ? 'BUSTED!' : 'WASTED!', VIEW.width / 2, 300);
  ctx.fillStyle = PALETTE.text;
  ctx.font = `26px ${FONT}`;
  ctx.fillText(`You walked away with $${s.money}.`, VIEW.width / 2, 360);
  ctx.font = `bold 24px ${FONT}`;
  ctx.fillText('Press Enter to play again', VIEW.width / 2, 430);
}
