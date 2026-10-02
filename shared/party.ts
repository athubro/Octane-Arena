import type { Preset } from "./catalog.js";
import type { PlayerInput, TeamId } from "./player.js";
export const partyAlphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const normalizePartyCode = (code: string) =>
  code.replace(/\s/g, "").toUpperCase();
export const validPartyCode = (code: string) =>
  /^[A-HJKMNP-Z2-9]{5,6}$/.test(code);
export type PartyMode = "1v1" | "2v2" | "2v2bots";
export type PartyStage = "home" | "mode" | "teams";
export const partyModes: { id: PartyMode; label: string }[] = [
  { id: "1v1", label: "1 VS 1" },
  { id: "2v2", label: "2 VS 2" },
  { id: "2v2bots", label: "2 VS 2 BOTS" },
];
export const teamCapacity = (mode: PartyMode, team: 0 | 1) =>
  mode === "2v2bots" && team === 1 ? 0 : mode === "1v1" ? 1 : 2;
export type PartyTeam = 0 | 1 | null;
export interface PartyMember {
  id: string;
  name: string;
  title: string;
  avatarId: string;
  preset: Preset;
  team: PartyTeam;
  ready: boolean;
}
export type MatchPhase =
  | "countdown"
  | "playing"
  | "goal"
  | "paused"
  | "finished";
export type Vec3Tuple = [number, number, number];
export type QuatTuple = [number, number, number, number];
export interface NetworkCarSnapshot {
  id: string;
  position: Vec3Tuple;
  rotation: QuatTuple;
  velocity: Vec3Tuple;
  angularVelocity: Vec3Tuple;
  enabled: boolean;
  boost: number;
  boosting: boolean;
  demolitionState: "active" | "demolished" | "respawning";
  respawnTimer: number;
  supersonic: boolean;
  forwardSpeed: number;
  steerAngle: number;
  grounded: boolean;
  wheelOrigins: Vec3Tuple[];
  wheelHits: Vec3Tuple[];
  wheelContact: boolean[];
}
export interface MatchSnapshot {
  sequence: number;
  phase: MatchPhase;
  score: [number, number];
  remaining: number;
  countdown: number;
  freeze: number;
  goTime: number;
  overtime: boolean;
  message: string;
  resetSequence: number;
  lastGoal: { scorerId: string; team: number; ownGoal: boolean } | null;
  goalFocus: Vec3Tuple | null;
  clock: number;
  lastTouchId: string | null;
  ball: {
    position: Vec3Tuple;
    rotation: QuatTuple;
    velocity: Vec3Tuple;
    angularVelocity: Vec3Tuple;
    enabled: boolean;
  };
  cars: NetworkCarSnapshot[];
  pads: number[];
}
export interface PartyGame {
  id: string;
  mode: PartyMode;
  status: "playing" | "finished";
  startedAt: number;
  players: (Pick<PartyMember, "id" | "name" | "preset"> & {
    team: TeamId;
  })[];
  inputs: Record<string, PlayerInput>;
  snapshot: MatchSnapshot | null;
}
export interface PartyState {
  code: string;
  hostId: string;
  members: PartyMember[];
  mode: PartyMode;
  stage: PartyStage;
  game: PartyGame | null;
}
export interface PartyReply {
  playerId: string;
  party: PartyState | null;
  notice: string;
  sessionToken?: string;
}
export interface PartyActions {
  create: Record<string, never>;
  join: { code: string };
  leave: Record<string, never>;
  kick: { playerId: string };
  team: { team: PartyTeam };
  ready: { ready: boolean };
  mode: { mode: PartyMode };
  stage: { stage: PartyStage };
  disconnect: Record<string, never>;
  startMatch: Record<string, never>;
  endMatch: Record<string, never>;
}
