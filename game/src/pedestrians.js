// Pedestrians: the people on Solmar Bay's sidewalks. Each one walks between
// random sidewalk waypoints — a point just off a road, at a block corner —
// at a strolling pace, facing where they walk, with a small bob as they go.

import { CITY, PALETTE, PEDS } from './config.js';
import { randPick, randRange } from './random.js';

const AVENUES = CITY.avenues;

/** A random point on a sidewalk: just off an avenue, near a block edge. */
function randomSidewalkPoint(rng) {
  const axis = rng() < 0.5 ? 'x' : 'z';
  const at = randPick(rng, AVENUES);
  const along = randRange(rng, -250, 250);
  const side = rng() < 0.5 ? -1 : 1;
  const off = side * randRange(rng, 8.5, 11.5);
  if (axis === 'x') return { x: along, z: at + off };
  return { x: at + off, z: along };
}

function buildPedBody(rng) {
  const group = new THREE.Group();
  const height = randRange(rng, PEDS.heightMin, PEDS.heightMax);
  const shirt = randPick(rng, PALETTE.pedShirt);
  const skin = randPick(rng, PALETTE.pedSkin);
  const bodyH = height * 0.55;
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.32, bodyH, 8),
    new THREE.MeshLambertMaterial({ color: shirt }),
  );
  body.position.y = bodyH / 2 + 0.05;
  group.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.21, 10, 8),
    new THREE.MeshLambertMaterial({ color: skin }),
  );
  head.position.y = bodyH + 0.28;
  group.add(head);
  // Legs: two dark boxes so the walk reads at a distance.
  const legMat = new THREE.MeshLambertMaterial({ color: '#2c2c34' });
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.42, 0.16), legMat);
    leg.position.set(sx * 0.11, 0.21, 0);
    group.add(leg);
  }
  group.userData.height = height;
  return group;
}

/**
 * Create the pedestrians. `city` is the object buildCity returned (kept for
 * future sidewalk queries; walkers stay on sidewalks by construction).
 * Returns { peds, update(dt, G), reset() }.
 */
export function createPedestrians(scene, city, rng) {
  const peds = [];

  function scatter(ped) {
    const start = randomSidewalkPoint(rng);
    ped.group.position.set(start.x, 0, start.z);
    ped.target = randomSidewalkPoint(rng);
    ped.speed = randRange(rng, PEDS.speedMin, PEDS.speedMax);
    ped.phase = randRange(rng, 0, Math.PI * 2);
    ped.heading = randRange(rng, 0, Math.PI * 2);
    ped.group.rotation.y = ped.heading;
  }

  for (let i = 0; i < PEDS.count; i += 1) {
    const group = buildPedBody(rng);
    scene.add(group);
    const ped = { group, target: { x: 0, z: 0 }, speed: 1.5, phase: 0, heading: 0 };
    scatter(ped);
    peds.push(ped);
  }

  function reset() {
    for (const ped of peds) scatter(ped);
  }

  function update(dt, G) {
    for (const ped of peds) {
      const pos = ped.group.position;
      const dx = ped.target.x - pos.x;
      const dz = ped.target.z - pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 1) {
        ped.target = randomSidewalkPoint(rng);
        continue;
      }
      const step = ped.speed * dt;
      const mx = (dx / dist) * step;
      const mz = (dz / dist) * step;
      pos.x += mx;
      pos.z += mz;
      // Face the direction of travel (forward is +Z at heading 0).
      const wanted = Math.atan2(mx, mz);
      let diff = wanted - ped.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      ped.heading += Math.max(-3 * dt, Math.min(3 * dt, diff));
      ped.group.rotation.y = ped.heading;
      // Small bob while walking.
      ped.phase += dt * ped.speed * 4;
      pos.y = Math.abs(Math.sin(ped.phase)) * 0.05;
    }
  }

  return { peds, update, reset };
}
