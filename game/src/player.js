// Rook: walking the streets of Solmar Bay, stealing cars, and the chase
// camera that follows him. On foot he is a person mesh; in a car he drives
// the rig he is sitting in.
import { CONFIG } from './config.js';
import { CarRig, makePersonMesh } from './vehicles.js';

export class Player {
  constructor(scene, x, z) {
    this.mesh = makePersonMesh();
    this.mesh.position.set(x, 0, z);
    scene.add(this.mesh);
    this.heading = 0;
    this.speed = 0;
    this.driving = null; // a CarRig when Rook is behind the wheel
    this.onFoot = true;
    this.enterCooldown = 0;
  }

  get x() {
    return this.driving ? this.driving.x : this.mesh.position.x;
  }

  get z() {
    return this.driving ? this.driving.z : this.mesh.position.z;
  }

  get currentSpeed() {
    return this.driving ? Math.abs(this.driving.speed) : this.speed;
  }

  // Find the closest car Rook can steal, within enter range.
  nearestCar(cars) {
    let best = null;
    let bestDist = CONFIG.enterRange;
    for (const car of cars) {
      if (car === this.driving) continue;
      const dx = car.x - this.x;
      const dz = car.z - this.z;
      const d = Math.hypot(dx, dz);
      if (d < bestDist) {
        bestDist = d;
        best = car;
      }
    }
    return best;
  }

  enterCar(car) {
    this.driving = car;
    this.onFoot = false;
    this.mesh.visible = false;
    this.enterCooldown = 0.6;
    return car;
  }

  exitCar() {
    if (!this.driving) return;
    const f = this.driving.forward();
    this.mesh.position.set(
      this.driving.x - f.x * 3.4,
      0,
      this.driving.z - f.z * 3.4,
    );
    this.mesh.rotation.y = this.driving.heading;
    this.heading = this.driving.heading;
    this.mesh.visible = true;
    this.driving = null;
    this.onFoot = true;
    this.enterCooldown = 0.6;
  }

  // keys: a Set of currently held key codes (lowercase).
  // Returns an event string when something notable happened, else null.
  update(dt, keys, world, cars, onSteal) {
    this.enterCooldown = Math.max(0, this.enterCooldown - dt);
    if (this.driving) {
      const throttle =
        (keys.has('w') || keys.has('arrowup') ? 1 : 0) -
        (keys.has('s') || keys.has('arrowdown') ? 1 : 0);
      const steer =
        (keys.has('a') || keys.has('arrowleft') ? -1 : 0) +
        (keys.has('d') || keys.has('arrowright') ? 1 : 0);
      this.driving.update(dt, { throttle, steer });
      this.clampToCity(this.driving.mesh, world);
      this.pushOutOfBuildings(this.driving.mesh, world, true);
      if ((keys.has('e') || keys.has('enter')) && this.enterCooldown <= 0) {
        this.exitCar();
        return 'exit';
      }
      return null;
    }

    // On foot: WASD / arrows walk in camera-relative directions.
    let mx = 0;
    let mz = 0;
    if (keys.has('w') || keys.has('arrowup')) mz += 1;
    if (keys.has('s') || keys.has('arrowdown')) mz -= 1;
    if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
    if (keys.has('d') || keys.has('arrowright')) mx += 1;
    const moving = mx !== 0 || mz !== 0;
    const targetSpeed = moving ? CONFIG.walkSpeed : 0;
    this.speed += (targetSpeed - this.speed) * Math.min(1, dt * 10);
    if (moving) {
      const len = Math.hypot(mx, mz);
      const nx = mx / len;
      const nz = mz / len;
      // The camera sits behind Rook looking north, so screen-up is -z.
      // Movement in world space is (nx, -nz); face that direction.
      this.heading = Math.atan2(nx, -nz);
      this.mesh.rotation.y = this.heading;
      this.mesh.position.x += nx * this.speed * dt;
      this.mesh.position.z -= nz * this.speed * dt;
    }
    this.clampToCity(this.mesh, world);
    this.pushOutOfBuildings(this.mesh, world, false);
    if ((keys.has('e') || keys.has('enter')) && this.enterCooldown <= 0) {
      const car = this.nearestCar(cars);
      if (car) {
        this.enterCar(car);
        if (onSteal) onSteal(car);
        return 'steal';
      }
    }
    return null;
  }

  clampToCity(obj, world) {
    const b = world.bounds - 2;
    obj.position.x = Math.max(-b, Math.min(b, obj.position.x));
    obj.position.z = Math.max(-b, Math.min(b, obj.position.z));
  }

  // Push a mesh's circle (player on foot or a car) out of any building
  // footprint it overlaps. isCar picks the radius and the speed penalty.
  pushOutOfBuildings(obj, world, isCar) {
    const r = isCar ? CONFIG.carRadius : CONFIG.playerRadius;
    for (const f of world.footprints) {
      const dx = obj.position.x - f.x;
      const dz = obj.position.z - f.z;
      const ox = f.hw + r - Math.abs(dx);
      const oz = f.hd + r - Math.abs(dz);
      if (ox > 0 && oz > 0) {
        if (ox < oz) {
          obj.position.x += Math.sign(dx || 1) * ox;
        } else {
          obj.position.z += Math.sign(dz || 1) * oz;
        }
        if (isCar && this.driving) this.driving.speed *= 0.4;
      }
    }
  }
}

export { CarRig };
