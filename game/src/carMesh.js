// SOLMAR BAY — car meshes: player, traffic and police bodies.
// One job: turn a colour and a kind into a drivable-looking car group.

import THREE from './three.js';

const bodyGeo = new THREE.BoxGeometry(1, 1, 1);
const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);

export function buildCarMesh(color, kind = 'sedan') {
  const group = new THREE.Group();
  group.name = `car-${kind}`;
  const paint = new THREE.MeshLambertMaterial({ color });
  const glass = new THREE.MeshLambertMaterial({ color: 0x1c2836, emissive: 0x0a1420 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x14161a });

  const long = kind === 'sport' ? 4.6 : 4.2;
  const wide = 1.9;
  const body = new THREE.Mesh(bodyGeo, paint);
  body.scale.set(wide, 0.75, long);
  body.position.y = 0.62;
  body.castShadow = true;
  group.add(body);

  const cabin = new THREE.Mesh(bodyGeo, glass);
  cabin.scale.set(wide * 0.82, 0.62, long * 0.45);
  cabin.position.set(0, 1.28, kind === 'sport' ? -0.2 : -0.1);
  cabin.castShadow = true;
  group.add(cabin);

  // headlights + taillights
  const lightMat = new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0x776622 });
  const tailMat = new THREE.MeshLambertMaterial({ color: 0xc22a1e, emissive: 0x550a05 });
  for (const sx of [-0.6, 0.6]) {
    const head = new THREE.Mesh(bodyGeo, lightMat);
    head.scale.set(0.45, 0.18, 0.1);
    head.position.set(sx, 0.62, long / 2 + 0.02);
    group.add(head);
    const tail = new THREE.Mesh(bodyGeo, tailMat);
    tail.scale.set(0.45, 0.18, 0.1);
    tail.position.set(sx, 0.62, -long / 2 - 0.02);
    group.add(tail);
  }

  // wheels, spun by the driving code
  const wheels = [];
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111214 });
  for (const [wx, wz] of [[-0.85, 1.45], [0.85, 1.45], [-0.85, -1.45], [0.85, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.42, wz);
    wheel.castShadow = true;
    group.add(wheel);
    wheels.push(wheel);
  }

  let strobes = null;
  if (kind === 'police') {
    const bar = new THREE.Mesh(bodyGeo, dark);
    bar.scale.set(1.2, 0.22, 0.4);
    bar.position.set(0, 1.72, -0.1);
    group.add(bar);
    const redMat = new THREE.MeshLambertMaterial({ color: 0xff2211, emissive: 0x880000 });
    const blueMat = new THREE.MeshLambertMaterial({ color: 0x2266ff, emissive: 0x000088 });
    const red = new THREE.Mesh(bodyGeo, redMat);
    red.scale.set(0.55, 0.24, 0.42);
    red.position.set(-0.3, 1.74, -0.1);
    group.add(red);
    const blue = new THREE.Mesh(bodyGeo, blueMat);
    blue.scale.set(0.55, 0.24, 0.42);
    blue.position.set(0.3, 1.74, -0.1);
    group.add(blue);
    strobes = { red: redMat, blue: blueMat, phase: 0 };
    const stripe = new THREE.Mesh(bodyGeo, new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }));
    stripe.scale.set(wide + 0.02, 0.2, long * 0.5);
    stripe.position.set(0, 0.75, 0);
    group.add(stripe);
  }

  return { group, wheels, strobes, length: long, width: wide };
}

// A simple on-foot character: body, head, legs that swing while walking.
export function buildPersonMesh(shirtColor, skinColor = 0xc98d64) {
  const group = new THREE.Group();
  group.name = 'person';
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
  const skin = new THREE.MeshLambertMaterial({ color: skinColor });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2b3442 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.75, 0.34), shirt);
  body.position.y = 1.12;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), skin);
  head.position.y = 1.72;
  head.castShadow = true;
  group.add(head);
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.14, 0.44), new THREE.MeshLambertMaterial({ color: 0x1d1712 }));
  hair.position.y = 1.96;
  group.add(hair);
  const legs = [];
  for (const sx of [-0.16, 0.16]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.72, 0.26), pants);
    leg.position.set(sx, 0.36, 0);
    leg.castShadow = true;
    group.add(leg);
    legs.push(leg);
  }
  const arms = [];
  for (const sx of [-0.38, 0.38]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.2), shirt);
    arm.position.set(sx, 1.12, 0);
    group.add(arm);
    arms.push(arm);
  }
  return { group, legs, arms, head };
}
