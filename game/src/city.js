// SOLMAR BAY — the city: ground, roads, buildings, beach, tower, palms.
// One job: build every static piece of Solmar Bay and answer "where is road?".

import THREE from './three.js';
import { CITY, PALETTE } from './config.js';
import { range, intRange, pick } from './random.js';

export const ROAD_LINES = [];
for (let v = -240; v <= 240; v += CITY.roadGap) ROAD_LINES.push(v);

export function nearestRoadCoord(v) {
  let best = ROAD_LINES[0];
  for (const line of ROAD_LINES) if (Math.abs(line - v) < Math.abs(best - v)) best = line;
  return best;
}

export function roadPointNear(x, z) {
  const nx = nearestRoadCoord(x);
  const nz = nearestRoadCoord(z);
  if (Math.abs(x - nx) < Math.abs(z - nz)) return { x: nx, z };
  return { x, z: nz };
}

export function isOnRoad(x, z) {
  const dx = Math.abs(x - nearestRoadCoord(x));
  const dz = Math.abs(z - nearestRoadCoord(z));
  return dx < CITY.roadWidth / 2 + 0.5 || dz < CITY.roadWidth / 2 + 0.5;
}

function groundTexture(rng) {
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d');
  const toPx = (v) => ((v + CITY.half + 24) / (2 * (CITY.half + 24))) * S;
  // base: dry grass / dirt
  g.fillStyle = '#a8a582';
  g.fillRect(0, 0, S, S);
  // blocks: warm concrete with speckle
  for (let bx = -240; bx < 240; bx += CITY.roadGap) {
    for (let bz = -240; bz < 240; bz += CITY.roadGap) {
      g.fillStyle = pick(rng, ['#b3ac93', '#aca58c', '#b8b198']);
      g.fillRect(toPx(bx + 6), toPx(bz + 6), toPx(bx + 54) - toPx(bx + 6), toPx(bz + 54) - toPx(bz + 6));
    }
  }
  // sidewalks: pale border around each block
  g.fillStyle = '#c9c2ae';
  for (let bx = -240; bx < 240; bx += CITY.roadGap) {
    for (let bz = -240; bz < 240; bz += CITY.roadGap) {
      g.fillRect(toPx(bx + 6), toPx(bz + 6), toPx(bx + 54) - toPx(bx + 6), 3);
      g.fillRect(toPx(bx + 6), toPx(bz + 51), toPx(bx + 54) - toPx(bx + 6), 3);
      g.fillRect(toPx(bx + 6), toPx(bz + 6), 3, toPx(bz + 54) - toPx(bz + 6));
      g.fillRect(toPx(bx + 51), toPx(bz + 6), 3, toPx(bz + 54) - toPx(bz + 6));
    }
  }
  // roads: dark asphalt with centre dashes
  g.fillStyle = '#33363c';
  for (const line of ROAD_LINES) {
    g.fillRect(0, toPx(line - CITY.roadWidth / 2), S, toPx(line + CITY.roadWidth / 2) - toPx(line - CITY.roadWidth / 2));
    g.fillRect(toPx(line - CITY.roadWidth / 2), 0, toPx(line + CITY.roadWidth / 2) - toPx(line - CITY.roadWidth / 2), S);
  }
  g.fillStyle = '#d8d2b8';
  for (const line of ROAD_LINES) {
    for (let v = -288; v < 288; v += 16) {
      g.fillRect(toPx(v), toPx(line) - 1, 8, 2);
      g.fillRect(toPx(line) - 1, toPx(v), 2, 8);
    }
  }
  // beach + ocean on the east edge
  g.fillStyle = '#e8cf9a';
  g.fillRect(toPx(CITY.beachX), 0, toPx(CITY.oceanX) - toPx(CITY.beachX), S);
  const ocean = g.createLinearGradient(toPx(CITY.oceanX), 0, S, 0);
  ocean.addColorStop(0, '#3d93ad');
  ocean.addColorStop(1, '#1f5f7d');
  g.fillStyle = ocean;
  g.fillRect(toPx(CITY.oceanX), 0, S - toPx(CITY.oceanX), S);
  g.fillStyle = 'rgba(255,255,255,0.5)';
  for (let i = 0; i < 40; i++) {
    const y = rng() * S;
    g.fillRect(toPx(CITY.oceanX) + rng() * 6, y, 10 + rng() * 22, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

function windowsTexture(rng, base) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 64, 128);
  for (let y = 8; y < 120; y += 14) {
    for (let x = 6; x < 58; x += 12) {
      const lit = rng() < 0.45;
      g.fillStyle = lit ? '#ffe9a8' : '#2c3542';
      g.fillRect(x, y, 7, 9);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

export function buildCity(scene, rng) {
  const buildings = []; // {minX,maxX,minZ,maxZ,height} for collision + minimap
  const group = new THREE.Group();
  group.name = 'city';

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(2 * (CITY.half + 24), 2 * (CITY.half + 24)),
    new THREE.MeshLambertMaterial({ map: groundTexture(rng) }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // buildings: one or two per block, kept off the roads.
  // Window textures are shared per palette colour (one canvas each).
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const facadeMats = new Map();
  const facadeMat = (colorHex) => {
    if (!facadeMats.has(colorHex)) {
      facadeMats.set(colorHex, new THREE.MeshLambertMaterial({ map: windowsTexture(rng, colorHex) }));
    }
    return facadeMats.get(colorHex);
  };
  for (let bx = -240; bx < 240; bx += CITY.roadGap) {
    for (let bz = -240; bz < 240; bz += CITY.roadGap) {
      if (bx === 0 && bz === 0) continue; // plaza around the tower
      const count = rng() < 0.55 ? 2 : 1;
      for (let k = 0; k < count; k++) {
        const w = count === 1 ? range(rng, 30, 40) : range(rng, 16, 22);
        const d = count === 1 ? range(rng, 30, 40) : range(rng, 16, 22);
        const cx = bx + 30 + (count === 1 ? 0 : (k === 0 ? -11 : 11)) + range(rng, -2, 2);
        const cz = bz + 30 + (count === 1 ? 0 : (k === 0 ? -11 : 11)) + range(rng, -2, 2);
        if (cx + w / 2 > CITY.beachX - 4) continue;
        const h = range(rng, 10, 42) * (Math.abs(bx) < 90 && Math.abs(bz) < 90 ? 1.5 : 1);
        const color = '#' + new THREE.Color(pick(rng, PALETTE.building)).getHexString();
        const b = new THREE.Mesh(boxGeo, facadeMat(color));
        b.scale.set(w, h, d);
        b.position.set(cx, h / 2, cz);
        b.castShadow = true;
        b.receiveShadow = true;
        group.add(b);
        // rooftop box
        const roof = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x6b6257 }));
        roof.scale.set(w * 0.25, 2, d * 0.25);
        roof.position.set(cx + w * 0.2, h + 1, cz - d * 0.2);
        group.add(roof);
        buildings.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, height: h });
      }
    }
  }

  // Solmar Tower: the landmark, glass + gold crown
  const towerMat = new THREE.MeshLambertMaterial({ color: 0x9fc4d8, emissive: 0x1a2f42 });
  const tower = new THREE.Mesh(boxGeo, towerMat);
  tower.scale.set(26, CITY.tower.height, 26);
  tower.position.set(CITY.tower.x, CITY.tower.height / 2, CITY.tower.z);
  tower.castShadow = true;
  group.add(tower);
  const crown = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xffc93a, emissive: 0x7a5a00 }));
  crown.scale.set(28, 4, 28);
  crown.position.set(CITY.tower.x, CITY.tower.height + 2, CITY.tower.z);
  group.add(crown);
  buildings.push({
    minX: CITY.tower.x - 13, maxX: CITY.tower.x + 13,
    minZ: CITY.tower.z - 13, maxZ: CITY.tower.z + 13, height: CITY.tower.height,
  });

  // palm trees along the beach and the main avenue
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f8f4f });
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.5, 9, 6);
  const leafGeo = new THREE.ConeGeometry(3.2, 4.5, 6);
  for (let z = -270; z <= 270; z += 30) {
    const x = CITY.beachX - 6 + range(rng, -2, 2);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, 4.5, z);
    trunk.castShadow = true;
    group.add(trunk);
    const leaves = new THREE.Mesh(leafGeo, leafMat);
    leaves.position.set(x, 10.5, z);
    group.add(leaves);
  }
  for (let x = -240; x <= 240; x += 60) {
    const z = 66 + range(rng, -1, 1);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, 4.5, z);
    group.add(trunk);
    const leaves = new THREE.Mesh(leafGeo, leafMat);
    leaves.position.set(x, 10.5, z);
    group.add(leaves);
  }

  // street lamps at intersections
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2a2d33 });
  const lampMat = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xaa8833 });
  const poleGeo = new THREE.CylinderGeometry(0.15, 0.15, 7, 6);
  const lampGeo = new THREE.SphereGeometry(0.5, 8, 6);
  for (const lx of ROAD_LINES) {
    for (const lz of ROAD_LINES) {
      if ((lx + lz) % 120 !== 0) continue;
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(lx + 7, 3.5, lz + 7);
      group.add(pole);
      const lamp = new THREE.Mesh(lampGeo, lampMat);
      lamp.position.set(lx + 7, 7.2, lz + 7);
      group.add(lamp);
    }
  }

  scene.add(group);
  return { buildings, group };
}

// Push a circle (x,z,r) out of every building AABB it overlaps.
export function collideBuildings(buildings, x, z, r) {
  let px = x;
  let pz = z;
  for (const b of buildings) {
    const cx = Math.max(b.minX, Math.min(px, b.maxX));
    const cz = Math.max(b.minZ, Math.min(pz, b.maxZ));
    const dx = px - cx;
    const dz = pz - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        px = cx + (dx / d) * r;
        pz = cz + (dz / d) * r;
      } else if (px < (b.minX + b.maxX) / 2) {
        px = b.minX - r;
      } else {
        px = b.maxX + r;
      }
    }
  }
  return { x: px, z: pz };
}
