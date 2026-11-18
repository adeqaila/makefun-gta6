// SOLMAR BAY — the story: three chained missions for Marisol Kane.
// One job: objectives, beacons, rewards and the mission flow.

import THREE from './three.js';
import { MISSIONS } from './config.js';
import { spawnEnemy } from './combat.js';
import { clearWanted } from './police.js';

export function createMissions(scene) {
  // a glowing beacon pillar + floating diamond marks the objective
  const beaconMat = new THREE.MeshBasicMaterial({
    color: 0xffc93a, transparent: true, opacity: 0.28, depthWrite: false,
  });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 60, 16, 1, true), beaconMat);
  beacon.position.y = 30;
  beacon.visible = false;
  scene.add(beacon);
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.1),
    new THREE.MeshBasicMaterial({ color: 0xffc93a }),
  );
  diamond.position.y = 8;
  diamond.visible = false;
  scene.add(diamond);
  return {
    current: 0,        // index into MISSIONS, 3 = story done
    stage: 0,          // 0 = go to target, 1 = (M3) rivals cleared, go to safehouse
    beacon,
    diamond,
    done: false,
    rivalsSpawned: false,
  };
}

export function missionTarget(missions) {
  if (missions.current >= MISSIONS.length) return null;
  return MISSIONS[missions.current].target;
}

export function currentObjective(missions) {
  if (missions.current >= MISSIONS.length) return 'Story complete — Solmar Bay is yours. Free roam!';
  const m = MISSIONS[missions.current];
  if (missions.current === 2 && missions.stage === 1) return 'Lose the heat — reach the Safehouse';
  return m.objective;
}

function moveBeacon(missions, x, z) {
  missions.beacon.position.x = x;
  missions.beacon.position.z = z;
  missions.beacon.visible = true;
  missions.diamond.position.x = x;
  missions.diamond.position.z = z;
  missions.diamond.visible = true;
}

export function startMission(world, index) {
  const { missions, hud, audio } = world;
  missions.current = index;
  missions.stage = 0;
  missions.rivalsSpawned = false;
  const m = MISSIONS[index];
  const t = missionTarget(missions);
  moveBeacon(missions, t.x, t.z);
  if (hud) {
    hud.banner(`${m.id} — ${m.title}`);
    hud.message(m.brief);
  }
  if (audio) audio.fanfare();
}

export function completeMission(world) {
  const { missions, player, hud, audio, save } = world;
  const m = MISSIONS[missions.current];
  player.money += m.reward;
  if (hud) {
    hud.banner(`Mission complete — +$${m.reward}`);
    hud.toast(`${m.id} ${m.title} done`);
  }
  if (audio) audio.fanfare();
  if (save) save.saveGame(world);
  missions.current += 1;
  missions.stage = 0;
  if (missions.current >= MISSIONS.length) {
    missions.done = true;
    missions.beacon.visible = false;
    missions.diamond.visible = false;
    if (hud) hud.message('All three jobs done. Marisol Kane is paid — Solmar Bay is yours.');
    return;
  }
  startMission(world, missions.current);
}

export function updateMissions(world, dt) {
  const { missions, player, combat, scene, rng, police } = world;
  if (missions.done) return;
  missions.diamond.rotation.y += dt * 2;
  missions.diamond.position.y = 8 + Math.sin(world.time * 2) * 0.6;
  const px = player.inCar ? player.inCar.x : player.x;
  const pz = player.inCar ? player.inCar.z : player.z;
  const target = missionTarget(missions);
  if (!target) return;

  // M3: rivals guard the club; spawn them once Rico gets close
  if (missions.current === 2 && missions.stage === 0 && !missions.rivalsSpawned) {
    const d = Math.hypot(px - target.x, pz - target.z);
    if (d < 40) {
      missions.rivalsSpawned = true;
      spawnEnemy(combat, scene, rng, target.x + 8, target.z + 6);
      spawnEnemy(combat, scene, rng, target.x - 8, target.z - 4);
      if (world.hud) world.hud.message('Rivals! Deal with them — then get to the Safehouse.');
      if (world.audio) world.audio.alarm();
    }
  }
  // M3 stage 0 completes when the rivals are gone
  if (missions.current === 2 && missions.stage === 0 && missions.rivalsSpawned && combat.enemies.length === 0) {
    missions.stage = 1;
    const safe = MISSIONS[2].target;
    moveBeacon(missions, safe.x, safe.z);
    if (world.hud) world.hud.message('Rivals cleared — lose the heat at the Safehouse.');
  }
  // reaching the beacon completes the current leg
  const d = Math.hypot(px - target.x, pz - target.z);
  const needClear = missions.current === 2 && missions.stage === 0;
  if (d < 5 && !needClear) {
    if (missions.current === 2 && missions.stage === 1) {
      clearWanted(police, world);
      completeMission(world);
    } else if (missions.current !== 2) {
      completeMission(world);
    }
  }
}
