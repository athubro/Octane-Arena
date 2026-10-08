import assert from "node:assert/strict";
import RAPIER from "@dimforge/rapier3d-compat";
import { Simulation } from "../src/physics/simulation";
import { RingChallenge } from "../src/game/ring-challenge";

await RAPIER.init();
const simulation = new Simulation(false, [
  { id: "player", name: "Guest", team: 0, controller: "local" },
]);
simulation.setRingCourse(true, RingChallenge.startingPosition);
simulation.reset();

const spawn = simulation.cars[0].body.translation();
assert.equal(spawn.x, 0);
assert.ok(Math.abs(spawn.y - 0.36) < 1e-5);
assert.equal(spawn.z, 51, "Ring Rush resets on the starting platform");

const ray = new RAPIER.Ray({ x: 20, y: 5, z: 43 }, { x: 0, y: -1, z: 0 });
assert.equal(
  simulation.world.castRay(ray, 10, true),
  null,
  "the normal arena floor is disabled outside the floating platform",
);

const platformRay = new RAPIER.Ray(
  { x: 0, y: 5, z: -50 },
  { x: 0, y: -1, z: 0 },
);
assert.ok(
  simulation.world.castRay(platformRay, 10, true),
  "the extended course platform remains solid beneath ring six",
);
for (const [name, origin, direction] of [
  ["left", { x: -14, y: 1.5, z: -50 }, { x: 1, y: 0, z: 0 }],
  ["right", { x: 14, y: 1.5, z: -50 }, { x: -1, y: 0, z: 0 }],
  ["far end", { x: 0, y: 1.5, z: -102 }, { x: 0, y: 0, z: 1 }],
  ["near end", { x: 0, y: 1.5, z: 62 }, { x: 0, y: 0, z: -1 }],
] as const) {
  assert.ok(
    simulation.world.castRay(new RAPIER.Ray(origin, direction), 8, true),
    `visible course boundary has a solid ${name} collider`,
  );
}
for (const z of [20, 6, -8, -22, -36, -50, -64, -78, -92]) {
  const ray = new RAPIER.Ray({ x: 0, y: 5, z }, { x: 0, y: -1, z: 0 });
  assert.ok(simulation.world.castRay(ray, 10, true), `course deck supports ring at z=${z}`);
}
const car = simulation.cars[0];
for (const [name, position, velocity, axis] of [
  ["left", { x: -10.7, y: 1, z: -50 }, { x: -80, y: 0, z: 0 }, "x"],
  ["right", { x: 10.7, y: 1, z: -50 }, { x: 80, y: 0, z: 0 }, "x"],
  ["far end", { x: 0, y: 1, z: -96 }, { x: 0, y: 0, z: -80 }, "z"],
  ["near end", { x: 0, y: 1, z: 56 }, { x: 0, y: 0, z: 80 }, "z"],
] as const) {
  car.reset(0, 51, 0);
  car.body.setTranslation(position, true);
  car.body.setLinvel(velocity, true);
  for (let i = 0; i < 8; i++) simulation.step([]);
  const p = car.body.translation();
  assert.ok(Math.abs(p.x) <= 11.2 && p.z >= -97 && p.z <= 57,
    `${name} high-speed launch remains inside the ring course: ${p.x}, ${p.z}`);
}
car.body.setTranslation({ x: 0, y: -8, z: -104 }, true);
simulation.step([]);
assert.ok(car.body.translation().z > 45, "falling beyond a rail recovers to spawn");

simulation.setRingCourse(false);
assert.ok(
  simulation.world.castRay(ray, 10, true),
  "normal arena collisions return when Ring Rush ends",
);

simulation.setRingCourse(true, RingChallenge.startingPosition, true);
for (const z of [51, 0, -30, -80, -125]) {
  assert.ok(
    simulation.world.castRay(
      new RAPIER.Ray({ x: 0, y: 5, z }, { x: 0, y: -1, z: 0 }),
      10,
      true,
    ),
    `dribble deck supports the full level route at z=${z}`,
  );
}
const dribbleSpawn = simulation.cars[0].body.translation();
const dribbleBall = simulation.ball.translation();
assert.ok(Math.abs(dribbleBall.z - (dribbleSpawn.z - 2.5)) < 1e-5,
  "dribble ball starts in front of the car rather than across the void");
simulation.setRingCourse(false);

console.log("PASS Ring Rush platform collision and spawn");
