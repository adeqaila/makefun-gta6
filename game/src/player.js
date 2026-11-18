// SOLMAR BAY — Rico Vale on foot: walk, run, punch, enter cars.
// One job: the player character when he is not driving.

import THREE from './three.js';
import { PLAYER } from './config.js';
import { buildPersonMesh } from './carMesh.js';
import { collideBuildings } from './city.js';

export function createPlayer(scene) {
  const mesh = buildPersonMesh(0xd94f3d); // Rico: red shirt, easy to spot
  const player = {
    mesh: mesh.group,
    legs: mesh.legs,
    arms: mesh.arms,
    x: -60,
    z: 120,
    heading: Math.PI,
    speed: 0,
    walkPhase: 0,
    health: PLAYER.health,
    money: 250,
    ammo: 24,
    inCar: null,
    punchCooldown: 0,
  };
  mesh.group.position.set(player.x, 0, player.z);
  scene.add(mesh.group);
  return player;
}

export function updatePlayerOnFoot(player, input, cameraYaw, dt, buildings) {
  const run = input.keys['ShiftLeft'] || input.keys['ShiftRight'];
  const topSpeed = run ? PLAYER.runSpeed : PLAYER.walkSpeed;
  let mx = 0;
  let mz = 0;
  if (input.keys['KeyW']) mz += 1;
  if (input.keys['KeyS']) mz -= 1;
  if (input.keys['KeyA']) mx -= 1;
  if (input.keys['KeyD']) mx += 1;
  const moving = mx !== 0 || mz !== 0;
  if (moving) {
    const len = Math.hypot(mx, mz);
    mx /= len;
    mz /= len;
    // movement is relative to the camera's yaw: W walks away from the camera
    const sin = Math.sin(cameraYaw);
    const cos = Math.cos(cameraYaw);
    const wx = mx * cos + mz * sin;
    const wz = -mx * sin + mz * cos;
    player.speed += (topSpeed - player.speed) * Math.min(1, dt * 8);
    player.x += wx * player.speed * dt;
    player.z += wz * player.speed * dt;
    player.heading = Math.atan2(wx, wz);
    player.walkPhase += dt * player.speed * 1.6;
  } else {
    player.speed += (0 - player.speed) * Math.min(1, dt * 8);
  }
  const fixed = collideBuildings(buildings, player.x, player.z, PLAYER.radius);
  player.x = fixed.x;
  player.z = fixed.z;
  player.x = THREE.MathUtils.clamp(player.x, -292, 296);
  player.z = THREE.MathUtils.clamp(player.z, -292, 292);
  player.mesh.position.set(player.x, 0, player.z);
  player.mesh.rotation.y = player.heading;
  const swing = Math.sin(player.walkPhase) * (player.speed > 0.5 ? 0.55 : 0);
  player.legs[0].rotation.x = swing;
  player.legs[1].rotation.x = -swing;
  player.arms[0].rotation.x = -swing * 0.8;
  player.arms[1].rotation.x = swing * 0.8;
  if (player.punchCooldown > 0) player.punchCooldown -= dt;
}
