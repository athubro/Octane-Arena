import { neutralInput, type PlayerInput } from "../../shared/player";
import {
  applyPartyLobbyAction,
  joinPartyState,
  sanitizePartyName,
} from "../../shared/party-rules";
import type {
  MatchSnapshot,
  PartyGame,
  PartyMember,
  PartyMode,
  PartyReply,
  PartyState,
} from "../../shared/party";
import { partyAlphabet } from "../../shared/party";
import type { Preset } from "../../shared/catalog";
import type { LobbyActionMessage } from "./party-wire";

export const PARTY_REJOIN_MS = 45_000;
const MAX_SNAPSHOT_BYTES = 24_000;

type PeerSender = (message: PartyReply | { type: "host-left" }) => void;
type Session = {
  id: string;
  token: string;
  expiresAt: number;
  send?: PeerSender;
};

export type AuthorityResult =
  | { ok: true; reply: PartyReply }
  | { ok: false; error: string; reply: PartyReply };

function randomId(prefix = "p") {
  const bytes = new Uint8Array(16);
  try {
    if (!globalThis.crypto?.getRandomValues)
      throw new Error("Secure random numbers unavailable");
    globalThis.crypto.getRandomValues(bytes);
  } catch {
    for (let i = 0; i < bytes.length; i++)
      bytes[i] = Math.floor(Math.random() * 256);
  }
  return `${prefix}-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export function createPartyCode(random = Math.random) {
  return Array.from(
    { length: 6 },
    () => partyAlphabet[Math.floor(random() * partyAlphabet.length)],
  ).join("");
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export class PartyAuthority {
  party: PartyState | null = null;
  private sessions = new Map<string, Session>();
  private listeners = new Set<(reply: PartyReply) => void>();
  private lastInput = new Map<string, number>();

  subscribe(listener: (reply: PartyReply) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  create(code: string, token: string, member: PartyMember) {
    if (this.party) throw new Error("A party is already active");
    member = {
      ...member,
      id: randomId(),
      name: sanitizePartyName(member.name),
      team: 0,
      ready: false,
      connected: true,
    };
    this.party = {
      code,
      hostId: member.id,
      members: [member],
      mode: "1v1",
      stage: "home",
      game: null,
    };
    this.sessions.set(token, {
      id: member.id,
      token,
      expiresAt: Number.POSITIVE_INFINITY,
    });
    this.publish();
    return member.id;
  }

  join(
    token: string,
    name: string,
    preset: Preset,
    send: PeerSender,
  ): AuthorityResult {
    const party = this.party;
    if (!party) return this.fail(token, "PARTY NOT FOUND");
    if (party.game?.status === "playing")
      return this.fail(token, "MATCH IN PROGRESS");
    let session = this.sessions.get(token),
      member =
        session &&
        party.members.find((candidate) => candidate.id === session!.id);
    if (
      session &&
      member &&
      (member.id === party.hostId || session.send !== undefined)
    )
      return this.fail(token, "PARTY SESSION IS ALREADY CONNECTED");
    if (session && member && session.expiresAt < Date.now()) {
      party.members = party.members.filter(
        (candidate) => candidate.id !== member!.id,
      );
      this.sessions.delete(token);
      this.lastInput.delete(member.id);
      session = undefined;
      member = undefined;
    }
    if (!member) {
      member = {
        id: randomId(),
        name: sanitizePartyName(name),
        title: "Rookie",
        avatarId: "helmet",
        preset,
        team: null,
        ready: false,
        connected: true,
      };
      const joined = joinPartyState(party, member);
      if (joined.error) return this.fail(token, joined.error);
      session = { id: member.id, token, expiresAt: Number.POSITIVE_INFINITY };
      this.sessions.set(token, session);
    } else {
      member.name = sanitizePartyName(name);
      member.preset = preset;
      member.connected = true;
      session!.expiresAt = Number.POSITIVE_INFINITY;
    }
    session!.send = send;
    this.publish();
    return { ok: true, reply: this.reply(session!.id) };
  }

  action(
    token: string,
    action:
      | LobbyActionMessage
      | { type: "leave" }
      | { type: "startMatch" }
      | { type: "endMatch" },
  ): AuthorityResult {
    const session = this.sessions.get(token),
      party = this.party;
    if (!session || !party) return this.fail(token, "JOIN A PARTY FIRST");
    if (action.type === "leave") return this.leave(session);
    if (action.type === "startMatch") return this.startMatch(session);
    if (action.type === "endMatch") {
      if (party.hostId !== session.id)
        return this.fail(token, "ONLY THE HOST CAN END THE MATCH");
      if (party.game) party.game.status = "finished";
      this.publish();
      return { ok: true, reply: this.reply(session.id) };
    }
    const changed = applyPartyLobbyAction(party, session.id, action);
    if (changed.error) return this.fail(token, changed.error);
    if (action.type === "kick") {
      const victim = [...this.sessions.values()].find(
        (candidate) => candidate.id === action.playerId,
      );
      if (victim) {
        victim.send?.({
          playerId: victim.id,
          party: null,
          notice: "YOU WERE REMOVED FROM THE PARTY",
        });
        this.sessions.delete(victim.token);
        this.lastInput.delete(victim.id);
      }
    }
    this.publish();
    return { ok: true, reply: this.reply(session.id) };
  }

  appearance(token: string, name: string, preset: Preset): AuthorityResult {
    const session = this.sessions.get(token),
      member = this.party?.members.find(
        (candidate) => candidate.id === session?.id,
      );
    if (!session || !member) return this.fail(token, "JOIN A PARTY FIRST");
    member.name = sanitizePartyName(name);
    member.preset = preset;
    this.publish();
    return { ok: true, reply: this.reply(session.id) };
  }

  gameUpdate(
    token: string,
    input: PlayerInput,
    snapshot?: MatchSnapshot,
  ): AuthorityResult {
    const session = this.sessions.get(token),
      party = this.party,
      game = party?.game;
    if (!session || !party || !game || game.status !== "playing")
      return this.fail(token, "NO ACTIVE MATCH");
    if (!game.players.some((player) => player.id === session.id))
      return this.fail(token, "NOT A MATCH PARTICIPANT");
    game.inputs[session.id] = input;
    this.lastInput.set(session.id, Date.now());
    if (snapshot !== undefined) {
      if (session.id !== party.hostId)
        return this.fail(token, "ONLY THE HOST CAN PUBLISH MATCH STATE");
      if (
        new TextEncoder().encode(JSON.stringify(snapshot)).length >
        MAX_SNAPSHOT_BYTES
      )
        return this.fail(token, "INVALID MATCH SNAPSHOT");
      if (!game.snapshot || snapshot.sequence > game.snapshot.sequence)
        game.snapshot = snapshot;
      if (snapshot.phase === "finished") game.status = "finished";
      this.publish();
    } else {
      const hostId = party.hostId;
      for (const listener of this.listeners) listener(this.reply(hostId));
    }
    return { ok: true, reply: this.reply(session.id) };
  }

  drop(token: string) {
    const session = this.sessions.get(token),
      member = this.party?.members.find(
        (candidate) => candidate.id === session?.id,
      );
    if (!session || !member || !this.party) return;
    session.send = undefined;
    if (member.id === this.party.hostId) {
      this.endForHostLeft();
      return;
    }
    member.connected = false;
    session.expiresAt = Date.now() + PARTY_REJOIN_MS;
    this.publish();
  }

  sweep(now = Date.now()) {
    const expired = [...this.sessions.values()].filter(
      (session) => session.send === undefined && session.expiresAt <= now,
    );
    if (!expired.length || !this.party) return;
    for (const session of expired) {
      this.party.members = this.party.members.filter(
        (member) => member.id !== session.id,
      );
      this.sessions.delete(session.token);
      this.lastInput.delete(session.id);
    }
    if (this.party.game?.status === "playing")
      this.party.game.status = "finished";
    this.publish();
  }

  destroy() {
    this.endForHostLeft();
  }

  private startMatch(session: Session): AuthorityResult {
    const party = this.party;
    if (!party || party.hostId !== session.id)
      return this.fail(session.token, "ONLY THE HOST CAN START THE MATCH");
    if (party.stage !== "teams")
      return this.fail(session.token, "CHOOSE TEAMS FIRST");
    if (party.game?.status === "playing")
      return this.fail(session.token, "MATCH ALREADY IN PROGRESS");
    const members = party.members,
      blue = members.filter((member) => member.team === 0).length,
      orange = members.filter((member) => member.team === 1).length;
    if (
      members.some((member) => member.team === null) ||
      (party.mode === "1v1" &&
        (members.length !== 2 || blue !== 1 || orange !== 1)) ||
      (party.mode === "2v2" && (members.length < 2 || !blue || !orange)) ||
      (party.mode === "2v2bots" && (!blue || orange))
    )
      return this.fail(session.token, "FILL BOTH SIDES BEFORE STARTING");
    const players: PartyGame["players"] = members.map((member) => ({
      id: member.id,
      name: member.name,
      preset: member.preset,
      team: member.team as 0 | 1,
    }));
    party.game = {
      id: randomId("match"),
      mode: party.mode as PartyMode,
      status: "playing",
      startedAt: Date.now() + 750,
      players,
      inputs: Object.fromEntries(players.map(({ id }) => [id, neutralInput()])),
      snapshot: null,
    };
    for (const player of players) this.lastInput.set(player.id, Date.now());
    this.publish();
    return { ok: true, reply: this.reply(session.id) };
  }

  private leave(session: Session): AuthorityResult {
    if (this.party?.hostId === session.id) {
      this.endForHostLeft();
      return {
        ok: true,
        reply: this.reply(session.id, "HOST LEFT — PARTY ENDED"),
      };
    }
    this.party!.members = this.party!.members.filter(
      (member) => member.id !== session.id,
    );
    if (this.party!.game?.status === "playing")
      this.party!.game.status = "finished";
    this.sessions.delete(session.token);
    this.lastInput.delete(session.id);
    this.publish();
    return {
      ok: true,
      reply: { ...this.reply(session.id), party: null },
    };
  }

  private endForHostLeft() {
    const oldParty = this.party;
    if (!oldParty) return;
    for (const session of this.sessions.values())
      session.send?.({ type: "host-left" });
    this.sessions.clear();
    this.lastInput.clear();
    this.party = null;
    for (const listener of this.listeners)
      listener({
        playerId: oldParty.hostId,
        party: null,
        notice: "HOST LEFT — PARTY ENDED",
      });
  }

  private fail(token: string, error: string): AuthorityResult {
    const session = this.sessions.get(token);
    return { ok: false, error, reply: this.reply(session?.id ?? "", error) };
  }

  private reply(playerId: string, notice = ""): PartyReply {
    const game = this.party?.game;
    if (game) {
      game.inputs = Object.fromEntries(
        game.players.map(({ id }) => [
          id,
          Date.now() - (this.lastInput.get(id) ?? 0) < 300
            ? (game.inputs[id] ?? neutralInput())
            : neutralInput(),
        ]),
      );
    }
    return {
      playerId,
      party: this.party ? clone(this.party) : null,
      notice,
    };
  }

  private publish() {
    for (const session of this.sessions.values()) {
      if (!session.send) continue;
      session.send(this.reply(session.id));
    }
    for (const listener of this.listeners) {
      const hostId = this.party?.hostId ?? "";
      listener(this.reply(hostId));
    }
  }
}
