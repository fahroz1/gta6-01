// Staged screenshot views. When the page loads with ?shot=<name>&seed=<n>
// the game is arranged into one fixed, deterministic scene so a screenshot
// captures it: the player on foot by a car, driving, a police chase, or
// standing at the mission beacon.
import { CONFIG } from './config.js';

// Place the player and the camera for one named shot. game is the object
// main.js assembles: { player, traffic, police, missions, camera, world,
// hud, setShotCamera }. Returns a short label for the shot.
export function applyShot(game, name, seed) {
  const { player, missions, camera } = game;
  const setCam = (px, py, pz, lx, ly, lz) => {
    camera.position.set(px, py, pz);
    camera.lookAt(lx, ly, lz);
    game.shotCamera = true;
  };

  if (name === 'start') {
    // Rook on foot beside a parked car, the city stretching behind him.
    player.mesh.position.set(-88, 0, -48);
    player.heading = Math.PI * 0.75;
    player.mesh.rotation.y = player.heading;
    player.mesh.visible = true;
    setCam(-102, 9, -66, -84, 2, -44);
    return 'start';
  }

  if (name === 'drive') {
    // Rook driving down a street, traffic ahead. The car sits on the
    // street centerline and the camera pulls back high enough to see it.
    const car = game.traffic.allCars[0];
    player.enterCar(car);
    car.mesh.position.set(-40, 0, 0);
    car.heading = Math.PI / 2;
    car.mesh.rotation.y = car.heading;
    car.speed = 16;
    const f = car.forward();
    setCam(
      car.x - f.x * 17, 8.5, car.z - f.z * 17,
      car.x + f.x * 10, 2, car.z + f.z * 10,
    );
    return 'drive';
  }

  if (name === 'chase') {
    // A police car right on Rook's tail, sirens in the air. Both cars
    // stay on the street centerline so the camera never sits in a tower.
    const car = game.traffic.allCars[1] || game.traffic.allCars[0];
    player.enterCar(car);
    car.mesh.position.set(0, 0, -20);
    car.heading = 0;
    car.mesh.rotation.y = 0;
    car.speed = 18;
    game.police.setWanted(2);
    game.police.update(0.01, player, game.world);
    if (game.police.cars.length > 0) {
      const cop = game.police.cars[0];
      cop.mesh.position.set(-1, 0, car.z - 13);
      cop.heading = 0;
      cop.mesh.rotation.y = 0;
      cop.speed = 20;
    }
    const f = car.forward();
    setCam(
      car.x - f.x * 17 + 6, 9, car.z - f.z * 17,
      car.x + f.x * 10, 2, car.z + f.z * 10,
    );
    return 'chase';
  }

  if (name === 'mission') {
    // Rook on foot at the glowing mission beacon, job 1's garage in view.
    const t = missions.target;
    player.mesh.position.set(t.x - 6, 0, t.z + 8);
    player.heading = Math.atan2(t.x - player.mesh.position.x, t.z - player.mesh.position.z);
    player.mesh.rotation.y = player.heading;
    player.mesh.visible = true;
    missions.moveBeacon(t.x, t.z);
    setCam(t.x - 14, 10, t.z + 18, t.x, 3, t.z);
    return 'mission';
  }

  // Unknown shot name: fall back to the start vista.
  return applyShot(game, 'start', seed);
}

export function shotNames() {
  return ['start', 'drive', 'chase', 'mission'];
}

export { CONFIG };
