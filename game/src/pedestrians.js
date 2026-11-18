// SOLMAR BAY — pedestrians: people walking the sidewalks.
// One job: peds that stroll, wait at corners and flee from gunfire.

import THREE from './three.js';
import { CITY } from './config.js';
import { range, pick } from './random.js';
import { buildPersonMesh } from './carMesh.js';
import { ROAD_LINES, nearestRoadCoord, roadPointNear } from './city.js';

const SHIRTS = [0xe8e4da, 0x4fa3c9, 0xe07a5f, 0x81b29a, 0xf2cc8f, 0x9b7ede, 0x3d5a80];

export function createPedestrians(scene, rng, count = 36) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const mesh = buildPersonMesh(pick(rng, SHIRTS));
    const road = roadPointNear(range(rng, -270, 270), range(rng, -270, 270));
    const ped = {
      mesh: mesh.group,
      legs: mesh.legs,
      x: road.x + range(rng, -8, 8),
      z: road.z + range(rng, -8, 8),
      heading: range(rng, 0, Math.PI * 2),
      speed: range(rng, 1, 2),
      walkPhase: range(rng, 0, Math.PI * 2),
      fleeing: 0,
      targetX: 0,
      targetZ: 0,
    };
    // keep peds on the sidewalk, beside the road
    const onXRoad = Math.abs(ped.x - nearestRoadCoord(ped.x)) < Math.abs(ped.z - nearestRoadCoord(ped.z));
    if (onXRoad) ped.x = nearestRoadCoord(ped.x) + (rng() < 0.5 ? 8.5 : -8.5);
    else ped.z = nearestRoadCoord(ped.z) + (rng() < 0.5 ? 8.5 : -8.5);
    ped.targetX = ped.x;
    ped.targetZ = ped.z;
    mesh.group.position.set(ped.x, 0, ped.z);
    scene.add(mesh.group);
    peds.push(ped);
  }
  return { peds };
}

export function updatePedestrians(peds, dt, rng) {
  for (const ped of peds.peds) {
    if (ped.fleeing > 0) {
      ped.fleeing -= dt;
      ped.heading = Math.atan2(ped.targetX - ped.x, ped.targetZ - ped.z);
      ped.speed = 5;
    } else {
      // reached the current corner: pick a new sidewalk target
      if (Math.hypot(ped.targetX - ped.x, ped.targetZ - ped.z) < 1.5) {
        const next = roadPointNear(ped.x + range(rng, -90, 90), ped.z + range(rng, -90, 90));
        const onXRoad = Math.abs(next.x - nearestRoadCoord(next.x)) < Math.abs(next.z - nearestRoadCoord(next.z));
        ped.targetX = onXRoad ? nearestRoadCoord(next.x) + (rng() < 0.5 ? 8.5 : -8.5) : next.x;
        ped.targetZ = onXRoad ? next.z : nearestRoadCoord(next.z) + (rng() < 0.5 ? 8.5 : -8.5);
        ped.speed = range(rng, 1, 2);
      }
      ped.heading = Math.atan2(ped.targetX - ped.x, ped.targetZ - ped.z);
    }
    ped.x += Math.sin(ped.heading) * ped.speed * dt;
    ped.z += Math.cos(ped.heading) * ped.speed * dt;
    ped.x = THREE.MathUtils.clamp(ped.x, -290, CITY.beachX - 2);
    ped.z = THREE.MathUtils.clamp(ped.z, -290, 290);
    ped.walkPhase += dt * ped.speed * 4;
    ped.mesh.position.set(ped.x, 0, ped.z);
    ped.mesh.rotation.y = ped.heading;
    const swing = Math.sin(ped.walkPhase) * 0.5;
    ped.legs[0].rotation.x = swing;
    ped.legs[1].rotation.x = -swing;
  }
}

// Scare every ped near (x,z): they run away from it.
export function scarePeds(peds, x, z, rng, radius = 18) {
  for (const ped of peds.peds) {
    const d = Math.hypot(ped.x - x, ped.z - z);
    if (d < radius) {
      ped.fleeing = range(rng, 2, 4);
      const away = Math.atan2(ped.x - x, ped.z - z);
      ped.targetX = ped.x + Math.sin(away) * 30;
      ped.targetZ = ped.z + Math.cos(away) * 30;
    }
  }
}

export function nearestPed(peds, x, z, maxDist = 3) {
  let best = null;
  let bestD = maxDist;
  for (const ped of peds.peds) {
    const d = Math.hypot(ped.x - x, ped.z - z);
    if (d < bestD) {
      bestD = d;
      best = ped;
    }
  }
  return best;
}
