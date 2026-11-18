// Mara's jobs: a three-job story chain for Rook. A glowing beacon marks
// the current objective in the world, and each completed job brings Mara's
// next message over the phone feed.
import { CONFIG, JOBS } from './config.js';
import { CarRig, makeCarMesh } from './vehicles.js';

function beaconMesh() {
  const group = new THREE.Group();
  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(2.6, 3.2, 26, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x37e08a,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  column.position.y = 13;
  group.add(column);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.4, 3.4, 24),
    new THREE.MeshBasicMaterial({
      color: 0x37e08a,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  group.add(ring);
  const light = new THREE.PointLight(0x37e08a, 1.4, 40);
  light.position.y = 4;
  group.add(light);
  group.userData.ring = ring;
  return group;
}

export class Missions {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.jobIndex = 0;
    this.phase = 'go'; // 'go' = reach the target, 'done' = chain finished
    this.beacon = beaconMesh();
    this.beacon.visible = false;
    scene.add(this.beacon);
    this.markedCar = null;
    this.stealDone = false;
    this.onMessage = null; // (text) => void, wired to the HUD feed
    this.onJobComplete = null; // (job) => void
    this.pulse = 0;
    this.startJob(0);
  }

  get job() {
    return JOBS[this.jobIndex];
  }

  get finished() {
    return this.jobIndex >= JOBS.length;
  }

  say(text) {
    if (this.onMessage) this.onMessage(text);
  }

  startJob(index) {
    this.jobIndex = index;
    this.stealDone = false;
    if (this.finished) {
      this.beacon.visible = false;
      return;
    }
    const job = this.job;
    this.say(`Mara: ${job.intro}`);
    if (job.forceWanted) {
      // The getaway starts hot; the game loop applies this via the flag.
      this.pendingWanted = job.forceWanted;
    }
    if (job.carSpot && !this.markedCar) {
      // The silver Comet, parked where Mara said it would be.
      const mesh = makeCarMesh(0xc8ccd2);
      this.scene.add(mesh);
      this.markedCar = new CarRig(mesh, job.carSpot.x, job.carSpot.z, Math.PI / 2);
      const marker = new THREE.Mesh(
        new THREE.ConeGeometry(0.9, 1.8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffe14a }),
      );
      marker.position.set(job.carSpot.x, 4.6, job.carSpot.z);
      marker.rotation.x = Math.PI;
      this.scene.add(marker);
      this.markedCarMarker = marker;
    }
    this.moveBeacon(job.target.x, job.target.z);
  }

  moveBeacon(x, z) {
    this.beacon.position.set(x, 0, z);
    this.beacon.visible = true;
  }

  get target() {
    if (this.finished) return null;
    // Job 1 first wants the car itself, then the garage.
    if (this.jobIndex === 0 && !this.stealDone) {
      return { x: this.job.carSpot.x, z: this.job.carSpot.z, label: 'The silver Comet' };
    }
    return { x: this.job.target.x, z: this.job.target.z, label: this.job.targetLabel };
  }

  jobText() {
    if (this.finished) return 'All jobs done — Solmar is yours tonight.';
    return `${this.job.title} — ${this.target.label}`;
  }

  // Called when Rook steals a car; job 1 only counts the marked Comet.
  onSteal(car) {
    if (this.jobIndex === 0 && !this.stealDone && car === this.markedCar) {
      this.stealDone = true;
      if (this.markedCarMarker) {
        this.scene.remove(this.markedCarMarker);
        this.markedCarMarker = null;
      }
      this.say('Mara: That is the one. Now get it to the garage on Crane Street.');
      this.moveBeacon(this.job.target.x, this.job.target.z);
      return true;
    }
    return false;
  }

  update(dt, player) {
    this.pulse += dt * CONFIG.beaconPulseSpeed;
    if (this.beacon.visible) {
      const s = 1 + Math.sin(this.pulse) * 0.18;
      this.beacon.userData.ring.scale.set(s, s, 1);
      this.beacon.rotation.y += dt * 0.6;
    }
    if (this.finished) return;
    const t = this.target;
    if (!t) return;
    // For job 1 the beacon sits on the garage only after the steal.
    const beaconAtTarget =
      this.jobIndex !== 0 || this.stealDone;
    if (beaconAtTarget) {
      this.beacon.position.x = this.job.target.x;
      this.beacon.position.z = this.job.target.z;
    } else {
      this.beacon.position.x = this.job.carSpot.x;
      this.beacon.position.z = this.job.carSpot.z;
    }
    const d = Math.hypot(player.x - t.x, player.z - t.z);
    // Job 1 has two phases: reaching the Comet on foot does nothing — the
    // steal itself (onSteal) advances the phase. Only the garage delivery
    // completes the job, and Rook has to be driving for that.
    const isStealPhase = this.jobIndex === 0 && !this.stealDone;
    const needCar = this.jobIndex === 0 && this.stealDone;
    const arrived =
      !isStealPhase && d < CONFIG.arriveRadius && (!needCar || player.driving);
    if (arrived) {
      const done = this.job;
      if (this.onJobComplete) this.onJobComplete(done);
      this.say(`Mara: ${done.title} — done. ${this.jobIndex + 1 < JOBS.length ? 'Next job coming in.' : 'That is the whole chain, Rook.'}`);
      this.startJob(this.jobIndex + 1);
    }
  }
}
