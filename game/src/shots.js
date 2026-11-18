// SOLMAR BAY — screenshot staging: four fixed, deterministic scenes.
// One job: place every actor for a shot, then run the world a fixed number of steps.

import THREE from './three.js';
import { MISSIONS } from './config.js';
import { makeDrivableCar, speedMph } from './vehicles.js';
import { spawnEnemy } from './combat.js';
import { startMission } from './missions.js';

const FIXED_DT = 1 / 60;

function resetWorld(world, money = 250, ammo = 24) {
  const { player, police, combat, scene } = world;
  player.health = 100;
  player.money = money;
  player.ammo = ammo;
  player.punchCooldown = 0;
  police.wanted = 0;
  police.bustTimer = 0;
  police.quietTimer = 0;
  for (const car of [...police.cars]) scene.remove(car.mesh);
  police.cars = [];
  for (const enemy of [...combat.enemies]) {
    scene.remove(enemy.mesh);
  }
  combat.enemies = [];
  if (world.parkedCar) {
    scene.remove(world.parkedCar.mesh);
    world.parkedCar = null;
  }
  if (player.inCar) {
    scene.remove(player.inCar.mesh);
    player.inCar = null;
    player.mesh.visible = true;
  }
  world.gameMinutes = 16 * 60 + 20;
  world.time = 0;
}

function putPlayerInCar(world, color, kind, x, z, heading) {
  const car = makeDrivableCar(world.scene, color, kind, x, z, heading);
  car.speed = 0;
  world.player.inCar = car;
  world.player.mesh.visible = false;
  world.player.x = x;
  world.player.z = z;
  world.player.heading = heading;
  return car;
}

function putPoliceBehind(world, x, z, heading, n) {
  for (let i = 0; i < n; i++) {
    const car = makeDrivableCar(world.scene, 0x1d2f4a, 'police', x - i * 16, z + (i % 2 === 0 ? 3 : -3), heading);
    car.speed = 26 + i * 2;
    world.police.cars.push(car);
  }
}

// Move every traffic car the shot does not feature onto far avenues, so no
// random car can drift into the player's path and spoil the staged scene.
function clearTraffic(world) {
  const avenues = [-240, -180, -120, 120, 180, 240];
  world.traffic.cars.forEach((car, i) => {
    car.x = avenues[i % avenues.length];
    car.z = -220 + i * 34;
    car.heading = i % 2 === 0 ? 0 : Math.PI;
    car.speed = 10;
    car.cruise = 10;
    car.wait = 0;
  });
}

// Stage shot n (1-4). Returns {steps, input} for the fixed-step run.
export function stageShot(world, n) {
  const { player, rng } = world;
  world.state = 'playing';
  world.hud.el.style.display = 'block';
  if (n === 1) {
    // COVER — chase: red Solmar GT at speed, three police on its tail, wanted 3.
    resetWorld(world, 1050, 24);
    spawnEnemy(world.combat, world.scene, rng, 188, 126);
    spawnEnemy(world.combat, world.scene, rng, 172, 116);
    startMission(world, 2);
    world.missions.rivalsSpawned = true; // rivals already placed at the club
    const car = putPlayerInCar(world, 0xc23b2e, 'sport', -120, 0, Math.PI / 2);
    car.speed = 26;
    world.police.wanted = 3;
    putPoliceBehind(world, -152, 0, Math.PI / 2, 3);
    clearTraffic(world);
    // traffic ahead in the same avenue, in the outer lanes (never in the
    // player's path, so the chase is never spoiled by a rear-end graze)
    world.traffic.cars[0].x = -60; world.traffic.cars[0].z = 4.5; world.traffic.cars[0].heading = Math.PI / 2; world.traffic.cars[0].speed = 12;
    world.traffic.cars[1].x = -30; world.traffic.cars[1].z = -4.5; world.traffic.cars[1].heading = Math.PI / 2; world.traffic.cars[1].speed = 10;
    world.traffic.cars[2].x = -95; world.traffic.cars[2].z = -4.5; world.traffic.cars[2].heading = -Math.PI / 2; world.traffic.cars[2].speed = 11;
    world.cameraYaw = Math.PI / 2;
    return { steps: 360, input: { KeyW: true } };
  }
  if (n === 2) {
    // STREET — blue sedan cruising the central avenue, traffic and peds close by.
    resetWorld(world, 250, 24);
    startMission(world, 0);
    const car = putPlayerInCar(world, 0x2e6fc2, 'sedan', 0, -120, 0);
    car.speed = 14;
    world.police.wanted = 0;
    clearTraffic(world);
    world.traffic.cars[0].x = 4.5; world.traffic.cars[0].z = -58; world.traffic.cars[0].heading = 0; world.traffic.cars[0].speed = 11;
    world.traffic.cars[1].x = 4.5; world.traffic.cars[1].z = -45; world.traffic.cars[1].heading = 0; world.traffic.cars[1].speed = 12;
    world.traffic.cars[2].x = -4.5; world.traffic.cars[2].z = 30; world.traffic.cars[2].heading = Math.PI; world.traffic.cars[2].speed = 10;
    world.traffic.cars[3].x = 4.5; world.traffic.cars[3].z = -41; world.traffic.cars[3].heading = 0; world.traffic.cars[3].speed = 12;
    // peds on the sidewalks just ahead of where the car ends up
    const near = world.peds.peds.slice(0, 5);
    const spots = [[8.5, -32], [-8.5, -24], [8.5, -16], [-8.5, -38], [8.5, -42]];
    near.forEach((ped, i) => {
      ped.x = spots[i][0];
      ped.z = spots[i][1];
      ped.targetX = ped.x;
      ped.targetZ = ped.z + 40;
      ped.speed = 1.5;
    });
    world.cameraYaw = 0;
    return { steps: 180, input: { KeyW: true } };
  }
  if (n === 3) {
    // ON FOOT — Rico walks east down the avenue toward a rival, Club Neon Palms beacon ahead.
    resetWorld(world, 650, 24);
    startMission(world, 1);
    player.x = 140;
    player.z = 120;
    player.heading = Math.PI / 2;
    player.mesh.position.set(140, 0, 120);
    player.mesh.rotation.y = Math.PI / 2;
    world.police.wanted = 1;
    clearTraffic(world);
    spawnEnemy(world.combat, world.scene, rng, 158, 114);
    world.cameraYaw = Math.PI / 2;
    return { steps: 90, input: { KeyW: true } };
  }
  // START — aerial vista of the city, tower and ocean, title screen on top.
  resetWorld(world, 250, 24);
  world.state = 'title';
  world.hud.el.style.display = 'none';
  player.x = -60;
  player.z = 120;
  player.mesh.position.set(-60, 0, 120);
  startMission(world, 0);
  return { steps: 0, input: {} };
}

