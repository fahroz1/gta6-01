// Solmar traffic: ordinary cars cruising the street grid. Each one drives
// down a street lane, picks a turn at every intersection, and eases off
// when another car is right ahead of it.
import { CONFIG } from './config.js';
import { makeRng } from './random.js';
import { CarRig, makeCarMesh } from './vehicles.js';
import { streetLines } from './world.js';

const TRAFFIC_COLORS = [
  0x3f6fb5, 0xb5a23f, 0x7a4a8c, 0x4a8c5a, 0x9c4a3f,
  0x5a6a7a, 0xc2c2c2, 0x2e4a6b, 0x8c6b3f, 0x4a7a6b,
];

// A traffic car drives along one street at a time. axis 'x' means it moves
// along a street that runs east-west (constant z); axis 'z' the opposite.
function spawnTrafficCar(scene, rng, lines, lane) {
  const axis = rng.pick(['x', 'z']);
  const line = rng.pick(lines);
  const dir = rng.pick([-1, 1]);
  const half = CONFIG.cityHalf;
  const along = rng.range(-half + 12, half - 12);
  const x = axis === 'x' ? along : line + lane * dir;
  const z = axis === 'x' ? line + lane * dir : along;
  const heading = axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : dir > 0 ? 0 : Math.PI;
  const mesh = makeCarMesh(rng.pick(TRAFFIC_COLORS));
  scene.add(mesh);
  const rig = new CarRig(mesh, x, z, heading);
  rig.speed = CONFIG.trafficSpeed + rng.range(-CONFIG.trafficSpeedJitter, CONFIG.trafficSpeedJitter);
  return {
    rig,
    axis,
    line,
    dir,
    lane,
    turnCooldown: rng.range(0.5, 2),
  };
}

export class Traffic {
  constructor(scene, seed, world) {
    this.rng = makeRng(seed + 101);
    this.cars = [];
    this.lines = world.lines;
    for (let i = 0; i < CONFIG.trafficCount; i += 1) {
      const lane = this.rng.pick([-1, 1]) * 2.6;
      this.cars.push(spawnTrafficCar(scene, this.rng, this.lines, lane));
    }
    // Parked cars line a few curbs and never move.
    this.parked = [];
    const parkedColors = [0xc0c0c8, 0x5a2e2e, 0x2e4a5a, 0x6b5a2e];
    for (let i = 0; i < Math.min(6, world.parkingSpots.length); i += 1) {
      const spot = world.parkingSpots[i];
      const mesh = makeCarMesh(parkedColors[i % parkedColors.length]);
      scene.add(mesh);
      const rig = new CarRig(mesh, spot.x, spot.z, spot.heading);
      this.parked.push(rig);
    }
  }

  get allCars() {
    return [...this.cars.map((c) => c.rig), ...this.parked];
  }

  nearestLine(value) {
    let best = this.lines[0];
    let bestD = Math.abs(value - best);
    for (const line of this.lines) {
      const d = Math.abs(value - line);
      if (d < bestD) {
        bestD = d;
        best = line;
      }
    }
    return best;
  }

  // drivenRig: the CarRig Rook is currently driving (if any). Traffic
  // never steers a stolen car — Rook owns it now.
  update(dt, drivenRig) {
    const half = CONFIG.cityHalf;
    for (const car of this.cars) {
      if (drivenRig && car.rig === drivenRig) continue;
      car.turnCooldown -= dt;
      const rig = car.rig;
      const f = rig.forward();
      // Slow down if another traffic car is close ahead.
      let ahead = false;
      for (const other of this.cars) {
        if (other === car) continue;
        const dx = other.rig.x - rig.x;
        const dz = other.rig.z - rig.z;
        const along = dx * f.x + dz * f.z;
        const side = Math.abs(dx * f.z - dz * f.x);
        if (along > 0 && along < 9 && side < 3.2) {
          ahead = true;
          break;
        }
      }
      const targetSpeed = ahead
        ? CONFIG.trafficSpeed * 0.3
        : CONFIG.trafficSpeed + 1;
      rig.speed += (targetSpeed - rig.speed) * Math.min(1, dt * 2);
      rig.mesh.position.x += f.x * rig.speed * dt;
      rig.mesh.position.z += f.z * rig.speed * dt;

      // At an intersection, sometimes turn onto the crossing street.
      const alongAxis = car.axis === 'x' ? rig.x : rig.z;
      const nearest = this.nearestLine(alongAxis);
      const atJunction =
        Math.abs(alongAxis - nearest) < 2.5 && car.turnCooldown <= 0;
      if (atJunction) {
        car.turnCooldown = 3;
        if (this.rng.chance(0.45)) {
          const newDir = this.rng.pick([-1, 1]);
          car.axis = car.axis === 'x' ? 'z' : 'x';
          car.dir = newDir;
          car.line = nearest;
          rig.heading =
            car.axis === 'x'
              ? newDir > 0
                ? Math.PI / 2
                : -Math.PI / 2
              : newDir > 0
                ? 0
                : Math.PI;
          rig.mesh.rotation.y = rig.heading;
          // Nudge onto the new lane so the car sits in its street.
          if (car.axis === 'x') {
            rig.mesh.position.z = car.line + car.lane * newDir;
          } else {
            rig.mesh.position.x = car.line + car.lane * newDir;
          }
        }
      }

      // At the city edge, turn around instead of driving into the sea.
      if (Math.abs(rig.x) > half - 6 || Math.abs(rig.z) > half - 6) {
        car.dir *= -1;
        rig.heading += Math.PI;
        rig.mesh.rotation.y = rig.heading;
        rig.mesh.position.x = Math.max(-half + 8, Math.min(half - 8, rig.x));
        rig.mesh.position.z = Math.max(-half + 8, Math.min(half - 8, rig.z));
      }
    }
  }
}
