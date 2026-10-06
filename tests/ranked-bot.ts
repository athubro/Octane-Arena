import assert from "node:assert/strict";
import RAPIER from "@dimforge/rapier3d-compat";
import { Opponent } from "../src/ai/opponent";
import { Simulation } from "../src/physics/simulation";
import { neutral } from "../src/input/types";
import { P } from "../src/config/physics";

await RAPIER.init();

{
  const simulation = new Simulation(),
    car = simulation.cars[1],
    bot = new Opponent(),
    ball = { x: 0, y: P.ball.radius + 0.02, z: 0 };
  car.reset(0, -20, Math.PI);
  car.forwardSpeed = 15;
  bot.level = 1;
  const low = bot.sample(car, ball, 1);
  bot.level = 10;
  const high = bot.sample(car, ball, 1);
  assert.equal(
    low.throttle,
    0,
    "low rank should stay below its lower speed cap",
  );
  assert.equal(
    high.throttle,
    1,
    "top rank should drive through at the same speed",
  );
  simulation.dispose();
}

{
  const simulation = new Simulation(),
    botCar = simulation.cars[1],
    playerCar = simulation.cars[0],
    bot = new Opponent();
  bot.level = 10;
  let touchedBall = false,
    peakBallSpeed = 0,
    playerDemolitions = 0;
  let playerWasActive = true;
  for (let i = 0; i < 1800; i++) {
    const input = bot.sample(
      botCar,
      simulation.ball.translation(),
      simulation.clock,
      simulation.ball.linvel(),
      [playerCar],
    );
    simulation.step([neutral(), input]);
    touchedBall ||= simulation.lastTouchId === botCar.id;
    const velocity = simulation.ball.linvel();
    peakBallSpeed = Math.max(
      peakBallSpeed,
      Math.hypot(velocity.x, velocity.y, velocity.z),
    );
    if (playerWasActive && playerCar.demolitionState !== "active")
      playerDemolitions++;
    playerWasActive = playerCar.demolitionState === "active";
  }
  assert.ok(touchedBall, "ranked CPU should reach and play the ball");
  assert.ok(peakBallSpeed > 2, `CPU's strongest ball hit was ${peakBallSpeed}`);
  assert.equal(playerDemolitions, 0, "CPU should not ram a stationary player");
  simulation.dispose();
}

console.log("PASS ranked CPU difficulty scaling and safe ball-first play");
