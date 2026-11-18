// Traffic: the NPC cars that keep Solmar Bay's avenues alive. Each car owns
// one road — an avenue plus a lane offset — and drives along it, slowing for
// the car ahead and sometimes turning at an intersection. Cars never leave
// their road, so they never hit a building. A traffic car can be stolen:
// builder B takes over its group, this module just stops driving it.

import { TRAFFIC } from './config.js';
import { randPick, randRange } from './random.js';
import { buildCarMesh, randomCarColor } from './carMesh.js';

const KINDS = ['sedan', 'sedan', 'sedan', 'sport', 'taxi', 'taxi', 'truck'];
const TURN_TIME = 0.8;

/** Turn a heading toward a target heading, shortest way around, capped per second. */
function turnHeadingToward(heading, target, rate, dt) {
  let diff = target - heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const step = Math.max(-rate * dt, Math.min(rate * dt, diff));
  return heading + step;
}

/**
 * Create the traffic system. `city` is the object buildCity returned.
 * Returns { cars, update(dt, G), reset(), spawnTrafficCar(spot?) }.
 */
export function createTraffic(scene, city, rng, carMeshModule) {
  const makeCar = (carMeshModule && carMeshModule.buildCarMesh) || buildCarMesh;
  const cars = [];

  function placeOnRoad(car, spot) {
    const point = spot && spot.axis ? spot : city.randomRoadPoint(rng);
    car.axis = point.axis;
    car.avenue = point.avenue !== undefined ? point.avenue : point.axis === 'x' ? point.z : point.x;
    car.lane = point.lane !== undefined ? point.lane : city.laneFor(point.axis, point.heading);
    car.laneTarget = car.lane;
    car.heading = point.heading;
    car.targetHeading = point.heading;
    car.along = point.axis === 'x' ? point.x : point.z;
    car.turning = 0;
    car.turnCooldown = randRange(rng, 1, 4);
    car.targetSpeed = randRange(rng, TRAFFIC.speedMin, TRAFFIC.speedMax);
    car.speed = car.targetSpeed * randRange(rng, 0.7, 1);
    car.group.position.set(point.x, 0, point.z);
    car.group.rotation.y = point.heading;
  }

  function newCar(spot) {
    const kind = randPick(rng, KINDS);
    const color = randomCarColor(rng);
    const group = makeCar(color, kind);
    scene.add(group);
    const car = { group, kind, color, heading: 0, speed: 0, targetSpeed: 10, axis: 'x', lane: 0 };
    placeOnRoad(car, spot);
    cars.push(car);
    return car;
  }

  for (let i = 0; i < TRAFFIC.count; i += 1) newCar();

  /** Add one more traffic car on a road point (used when a car gets stolen). */
  function spawnTrafficCar(spot) {
    return newCar(spot);
  }

  function reset() {
    for (const car of cars) placeOnRoad(car);
  }

  function update(dt, G) {
    for (const car of cars) {
      if (car.stolen) continue;
      car.turnCooldown -= dt;

      // Slow down for a car ahead on the same road, same lane direction.
      let wanted = car.targetSpeed;
      for (const other of cars) {
        if (other === car || other.stolen || other.axis !== car.axis) continue;
        const perp = car.axis === 'x'
          ? Math.abs((other.avenue + other.lane) - (car.avenue + car.lane))
          : Math.abs((other.avenue + other.lane) - (car.avenue + car.lane));
        if (perp > 4) continue;
        const gap = (other.along - car.along) * (car.axis === 'x' ? Math.sin(car.heading) : Math.cos(car.heading));
        if (gap > 0 && gap < TRAFFIC.followGap) {
          wanted = gap < 4 ? 0 : Math.min(wanted, Math.max(0, other.speed - 1));
        }
      }
      car.speed += (wanted - car.speed) * Math.min(1, dt * 2.5);
      if (car.speed < 0.05 && wanted === 0) car.speed = 0;

      // At an intersection, sometimes turn onto the crossing avenue.
      const avenueAts = city.avenues.filter((a) => a.axis === 'z').map((a) => a.at);
      let nearCrossing = null;
      for (const at of avenueAts) {
        if (Math.abs(car.along - at) < 2.5) { nearCrossing = at; break; }
      }
      if (nearCrossing !== null && car.turnCooldown <= 0 && car.turning <= 0 && rng() < TRAFFIC.turnChance) {
        const turnLeft = rng() < 0.5;
        let newHeading;
        if (car.axis === 'x') {
          newHeading = car.heading > 0 ? (turnLeft ? 0 : Math.PI) : (turnLeft ? Math.PI : 0);
        } else {
          newHeading = car.heading === 0 ? (turnLeft ? Math.PI / 2 : -Math.PI / 2) : (turnLeft ? -Math.PI / 2 : Math.PI / 2);
        }
        const newAxis = car.axis === 'x' ? 'z' : 'x';
        car.axis = newAxis;
        car.avenue = nearCrossing;
        car.along = car.axis === 'x'
          ? car.group.position.x
          : car.group.position.z;
        // Ease from the road centre into the new lane instead of snapping.
        car.lane = 0;
        car.laneTarget = city.laneFor(newAxis, newHeading);
        car.targetHeading = newHeading;
        car.turning = TURN_TIME;
        car.turnCooldown = randRange(rng, 4, 9);
      }

      // Heading eases toward its target while turning; lane eases likewise.
      if (car.turning > 0) {
        car.heading = turnHeadingToward(car.heading, car.targetHeading, 2.6, dt);
        car.turning -= dt;
      }
      car.lane += (car.laneTarget - car.lane) * Math.min(1, dt * 2);

      // Drive along the road; wrap around at the city edge.
      const dir = car.axis === 'x' ? Math.sin(car.targetHeading) : Math.cos(car.targetHeading);
      car.along += dir * car.speed * dt;
      if (car.along > 262) car.along = -262;
      if (car.along < -262) car.along = 262;

      if (car.axis === 'x') car.group.position.set(car.along, 0, car.avenue + car.lane);
      else car.group.position.set(car.avenue + car.lane, 0, car.along);
      car.group.rotation.y = car.heading;
    }
  }

  return { cars, update, reset, spawnTrafficCar };
}
