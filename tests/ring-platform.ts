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
  { x: 0, y: 5, z: 43 },
  { x: 0, y: -1, z: 0 },
);
assert.ok(
  simulation.world.castRay(platformRay, 10, true),
  "the floating platform remains solid in Ring Rush",
);

simulation.setRingCourse(false);
assert.ok(
  simulation.world.castRay(ray, 10, true),
  "normal arena collisions return when Ring Rush ends",
);

console.log("PASS Ring Rush platform collision and spawn");
