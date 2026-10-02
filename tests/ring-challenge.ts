import assert from "node:assert/strict";
import { Vector3 } from "three";
import { RingChallenge } from "../src/game/ring-challenge";

const values = new Map<string, string>(),
  storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  },
  challenge = new RingChallenge(storage);

const crossing = (gate: RingChallenge, reverse = false, offset = 0) => {
  const center = gate.activeCenter.clone(),
    direction = gate.direction.clone(),
    sideways = new Vector3(-direction.z, 0, direction.x).normalize();
  if (offset) center.addScaledVector(sideways, offset);
  const before = center.clone().addScaledVector(direction, reverse ? 4 : -4),
    after = center.clone().addScaledVector(direction, reverse ? -4 : 4);
  return [before, after] as const;
};

assert.equal(challenge.cross(new Vector3(), new Vector3(0, 1, 0)), null);
for (let i = 0; i < 3; i++) {
  const [before, after] = crossing(challenge);
  assert.equal(challenge.cross(before, after), "passed");
  assert.equal(challenge.streak, i + 1);
}
assert.equal(challenge.best, 3);
assert.equal(values.get("octane-arena-ring-streak-v1"), "3");

const [reverseBefore, reverseAfter] = crossing(challenge, true);
assert.equal(challenge.cross(reverseBefore, reverseAfter), "missed");
assert.equal(challenge.streak, 3, "a failed run keeps its completed streak");

challenge.start();
const [outsideBefore, outsideAfter] = crossing(
  challenge,
  false,
  RingChallenge.gateOpeningRadius + 1,
);
assert.equal(challenge.cross(outsideBefore, outsideAfter), "missed");

const restored = new RingChallenge(storage);
assert.equal(restored.best, 3);
const [insideBefore, insideAfter] = crossing(restored, false, 1);
assert.equal(restored.cross(insideBefore, insideAfter), "passed");
assert.equal(restored.streak, 1);
assert.equal(restored.best, 3);

console.log(
  "PASS ring course ordering, direction, misses, streaks and saved best",
);