// Position the camera for shot n after the fixed-step run.
export function shotCamera(world, n) {
  const { camera, player } = world;
  if (n === 1) {
    // chase, seen from ahead: the Solmar GT head-on, police closing in behind it
    const car = player.inCar;
    const f = new THREE.Vector3(Math.sin(car.heading), 0, Math.cos(car.heading));
    const r = new THREE.Vector3(f.z, 0, -f.x);
    camera.position.copy(new THREE.Vector3(car.x, 0, car.z)).addScaledVector(f, 17).addScaledVector(r, 5).add(new THREE.Vector3(0, 5.5, 0));
    camera.lookAt(car.x - f.x * 12, 1.4, car.z - f.z * 12);
    return;
  }
  if (n === 2) {
    const car = player.inCar;
    const f = new THREE.Vector3(Math.sin(car.heading), 0, Math.cos(car.heading));
    const r = new THREE.Vector3(f.z, 0, -f.x);
    // higher and further to the right, so the near building wall on the
    // left drops out of the frame and the avenue reads cleanly
    camera.position.copy(new THREE.Vector3(car.x, 0, car.z)).addScaledVector(f, -13).addScaledVector(r, 4.5).add(new THREE.Vector3(0, 7, 0));
    camera.lookAt(car.x + f.x * 10, 1.2, car.z + f.z * 10);
    return;
  }
  if (n === 3) {
    const f = new THREE.Vector3(Math.sin(player.heading), 0, Math.cos(player.heading));
    const r = new THREE.Vector3(f.z, 0, -f.x);
    camera.position.copy(new THREE.Vector3(player.x, 0, player.z)).addScaledVector(f, -7).addScaledVector(r, 3).add(new THREE.Vector3(0, 3, 0));
    camera.lookAt(player.x + f.x * 12, 1.4, player.z + f.z * 12);
    return;
  }
  // aerial vista: high over the south-west, looking at the tower and the ocean
  camera.position.set(-150, 155, -150);
  camera.lookAt(80, 0, 80);
}

export function shotState(world, n) {
  const { player } = world;
  return {
    shot: n,
    playerX: Math.round((player.inCar ? player.inCar.x : player.x) * 100) / 100,
    playerZ: Math.round((player.inCar ? player.inCar.z : player.z) * 100) / 100,
    speedMph: player.inCar ? Math.round(speedMph(player.inCar) * 10) / 10 : 0,
    wanted: world.police.wanted,
    money: player.money,
    ammo: player.ammo,
    policeCars: world.police.cars.length,
    mission: world.missions.current,
    gameMinutes: Math.round(world.gameMinutes * 100) / 100,
  };
}

export { FIXED_DT, MISSIONS };
