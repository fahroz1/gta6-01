// Cars: the factory that builds every vehicle mesh and the arcade physics
// every driven car shares — player, traffic and police all drive the same way.
import { CAR, PALETTE } from './config.js';
import { pick } from './random.js';

export function makeCarMesh(color, isPolice = false) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2733 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.75, 4.4), bodyMat);
  body.position.y = 0.65;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.65, 2.2), glassMat);
  cabin.position.set(0, 1.3, -0.2);
  cabin.castShadow = true;
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x151515 });
  for (const [x, z] of [[-1, 1.5], [1, 1.5], [-1, -1.5], [1, -1.5]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.42, z);
    group.add(w);
  }
  if (isPolice) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    bar.position.set(0, 1.75, -0.2);
    bar.name = 'lightbar';
    group.add(bar);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.3, 4.42), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    stripe.position.y = 0.65;
    group.add(stripe);
  }
  // Headlights so a car reads at dusk and in the minimap's dark.
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8 });
  for (const x of [-0.7, 0.7]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), lampMat);
    lamp.position.set(x, 0.7, 2.22);
    group.add(lamp);
  }
  return group;
}

export function createCar({ x = 0, z = 0, heading = 0, color = 0xc0392b, sports = false, police = false, scene }) {
  const mesh = makeCarMesh(color, police);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  if (scene) scene.add(mesh);
  return {
    mesh,
    pos: mesh.position,
    heading,
    speed: 0,
    hp: CAR.hp,
    maxSpeed: sports ? CAR.sportsMax : CAR.maxSpeed,
    sports,
    police,
    color,
    dead: false,
    steer: 0,
  };
}

// Arcade drive: throttle, brake/reverse, steering that bites harder at speed.
// input: {up, down, left, right} booleans. Returns nothing; edits car.
export function driveCar(car, input, dt) {
  if (car.dead) return;
  if (input.up) car.speed += CAR.accel * dt;
  else if (input.down) {
    car.speed -= (car.speed > 0.5 ? CAR.brake : CAR.accel * 0.7) * dt;
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
  }
  car.speed = Math.max(-CAR.reverseMax, Math.min(car.maxSpeed, car.speed));
  const steerInput = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  const grip = Math.min(1, Math.abs(car.speed) / 8);
  car.heading += steerInput * CAR.steer * grip * dt * Math.sign(car.speed || 1);
  car.pos.x += Math.sin(car.heading) * car.speed * dt;
  car.pos.z += Math.cos(car.heading) * car.speed * dt;
  car.mesh.rotation.y = car.heading;
}

// A parked car waiting to be stolen, or a traffic car's ride.
export function randomCar(rng, x, z, heading, scene, sportsChance = 0.15) {
  const sports = rng() < sportsChance;
  const color = sports ? pick(rng, [0xe74c3c, 0xf1c40f, 0xecf0f1]) : pick(rng, PALETTE.car);
  return createCar({ x, z, heading, color, sports, scene });
}
