import RAPIER from "@dimforge/rapier3d-compat";
import assert from "node:assert/strict";
import { Simulation } from "../src/physics/simulation";
import { neutralInput, type PlayerEntity } from "../shared/player";
import { Match } from "../src/game/match";
import type { MatchSnapshot } from "../shared/party";
await RAPIER.init();
const roster: PlayerEntity[] = Array.from({ length: 4 }, (_, i) => ({
  id: `unique-${i}-id`,
  name: `Driver ${i}`,
  team: (i % 2) as 0 | 1,
  controller: i === 0 ? "local" : "remote",
}));
const s = new Simulation(true, roster);
try {
  assert.equal(s.cars.length, 4);
  s.ballCollider.setCollisionGroups(0);
  s.cars.forEach((c, i) => c.reset(i * 10, 0, 0));
  const inputs = new Map(
    roster.map((p, i) => [
      p.id,
      { ...neutralInput(), throttle: i === 1 ? 1 : i === 2 ? -1 : 0 },
    ]),
  );
  for (let i = 0; i < 120; i++) s.step(inputs);
  assert.ok(s.cars[1].body.translation().z < -3);
  assert.ok(s.cars[2].body.translation().z > 3);
  assert.ok(
    Math.abs(s.cars[0].body.translation().z) < 0.01 &&
      Math.abs(s.cars[3].body.translation().z) < 0.01,
  );
  console.log("PASS four independent ID-addressed PlayerInput entities");
  s.cars[0].reset(-50, 0, 0);
  s.cars[1].reset(50, 0, 0);
  s.cars[2].reset(0, 2, 0);
  s.cars[3].reset(0, -2, Math.PI);
  s.cars[2].body.setLinvel({ x: 0, y: 0, z: -12 }, true);
  s.cars[3].body.setLinvel({ x: 0, y: 0, z: 12 }, true);
  let bumped = false;
  for (let i = 0; i < 60; i++) {
    s.step(new Map());
    bumped ||= s.cars[2].impactTime > 0 && s.cars[3].impactTime > 0;
  }
  assert.ok(bumped);
  assert.equal(s.cars[0].impactTime, 0);
  console.log(
    "PASS collision bookkeeping uses actual third/fourth participants",
  );
  const m = new Match();
  m.phase = "playing";
  s.lastTouchId = roster[3].id;
  s.ball.setTranslation({ x: 0, y: 1, z: 53 }, true);
  m.tick(s);
  assert.equal(m.score[1], 1);
  assert.equal(m.lastGoal?.scorerId, roster[3].id);
  assert.match(m.message, /DRIVER 3/);
  s.reset();
  assert.deepEqual(
    s.cars.map((c) => c.id),
    roster.map((p) => p.id),
  );
  console.log(
    "PASS scoring and reset preserve unique IDs and teams, independent of names",
  );
  s.cars[3].body.setTranslation({ x: 7, y: 2, z: -11 }, true);
  s.cars[3].boost = 43;
  const position = (v: { x: number; y: number; z: number }) =>
      [v.x, v.y, v.z] as [number, number, number],
    rotation = (q: { x: number; y: number; z: number; w: number }) =>
      [q.x, q.y, q.z, q.w] as [number, number, number, number],
    snapshot: MatchSnapshot = {
      sequence: 1,
      phase: "playing",
      score: [2, 1],
      remaining: 180,
      countdown: 0,
      freeze: 0,
      goTime: 0,
      overtime: false,
      message: "",
      resetSequence: 2,
      lastGoal: null,
      goalFocus: null,
      clock: s.clock,
      lastTouchId: s.lastTouchId,
      ball: {
        position: position(s.ball.translation()),
        rotation: rotation(s.ball.rotation()),
        velocity: position(s.ball.linvel()),
        angularVelocity: position(s.ball.angvel()),
        enabled: s.ball.isEnabled(),
      },
      cars: s.cars.map((car) => ({
        id: car.id,
        position: position(car.body.translation()),
        rotation: rotation(car.body.rotation()),
        velocity: position(car.body.linvel()),
        angularVelocity: position(car.body.angvel()),
        enabled: car.body.isEnabled(),
        boost: car.boost,
        boosting: car.boosting,
        demolitionState: car.demolitionState,
        respawnTimer: car.respawnTimer,
        supersonic: car.supersonic,
        forwardSpeed: car.forwardSpeed,
        steerAngle: car.steerAngle,
        grounded: car.grounded,
        wheelOrigins: car.wheelOrigins.map(position),
        wheelHits: car.wheelHits.map(position),
        wheelContact: [...car.wheelContact],
      })),
      pads: [],
    };
  const receiver = new Simulation(true, [...roster].reverse());
  try {
    receiver.applyNetworkSnapshot(snapshot);
    const applied = receiver.cars
      .find((car) => car.id === roster[3].id)
      ?.body.translation();
    assert.deepEqual([applied?.x, applied?.y, applied?.z], [7, 2, -11]);
    assert.equal(
      receiver.cars.find((car) => car.id === roster[3].id)?.boost,
      43,
    );
    const remoteMatch = new Match();
    remoteMatch.applyNetworkSnapshot(snapshot);
    assert.equal(remoteMatch.mode, "party");
    assert.equal(remoteMatch.phase, "playing");
    assert.deepEqual(remoteMatch.score, [2, 1]);
    console.log(
      "PASS remote clients apply ID-matched physics and match snapshots",
    );
  } finally {
    receiver.dispose();
  }
  assert.throws(() => new Simulation(true, [roster[0], roster[0]]));
} finally {
  s.dispose();
}
const a = new Simulation(true),
  b = new Simulation(true, roster.slice(0, 2));
try {
  for (let tick = 0; tick < 480; tick++) {
    const input = {
      ...neutralInput(),
      throttle: 1,
      steer: tick > 120 ? 0.3 : 0,
      boost: tick < 60,
      jump: tick >= 240 && tick < 250,
      slide: tick > 360,
    };
    a.step([input, neutralInput()]);
    b.step(
      new Map([
        [roster[0].id, input],
        [roster[1].id, neutralInput()],
      ]),
    );
    assert.deepEqual(
      a.cars[0].body.translation(),
      b.cars[0].body.translation(),
    );
    assert.deepEqual(a.cars[0].body.linvel(), b.cars[0].body.linvel());
    assert.deepEqual(a.cars[0].body.rotation(), b.cars[0].body.rotation());
  }
  console.log("PASS array-input and ID-input replay produce identical physics");
} finally {
  a.dispose();
  b.dispose();
}
