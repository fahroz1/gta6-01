// SOLMAR — Open Streets: tuning and shared constants.
// One city grid, one scale, one set of speeds: every system reads these.
export const CITY = {
  blocks: 7, // blocks per side
  block: 46, // block pitch (road centre to road centre)
  road: 14, // road width
  span: 7 * 46, // 322, city edge to edge
  beach: 64, // sand strip depth south of the city
  water: 120, // water depth past the sand
};

export const SAVE_KEY = 'solmar-save-v1';

export const PLAYER = {
  walkSpeed: 6,
  runSpeed: 10,
  radius: 0.9,
  health: 100,
};

export const CAR = {
  accel: 14,
  brake: 26,
  maxSpeed: 38,
  sportsMax: 48,
  reverseMax: 12,
  steer: 1.9,
  radius: 1.6,
  hp: 100,
};

export const TRAFFIC_COUNT = 14;
export const PED_COUNT = 18;

export const WANTED = {
  decaySeconds: 25, // quiet seconds before one star drops
  maxStars: 5,
  bustSeconds: 1.2, // police contact on foot before a bust
};

export const MISSIONS = [
  { id: 1, name: 'First Job', reward: 300 },
  { id: 2, name: 'Hot Wheels', reward: 600 },
  { id: 3, name: 'The Big Score', reward: 1200 },
];

// Palette: sun-soaked Solmar Bay — warm sand, pastel towers, teal water.
export const PALETTE = {
  sky: 0x87bfe8,
  fog: 0xa8c8e0,
  sun: 0xfff2d0,
  ground: 0x3a3f46,
  sidewalk: 0x8a8f96,
  sand: 0xe8d29a,
  water: 0x2e8fa8,
  building: [0xd8b48f, 0xc9a06a, 0x9fb4c7, 0xe0cfa8, 0xb98a7a, 0x8fa8b8, 0xd0d0c8, 0xc78d5a],
  window: 0x2a3542,
  car: [0xc0392b, 0x2980b9, 0xf1c40f, 0x27ae60, 0x8e44ad, 0xe67e22, 0xecf0f1, 0x2c3e50],
  police: 0x1a2a44,
  taxi: 0xf7c948,
};
