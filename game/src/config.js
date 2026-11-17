// Vice Shores — tuning numbers and colours in one place.
// The world is a fixed 3200x2400 city; the camera follows the player and the
// renderer scales a 1280x720 logical viewport to the window, so no rule here
// depends on the screen size.

export const WORLD = { width: 3200, height: 2400, beachX: 260 };
export const VIEW = { width: 1280, height: 720 };
export const STEP = 1 / 60;

export const ROAD = { gap: 400, width: 96 };

export const ON_FOOT = { speed: 230, radius: 13, health: 100 };
export const CAR = {
  width: 58,
  length: 96,
  accel: 420,
  brake: 620,
  reverse: 190,
  maxSpeed: 560,
  maxReverse: 170,
  turn: 2.6,
  grip: 3.2,
};

export const COP = { speed: 300, carSpeed: 480, count: 3, bustRadius: 26 };
export const PED = { speed: 55, count: 26 };
export const TRAFFIC = { count: 10, speed: 170 };
export const PARKED = { count: 14 };

export const WANTED = { max: 5, decaySeconds: 10, stealStars: 1, hitCopStars: 2 };

// Missions pay out in this order; finishing all three is a full playthrough.
export const MISSIONS = [
  { id: 1, name: 'Pick up the package', text: 'Reach the yellow marker in the park.', pay: 250 },
  { id: 2, name: 'Lose the heat', text: 'Cops are on you — stay out of sight until the stars fade.', pay: 400 },
  { id: 3, name: 'Deliver to the docks', text: 'Get the package to the east docks. A car helps.', pay: 750 },
];

export const PALETTE = {
  grass: '#3d7a44',
  park: '#2f6b35',
  beach: '#d9c27a',
  sea: '#1f6f8b',
  road: '#33373f',
  roadLine: '#d8c95a',
  sidewalk: '#5a5f68',
  building: '#7d7468',
  buildingTop: '#9a8f7d',
  roof: '#b8452f',
  player: '#f2c94c',
  playerCar: '#e5534b',
  trafficCar: '#7fb3d5',
  parkedCar: '#a569bd',
  cop: '#2f6fd0',
  copCar: '#2f6fd0',
  ped: '#e8e0d0',
  marker: '#ffd23f',
  hud: '#10141b',
  text: '#f2f4f6',
  muted: '#9aa3ad',
  danger: '#ff5a4e',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const BEST_KEY = 'vice-shores.best';
