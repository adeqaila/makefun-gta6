// Solmar Bay — the city itself: roads, blocks, towers, palms, beach, ocean.
// Builds the whole skyline from the seed, and reports the building colliders
// so feet and wheels never pass through walls.

import { THREE } from './three.js';
import { CFG, PALETTE } from './config.js';
import { pick, range, rangeInt } from './random.js';

const BLOCK_CENTERS = [-90, -30, 30, 90];

function skyTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, PALETTE.skyTop);
  grad.addColorStop(0.55, '#a8c8e8');
  grad.addColorStop(0.8, PALETTE.skyHorizon);
  grad.addColorStop(1, '#ff9a5c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function flatBox(w, h, d, color, x, y, z, rough = 0.9) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 })
  );
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  return mesh;
}

export function buildCity(scene, rng) {
  const colliders = [];
  scene.background = skyTexture();
  scene.fog = new THREE.Fog(0xffc890, 130, 420);

  const sun = new THREE.DirectionalLight(0xffd9a8, 1.5);
  sun.position.set(120, 150, 70);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -160;
  sun.shadow.camera.right = 160;
  sun.shadow.camera.top = 160;
  sun.shadow.camera.bottom = -160;
  sun.shadow.camera.far = 500;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfd8ff, 0x8a7a5a, 0.75));

  // Ground slab: concrete under everything.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(460, 460),
    new THREE.MeshStandardMaterial({ color: 0x9a938a, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Roads: dark strips on the grid lines, with dashed centre lines.
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x2f3339, roughness: 0.95 });
  const dashMat = new THREE.MeshStandardMaterial({ color: 0xe8e4d8, roughness: 0.8 });
  for (const line of CFG.roadLines) {
    for (const horizontal of [true, false]) {
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(horizontal ? 380 : 10, 0.08, horizontal ? 10 : 380),
        roadMat
      );
      strip.position.set(horizontal ? 0 : line, 0.04, horizontal ? line : 0);
      strip.receiveShadow = true;
      scene.add(strip);
      for (let d = -180; d <= 180; d += 16) {
        const dash = new THREE.Mesh(
          new THREE.BoxGeometry(horizontal ? 6 : 0.5, 0.02, horizontal ? 0.5 : 6),
          dashMat
        );
        dash.position.set(horizontal ? d : line, 0.1, horizontal ? line : d);
        scene.add(dash);
      }
    }
  }

  // Sidewalk slabs for each block.
  const slabMat = new THREE.MeshStandardMaterial({ color: 0xb7ab98, roughness: 1 });
  for (const bx of BLOCK_CENTERS) {
    for (const bz of BLOCK_CENTERS) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(46, 0.3, 46), slabMat);
      slab.position.set(bx, 0.15, bz);
      slab.receiveShadow = true;
      scene.add(slab);
    }
  }

  // Buildings: one or two per block, varied heights and warm stucco colours.
  // The Solmar Tower rises over the (30, 30) block; the club glows at (90, 90).
  for (const bx of BLOCK_CENTERS) {
    for (const bz of BLOCK_CENTERS) {
      const isTower = bx === 30 && bz === 30;
      const isClub = bx === 90 && bz === 90;
      const count = isTower || isClub ? 1 : rangeInt(rng, 1, 2);
      for (let i = 0; i < count; i++) {
        const ox = count === 1 ? 0 : pick(rng, [-10, 10]);
        const oz = count === 1 ? 0 : pick(rng, [-10, 10]);
        const w = isTower ? 24 : range(rng, 13, 20);
        const d = isTower ? 24 : range(rng, 13, 20);
        const h = isTower ? 92 : isClub ? 12 : range(rng, 10, 42);
        const color = isTower ? PALETTE.tower : isClub ? PALETTE.club : pick(rng, PALETTE.building);
        const cx = bx + ox;
        const cz = bz + oz;
        const building = new THREE.Mesh(
          new THREE.BoxGeometry(w, h, d),
          new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05 })
        );
        building.position.set(cx, 0.3 + h / 2, cz);
        building.castShadow = true;
        building.receiveShadow = true;
        scene.add(building);
        // Roof cap.
        const roof = flatBox(w * 0.7, 1.2, d * 0.7, 0x6b6258, cx, 0.3 + h + 0.6, cz);
        scene.add(roof);
        // Lit window strips on the street face.
        const floors = Math.max(1, Math.floor(h / 7));
        const winMat = new THREE.MeshStandardMaterial({
          color: 0x2a3542, emissive: 0xffc860, emissiveIntensity: 0.55, roughness: 0.4,
        });
        for (let f = 0; f < floors; f++) {
          const strip = new THREE.Mesh(new THREE.BoxGeometry(w * 0.72, 0.9, 0.15), winMat);
          strip.position.set(cx, 3.5 + f * 7, cz + d / 2 + 0.08);
          scene.add(strip);
        }
        if (isTower) {
          const antenna = new THREE.Mesh(
            new THREE.CylinderGeometry(0.3, 0.5, 18, 8),
            new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5, metalness: 0.6 })
          );
          antenna.position.set(cx, 0.3 + h + 9, cz);
          scene.add(antenna);
          const beacon = new THREE.Mesh(
            new THREE.SphereGeometry(1.1, 10, 8),
            new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff2222, emissiveIntensity: 2 })
          );
          beacon.position.set(cx, 0.3 + h + 18.5, cz);
          scene.add(beacon);
        }
        if (isClub) {
          const sign = new THREE.Mesh(
            new THREE.BoxGeometry(w * 0.8, 2.2, 0.4),
            new THREE.MeshStandardMaterial({ color: 0xff4fd8, emissive: 0xff2fb0, emissiveIntensity: 1.6 })
          );
          sign.position.set(cx, 9, cz - d / 2 - 0.25);
          scene.add(sign);
        }
        colliders.push({ x: cx, z: cz, hx: w / 2 + 0.4, hz: d / 2 + 0.4 });
      }
    }
  }

  // Palms along the avenues and the beachfront.
  for (let i = 0; i < 18; i++) {
    const alongBeach = i >= 12;
    const px = alongBeach ? range(rng, -140, 140) : pick(rng, [-67, -53, -7, 7, 53, 67]);
    const pz = alongBeach ? range(rng, 112, 118) : range(rng, -140, 110);
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.34, 6.5, 8),
      new THREE.MeshStandardMaterial({ color: 0x8a6b48, roughness: 1 })
    );
    trunk.position.set(px, 3.25, pz);
    trunk.castShadow = true;
    scene.add(trunk);
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2e8b57, roughness: 0.9 });
    for (let l = 0; l < 5; l++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3.4, 6), leafMat);
      const a = (l / 5) * Math.PI * 2 + rng() * 0.6;
      leaf.position.set(px + Math.cos(a) * 1.1, 6.6, pz + Math.sin(a) * 1.1);
      leaf.rotation.z = Math.cos(a) * 1.1;
      leaf.rotation.x = -Math.sin(a) * 1.1;
      leaf.castShadow = true;
      scene.add(leaf);
    }
  }

  // Street lamps on the avenue corners.
  const lampHeadMat = new THREE.MeshStandardMaterial({
    color: 0xfff2c0, emissive: 0xffdf90, emissiveIntensity: 1.2,
  });
  for (const lx of [-65, -5, 55]) {
    for (const lz of [-65, -5, 55]) {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.16, 7, 8),
        new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.6, metalness: 0.5 })
      );
      pole.position.set(lx, 3.5, lz);
      pole.castShadow = true;
      scene.add(pole);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), lampHeadMat);
      head.position.set(lx, 7.1, lz);
      scene.add(head);
    }
  }

  // Beach sand and the ocean to the south (positive z).
  const sand = flatBox(460, 0.5, 34, 0xe8d29a, 0, 0.1, 137);
  scene.add(sand);
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(460, 260),
    new THREE.MeshStandardMaterial({ color: 0x2e7fa8, roughness: 0.25, metalness: 0.1 })
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, -0.4, 285);
  scene.add(ocean);

  return {
    colliders,
    tower: { x: 30, z: 30 },
    club: { x: 90, z: 90 },
    beachZ: 120,
  };
}

// Push a circle (x, z, radius) out of every building box it overlaps.
// Returns true when a push happened.
export function collideBuildings(x, z, radius, colliders) {
  let pushed = false;
  for (const b of colliders) {
    const dx = x - b.x;
    const dz = z - b.z;
    const px = b.hx + radius - Math.abs(dx);
    const pz = b.hz + radius - Math.abs(dz);
    if (px > 0 && pz > 0) {
      pushed = true;
      if (px < pz) x = b.x + Math.sign(dx || 1) * (b.hx + radius);
      else z = b.z + Math.sign(dz || 1) * (b.hz + radius);
    }
  }
  return { x, z, pushed };
}

export function clampToWorld(x, z, half = CFG.worldHalf) {
  return {
    x: Math.max(-half, Math.min(half, x)),
    z: Math.max(-half, Math.min(half, z)),
  };
}
