// Solmar Bay — pedestrians strolling the sidewalks.
// Thirty-six walkers, each on one sidewalk, bobbing along and wrapping at
// the edge of town.

import { makePerson } from './carMesh.js';
import { CFG } from './config.js';
import { pick, pickSign, range, rangeInt } from './random.js';

const SHIRTS = [0xe85d3f, 0x3f8be8, 0xead13f, 0x7ad13f, 0xe83fa0, 0xf0f0f0, 0x8b5cf6];
const PANTS = [0x2a2f3a, 0x5a4632, 0x3a4a5a, 0x6b6b6b];

export function createPedestrians(scene, rng) {
  const walkers = [];
  for (let i = 0; i < CFG.pedCount; i++) {
    const axis = pick(rng, ['x', 'z']);
    const line = pick(rng, CFG.roadLines);
    const side = pickSign(rng) * 7.6;
    const dir = pickSign(rng);
    const mesh = makePerson(pick(rng, SHIRTS), pick(rng, PANTS));
    const walker = {
      mesh,
      axis,
      dir,
      speed: range(rng, 1.0, 2.0),
      phase: range(rng, 0, Math.PI * 2),
      x: 0,
      z: 0,
      heading: 0,
      down: false,
      downTimer: 0,
    };
    const along = range(rng, -160, 160);
    if (axis === 'x') {
      walker.x = along;
      walker.z = line + side;
      walker.heading = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      walker.x = line + side;
      walker.z = along;
      walker.heading = dir > 0 ? 0 : Math.PI;
    }
    mesh.position.set(walker.x, 0, walker.z);
    mesh.rotation.y = walker.heading;
    scene.add(mesh);
    walkers.push(walker);
  }

  function update(dt) {
    for (const w of walkers) {
      if (w.down) {
        w.downTimer -= dt;
        w.mesh.rotation.x = Math.min(1.4, w.mesh.rotation.x + dt * 3);
        if (w.downTimer <= 0) {
          w.down = false;
          w.mesh.rotation.x = 0;
          w.mesh.visible = true;
        }
        continue;
      }
      w.phase += dt * w.speed * 3.2;
      if (w.axis === 'x') {
        w.x += w.dir * w.speed * dt;
        if (w.x > 172) w.x = -172;
        if (w.x < -172) w.x = 172;
      } else {
        w.z += w.dir * w.speed * dt;
        if (w.z > 172) w.z = -172;
        if (w.z < -172) w.z = 172;
      }
      w.mesh.position.set(w.x, Math.abs(Math.sin(w.phase)) * 0.06, w.z);
      w.mesh.rotation.y = w.heading;
    }
  }

  // Knock a walker down; they get up after a few seconds.
  function knockDown(walker) {
    if (walker.down) return;
    walker.down = true;
    walker.downTimer = 4;
  }

  function nearest(x, z, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const w of walkers) {
      if (w.down) continue;
      const d = Math.hypot(w.x - x, w.z - z);
      if (d < bestD) {
        bestD = d;
        best = w;
      }
    }
    return best;
  }

  return { walkers, update, knockDown, nearest };
}
