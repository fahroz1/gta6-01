// The Solmar police: a wanted level from 0 to 5 stars, patrol cars that
// spawn when the heat is on and chase Rook, and a slow cooldown when he
// slips out of sight.
import { CONFIG } from './config.js';
import { makeRng } from './random.js';
import { CarRig, makeCarMesh } from './vehicles.js';

const POLICE_COLORS = [0x1a1d22, 0x1a1d22, 0x232a33];

function policeMesh() {
  const car = makeCarMesh(POLICE_COLORS[0]);
  // A white roof band and a red-blue light bar on top.
  const band = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 0.16, 2.2),
    new THREE.MeshLambertMaterial({ color: 0xe8e8e8 }),
  );
  band.position.set(0, 1.0, -0.25);
  car.add(band);
  const bar = new THREE.Group();
  const red = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.18, 0.3),
    new THREE.MeshLambertMaterial({ color: 0xd21f1f, emissive: 0x881111 }),
  );
  red.position.x = -0.35;
  const blue = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.18, 0.3),
    new THREE.MeshLambertMaterial({ color: 0x1f4fd2, emissive: 0x111188 }),
  );
  blue.position.x = 0.35;
  bar.add(red);
  bar.add(blue);
  bar.position.set(0, 1.66, -0.25);
  car.add(bar);
  return car;
}

export class Police {
  constructor(scene, seed) {
    this.scene = scene;
    this.rng = makeRng(seed + 707);
    this.wanted = 0;
    this.cars = [];
    this.bumpCooldown = 0;
    this.sirenOn = false;
  }

  addWanted(n) {
    this.wanted = Math.max(0, Math.min(CONFIG.wantedMax, this.wanted + n));
  }

  setWanted(n) {
    this.wanted = Math.max(0, Math.min(CONFIG.wantedMax, n));
  }

  // How many patrol cars the current heat calls for.
  desiredCount() {
    return this.wanted === 0 ? 0 : Math.min(3, this.wanted);
  }

  spawnNear(x, z) {
    const angle = this.rng.range(0, Math.PI * 2);
    const dist = this.rng.range(26, 40);
    const px = x + Math.cos(angle) * dist;
    const pz = z + Math.sin(angle) * dist;
    const mesh = policeMesh();
    this.scene.add(mesh);
    const heading = Math.atan2(x - px, z - pz);
    const rig = new CarRig(mesh, px, pz, heading);
    rig.speed = CONFIG.policeTopSpeed * 0.7;
    this.cars.push(rig);
  }

  removeCar(rig) {
    this.scene.remove(rig.mesh);
    this.cars = this.cars.filter((c) => c !== rig);
  }

  // Chase the player. Returns 'busted' when a patrol car makes hard
  // contact while the heat is on (the run gets harder, not ended).
  update(dt, player, world) {
    this.bumpCooldown = Math.max(0, this.bumpCooldown - dt);
    while (this.cars.length < this.desiredCount()) {
      this.spawnNear(player.x, player.z);
    }
    while (this.cars.length > this.desiredCount()) {
      this.removeCar(this.cars[this.cars.length - 1]);
    }
    this.sirenOn = this.cars.length > 0;

    let nearestDist = Infinity;
    for (const rig of this.cars) {
      // Steer toward the player, with a little wobble so the chase reads
      // as driving, not homing.
      const dx = player.x - rig.x;
      const dz = player.z - rig.z;
      const dist = Math.hypot(dx, dz);
      nearestDist = Math.min(nearestDist, dist);
      const targetHeading = Math.atan2(dx, dz);
      let diff = targetHeading - rig.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      rig.heading += Math.max(-1.6 * dt, Math.min(1.6 * dt, diff));
      rig.speed += (CONFIG.policeTopSpeed - rig.speed) * Math.min(1, dt * 0.7);
      const f = rig.forward();
      rig.mesh.position.x += f.x * rig.speed * dt;
      rig.mesh.position.z += f.z * rig.speed * dt;
      rig.mesh.rotation.y = rig.heading;
      const b = world.bounds - 2;
      rig.mesh.position.x = Math.max(-b, Math.min(b, rig.mesh.position.x));
      rig.mesh.position.z = Math.max(-b, Math.min(b, rig.mesh.position.z));

      if (dist < CONFIG.policeCatchRadius && this.bumpCooldown <= 0) {
        this.bumpCooldown = 2.5;
        this.addWanted(1);
        // Shove the player's car a little so the hit is felt.
        if (player.driving) {
          player.driving.speed *= 0.55;
        }
        return 'busted';
      }
    }

    // No patrol car close by: the heat slowly bleeds off.
    if (this.wanted > 0 && nearestDist > CONFIG.wantedDecayClearRange) {
      this.wanted = Math.max(0, this.wanted - CONFIG.wantedDecayPerSec * dt);
    }
    return null;
  }

  get stars() {
    return Math.ceil(this.wanted);
  }
}
