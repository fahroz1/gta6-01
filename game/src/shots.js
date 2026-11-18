// Screenshot scenes: ?shot=start|drive|chase|mission with &seed=N stages a
// fixed scene and the page paints it twice, then sets window.__shotReady.
// Each scene is the real game — the real city, the real cars, the real HUD —
// driven by a scripted autopilot for a fixed number of steps.
import { createCar } from './vehicles.js';
import { startMission } from './missions.js';
import { addWanted } from './police.js';

// Put a traffic car on a road near a point, for the drive and chase scenes.
function placeTrafficCar(G, x, z, heading, speed) {
  const car = G.traffic.find((c) => !c.stolen && !c.dead && Math.abs(c.pos.x - x) > 30);
  if (!car) return;
  car.pos.x = x;
  car.pos.z = z;
  car.heading = heading;
  car.speed = speed;
  car.route = { axis: 'x', line: z, dir: 1 };
}

export function stageShot(name, G) {
  const { world, player } = G;
  // Fresh heat for every shot.
  G.wanted.stars = 0;
  G.wanted.quietTimer = 0;
  G.wanted.bustTimer = 0;
  for (const cop of G.police) G.scene.remove(cop.mesh);
  G.police.length = 0;
  player.health = 100;
  player.cash = 2450;
  player.onFoot = true;
  if (player.car) {
    player.car = null;
  }
  player.mesh.visible = true;

  if (name === 'start') {
    player.pos.set(8, 0, 118);
    player.heading = Math.PI;
    player.mesh.rotation.y = player.heading;
    G.shotCamera = { pos: [-70, 62, 195], look: [10, 8, 30] };
    return { screen: 'title', autopilot: null, stats: 'Cash $2,450 · 0 jobs done · Solmar Bay awaits' };
  }

  if (name === 'drive') {
    const car = createCar({ x: 23, z: -60, heading: 0, color: 0xe74c3c, sports: true, scene: G.scene });
    player.car = car;
    player.onFoot = false;
    player.mesh.visible = false;
    car.speed = 26;
    // Traffic on the east-west roads the player will cross or approach:
    // east on z=-23 behind, west on z=23 ahead-right, east on z=69 far ahead.
    placeTrafficCar(G, -69, -23, Math.PI / 2, 10);
    placeTrafficCar(G, 69, 23, -Math.PI / 2, 11);
    placeTrafficCar(G, -115, 69, Math.PI / 2, 9);
    G.missions.text = 'Cruise Solmar Bay — find Mara at the Plaza';
    G.shotCamera = null; // chase camera
    // The car sits on the north-south road x=23 driving south (+z): stay on
    // that road (axis 'z', line = x) instead of steering across the city.
    return { screen: 'play', autopilot: { axis: 'z', line: 23, dir: 1 } };
  }

  if (name === 'chase') {
    // Slower than the sports car on purpose: the cruisers (faster than this
    // car) close in over the two staged seconds instead of being left behind.
    const car = createCar({ x: -23, z: 40, heading: 0, color: 0xf1c40f, sports: false, scene: G.scene });
    player.car = car;
    player.onFoot = false;
    player.mesh.visible = false;
    car.speed = 30;
    addWanted(G.wanted, 3);
    // Roadblock ahead on the same road (x=-23, south of the player), facing
    // the player head-on so the cruisers are in frame, plus one chaser behind.
    const roadblock = [
      { x: -29, z: 78, heading: Math.PI, speed: 28 },
      { x: -17, z: 78, heading: Math.PI, speed: 28 },
      { x: -23, z: 24, heading: 0, speed: 30 },
    ];
    for (const spec of roadblock) {
      const cop = createCar({
        x: spec.x,
        z: spec.z,
        heading: spec.heading,
        color: 0x1a2a44,
        police: true,
        scene: G.scene,
      });
      cop.speed = spec.speed;
      G.police.push(cop);
    }
    placeTrafficCar(G, -69, 69, Math.PI / 2, 9);
    G.missions.text = 'Lose the cops — 3 stars on you!';
    // Fixed high camera hovering over the road itself (x=-23), looking south
    // down it: the cruisers trail just behind the player, so the camera must
    // sit above the road corridor — a side camera's sightline crosses a block
    // and a tower hides the cars.
    G.shotCamera = { pos: [-23, 30, 72], look: [-23, 0, 115] };
    // Same road as the drive shot: north-south road x=-23, driving south.
    return { screen: 'play', autopilot: { axis: 'z', line: -23, dir: 1 } };
  }

  // mission
  G.missions.index = 0;
  startMission(G.missions);
  const target = G.missions.target;
  // Stand on the north-south road x=115, 26m west of the Docks target, facing
  // east so the yellow beacon rises above the docks building in frame.
  player.pos.set(target.x - 26, 0, target.z);
  player.heading = Math.atan2(target.x - player.pos.x, target.z - player.pos.z);
  player.mesh.rotation.y = player.heading;
  // Fixed high camera: the player mid-frame, the street and the beacon above
  // the docks building behind him. The chase cam sits too low and the beacon
  // hides behind the nearest tower.
  G.shotCamera = { pos: [95, 16, -28], look: [135, 6, 0] };
  return { screen: 'play', autopilot: null };
}

// Autopilot input for the drive and chase shots: stay on the road line,
// throttle on, steer gently toward the line.
export function autopilotInput(G, auto) {
  const car = G.player.car;
  if (!car) return { up: false, down: false, left: false, right: false };
  const across = auto.axis === 'x' ? car.pos.z - auto.line : car.pos.x - auto.line;
  const wantHeading = auto.axis === 'x' ? (auto.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (auto.dir > 0 ? 0 : Math.PI);
  let dh = wantHeading - car.heading;
  while (dh > Math.PI) dh -= Math.PI * 2;
  while (dh < -Math.PI) dh += Math.PI * 2;
  const steer = dh + across * 0.02;
  return {
    up: true,
    down: false,
    left: steer > 0.05,
    right: steer < -0.05,
  };
}
