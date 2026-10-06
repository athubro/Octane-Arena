import type {
  PartyMember,
  ArenaField,
  PartyMode,
  PartyStage,
  PartyState,
} from "./party.js";
import { arenaFields } from "./party.js";

export type PartyLobbyAction =
  | { type: "team"; team: PartyMember["team"] }
  | { type: "ready"; ready: boolean }
  | { type: "mode"; mode: PartyMode }
  | { type: "field"; field: ArenaField }
  | { type: "stage"; stage: PartyStage }
  | { type: "kick"; playerId: string };

export interface PartyRuleResult {
  error?: string;
  status?: number;
}

export function sanitizePartyName(value: unknown, fallback = "Guest") {
  if (typeof value !== "string") return fallback;
  const name = Array.from(value.replace(/[\p{Cc}\p{Cf}]/gu, "").trim())
    .slice(0, 24)
    .join("");
  return name || fallback;
}

export function joinPartyState(
  party: PartyState,
  member: PartyMember,
): PartyRuleResult {
  if (party.game?.status === "playing")
    return { status: 409, error: "MATCH IN PROGRESS" };
  if (party.members.some((candidate) => candidate.id === member.id)) return {};
  if (party.members.length >= 4) return { status: 409, error: "PARTY FULL" };
  if (
    party.stage === "teams" &&
    party.mode !== "2v2" &&
    party.members.length >= 2
  )
    return { status: 409, error: "THIS MODE HAS TWO PLAYER SLOTS" };
  member.team =
    party.stage === "teams"
      ? null
      : (([0, 1] as const).find(
          (team) =>
            party.members.filter((candidate) => candidate.team === team)
              .length <
            (party.mode === "2v2bots" && team === 1
              ? 0
              : party.mode === "1v1"
                ? 1
                : 2),
        ) ?? null);
  member.ready = false;
  member.connected = true;
  party.members.push(member);
  return {};
}

export function applyPartyLobbyAction(
  party: PartyState,
  actorId: string,
  action: PartyLobbyAction,
): PartyRuleResult {
  const actor = party.members.find((member) => member.id === actorId);
  if (!actor) return { status: 403, error: "NOT A PARTY MEMBER" };
  if (party.game?.status === "playing")
    return { status: 409, error: "MATCH IN PROGRESS" };

  if (action.type === "team") {
    if (action.team !== null && action.team !== 0 && action.team !== 1)
      return { status: 400, error: "INVALID TEAM" };
    if (
      action.team !== null &&
      party.members.filter(
        (member) => member.id !== actorId && member.team === action.team,
      ).length >=
        (party.mode === "2v2bots" && action.team === 1
          ? 0
          : party.mode === "1v1"
            ? 1
            : 2)
    )
      return { status: 409, error: "TEAM FULL" };
    actor.team = action.team;
    actor.ready = false;
    return {};
  }

  if (action.type === "ready") {
    if (typeof action.ready !== "boolean")
      return { status: 400, error: "INVALID READY STATE" };
    if (action.ready && actor.team === null)
      return { status: 409, error: "CHOOSE A TEAM FIRST" };
    actor.ready = action.ready;
    return {};
  }

  if (party.hostId !== actorId) {
    return {
      status: 403,
      error:
        action.type === "kick"
          ? "ONLY THE HOST CAN KICK"
          : action.type === "mode"
            ? "ONLY THE HOST CAN CHANGE MODE"
            : "ONLY THE HOST CAN CONTINUE",
    };
  }

  if (action.type === "kick") {
    if (action.playerId === actorId)
      return { status: 400, error: "CANNOT KICK YOURSELF" };
    const target = party.members.find(
      (member) => member.id === action.playerId,
    );
    if (!target) return { status: 404, error: "PLAYER NOT FOUND" };
    if (target.id === party.hostId)
      return { status: 400, error: "CANNOT KICK THE HOST" };
    party.members = party.members.filter(
      (member) => member.id !== action.playerId,
    );
    return {};
  }

  if (action.type === "mode") {
    if (!["1v1", "2v2", "2v2bots"].includes(action.mode))
      return { status: 400, error: "INVALID MODE" };
    if (party.stage === "teams")
      return { status: 409, error: "RETURN TO MODE SELECTION FIRST" };
    party.mode = action.mode;
    const counts = [0, 0];
    for (const member of party.members) {
      member.ready = false;
      if (
        member.team !== null &&
        ++counts[member.team] > capacity(action.mode, member.team)
      )
        member.team = null;
    }
    return {};
  }

  if (action.type === "field") {
    if (!arenaFields.some(({ id }) => id === action.field))
      return { status: 400, error: "INVALID FIELD" };
    party.field = action.field;
    return {};
  }

  if (action.type === "stage") {
    if (!["home", "mode", "teams"].includes(action.stage))
      return { status: 400, error: "INVALID LOBBY STAGE" };
    if (action.stage === "teams" && party.stage !== "mode")
      return { status: 409, error: "CHOOSE A MODE FIRST" };
    if (
      action.stage === "teams" &&
      party.mode !== "2v2" &&
      party.members.length > 2
    )
      return { status: 409, error: "CHOOSE 2 VS 2 FOR MORE THAN TWO PLAYERS" };
    if (action.stage === "teams")
      for (const member of party.members) {
        member.team = null;
        member.ready = false;
      }
    party.stage = action.stage;
    return {};
  }
  return {};
}

function capacity(mode: PartyMode, team: 0 | 1) {
  return mode === "2v2bots" && team === 1 ? 0 : mode === "1v1" ? 1 : 2;
}
