import assert from "node:assert/strict";
import RAPIER from "@dimforge/rapier3d-compat";
import { Opponent } from "../src/ai/opponent";
import { Simulation } from "../src/physics/simulation";
import { P } from "../src/config/physics";

await RAPIER.init();

const scenarios = [
  ["stationary ball", [0, P.ball.radius, 0], [0, 0, 0]],
  ["slow ground ball", [-8, P.ball.radius, -6], [1.2, 0, -0.8]],
  ["fast ground ball", [4, P.ball.radius, 7], [-18, 0, -21]],
  ["wall rebound", [P.arena.halfWidth - 1, 3, 0], [16, 0, -4]],
  ["ground bounce", [0, P.ball.radius + 0.4, 0], [9, -4, 13]],
  ["toward goal", [3, 2, P.arena.halfLength - 12], [0, 0, 18]],
  ["away from goal", [-2, 1.5, P.arena.halfLength - 12], [0, 1, -15]],
  ["high aerial", [4, 10, -5], [-5, 2, 12]],
  [
    "corner ball",
    [P.arena.halfWidth - 4, 2, P.arena.halfLength - 5],
    [9, 0, 11],
  ],
  ["ball behind car", [0, 1, 30], [0, 0, -8]],
  ["rapid trajectory change", [0, 3, 0], [12, -5, -6]],
] as const;

const simulation = new Simulation(),
  botCar = simulation.cars[1],
  brain = new Opponent();
brain.level = 10;
botCar.reset(0, -20, Math.PI);
for (const [name, position, velocity] of scenarios) {
  const input = brain.sample(
    botCar,
    { x: position[0], y: position[1], z: position[2] },
    1,
    { x: velocity[0], y: velocity[1], z: velocity[2] },
  );
  assert.ok(
    [input.throttle, input.steer, input.boost ? 1 : 0].every(Number.isFinite),
    `${name}: controller output must stay finite`,
  );
  assert.ok(
    Number.isFinite(brain.telemetry.eta),
    `${name}: ETA must be finite`,
  );
  assert.ok(
    brain.telemetry.prediction.length > 0 &&
      brain.telemetry.prediction.every((point) => point.every(Number.isFinite)),
    `${name}: future ball samples must be available`,
  );
  assert.ok(
    brain.telemetry.confidence >= 0 && brain.telemetry.confidence <= 1,
    `${name}: confidence must be normalized`,
  );
  assert.ok(
    brain.telemetry.reason.length > 0,
    `${name}: decision needs a reason`,
  );
}
assert.equal(
  brain.telemetry.history.length,
  8,
  "state history is capped at eight samples",
);
assert.ok(
  brain.telemetry.predictedIntercept.some((v) => !Number.isNaN(v)),
  "planner exposes its selected predicted interception",
);
simulation.dispose();
console.log(
  `PASS predictive bot planning across ${scenarios.length} ball situations`,
);
