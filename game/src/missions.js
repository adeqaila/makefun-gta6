// Solmar Bay — the three jobs that pay Rico's debt.
// A glowing beacon marks the current target; stepping into it pays the
// reward, advances the story, and saves the game.

import { THREE } from './three.js';
import { MISSIONS, CFG } from './config.js';

export function createMissions(scene) {
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xffc860, transparent: true, opacity: 0.35, depthWrite: false,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 60, 16, 1, true), beamMat);
  beam.position.y = 30;
  scene.add(beam);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffc860, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 3.2, 32), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.25;
  scene.add(ring);
  const missions = {
    current: 0,
    beam,
    ring,
    spin: 0,
    done: false,
  };

  function setBeacon(index) {
    const m = MISSIONS[index];
    if (!m) {
      beam.visible = false;
      ring.visible = false;
      return;
    }
    beam.visible = true;
    ring.visible = true;
    beam.position.x = m.target.x;
    beam.position.z = m.target.z;
    ring.position.x = m.target.x;
    ring.position.z = m.target.z;
  }

  function update(dt, player) {
    missions.spin += dt;
    ring.rotation.z = missions.spin * 1.5;
    ring.scale.setScalar(1 + Math.sin(missions.spin * 3) * 0.12);
    if (missions.done || missions.current >= MISSIONS.length) return null;
    const m = MISSIONS[missions.current];
    const d = Math.hypot(player.x - m.target.x, player.z - m.target.z);
    if (d < CFG.beaconRadius) {
      const finished = m;
      missions.current += 1;
      if (missions.current >= MISSIONS.length) missions.done = true;
      setBeacon(missions.current);
      return finished;
    }
    return null;
  }

  function reset() {
    missions.current = 0;
    missions.done = false;
    setBeacon(0);
  }

  setBeacon(0);
  return { missions, setBeacon, update, reset };
}
