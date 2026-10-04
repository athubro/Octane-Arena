import RAPIER from "@dimforge/rapier3d-compat";
import assert from "node:assert/strict";
import { Simulation } from "../src/physics/simulation";
import { P } from "../src/config/physics";
import { neutral } from "../src/input/types";

await RAPIER.init();
const simulation = new Simulation();
const car = simulation.cars[0];
car.body.setTranslation({ x: P.arena.halfWidth + 3, y: 8, z: 4 }, true);
car.body.setLinvel({ x: 12, y: 0, z: 0 }, true);
simulation.ball.setTranslation(
  {
    x: P.arena.halfWidth + 3,
    y: 8,
    z: P.arena.halfLength + P.arena.goalDepth + 3,
  },
  true,
);
simulation.ball.setLinvel({ x: 12, y: 0, z: 12 }, true);
simulation.step([neutral(), neutral()]);

const carPosition = car.body.translation(),
  ballPosition = simulation.ball.translation();
assert.ok(Math.abs(carPosition.x) <= P.arena.halfWidth);
assert.ok(Math.abs(carPosition.z) <= P.arena.halfLength + P.arena.goalDepth);
assert.ok(
  Math.abs(ballPosition.x) <= P.arena.halfWidth - P.ball.radius + 0.01,
  `ball x ${ballPosition.x}`,
);
assert.ok(
  Math.abs(ballPosition.z) <=
    P.arena.halfLength + P.arena.goalDepth - P.ball.radius + 0.01,
);
simulation.dispose();
console.log(
  "PASS escaped vehicles and ball are constrained to the arena envelope",
);
