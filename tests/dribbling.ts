import assert from "node:assert/strict";
import { DribblingChallenge } from "../src/game/dribbling";

const challenge = new DribblingChallenge();
challenge.start(0);
assert.equal(challenge.levelCount, 20);
assert.ok(challenge.checkpoints.length >= 4);
assert.equal(challenge.progress, 0);
challenge.advance({ x: 0, y: 0, z: challenge.checkpoints[0].z - 1.5 });
assert.equal(challenge.progress, 1);
challenge.advance({ x: 0, y: 0, z: challenge.finish.z - 1.5 });
assert.ok(challenge.completed);
console.log("PASS dribbling progression");
