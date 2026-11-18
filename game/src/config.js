// SOLMAR BAY — shared tuning, palette and mission text.
// One job: every number and name the rest of the game reads.

export const CITY = {
  half: 300,            // city extends -300..300 on x and z
  roadGap: 60,          // distance between parallel roads
  roadWidth: 12,        // asphalt width
  beachX: 264,          // sand starts here
  oceanX: 300,          // water starts here
  tower: { x: 30, z: 30, height: 96 },
};

export const PALETTE = {
  skyTop: 0x2e6fb0,
  skyHorizon: 0xffc98a,
  sun: 0xffe9a8,
  fog: 0xf2b98a,
  ground: 0x9aa08a,
  asphalt: 0x33363c,
  sidewalk: 0xb9b3a4,
  sand: 0xe8cf9a,
  ocean: 0x2f7f9e,
  building: [0xe8d9b8, 0xd98a6a, 0x7fb3a8, 0xe0a458, 0xc97b7b, 0x8fa8c9, 0xf0e6cc],
  car: [0xc23b2e, 0x2e6fc2, 0xe8c33a, 0x3aa655, 0xe8e4da, 0x22242a, 0x7a4fa3],
  police: 0x1d2f4a,
  beacon: 0xffc93a,
  club: 0xff5fa2,
};

export const PLAYER = {
  walkSpeed: 7,
  runSpeed: 12,
  radius: 0.7,
  health: 100,
  punchDamage: 25,
  punchRange: 2.2,
};

export const CAR = {
  accel: 22,
  brake: 34,
  reverseAccel: 12,
  maxSpeed: 38,          // ~85 mph
  maxReverse: 10,
  steer: 1.9,
  grip: 6.5,
};

export const POLICE = {
  maxActive: 4,
  chaseSpeed: 36,
  ramDamage: 6,
  bustRange: 3.2,
  bustTime: 2.5,
};

export const MISSIONS = [
  {
    id: 'M1',
    title: 'The Pickup',
    brief: 'Marisol Kane owns your debt. Pick up her package at Rico\u2019s Garage.',
    objective: 'Pick up the package at Rico\u2019s Garage',
    target: { x: -60, z: 60, label: 'Garage' },
    reward: 400,
  },
  {
    id: 'M2',
    title: 'The Delivery',
    brief: 'Take the package across town to Club Neon Palms. Don\u2019t keep Marisol waiting.',
    objective: 'Deliver the package to Club Neon Palms',
    target: { x: 180, z: 120, label: 'Club Neon Palms' },
    reward: 600,
  },
  {
    id: 'M3',
    title: 'The Getaway',
    brief: 'Kane\u2019s rivals are at the club. Deal with them, then lose the heat at the Safehouse.',
    objective: 'Clear the rivals, then reach the Safehouse',
    target: { x: 60, z: -120, label: 'Safehouse' },
    reward: 1000,
  },
];

export const STORY = {
  title: 'SOLMAR BAY',
  subtitle: 'An open-world story in the sun',
  hero: 'Rico Vale',
  debt: 'Marisol Kane',
  intro:
    'Rico Vale owes Marisol Kane more money than he has. Three jobs stand between him and a clean slate — if the sun, the traffic and the Solmar Bay police let him finish them.',
};

export const CONTROLS_TEXT =
  'WASD move / drive  ·  Mouse drag to look  ·  E enter or exit a car  ·  Shift run  ·  F punch  ·  Click shoot  ·  Esc pause  ·  M mute';
