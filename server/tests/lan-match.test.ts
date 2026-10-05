import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";
import { starter } from "../../shared/catalog.js";

const origin = "http://127.0.0.1:4192",
  headers = {
    origin,
    "x-arena-client": "1",
    "content-type": "application/json",
  };
const networkSnapshot = (sequence: number, phase: string) => ({
  sequence,
  phase,
  score: [0, 0],
  remaining: 300,
  countdown: 3,
  freeze: 0,
  goTime: 0,
  overtime: false,
  message: "",
  resetSequence: 1,
  lastGoal: null,
  goalFocus: null,
  clock: 0,
  lastTouchId: null,
  ball: {
    position: [0, 1, 0],
    rotation: [0, 0, 0, 1],
    velocity: [0, 0, 0],
    angularVelocity: [0, 0, 0],
    enabled: true,
  },
  cars: [
    {
      id: "car",
      position: [0, 1, 0],
      rotation: [0, 0, 0, 1],
      velocity: [0, 0, 0],
      angularVelocity: [0, 0, 0],
      enabled: true,
      boost: 100,
      boosting: false,
      demolitionState: "active",
      respawnTimer: 0,
      supersonic: false,
      forwardSpeed: 0,
      steerAngle: 0,
      grounded: true,
      wheelOrigins: Array.from({ length: 4 }, () => [0, 0, 0]),
      wheelHits: Array.from({ length: 4 }, () => [0, 0, 0]),
      wheelContact: [true, true, true, true],
    },
  ],
  pads: [],
});

test("LAN host starts a shared match and relays inputs and snapshots", async () => {
  const { app } = await createApp({
    host: "127.0.0.1",
    port: 0,
    database: ":memory:",
    origins: [origin],
    production: false,
    trustProxy: false,
    authLimit: 100,
    sessionSeconds: 600,
  });
  try {
    const clients: { cookie: string; id: string }[] = [];
    const send = (
      client: number,
      path: string,
      payload: unknown = {},
      method: "POST" | "GET" = "POST",
    ) =>
      app.inject({
        method,
        url: "/api/party" + path,
        headers: { ...headers, cookie: clients[client]?.cookie ?? "" },
        ...(method === "GET" ? {} : { payload }),
      });
    for (let i = 0; i < 2; i++) {
      const response = await send(-1, "/session", { preset: starter() });
      assert.equal(response.statusCode, 200);
      clients.push({
        cookie: response.cookies.map((c) => `${c.name}=${c.value}`).join("; "),
        id: response.json().playerId,
      });
    }
    const code = (await send(0, "/create")).json().party.code;
    assert.equal((await send(1, "/join", { code })).statusCode, 200);
    await send(0, "/stage", { stage: "mode" });
    await send(0, "/stage", { stage: "teams" });
    assert.equal((await send(0, "/team", { team: 0 })).statusCode, 200);
    assert.equal((await send(1, "/team", { team: 1 })).statusCode, 200);
    const field = await send(0, "/field", { field: "neo-tokyo" });
    assert.equal(field.statusCode, 200);
    assert.equal(field.json().party.field, "neo-tokyo");
    assert.equal(
      (await send(1, "/field", { field: "lumen" })).statusCode,
      403,
    );
    assert.equal((await send(0, "/field", { field: "unknown" })).statusCode, 400);

    const started = await send(0, "/game/start");
    assert.equal(started.statusCode, 200);
    const game = started.json().party.game;
    assert.equal(game.status, "playing");
    assert.equal(game.players.length, 2);
    assert.ok(game.startedAt > Date.now());
    assert.equal((await send(0, "/team", { team: 1 })).statusCode, 409);

    const input = {
      throttle: 1,
      steer: -0.25,
      pitch: 0,
      yaw: 0,
      roll: 0,
      jump: false,
      boost: true,
      slide: false,
    };
    assert.equal(
      (
        await send(1, "/game/input", {
          input,
          snapshot: { sequence: 1, phase: "playing" },
        })
      ).statusCode,
      403,
      "only host can publish authoritative match snapshots",
    );
    assert.equal((await send(1, "/game/input", { input })).statusCode, 200);
    const received = (await send(0, "", {}, "GET")).json().party.game;
    assert.deepEqual(received.inputs[clients[1].id], input);

    assert.equal(
      (
        await send(0, "/game/input", {
          input: { ...input, throttle: 2 },
        })
      ).statusCode,
      400,
    );
    assert.equal(
      (
        await send(0, "/game/input", {
          input,
          snapshot: { sequence: 1, phase: "playing" },
        })
      ).statusCode,
      400,
    );
    assert.equal(
      (
        await send(0, "/game/input", {
          input,
          snapshot: networkSnapshot(1, "playing"),
        })
      ).statusCode,
      200,
    );
    const snapshot = (await send(1, "", {}, "GET")).json().party.game.snapshot;
    assert.equal(snapshot.sequence, 1);
    assert.equal(snapshot.phase, "playing");

    assert.equal(
      (
        await send(0, "/game/input", {
          input,
          snapshot: networkSnapshot(2, "finished"),
        })
      ).statusCode,
      200,
    );
    const finished = (await send(1, "", {}, "GET")).json().party.game;
    assert.equal(finished.status, "finished");
    assert.equal((await send(0, "/game/start")).statusCode, 200);
    assert.notEqual(
      (await send(0, "", {}, "GET")).json().party.game.id,
      game.id,
    );
  } finally {
    await app.close();
  }
});
