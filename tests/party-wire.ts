import assert from "node:assert/strict";
import { test } from "node:test";
import { starter } from "../shared/catalog";
import { PartyAuthority } from "../src/game/party-authority";
import { manualSignalSchema, partyWireSchema } from "../src/game/party-wire";

test("party wire schemas accept the client protocol and reject untrusted fields", () => {
  const authority = new PartyAuthority();
  authority.create("ABC234", "host-session-token-0123456789", {
    id: "",
    name: "Host",
    title: "Rookie",
    avatarId: "helmet",
    preset: starter(),
    team: 0,
    ready: false,
  });
  const reply = {
    playerId: authority.party!.hostId,
    party: authority.party,
    notice: "",
  };
  assert.equal(
    partyWireSchema.safeParse({ type: "state", reply }).success,
    true,
  );
  assert.equal(
    partyWireSchema.safeParse({
      type: "join",
      token: "guest-session-token-0123456789",
      name: "Guest",
      preset: starter(),
    }).success,
    true,
  );
  assert.equal(
    partyWireSchema.safeParse({
      type: "action",
      requestId: "request-1",
      action: { type: "lobby", action: { type: "team", team: 2 } },
    }).success,
    false,
  );
  assert.equal(
    partyWireSchema.safeParse({
      type: "join",
      token: "short",
      name: "Guest",
      preset: starter(),
      team: 1,
      ready: true,
    }).success,
    false,
  );
  assert.equal(
    partyWireSchema.safeParse({ type: "admin", action: "kick" }).success,
    false,
  );
  const snapshot = {
    sequence: 1,
    phase: "playing",
    score: [0, 0],
    remaining: 300,
    countdown: 0,
    freeze: 0,
    goTime: 0,
    overtime: false,
    message: "",
    resetSequence: 0,
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
        id: "host-car",
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
  };
  assert.equal(
    partyWireSchema.safeParse({
      type: "gameUpdate",
      requestId: "snapshot",
      input: {
        throttle: 0,
        steer: 0,
        pitch: 0,
        yaw: 0,
        roll: 0,
        jump: false,
        boost: false,
        slide: false,
      },
      snapshot,
    }).success,
    true,
  );
  assert.equal(
    partyWireSchema.safeParse({
      type: "gameUpdate",
      requestId: "bad-snapshot",
      input: {
        throttle: 0,
        steer: 0,
        pitch: 0,
        yaw: 0,
        roll: 0,
        jump: false,
        boost: false,
        slide: false,
      },
      snapshot: { ...snapshot, sequence: -1 },
    }).success,
    false,
  );
  assert.equal(
    manualSignalSchema.safeParse({ type: "offer", sdp: "candidate-data" })
      .success,
    true,
  );
  assert.equal(
    manualSignalSchema.safeParse({ type: "answer", sdp: "", extra: true })
      .success,
    false,
  );
});
