import assert from "node:assert/strict";
import RAPIER from "@dimforge/rapier3d-compat";
import { Simulation } from "../src/physics/simulation";
import { activeStaticCollider } from "../src/physics/query";
import { neutral } from "../src/input/types";

await RAPIER.init();
const simulation = new Simulation();
const ray = (current: Simulation) =>
  current.world.castRayAndGetNormal(
    new RAPIER.Ray({ x: 0, y: 2, z: 0 }, { x: 1, y: 0, z: 0 }),
    20,
    true,
    undefined,
    undefined,
    undefined,
    undefined,
    activeStaticCollider,
  );

assert.equal(
  ray(simulation),
  null,
  "inactive Ring Rush rails must not raycast in an arena field",
);
simulation.setRingCourse(true);
const ringRail = ray(simulation);
assert.ok(
  ringRail,
  "the Ring Rush rail must be queryable when that course is active",
);
assert.ok(Math.abs(ringRail.timeOfImpact - 11.3) < 0.02);
simulation.setRingCourse(false);

simulation.setActiveCount(1);
const car = simulation.cars[0];
car.reset(-18, 0, -Math.PI / 2);
car.body.setLinvel({ x: 8, y: 0, z: 0 }, true);
const supportCounts: number[] = [];
for (let i = 0; i < 110; i++) {
  simulation.step([{ ...neutral(), throttle: 1 }, neutral()]);
  const p = car.body.translation();
  if (p.x >= -12.5 && p.x <= -11.3) supportCounts.push(car.contacts);
}
assert.ok(
  supportCounts.length > 0,
  "car must cross the disabled rail location",
);
assert.ok(
  supportCounts.every((count) => count >= 3),
  `inactive rail stole wheel support: ${supportCounts.join(",")}`,
);
assert.ok(
  car.body.translation().x > -11.3,
  "car should drive through the old ghost barrier",
);
assert.ok(Math.abs(car.body.translation().y - 0.31) < 0.05);

simulation.dispose();
console.log(
  "PASS inactive Ring Rush colliders cannot affect either arena field",
);
