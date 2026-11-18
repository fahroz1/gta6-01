// Missions: Rook's story in Solmar Bay. Three jobs from the fixer Mara,
// each a drive-to-the-beacon chain with a cash reward. The beacon, the HUD
// arrow and the minimap blip all point at the same target.
import { MISSIONS } from './config.js';

export function createMissions(scene, world) {
  const beaconMat = new THREE.MeshBasicMaterial({
    color: 0xffd21a,
    transparent: true,
    opacity: 0.55,
  });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 30, 12, 1, true), beaconMat);
  beacon.position.y = 15;
  beacon.visible = false;
  scene.add(beacon);
  const marker = new THREE.Mesh(
    new THREE.ConeGeometry(1.1, 2.2, 4),
    new THREE.MeshBasicMaterial({ color: 0xffd21a }),
  );
  marker.rotation.x = Math.PI;
  marker.position.y = 6;
  marker.visible = false;
  scene.add(marker);

  const jobs = [
    {
      name: MISSIONS[0].name,
      brief: 'Mara: pick up the package at the Docks, deliver it to the Marina Hotel. No questions.',
      stages: [
        { text: 'Pick up the package at the Docks', at: world.locations.docks },
        { text: 'Deliver the package to the Marina Hotel', at: world.locations.hotel },
      ],
      reward: MISSIONS[0].reward,
    },
    {
      name: MISSIONS[1].name,
      brief: 'Mara: a red sports car is parked by the Plaza. Take it to the Garage. The cops will notice.',
      stages: [
        { text: 'Steal the red sports car at the Plaza', at: world.locations.plaza, steal: true },
        { text: 'Deliver the sports car to the Garage', at: world.locations.garage },
      ],
      reward: MISSIONS[1].reward,
    },
    {
      name: MISSIONS[2].name,
      brief: 'Mara: the big one. Three packages: Docks, Beach, Garage. Grab them all, then get to the Hotel.',
      stages: [
        { text: 'Collect package 1 of 3 at the Docks', at: world.locations.docks },
        { text: 'Collect package 2 of 3 at the Beach', at: world.locations.beach },
        { text: 'Collect package 3 of 3 at the Garage', at: world.locations.garage },
        { text: 'Deliver everything to the Marina Hotel', at: world.locations.hotel },
      ],
      reward: MISSIONS[2].reward,
    },
  ];

  return {
    jobs,
    index: 0, // current job
    stage: 0,
    active: false,
    done: 0, // jobs completed
    beacon,
    marker,
    target: null,
    text: 'No job yet — walk to the Plaza to meet Mara.',
    storyDone: false,
  };
}

export function startMission(missions) {
  if (missions.index >= missions.jobs.length) return;
  missions.active = true;
  missions.stage = 0;
  const job = missions.jobs[missions.index];
  missions.target = job.stages[0].at;
  missions.text = `${job.name}: ${job.stages[0].text}`;
  missions.beacon.visible = true;
  missions.marker.visible = true;
  missions.beacon.position.set(missions.target.x, 15, missions.target.z);
  missions.marker.position.set(missions.target.x, 6, missions.target.z);
}

export function missionTarget(missions) {
  return missions.active ? missions.target : null;
}

// Advance when the player reaches the target. Returns the cash earned (0
// while a job is still running) and the message to show.
export function updateMissions(missions, playerPos, inCar) {
  if (!missions.active || missions.storyDone) return { earned: 0, message: '' };
  const job = missions.jobs[missions.index];
  const target = job.stages[missions.stage].at;
  const d = Math.hypot(playerPos.x - target.x, playerPos.z - target.z);
  if (d > 4) return { earned: 0, message: '' };
  const stageDef = job.stages[missions.stage];
  if (stageDef.steal && inCar === false) return { earned: 0, message: '' };
  missions.stage += 1;
  if (missions.stage < job.stages.length) {
    missions.target = job.stages[missions.stage].at;
    missions.text = `${job.name}: ${job.stages[missions.stage].text}`;
    missions.beacon.position.set(missions.target.x, 15, missions.target.z);
    missions.marker.position.set(missions.target.x, 6, missions.target.z);
    return { earned: 0, message: 'Checkpoint reached.' };
  }
  // Job complete.
  const earned = job.reward;
  missions.done += 1;
  missions.active = false;
  missions.beacon.visible = false;
  missions.marker.visible = false;
  missions.index += 1;
  if (missions.index >= missions.jobs.length) {
    missions.storyDone = true;
    missions.text = 'Story complete — Solmar Bay is yours, Rook.';
    return { earned: earned + 500, message: `Job done! +$${earned}. Story complete: +$500 bonus.` };
  }
  missions.text = `Job done! +$${earned}. Next job: ${missions.jobs[missions.index].name} — walk to the Plaza.`;
  return { earned, message: `Job done! +$${earned}.` };
}

// The beacon pulses so it reads in screenshots.
export function animateBeacon(missions, time) {
  if (!missions.beacon.visible) return;
  missions.beacon.material.opacity = 0.4 + Math.sin(time * 3) * 0.18;
  missions.marker.position.y = 6 + Math.sin(time * 3) * 0.7;
  missions.marker.rotation.y += 0.02;
}

export function distanceToTarget(missions, playerPos) {
  if (!missions.active || !missions.target) return null;
  return Math.round(Math.hypot(playerPos.x - missions.target.x, playerPos.z - missions.target.z));
}
