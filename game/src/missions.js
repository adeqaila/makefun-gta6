// The story of Solmar Bay: Rico Vale owes Marisol Kane, and three chained
// jobs pay the debt off. Missions own the objective text, the 3D beacon
// over the current target, and the payout + save when a job lands.

import { saveGame } from './save.js';

const REWARDS = [400, 600, 1000];
const TITLES = ['The Debt', 'Hot Wheels', 'Bayfront Heat'];
const BRIEFINGS = [
  'Marisol Kane owns your debt. Pick up her package at the docks and deliver it to her club.',
  'Marisol wants the Solmar GT. Steal the sports car and bring it to the garage.',
  'The Bayfront job went loud. Lose the heat and reach the safehouse.',
];
const OBJECTIVES = [
  ['Pick up the package at the docks', 'Deliver to Marisol\'s club'],
  ['Steal the Solmar GT sports car', 'Bring the Solmar GT to the garage'],
  ['The heat is on — survive!', 'Lose the heat — reach the safehouse'],
];
const STAGE_COUNT = [2, 2, 2];
const PICKUP_RADIUS = 6;
const SAFEHOUSE_RADIUS = 8;
/** Seconds the "heat is on" stage lasts before the run-to-safety stage. */
const HEAT_STAGE_SECONDS = 2.5;

