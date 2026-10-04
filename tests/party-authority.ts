import assert from "node:assert/strict";
import { test } from "node:test";
import { starter } from "../shared/catalog";
import { PartyAuthority } from "../src/game/party-authority";

const member = (name: string) => ({
  id: "",
  name,
  title: "Rookie",
  avatarId: "helmet",
  preset: starter(),
  team: null as 0 | 1 | null,
  ready: false,
});
const getMember = (party: PartyAuthority, id: string) =>
  party.party!.members.find((candidate) => candidate.id === id)!;
const join = (
  authority: PartyAuthority,
  token: string,
  name = "Guest",
  receive: (reply: unknown) => void = () => {},
) => {
  const result = authority.join(token, name, starter(), receive);
  if (!result.ok) throw new Error(result.error);
  return result.reply.playerId;
};
const errorOf = (
  result:
    | ReturnType<PartyAuthority["action"]>
    | ReturnType<PartyAuthority["join"]>,
) => (result.ok ? "" : result.error);

test("WebRTC authority enforces lobby rules and membership actions", () => {
  const authority = new PartyAuthority(),
    hostToken = "host-session-token-0123456789",
    hostId = authority.create("ABC234", hostToken, member("Host")),
    guest1Token = "guest-session-token-0123456789",
    guest2Token = "guest-two-session-token-0123456789",
    guest3Token = "guest-three-session-token-0123456789",
    messages: unknown[] = [],
    guest1 = join(authority, guest1Token, "  Guest One \u0000", (m) =>
      messages.push(m),
    ),
    guest2 = join(authority, guest2Token, "Guest Two", (m) => messages.push(m)),
    guest3 = join(authority, guest3Token, "Guest Three", (m) =>
      messages.push(m),
    );

  assert.equal(authority.party?.members.length, 4);
  assert.equal(getMember(authority, guest1).name, "Guest One");
  assert.equal(getMember(authority, guest1).connected, true);
  assert.equal(
    errorOf(
      authority.join(
        "extra-session-token-0123456789",
        "Extra",
        starter(),
        () => {},
      ),
    ),
    "PARTY FULL",
  );
  assert.equal(
    errorOf(authority.action(guest1Token, { type: "mode", mode: "2v2" })),
    "ONLY THE HOST CAN CHANGE MODE",
  );
  assert.equal(
    authority.action(hostToken, { type: "stage", stage: "mode" }).ok,
    true,
  );
  assert.equal(
    authority.action(hostToken, { type: "mode", mode: "2v2" }).ok,
    true,
  );
  assert.equal(
    authority.action(hostToken, { type: "stage", stage: "teams" }).ok,
    true,
  );
  assert.equal(authority.action(hostToken, { type: "team", team: 0 }).ok, true);
  assert.equal(
    authority.action(guest1Token, { type: "team", team: 0 }).ok,
    true,
  );
  assert.equal(
    errorOf(authority.action(guest3Token, { type: "team", team: 0 })),
    "TEAM FULL",
  );
  assert.equal(
    authority.action(guest2Token, { type: "team", team: 1 }).ok,
    true,
  );
  assert.equal(
    authority.action(guest2Token, { type: "ready", ready: true }).ok,
    true,
  );
  assert.equal(getMember(authority, guest2).ready, true);
  assert.equal(
    errorOf(authority.action(guest1Token, { type: "kick", playerId: guest2 })),
    "ONLY THE HOST CAN KICK",
  );
  assert.equal(
    authority.action(hostToken, { type: "kick", playerId: guest2 }).ok,
    true,
  );
  assert.equal(authority.party?.members.length, 3);
  assert.ok(
    messages.some(
      (message) =>
        typeof message === "object" &&
        message !== null &&
        "party" in message &&
        (message as { party: unknown }).party === null,
    ),
  );
  assert.equal(
    authority.action(hostToken, { type: "stage", stage: "home" }).ok,
    true,
  );
  assert.equal(
    authority.action(hostToken, { type: "mode", mode: "2v2bots" }).ok,
    true,
  );
  assert.equal(
    errorOf(authority.action(guest3Token, { type: "team", team: 1 })),
    "TEAM FULL",
  );
  assert.equal(
    authority.action(guest3Token, { type: "leave" }).reply.party,
    null,
  );
  assert.equal(authority.party?.members.length, 2);
  assert.equal(
    authority.action(hostToken, { type: "leave" }).reply.party,
    null,
  );
  assert.equal(
    authority.party,
    null,
    "host leaving ends party without migration",
  );
  assert.ok(
    messages.some(
      (message) =>
        typeof message === "object" &&
        message !== null &&
        "type" in message &&
        (message as { type?: unknown }).type === "host-left",
    ),
  );
});

test("WebRTC authority marks drops disconnected and rejoins the same token", () => {
  const authority = new PartyAuthority(),
    hostToken = "host-session-token-rejoin-0123456789",
    guestToken = "guest-session-token-rejoin-0123456789",
    hostId = authority.create("ABC234", hostToken, member("Host")),
    guestId = join(authority, guestToken, "Guest", () => {});

  authority.drop(guestToken);
  assert.equal(getMember(authority, guestId).connected, false);
  const rejoined = authority.join(
    guestToken,
    "Guest Again",
    starter(),
    () => {},
  );
  assert.equal(rejoined.ok, true);
  assert.equal(rejoined.reply.playerId, guestId);
  assert.equal(authority.party?.members.length, 2);
  assert.equal(getMember(authority, guestId).connected, true);

  authority.drop(guestToken);
  authority.sweep(Date.now() + 46_000);
  assert.equal(
    authority.party?.members.some((candidate) => candidate.id === guestId),
    false,
  );
  assert.equal(authority.party?.hostId, hostId);
});

test("WebRTC authority starts and relays host-owned match state and inputs", () => {
  const authority = new PartyAuthority(),
    hostToken = "host-match-session-token-0123456789",
    hostId = authority.create("ABC234", hostToken, member("Host")),
    guestToken = "guest-match-session-token-0123456789",
    guestId = join(authority, guestToken, "Guest", () => {});
  authority.action(hostToken, { type: "stage", stage: "mode" });
  authority.action(hostToken, { type: "stage", stage: "teams" });
  authority.action(hostToken, { type: "team", team: 0 });
  authority.action(guestToken, { type: "team", team: 1 });

  const started = authority.action(hostToken, { type: "startMatch" });
  assert.equal(started.ok, true);
  assert.equal(started.reply.party?.game?.status, "playing");
  const input = {
    throttle: 1,
    steer: 0,
    pitch: 0,
    yaw: 0,
    roll: 0,
    jump: true,
    boost: false,
    slide: false,
  };
  const update = authority.gameUpdate(guestToken, input);
  assert.equal(update.ok, true);
  assert.deepEqual(update.reply.party?.game?.inputs[guestId], input);
  assert.equal(
    errorOf(authority.gameUpdate("unknown-session-token-0123456789", input)),
    "NO ACTIVE MATCH",
  );
  assert.equal(
    authority.action(hostToken, { type: "endMatch" }).reply.party?.game?.status,
    "finished",
  );
  assert.equal(authority.party?.hostId, hostId);
});
