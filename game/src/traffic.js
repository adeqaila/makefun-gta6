// SOLMAR BAY — traffic: NPC cars cruising the road grid.
// One job: keep cars on roads, turning at intersections, at sane speeds.

import THREE from './three.js';
import { CITY, PALETTE } from './config.js';
import { range, pick } from './random.js';
import { buildCarMesh } from './carMesh.js';
import { ROAD_LINES, nearestRoadCoord } from './city.js';

const LANES = [-3, 3]; // right-hand lanes, offset from the road centre line

export function createTraffic(scene, rng, count = 14) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const mesh = buildCarMesh(pick(rng, PALETTE.car), rng() < 0.25 ? 'sport' : 'sedan');
    const horizontal = rng() < 0.5;
    const line = pick(rng, ROAD_LINES);
    const along = range(rng, -270, 270);
    const lane = pick(rng, LANES);
    const dir = rng() < 0.5 ? 1 : -1;
    const car = {
      mesh: mesh.group,
      wheels: mesh.wheels,
      x: horizontal ? along : line + lane,
      z: horizontal ? line + lane : along,
      heading: horizontal ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2),
      speed: range(rng, 7, 12),
      cruise: range(rng, 7, 12),
      horizontal,
      line,
      wait: 0,
      bumpCd: 0,
    };
    mesh.group.position.set(car.x, 0, car.z);
    mesh.group.rotation.y = car.heading;
    scene.add(mesh.group);
    cars.push(car);
  }
  return { cars };
}

export function updateTraffic(traffic, dt, rng) {
  for (const car of traffic.cars) {
    // pause briefly at intersections sometimes, like a real driver
    const nearCross = Math.abs(car.x - nearestRoadCoord(car.x)) < 4 && Math.abs(car.z - nearestRoadCoord(car.z)) < 4;
    if (car.wait > 0) {
      car.wait -= dt;
    } else if (nearCross && rng() < 0.004) {
      car.wait = range(rng, 1, 2.5);
    }
    const speed = car.wait > 0 ? 0 : car.cruise;
    car.speed += (speed - car.speed) * Math.min(1, dt * 2);
    const dx = Math.sin(car.heading) * car.speed * dt;
    const dz = Math.cos(car.heading) * car.speed * dt;
    car.x += dx;
    car.z += dz;
    // reached the city edge: turn around at the next intersection
    if (Math.abs(car.x) > 285 || Math.abs(car.z) > 285) {
      car.heading += Math.PI;
      car.x = THREE.MathUtils.clamp(car.x, -285, 285);
      car.z = THREE.MathUtils.clamp(car.z, -285, 285);
    }
    // at an intersection, sometimes turn onto the crossing road
    if (nearCross && rng() < 0.02) {
      const turn = rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
      car.heading += turn;
      car.horizontal = Math.abs(Math.sin(car.heading)) > 0.5;
      car.line = car.horizontal ? nearestRoadCoord(car.z) : nearestRoadCoord(car.x);
      car.x = car.horizontal ? car.x : car.line + (car.heading > 0 ? 3 : -3);
      car.z = car.horizontal ? car.line + (car.heading > 0 ? -3 : 3) : car.z;
    }
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    for (const w of car.wheels) w.rotation.x += (car.speed * dt) / 0.42;
  }
}

// The traffic car nearest to (x,z), for collisions and stealing.
export function nearestTrafficCar(traffic, x, z, maxDist = 5) {
  let best = null;
  let bestD = maxDist;
  for (const car of traffic.cars) {
    const d = Math.hypot(car.x - x, car.z - z);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

export function removeTrafficCar(scene, traffic, car) {
  scene.remove(car.mesh);
  traffic.cars.splice(traffic.cars.indexOf(car), 1);
}