export function createMissions(G) {
  const missions = {
    current: 0,
    stage: 0,
    update,
    objectiveText,
    markerPos,
    startMission,
    reset,
    isComplete,
  };

  let stageTimer = 0;
  let heatSetupDone = false;
  let finished = false;
  let clock = 0;
  let beacon = null;
  let beaconDiamond = null;

  buildBeacon();

  /** A tall see-through yellow column plus a floating spinning diamond. */
  function buildBeacon() {
    try {
      const THREE = globalThis.THREE;
      if (!THREE || !G.scene) return;
      beacon = new THREE.Group();
      const columnGeo = new THREE.CylinderGeometry(2.4, 2.4, 34, 20, 1, true);
      const columnMat = new THREE.MeshBasicMaterial({
        color: 0xffd23f,
        transparent: true,
        opacity: 0.16,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const column = new THREE.Mesh(columnGeo, columnMat);
      column.position.y = 17;
      beacon.add(column);
      const diamondGeo = new THREE.OctahedronGeometry(1.3);
      const diamondMat = new THREE.MeshBasicMaterial({ color: 0xffd23f });
      beaconDiamond = new THREE.Mesh(diamondGeo, diamondMat);
      beaconDiamond.position.y = 7;
      beacon.add(beaconDiamond);
      beacon.visible = false;
      G.scene.add(beacon);
    } catch {
      beacon = null;
      beaconDiamond = null;
    }
  }

  /** Plain {x, z} for a target that may be a Vector3 or a plain point. */
  function pointOf(target) {
    if (!target) return null;
    if (typeof target.x === 'number' && typeof target.z === 'number') return { x: target.x, z: target.z };
    if (target.position && typeof target.position.x === 'number') return { x: target.position.x, z: target.position.z };
    return null;
  }

  /** The sports car Marisol wants, wherever it has been driven to. */
  function sportCar() {
    const lists = [G.vehicles?.drivable, G.vehicles?.cars, G.traffic?.cars];
    for (const list of lists) {
      if (!Array.isArray(list)) continue;
      for (const car of list) {
        if (car && car.isMissionSport) return car;
      }
    }
    return null;
  }

  function playerPoint() {
    return G.player?.pos ? { x: G.player.pos.x, z: G.player.pos.z } : null;
  }

  function distanceTo(point) {
    const p = playerPoint();
    if (!p || !point) return Infinity;
    const dx = p.x - point.x;
    const dz = p.z - point.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  /** The target of the active stage, as {x, z}, or null when there is none. */
  function targetPoint() {
    if (finished || missions.current >= 3) return null;
    if (missions.current === 0) {
      return missions.stage === 0 ? pointOf(G.city?.packagePickup) : pointOf(G.city?.club);
    }
    if (missions.current === 1) {
      if (missions.stage === 0) {
        const car = sportCar();
        return car?.group?.position ? pointOf(car.group.position) : null;
      }
      return pointOf(G.city?.garage);
    }
    // Mission 3: stage 0 has no place to go yet; stage 1 runs for the safehouse.
    if (missions.stage === 0) return null;
    return pointOf(G.city?.safehouse);
  }

  function objectiveText() {
    if (finished || missions.current >= 3) return 'Story complete — Solmar Bay is yours';
    const i = missions.current;
    return `M${i + 1} — ${TITLES[i]}: ${OBJECTIVES[i][missions.stage]}`;
  }

  function markerPos() {
    const target = targetPoint();
    if (!target) return null;
    try {
      const THREE = globalThis.THREE;
      if (THREE?.Vector3) return new THREE.Vector3(target.x, 0, target.z);
    } catch {
      // Fall through to the plain point below.
    }
    return { x: target.x, y: 0, z: target.z };
  }

  /** Stage 0 of the last job: wanted level 3 and two gunmen on Rico. */
  function runHeatSetup() {
    if (heatSetupDone) return;
    heatSetupDone = true;
    try {
      G.police?.addWanted?.(3, G);
    } catch {
      // Police may not be ready yet; the wanted level is set again on retry.
      heatSetupDone = false;
    }
    const p = playerPoint();
    if (p) {
      for (const [dx, dz] of [[10, 6], [-8, 10]]) {
        try {
          G.combat?.spawnEnemy?.({ x: p.x + dx, y: 0, z: p.z + dz }, G);
        } catch {
          // One missing gunman must not stop the mission.
        }
      }
    }
  }

  function startMission(i) {
    if (i >= 3) {
      finished = true;
      missions.current = 3;
      missions.stage = 0;
      G.banner = 'STORY COMPLETE — Solmar Bay is yours';
      G.bannerTimer = 6;
      if (beacon) beacon.visible = false;
      return;
    }
    missions.current = i;
    missions.stage = 0;
    stageTimer = 0;
    heatSetupDone = false;
    finished = false;
    G.banner = `MISSION ${i + 1} — ${TITLES[i]}`;
    G.bannerTimer = 4;
    G.message = BRIEFINGS[i];
    G.messageTimer = 5;
    if (i === 2) runHeatSetup();
  }

  function advanceStage() {
    missions.stage += 1;
    stageTimer = 0;
    if (missions.stage >= STAGE_COUNT[missions.current]) {
      completeMission();
      return;
    }
    if (missions.current === 2 && missions.stage === 1) {
      G.message = 'Lose the heat — reach the safehouse';
      G.messageTimer = 4;
    }
    if (missions.current === 1 && missions.stage === 1) {
      G.message = 'Solmar GT secured — take it to the garage';
      G.messageTimer = 4;
    }
    if (missions.current === 0 && missions.stage === 1) {
      G.message = 'Package secured — deliver it to the club';
      G.messageTimer = 4;
    }
  }

  function completeMission() {
    const reward = REWARDS[missions.current];
    if (G.player) G.player.money = (G.player.money || 0) + reward;
    G.banner = `MISSION COMPLETE — $${reward}`;
    G.bannerTimer = 4;
    try {
      G.audio?.missionDone?.();
    } catch {
      // Sound is optional.
    }
    // Advance first, then save: the save must describe the NEXT job, not
    // the one just finished (its stage count would reload as "undefined").
    const next = missions.current + 1;
    startMission(next);
    try {
      saveGame(G);
    } catch {
      // A failed save must not block the next mission.
    }
  }

  function update(dt, game) {
    clock += dt;
    if (finished) {
      if (beacon) beacon.visible = false;
      return;
    }
    stageTimer += dt;

    // Keep the beacon glued to the live target (the sports car moves).
    const target = targetPoint();
    if (beacon) {
      if (target) {
        beacon.visible = true;
        beacon.position.set(target.x, 0, target.z);
        if (beaconDiamond) {
          beaconDiamond.position.y = 7 + Math.sin(clock * 2) * 0.7;
          beaconDiamond.rotation.y += dt * 1.6;
        }
      } else {
        beacon.visible = false;
      }
    }

    if (missions.current === 2 && missions.stage === 0) {
      if (stageTimer >= HEAT_STAGE_SECONDS) advanceStage();
      return;
    }
    if (missions.current === 1 && missions.stage === 0) {
      const car = sportCar();
      if (car && G.player?.inCar === car) {
        advanceStage();
      }
      return;
    }
    const radius = missions.current === 2 && missions.stage === 1 ? SAFEHOUSE_RADIUS : PICKUP_RADIUS;
    if (distanceTo(target) < radius) advanceStage();
  }

  function reset() {
    missions.current = 0;
    missions.stage = 0;
    stageTimer = 0;
    heatSetupDone = false;
    finished = false;
    if (beacon) beacon.visible = false;
  }

  function isComplete() {
    return finished;
  }

  return missions;
}
