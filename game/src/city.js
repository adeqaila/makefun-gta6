// Solmar Bay itself: a sun-soaked grid city with a beach on its south edge.
// The city is built once from a seeded generator, so the same seed always
// gives the same streets, towers and palms. Buildings stay inside their
// blocks and never cover a road; colliders are circles the player, cars and
// pedestrians can test with isBlocked().

import { CITY, PALETTE, WORLD } from './config.js';
import { randPick, randRange } from './random.js';

const AVENUES = CITY.avenues;
const HALF_ROAD = CITY.road / 2;

/** The traffic lane offset for a heading on an axis (right-hand traffic). */
export function laneFor(axis, heading) {
  if (axis === 'x') return heading > 0 ? CITY.road / 4 : -CITY.road / 4;
  return heading === 0 ? -CITY.road / 4 : CITY.road / 4;
}

function flat(w, d, color, x, y, z, group) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshLambertMaterial({ color }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  group.add(mesh);
  return mesh;
}

/**
 * Build the whole city into `scene`. `rng` is the seeded generator function.
 * Returns the city object the rest of the game drives and collides against.
 */
export function buildCity(scene, rng) {
  const group = new THREE.Group();
  const colliders = [];
  const avenues = [];
  for (const at of AVENUES) {
    avenues.push({ axis: 'x', at, from: CITY.roadFrom, to: CITY.roadTo });
    avenues.push({ axis: 'z', at, from: CITY.roadFrom, to: CITY.roadTo });
  }

  // Warm dry-grass ground, then sand and sea along the southern edge.
  flat(660, 660, PALETTE.ground, 0, 0, 0, group);
  flat(660, 52, PALETTE.sand, 0, 0.01, WORLD.beachZ + 24, group);
  flat(660, 170, PALETTE.sea, 0, 0.02, WORLD.seaZ + 83, group);
  flat(660, 60, PALETTE.seaDeep, 0, 0.03, WORLD.seaZ + 195, group);

  // Asphalt avenues both ways, with a thin warm centre line on each.
  const roadMat = new THREE.MeshLambertMaterial({ color: PALETTE.road });
  const lineMat = new THREE.MeshLambertMaterial({ color: PALETTE.roadLine });
  for (const at of AVENUES) {
    const roadX = new THREE.Mesh(new THREE.PlaneGeometry(520, CITY.road), roadMat);
    roadX.rotation.x = -Math.PI / 2;
    roadX.position.set(0, 0.02, at);
    group.add(roadX);
    const roadZ = new THREE.Mesh(new THREE.PlaneGeometry(CITY.road, 520), roadMat);
    roadZ.rotation.x = -Math.PI / 2;
    roadZ.position.set(at, 0.02, 0);
    group.add(roadZ);
    const lineX = new THREE.Mesh(new THREE.PlaneGeometry(520, 0.4), lineMat);
    lineX.rotation.x = -Math.PI / 2;
    lineX.position.set(0, 0.04, at);
    group.add(lineX);
    const lineZ = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 520), lineMat);
    lineZ.rotation.x = -Math.PI / 2;
    lineZ.position.set(at, 0.04, 0);
    group.add(lineZ);
  }

  // Light sidewalks fill every block; buildings sit on top of them.
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const buildingMats = PALETTE.building.map(
    (c) => new THREE.MeshLambertMaterial({ color: c }),
  );
  const roofMat = new THREE.MeshLambertMaterial({ color: '#8a7f70' });

  function addBuilding(x, z, w, h, d, mat) {
    const mesh = new THREE.Mesh(unitBox, mat);
    mesh.scale.set(w, h, d);
    mesh.position.set(x, h / 2, z);
    group.add(mesh);
    colliders.push({ x, z, r: Math.max(w, d) * 0.62 });
    if (rng() < 0.4) {
      const roof = new THREE.Mesh(unitBox, roofMat);
      roof.scale.set(w * 0.3, 2.2, d * 0.3);
      roof.position.set(x + w * 0.15, h + 1.1, z - d * 0.12);
      group.add(roof);
    }
    return mesh;
  }

  // One building per block corner, more near the centre where towers belong.
  const towerBlock = { i: 3, j: 3 };
  for (let i = 0; i < AVENUES.length - 1; i += 1) {
    for (let j = 0; j < AVENUES.length - 1; j += 1) {
      const cx = (AVENUES[i] + AVENUES[i + 1]) / 2;
      const cz = (AVENUES[j] + AVENUES[j + 1]) / 2;
      flat(CITY.block, CITY.block, PALETTE.sidewalk, cx, 0.015, cz, group);
      if (i === towerBlock.i && j === towerBlock.j) {
        // Solmar Tower, the landmark: the tallest glass slab near the centre.
        const tower = addBuilding(cx, cz, 26, 110, 26, new THREE.MeshLambertMaterial({ color: PALETTE.tower }));
        tower.material.emissive = new THREE.Color('#1a2f45');
        const crown = new THREE.Mesh(unitBox, roofMat);
        crown.scale.set(10, 5, 10);
        crown.position.set(cx, 112.5, cz);
        group.add(crown);
        continue;
      }
      const dist = Math.hypot(cx, cz);
      const slots = [[-13, -13], [13, -12], [-12, 13], [13, 13]];
      const count = rng() < 0.4 ? 4 : 3;
      for (let s = 0; s < count; s += 1) {
        const w = randRange(rng, 12, 22);
        const d = randRange(rng, 12, 22);
        let h = randRange(rng, 8, 30) + Math.max(0, 1 - dist / 300) * 52 * rng();
        h = Math.min(90, h);
        addBuilding(
          cx + slots[s][0] + randRange(rng, -2, 2),
          cz + slots[s][1] + randRange(rng, -2, 2),
          w, h, d,
          randPick(rng, buildingMats),
        );
      }
    }
  }

  // Palms: a row along the beach and scattered ones on the sidewalks.
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 5.2, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: PALETTE.palmTrunk });
  const frondGeo = new THREE.ConeGeometry(0.55, 2.4, 4);
  const frondMat = new THREE.MeshLambertMaterial({ color: PALETTE.palmLeaf });
  function addPalm(x, z) {
    const palm = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 2.6;
    palm.add(trunk);
    for (let k = 0; k < 4; k += 1) {
      const frond = new THREE.Mesh(frondGeo, frondMat);
      const angle = (k / 4) * Math.PI * 2 + 0.4;
      frond.position.set(Math.cos(angle) * 0.8, 5.4, Math.sin(angle) * 0.8);
      frond.rotation.z = Math.cos(angle) * 1.1;
      frond.rotation.x = -Math.sin(angle) * 1.1;
      palm.add(frond);
    }
    palm.position.set(x, 0, z);
    group.add(palm);
    colliders.push({ x, z, r: 1 });
  }
  for (let p = 0; p < 18; p += 1) {
    addPalm(randRange(rng, -255, 255), randRange(rng, 258, 276));
  }
  for (let p = 0; p < CITY.palmCount - 18; p += 1) {
    const bi = Math.floor(rng() * (AVENUES.length - 1));
    const bj = Math.floor(rng() * (AVENUES.length - 1));
    const cx = (AVENUES[bi] + AVENUES[bi + 1]) / 2;
    const cz = (AVENUES[bj] + AVENUES[bj + 1]) / 2;
    const edge = rng() < 0.5;
    addPalm(
      cx + (edge ? (rng() < 0.5 ? -27 : 27) : randRange(rng, -26, 26)),
      cz + (edge ? randRange(rng, -26, 26) : (rng() < 0.5 ? -27 : 27)),
    );
  }

  // Street lamps at every other intersection, warm glow on top.
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 6.5, 6);
  const poleMat = new THREE.MeshLambertMaterial({ color: PALETTE.lampPole });
  const bulbMat = new THREE.MeshLambertMaterial({ color: PALETTE.lampGlow, emissive: '#ffbf5a' });
  const bulbGeo = new THREE.SphereGeometry(0.32, 8, 6);
  let lamps = 0;
  for (let i = 0; i < AVENUES.length && lamps < CITY.lampCount; i += 1) {
    for (let j = 0; j < AVENUES.length && lamps < CITY.lampCount; j += 1) {
      if ((i + j) % 2 !== 0) continue;
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(AVENUES[i] + 8.5, 3.25, AVENUES[j] + 8.5);
      group.add(pole);
      const bulb = new THREE.Mesh(bulbGeo, bulbMat);
      bulb.position.set(AVENUES[i] + 8.5, 6.6, AVENUES[j] + 8.5);
      group.add(bulb);
      lamps += 1;
    }
  }

  scene.add(group);

  function isBlocked(x, z, r) {
    if (Math.abs(x) > WORLD.bounds || Math.abs(z) > WORLD.bounds) return true;
    for (let k = 0; k < colliders.length; k += 1) {
      const c = colliders[k];
      const dx = x - c.x;
      const dz = z - c.z;
      const rr = r + c.r;
      if (dx * dx + dz * dz < rr * rr) return true;
    }
    return false;
  }

  function randomRoadPoint(rngFn) {
    const axis = rngFn() < 0.5 ? 'x' : 'z';
    const at = randPick(rngFn, AVENUES);
    const along = randRange(rngFn, -250, 250);
    const heading = axis === 'x' ? (rngFn() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rngFn() < 0.5 ? 0 : Math.PI);
    const lane = laneFor(axis, heading);
    if (axis === 'x') return { x: along, z: at + lane, heading, axis, lane, avenue: at };
    return { x: at + lane, z: along, heading, axis, lane, avenue: at };
  }

  function nearestAvenue(value) {
    let best = AVENUES[0];
    for (const at of AVENUES) {
      if (Math.abs(value - at) < Math.abs(value - best)) best = at;
    }
    return best;
  }

  /**
   * The nearest point on a road to (x, z) — accepts either two numbers or
   * one {x, z} point, since callers pass it both ways.
   */
  function roadPointNear(x, z) {
    if (x && typeof x === 'object') {
      z = x.z;
      x = x.x;
    }
    const atZ = nearestAvenue(z);
    const atX = nearestAvenue(x);
    if (Math.abs(z - atZ) <= Math.abs(x - atX)) {
      return { x: Math.max(-250, Math.min(250, x)), z: atZ, heading: Math.PI / 2, axis: 'x' };
    }
    return { x: atX, z: Math.max(-250, Math.min(250, z)), heading: 0, axis: 'z' };
  }

  return {
    group,
    colliders,
    avenues,
    spawn: { onFoot: { x: 0, z: 20 }, car: { x: 8, z: 20, heading: 0 } },
    garage: { x: 180, z: -148 },
    safehouse: { x: -190, z: 148 },
    packagePickup: { x: -160, z: -148 },
    club: { x: 120, z: 74 },
    sportCarSpot: { x: 60, z: -70.5, heading: Math.PI / 2 },
    beachZ: WORLD.beachZ,
    bounds: WORLD.bounds,
    isBlocked,
    randomRoadPoint,
    roadPointNear,
    laneFor,
  };
}
