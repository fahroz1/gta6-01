// Traffic and pedestrians: the city alive. Traffic cars follow the road
// lines, turn at intersections and stop for what is ahead; pedestrians walk
// the sidewalks and run when a car bears down on them.
import { TRAFFIC_COUNT, PED_COUNT } from './config.js';
import { randomRoadPoint, resolveCircle } from './world.js';
import { createCar, driveCar } from './vehicles.js';
import { pick, range } from './random.js';

export function createTraffic(scene, rng, world) {
  const cars = [];
  for (let i = 0; i < TRAFFIC_COUNT; i += 1) {
    const p = randomRoadPoint(rng, world);
    const car = createCar({
      x: p.x,
      z: p.z,
      heading: p.axis === 'x' ? (p.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (p.dir > 0 ? 0 : Math.PI),
      color: pick(rng, [0xc0392b, 0x2980b9, 0xf1c40f, 0x27ae60, 0x8e44ad, 0xe67e22, 0xecf0f1, 0x2c3e50]),
      scene,
    });
    car.route = { axis: p.axis, line: p.line, dir: p.dir };
    car.cruise = range(rng, 8, 12);
    car.wait = 0;
    cars.push(car);
  }
  return cars;
}

function carAhead(car, others, playerCar) {
  const fx = Math.sin(car.heading);
  const fz = Math.cos(car.heading);
  const check = (ox, oz) => {
    const dx = ox - car.pos.x;
    const dz = oz - car.pos.z;
    const along = dx * fx + dz * fz;
    const side = Math.abs(dx * fz - dz * fx);
    return along > 0 && along < 9 && side < 2.2;
  };
  for (const o of others) {
    if (o !== car && !o.dead && check(o.pos.x, o.pos.z)) return true;
  }
  if (playerCar && !playerCar.dead && check(playerCar.pos.x, playerCar.pos.z)) return true;
  return false;
}

export function updateTraffic(cars, dt, world, playerCar, rng) {
  for (const car of cars) {
    if (car.dead || car.stolen) continue;
    // At an intersection, sometimes turn onto the crossing road.
    const atCross = car.route.axis === 'x'
      ? world.lines.some((l) => Math.abs(car.pos.x - l) < 1.5)
      : world.lines.some((l) => Math.abs(car.pos.z - l) < 1.5);
    if (atCross && rng() < dt * 0.25) {
      if (car.route.axis === 'x') {
        car.route = { axis: 'z', line: car.pos.x, dir: rng() < 0.5 ? 1 : -1 };
      } else {
        car.route = { axis: 'x', line: car.pos.z, dir: rng() < 0.5 ? 1 : -1 };
      }
    }
    const targetHeading = car.route.axis === 'x'
      ? (car.route.dir > 0 ? Math.PI / 2 : -Math.PI / 2)
      : (car.route.dir > 0 ? 0 : Math.PI);
    let dh = targetHeading - car.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    car.heading += Math.max(-1.6 * dt, Math.min(1.6 * dt, dh));
    const blocked = carAhead(car, cars, playerCar);
    const want = blocked ? 0 : car.cruise;
    car.speed += Math.max(-14 * dt, Math.min(10 * dt, want - car.speed));
    car.pos.x += Math.sin(car.heading) * car.speed * dt;
    car.pos.z += Math.cos(car.heading) * car.speed * dt;
    car.mesh.rotation.y = car.heading;
    // Stay on the road: drift back onto the route line.
    if (car.route.axis === 'x') car.pos.z += (car.route.line - car.pos.z) * Math.min(1, dt * 1.5);
    else car.pos.x += (car.route.line - car.pos.x) * Math.min(1, dt * 1.5);
    resolveCircle(car.pos, 1.6, world);
  }
}

// Parked cars the player can steal: a few along the kerbs.
export function createParked(scene, rng, world) {
  const cars = [];
  for (let i = 0; i < 6; i += 1) {
    const p = randomRoadPoint(rng, world);
    const car = createCar({
      x: p.x + (p.axis === 'x' ? 0 : 5.5),
      z: p.z + (p.axis === 'x' ? 5.5 : 0),
      heading: p.axis === 'x' ? Math.PI / 2 : 0,
      color: pick(rng, [0xc0392b, 0x2980b9, 0xf1c40f, 0x27ae60, 0x8e44ad, 0xe67e22]),
      sports: rng() < 0.2,
      scene,
    });
    car.parked = true;
    cars.push(car);
  }
  return cars;
}

const PED_COLORS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c, 0xe67e22, 0xecf0f1];

export function createPeds(scene, rng, world) {
  const peds = [];
  for (let i = 0; i < PED_COUNT; i += 1) {
    const g = new THREE.Group();
    const shirt = new THREE.MeshLambertMaterial({ color: pick(rng, PED_COLORS) });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 1.0, 8), shirt);
    body.position.y = 1.05;
    body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshLambertMaterial({ color: 0xe8b88a }));
    head.position.y = 1.85;
    g.add(head);
    const p = randomRoadPoint(rng, world);
    g.position.set(p.x + range(rng, -5, 5), 0, p.z + range(rng, -5, 5));
    scene.add(g);
    peds.push({
      mesh: g,
      pos: g.position,
      heading: range(rng, 0, Math.PI * 2),
      speed: range(rng, 1.4, 2.4),
      state: 'walk', // walk | flee | down
      downTimer: 0,
      turnTimer: range(rng, 2, 6),
    });
  }
  return peds;
}

export function updatePeds(peds, dt, world, player, playerCar, rng) {
  for (const ped of peds) {
    if (ped.state === 'down') {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) {
        ped.state = 'walk';
        ped.mesh.rotation.x = 0;
        ped.mesh.position.y = 0;
        const p = randomRoadPoint(rng, world);
        ped.pos.x = p.x;
        ped.pos.z = p.z;
      }
      continue;
    }
    // Flee a fast car closing in.
    let threat = null;
    const cars = playerCar ? [playerCar] : [];
    for (const car of cars) {
      if (car.dead) continue;
      const d = Math.hypot(car.pos.x - ped.pos.x, car.pos.z - ped.pos.z);
      if (d < 9 && Math.abs(car.speed) > 6) threat = car;
    }
    if (threat) {
      ped.state = 'flee';
      ped.heading = Math.atan2(ped.pos.x - threat.pos.x, ped.pos.z - threat.pos.z);
    } else if (ped.state === 'flee') {
      ped.state = 'walk';
    }
    ped.turnTimer -= dt;
    if (ped.turnTimer <= 0 && ped.state === 'walk') {
      ped.heading += (rng() - 0.5) * 1.8;
      ped.turnTimer = range(rng, 2, 6);
    }
    const speed = ped.state === 'flee' ? 5 : ped.speed;
    ped.pos.x += Math.sin(ped.heading) * speed * dt;
    ped.pos.z += Math.cos(ped.heading) * speed * dt;
    ped.mesh.rotation.y = ped.heading;
    resolveCircle(ped.pos, 0.6, world);
  }
}

export function knockPed(ped) {
  ped.state = 'down';
  ped.downTimer = 6;
  ped.mesh.rotation.x = Math.PI / 2;
  ped.mesh.position.y = 0.3;
}
