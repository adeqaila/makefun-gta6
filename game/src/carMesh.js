// Car meshes for Solmar Bay: one small builder for every kind of car in the
// city. A car is a low-poly group — body box, cabin box, four cylinder
// wheels, small emissive light boxes — so a street full of them stays cheap
// for the headless renderer. Cars face +Z when their heading is 0.

import { PALETTE } from './config.js';

const WHEEL_R = 0.35;

/** Dimensions per kind: sport sits lower and stretches longer than a sedan. */
const DIMS = {
  sedan: { length: 4.2, width: 1.9, bodyH: 0.72, bodyY: 0.55, cabinL: 2.1, cabinH: 0.6 },
  sport: { length: 4.7, width: 2.0, bodyH: 0.55, bodyY: 0.48, cabinL: 2.0, cabinH: 0.5 },
  taxi: { length: 4.2, width: 1.9, bodyH: 0.72, bodyY: 0.55, cabinL: 2.1, cabinH: 0.6 },
  truck: { length: 5.4, width: 2.1, bodyH: 0.8, bodyY: 0.6, cabinL: 1.4, cabinH: 0.7 },
  police: { length: 4.3, width: 1.95, bodyH: 0.72, bodyY: 0.55, cabinL: 2.1, cabinH: 0.6 },
};

function box(w, h, d, color, x, y, z, emissive) {
  const mat = new THREE.MeshLambertMaterial({ color });
  if (emissive) mat.emissive = new THREE.Color(emissive);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  return mesh;
}

/**
 * Build one car. `color` is a hex string; `kind` is sedan, sport, taxi,
 * truck or police. Returns a THREE.Group whose userData holds length/width.
 */
export function buildCarMesh(color, kind) {
  const dims = DIMS[kind] || DIMS.sedan;
  const group = new THREE.Group();
  let strobeMats = null;
  const halfL = dims.length / 2;
  const halfW = dims.width / 2;

  const paint = kind === 'police' ? '#f0f0f0' : color;
  const body = box(dims.width, dims.bodyH, dims.length, paint, 0, dims.bodyY, 0);
  group.add(body);

  if (kind === 'truck') {
    // A cab up front and an open bed behind it instead of a full cabin.
    const cab = box(dims.width - 0.15, dims.cabinH, dims.cabinL, paint, 0, dims.bodyY + dims.bodyH / 2 + dims.cabinH / 2 - 0.08, halfL - dims.cabinL / 2 - 0.15);
    group.add(cab);
    const bedWall = 0.42;
    const bed = box(dims.width - 0.1, bedWall, dims.length - dims.cabinL - 0.7, '#6b5a48', 0, dims.bodyY + dims.bodyH / 2 + bedWall / 2 - 0.05, -halfL + (dims.length - dims.cabinL - 0.7) / 2 + 0.25);
    group.add(bed);
  } else {
    const cabin = box(dims.width - 0.25, dims.cabinH, dims.cabinL, '#22303c', 0, dims.bodyY + dims.bodyH / 2 + dims.cabinH / 2 - 0.05, -0.15);
    group.add(cabin);
  }

  // Wheels: cylinders turned so their axle runs across the car (along X).
  const wheelGeo = new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.26, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: '#1c1c20' });
  const wheelZ = halfL * 0.68;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(sx * (halfW - 0.08), WHEEL_R, sz * wheelZ);
      group.add(wheel);
    }
  }

  // Headlights (warm white, front = +Z) and taillights (red, rear = -Z).
  const lightW = 0.42;
  const lightY = dims.bodyY + 0.08;
  for (const sx of [-1, 1]) {
    group.add(box(lightW, 0.16, 0.08, '#fff6d8', sx * (halfW - 0.32), lightY, halfL + 0.01, '#fff2b0'));
    group.add(box(lightW, 0.16, 0.08, '#c02020', sx * (halfW - 0.32), lightY, -halfL - 0.01, '#ff2a2a'));
  }

  if (kind === 'police') {
    // Black-and-white doors are faked with a dark stripe; red/blue light bar on top.
    group.add(box(dims.width + 0.02, 0.3, dims.length * 0.45, '#22242c', 0, dims.bodyY + 0.05, 0));
    const barY = dims.bodyY + dims.bodyH + dims.cabinH - 0.02;
    const redMat = new THREE.MeshLambertMaterial({ color: '#d02020', emissive: new THREE.Color('#ff2020') });
    const blueMat = new THREE.MeshLambertMaterial({ color: '#2050d0', emissive: new THREE.Color('#2040ff') });
    const redBar = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.5), redMat);
    redBar.position.set(-0.3, barY, -0.15);
    const blueBar = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.5), blueMat);
    blueBar.position.set(0.3, barY, -0.15);
    group.add(redBar, blueBar);
    // Strobe materials, so police.js can flash the light bar while chasing.
    strobeMats = { red: redMat, blue: blueMat };
  }

  if (kind === 'taxi') {
    // Yellow roof sign.
    const signY = dims.bodyY + dims.bodyH + dims.cabinH - 0.02;
    group.add(box(0.7, 0.18, 0.4, '#f2c94c', 0, signY, -0.15, '#f2c94c'));
  }

  group.userData = { length: dims.length, width: dims.width, kind };
  if (strobeMats) group.userData.strobeMats = strobeMats;
  return group;
}

/** A random paint colour from the city palette. */
export function randomCarColor(rng) {
  return PALETTE.car[Math.floor(rng() * PALETTE.car.length)];
}
