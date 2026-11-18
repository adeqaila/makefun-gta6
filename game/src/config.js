// Solmar Bay — every tuning number and colour in one place.
// The city is a road grid about +/-260 units across; one fixed step is 1/60 s.

export const STEP = 1 / 60;

/** World limits: the playable city stays inside +/-BOUNDS on x and z. */
export const WORLD = { bounds: 280, beachZ: 270, seaZ: 305 };

/** Road grid: 7 avenues each way, 60-unit blocks, 14-unit roads. */
export const CITY = {
  block: 60,
  road: 14,
  grid: 7,
  avenues: [-222, -148, -74, 0, 74, 148, 222],
  roadFrom: -260,
  roadTo: 260,
  buildingCount: 120,
  palmCount: 40,
  lampCount: 24,
};

/** Sun-soaked late-afternoon palette: warm sky, pastel buildings, dark asphalt. */
export const PALETTE = {
  sky: '#ffd9a0',
  skyTop: '#7fb2e5',
  sun: '#fff2cf',
  ground: '#c2a878',
  sand: '#e8d5a8',
  sea: '#2e8f9e',
  seaDeep: '#1f6f8b',
  road: '#33363b',
  roadLine: '#d8c25a',
  sidewalk: '#b9b3a8',
  building: ['#f2c9a0', '#e8b48c', '#d9a06b', '#c9c2b4', '#a8c4d4', '#8fb8c9', '#e8dcc8', '#d48c7a'],
  tower: '#7fb2d9',
  palmTrunk: '#8a6b4a',
  palmLeaf: '#4d8a4a',
  lampPole: '#4a4a52',
  lampGlow: '#ffd28a',
  car: ['#c0392b', '#2e6fb0', '#e8e8e8', '#f2c94c', '#3a3a3a', '#7a4a8a', '#2a9d8f'],
  pedShirt: ['#e5534b', '#4fc3f7', '#f2c94c', '#7bc96f', '#ff8fab', '#9b7ede', '#ffffff', '#ff9f43'],
  pedSkin: ['#f2c9a0', '#d9a06b', '#8a5a3b', '#e8b48c'],
  text: '#f5efe4',
  muted: '#cfc4ae',
  hudPanel: 'rgba(20, 18, 24, 0.72)',
  wanted: '#ff5a4e',
  money: '#7be495',
};

export const PLAYER = {
  walk: 6,
  run: 10,
  health: 100,
  radius: 0.6,
  height: 1.8,
  punchDamage: 25,
  punchRange: 1.6,
  punchCooldown: 0.45,
};

/** Car tuning: acceleration in units/s^2, top speeds in units/s. */
export const CAR = {
  accel: 22,
  brake: 34,
  reverseMax: 10,
  turnRate: 2.4,
  sedanMax: 28,
  sportMax: 38,
  policeMax: 34,
  taxiMax: 28,
  truckMax: 22,
  steerGrip: 0.9,
};

export const TRAFFIC = {
  count: 14,
  speedMin: 9,
  speedMax: 13,
  turnChance: 0.25,
  followGap: 9,
  laneOffset: 3.5,
};

export const PEDS = {
  count: 36,
  speedMin: 1.2,
  speedMax: 2.0,
  heightMin: 1.6,
  heightMax: 1.95,
};

export const WANTED = {
  max: 5,
  decaySeconds: 14,
  policePerStar: 2,
  maxPolice: 8,
  chaseSpeed: 30,
  ramDamage: 12,
  bustRadius: 2.2,
  bustSeconds: 2.5,
};

export const MISSION = {
  rewards: { delivery: 400, pickup: 600, getaway: 1000 },
  deliveryRadius: 6,
  pickupRadius: 5,
  getawaySeconds: 75,
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the save (money, missions done, best score) is kept between visits. */
export const SAVE_KEY = 'solmar-bay.save.v1';
