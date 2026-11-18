// Solmar Bay — car and character meshes, built from boxes and cylinders.
// No borrowed art: every vehicle and person is assembled here from primitives.

import { THREE } from './three.js';

function box(w, h, d, color, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.25 })
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

function wheel(x, z) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.34, 0.28, 12),
    new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 })
  );
  mesh.rotation.z = Math.PI / 2;
  mesh.position.set(x, 0.34, z);
  mesh.castShadow = true;
  return mesh;
}

// A drivable car. Forward is +z when heading is 0.
export function makeCar(colorHex) {
  const car = new THREE.Group();
  car.add(box(1.9, 0.62, 4.3, colorHex, 0, 0.62, 0));
  car.add(box(1.65, 0.58, 2.1, 0x1c2733, 0, 1.18, -0.25));
  car.add(box(1.7, 0.1, 0.5, 0x1c2733, 0, 0.98, 1.95));
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xfff2c0, emissive: 0xffedb0, emissiveIntensity: 0.9,
  });
  for (const sx of [-0.6, 0.6]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.06), lampMat);
    lamp.position.set(sx, 0.66, 2.16);
    car.add(lamp);
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.16, 0.06),
      new THREE.MeshStandardMaterial({ color: 0xaa1111, emissive: 0x881111, emissiveIntensity: 0.7 })
    );
    tail.position.set(sx, 0.66, -2.16);
    car.add(tail);
  }
  for (const [x, z] of [[-0.85, 1.35], [0.85, 1.35], [-0.85, -1.35], [0.85, -1.35]]) {
    car.add(wheel(x, z));
  }
  return car;
}

// A police interceptor: dark body, roof light bar.
export function makeCopCar() {
  const car = makeCar(0x1b1e26);
  const barBase = box(1.1, 0.1, 0.32, 0x111111, 0, 1.52, -0.25);
  car.add(barBase);
  const red = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 0.16, 0.3),
    new THREE.MeshStandardMaterial({ color: 0xdd1111, emissive: 0xdd1111, emissiveIntensity: 1.4 })
  );
  red.position.set(-0.28, 1.6, -0.25);
  const blue = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 0.16, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x2266ff, emissive: 0x2266ff, emissiveIntensity: 1.4 })
  );
  blue.position.set(0.28, 1.6, -0.25);
  car.add(red);
  car.add(blue);
  car.userData.lightRed = red;
  car.userData.lightBlue = blue;
  return car;
}

// A person on foot. Forward is +z when heading is 0.
export function makePerson(shirt, pants, skin = 0xc98d64) {
  const person = new THREE.Group();
  const legMat = new THREE.MeshStandardMaterial({ color: pants, roughness: 0.85 });
  for (const sx of [-0.14, 0.14]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.78, 0.22), legMat);
    leg.position.set(sx, 0.39, 0);
    leg.castShadow = true;
    person.add(leg);
    person.userData[`leg${sx < 0 ? 'L' : 'R'}`] = leg;
  }
  const torso = box(0.62, 0.68, 0.34, shirt, 0, 1.12, 0);
  person.add(torso);
  const armMat = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.85 });
  for (const sx of [-0.38, 0.38]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.18), armMat);
    arm.position.set(sx, 1.1, 0);
    arm.castShadow = true;
    person.add(arm);
  }
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.21, 12, 10),
    new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7 })
  );
  head.position.set(0, 1.66, 0);
  head.castShadow = true;
  person.add(head);
  return person;
}

// Rico Vale: teal shirt, dark jeans, the hero of Solmar Bay.
export function makeRico() {
  const rico = makePerson(0x2e8b8b, 0x2a2f3a, 0xc98d64);
  const cap = new THREE.Mesh(
    new THREE.BoxGeometry(0.44, 0.1, 0.44),
    new THREE.MeshStandardMaterial({ color: 0xc01818, roughness: 0.7 })
  );
  cap.position.set(0, 1.84, 0);
  rico.add(cap);
  return rico;
}

// An armed rival: dark jacket, red bandana, a visible pistol.
export function makeRival() {
  const rival = makePerson(0x3a3a3a, 0x1e1e24, 0xb57a52);
  const band = new THREE.Mesh(
    new THREE.BoxGeometry(0.44, 0.12, 0.44),
    new THREE.MeshStandardMaterial({ color: 0xaa1111, roughness: 0.7 })
  );
  band.position.set(0, 1.8, 0);
  rival.add(band);
  const gun = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.12, 0.42),
    new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4, metalness: 0.6 })
  );
  gun.position.set(0.42, 1.05, 0.3);
  rival.add(gun);
  return rival;
}
