// Solmar Bay — tuning, palette, story and missions.
// One place for every number a designer would tweak.

export const CFG = {
  seed: 1,
  step: 1 / 60,
  worldHalf: 175,
  roadLines: [-60, 0, 60],
  roadHalf: 5,
  walkSpeed: 4.6,
  runSpeed: 8.2,
  carAccel: 14,
  carBrake: 26,
  carMaxSpeed: 40,
  carReverseMax: 9,
  carSteer: 1.9,
  trafficCount: 14,
  pedCount: 36,
  policeCap: 4,
  policeTopSpeed: 36,
  wantedDecaySeconds: 25,
  startMoney: 250,
  startHealth: 100,
  startAmmo: 24,
  maxAmmo: 120,
  bulletDamage: 34,
  punchDamage: 25,
  punchRange: 2.6,
  shootRange: 38,
  beaconRadius: 7,
  clockStartMinutes: 17 * 60 + 24,
};

export const PALETTE = {
  skyTop: '#6ea8dd',
  skyHorizon: '#ffb36b',
  sun: '#ffd9a8',
  ground: '#9a938a',
  road: '#2f3339',
  roadLine: '#e8e4d8',
  sidewalk: '#b7ab98',
  sand: '#e8d29a',
  ocean: '#2e7fa8',
  building: [0xe8c39a, 0xd9a06b, 0xc98d5f, 0xb7c4cc, 0x9fb4c7, 0xe0d6c0, 0xd97b6c],
  tower: 0x8fb4d9,
  club: 0xd63fa0,
  carColors: [0xc01818, 0x2456c8, 0xe8e8e8, 0x222226, 0xe8a018, 0x2e8b57, 0x7a4fd0],
};

export const STORY = {
  city: 'SOLMAR BAY',
  tagline: 'Sun, salt air, and one debt too many.',
  hero: 'Rico Vale',
  creditor: 'Marisol Kane',
  debt: 2000,
  intro:
    'Rico Vale owes Marisol Kane $2,000. Three jobs stand between him and a clean slate. ' +
    'Steal a car, lose the cops, and get the work done — the bay never sleeps.',
};

export const MISSIONS = [
  {
    id: 1,
    title: "Pick up Marisol's package",
    place: 'Harbor Steps',
    target: { x: -60, z: 60 },
    reward: 400,
    hint: 'Get to the beacon at the Harbor Steps.',
  },
  {
    id: 2,
    title: 'Deliver to the docks contact',
    place: 'North Docks',
    target: { x: 60, z: -60 },
    reward: 600,
    hint: 'The buyer waits at the North Docks. Do not keep him waiting.',
  },
  {
    id: 3,
    title: 'Settle the debt at Club Neon Palms',
    place: 'Club Neon Palms',
    target: { x: 60, z: 60 },
    reward: 1000,
    hint: 'Marisol’s crew guards the club. Expect a fight.',
  },
];

export function missionLabel(index) {
  const m = MISSIONS[index];
  if (!m) return 'Debt paid — Solmar Bay is yours.';
  return `M${m.id}/3 — ${m.title} — ${m.place} ($${m.reward})`;
}

export function formatMoney(n) {
  return `$${Math.floor(n).toLocaleString('en-US')}`;
}

export function formatClock(totalMinutes) {
  const mins = Math.floor(totalMinutes) % (24 * 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
