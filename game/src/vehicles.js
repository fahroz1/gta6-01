// Cars and people: the meshes plus the little arcade driving model every
// drivable car in Solmar shares.
import { CONFIG } from './config.js';

const WHEEL_GEO = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
const WHEEL_MAT = new THREE.MeshLambertMaterial({ color: 0x14161a });

// A low-poly car: body, cabin, four wheels, a pair of headlights.
export function makeCarMesh(colorHex) {
  const car = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color: colorHex });
  const glass = new THREE.MeshLambertMaterial({ color: 0x1c2836 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.72, 4.4), paint);
  body.position.y = 0.62;
  car.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.62, 2.2), glass);
  cabin.position.set(0, 1.24, -0.25);
  car.add(cabin);
  const lampMat = new THREE.MeshLambertMaterial({
    color: 0xfff6c8,
    emissive: 0xccb45a,
  });
  for (const sx of [-0.7, 0.7]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.2, 0.12), lampMat);
    lamp.position.set(sx, 0.66, 2.22);
    car.add(lamp);
  }
  const wheelSpots = [
    [-1.0, 1.45],
    [1.0, 1.45],
    [-1.0, -1.45],
    [1.0, -1.45],
  ];
  for (const [wx, wz] of wheelSpots) {
    const wheel = new THREE.Mesh(WHEEL_GEO, WHEEL_MAT);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.42, wz);
    car.add(wheel);
  }
  return car;
}

// Rook on foot: a simple standing figure, coat and cap, facing +z.
export function makePersonMesh() {
  const person = new THREE.Group();
  const coat = new THREE.MeshLambertMaterial({ color: 0x7a2e2e });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a986 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x23262b });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.95, 0.4), coat);
  torso.position.y = 1.05;
  person.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), skin);
  head.position.y = 1.85;
  person.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.34, 0.14, 10), dark);
  cap.position.y = 2.06;
  person.add(cap);
  for (const sx of [-0.2, 0.2]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.62, 0.3), dark);
    leg.position.set(sx, 0.31, 0);
    person.add(leg);
  }
  return person;
}

// One drivable car: a mesh plus heading, speed and a steering angle.
// The model is deliberately arcade: accelerate, brake, reverse, steer.
export class CarRig {
  constructor(mesh, x, z, heading) {
    this.mesh = mesh;
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = heading;
    this.heading = heading;
    this.speed = 0;
    this.steer = 0;
  }

  get x() {
    return this.mesh.position.x;
  }

  get z() {
    return this.mesh.position.z;
  }

  forward() {
    return { x: Math.sin(this.heading), z: Math.cos(this.heading) };
  }

  // controls: { throttle: -1..1, steer: -1..1 } — throttle 1 is gas.
  update(dt, controls) {
    const c = CONFIG;
    if (controls.throttle > 0) {
      this.speed += c.carAccel * controls.throttle * dt;
    } else if (controls.throttle < 0) {
      if (this.speed > 0.5) {
        this.speed -= c.carBrake * dt;
      } else {
        this.speed += c.carAccel * 0.45 * controls.throttle * dt;
      }
    } else {
      this.speed -= Math.sign(this.speed) * 6 * dt;
      if (Math.abs(this.speed) < 0.2) this.speed = 0;
    }
    this.speed = Math.max(-c.carReverseMax, Math.min(c.carTopSpeed, this.speed));
    const steerTarget = controls.steer * c.carSteer;
    this.steer += (steerTarget - this.steer) * Math.min(1, dt * 8);
    const speedFactor = Math.min(1, Math.abs(this.speed) / 8);
    this.heading += this.steer * speedFactor * Math.sign(this.speed || 1) * dt * 1.4;
    const f = this.forward();
    this.mesh.position.x += f.x * this.speed * dt;
    this.mesh.position.z += f.z * this.speed * dt;
    this.mesh.rotation.y = this.heading;
  }
}
