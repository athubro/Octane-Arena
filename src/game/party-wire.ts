import { z } from "zod";
import { presetSchema } from "../../shared/accounts";
import {
  arenaFields,
  partyModes,
  validPartyCode,
  type ArenaField,
  type MatchSnapshot,
  type PartyMode,
  type PartyReply,
  type PartyStage,
  type PartyState,
} from "../../shared/party";
import type { PlayerInput } from "../../shared/player";

const modeSchema = z.enum(
  partyModes.map(({ id }) => id) as [PartyMode, ...PartyMode[]],
);
const stageSchema = z.enum(["home", "mode", "teams"] satisfies PartyStage[]);
const fieldSchema = z.enum(
  arenaFields.map(({ id }) => id) as [ArenaField, ...ArenaField[]],
);
const inputSchema = z
  .object({
    throttle: z.number().finite().min(-1).max(1),
    steer: z.number().finite().min(-1).max(1),
    pitch: z.number().finite().min(-1).max(1),
    yaw: z.number().finite().min(-1).max(1),
    roll: z.number().finite().min(-1).max(1),
    jump: z.boolean(),
    boost: z.boolean(),
    slide: z.boolean(),
    dodgeX: z.number().finite().min(-1).max(1).optional(),
    dodgeY: z.number().finite().min(-1).max(1).optional(),
  })
  .strict();
const vec3Schema = z.tuple([
  z.number().finite(),
  z.number().finite(),
  z.number().finite(),
]);
const quatSchema = z.tuple([
  z.number().finite(),
  z.number().finite(),
  z.number().finite(),
  z.number().finite(),
]);
const snapshotSchema = z
  .object({
    sequence: z.number().int().nonnegative(),
    phase: z.enum(["countdown", "playing", "goal", "paused", "finished"]),
    score: z.tuple([
      z.number().finite().nonnegative(),
      z.number().finite().nonnegative(),
    ]),
    remaining: z.number().finite(),
    countdown: z.number().finite(),
    freeze: z.number().finite(),
    goTime: z.number().finite(),
    overtime: z.boolean(),
    message: z.string().max(160),
    resetSequence: z.number().int().nonnegative(),
    lastGoal: z
      .object({
        scorerId: z.string().max(100),
        team: z.number().int().min(0).max(1),
        ownGoal: z.boolean(),
      })
      .strict()
      .nullable(),
    goalFocus: vec3Schema.nullable(),
    clock: z.number().finite(),
    lastTouchId: z.string().max(100).nullable(),
    ball: z
      .object({
        position: vec3Schema,
        rotation: quatSchema,
        velocity: vec3Schema,
        angularVelocity: vec3Schema,
        enabled: z.boolean(),
      })
      .strict(),
    cars: z
      .array(
        z
          .object({
            id: z.string().min(1).max(100),
            position: vec3Schema,
            rotation: quatSchema,
            velocity: vec3Schema,
            angularVelocity: vec3Schema,
            enabled: z.boolean(),
            boost: z.number().finite().min(0).max(100),
            boosting: z.boolean(),
            demolitionState: z.enum(["active", "demolished", "respawning"]),
            respawnTimer: z.number().finite(),
            supersonic: z.boolean(),
            forwardSpeed: z.number().finite(),
            steerAngle: z.number().finite(),
            grounded: z.boolean(),
            wheelOrigins: z.array(vec3Schema).length(4),
            wheelHits: z.array(vec3Schema).length(4),
            wheelContact: z.array(z.boolean()).length(4),
          })
          .strict(),
      )
      .min(1)
      .max(4),
    pads: z.array(z.number().finite()).max(30),
  })
  .strict();
const memberSchema = z
  .object({
    id: z.string().min(1).max(100),
    name: z.string().min(1).max(24),
    title: z.string().max(32),
    avatarId: z.string().max(32),
    preset: presetSchema,
    team: z.union([z.literal(0), z.literal(1), z.null()]),
    ready: z.boolean(),
    connected: z.boolean().optional(),
  })
  .strict();
const playerSchema = z
  .object({
    id: z.string().min(1).max(100),
    name: z.string().min(1).max(24),
    preset: presetSchema,
    team: z.union([z.literal(0), z.literal(1)]),
  })
  .strict();
const gameSchema = z
  .object({
    id: z.string().min(1).max(100),
    mode: modeSchema,
    status: z.enum(["playing", "finished"]),
    startedAt: z.number().finite(),
    players: z.array(playerSchema).min(1).max(4),
    inputs: z.record(z.string(), inputSchema),
    snapshot: snapshotSchema.nullable(),
  })
  .strict();
const partySchema = z
  .object({
    code: z.string().refine(validPartyCode),
    hostId: z.string().min(1).max(100),
    members: z.array(memberSchema).max(4),
    mode: modeSchema,
    field: fieldSchema,
    stage: stageSchema,
    game: gameSchema.nullable(),
  })
  .strict();
const replySchema = z
  .object({
    playerId: z.string().min(1).max(100),
    party: partySchema.nullable(),
    notice: z.string().max(200),
    sessionToken: z.string().max(128).optional(),
  })
  .strict();
const lobbyActionSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("team"),
      team: z.union([z.literal(0), z.literal(1), z.null()]),
    })
    .strict(),
  z.object({ type: z.literal("ready"), ready: z.boolean() }).strict(),
  z.object({ type: z.literal("mode"), mode: modeSchema }).strict(),
  z.object({ type: z.literal("field"), field: fieldSchema }).strict(),
  z.object({ type: z.literal("stage"), stage: stageSchema }).strict(),
  z
    .object({ type: z.literal("kick"), playerId: z.string().min(1).max(100) })
    .strict(),
]);
const partyActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("leave") }).strict(),
  z.object({ type: z.literal("lobby"), action: lobbyActionSchema }).strict(),
  z.object({ type: z.literal("startMatch") }).strict(),
  z.object({ type: z.literal("endMatch") }).strict(),
]);
const base = { requestId: z.string().min(1).max(64) };

export const partyWireSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("join"),
      token: z.string().min(16).max(128),
      name: z.string().max(96),
      preset: presetSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("action"),
      ...base,
      action: partyActionSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("appearance"),
      ...base,
      name: z.string().max(96),
      preset: presetSchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("gameUpdate"),
      ...base,
      input: inputSchema,
      snapshot: snapshotSchema.optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("result"),
      ...base,
      ok: z.boolean(),
      error: z.string().max(200).optional(),
      reply: replySchema.optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal("state"),
      reply: replySchema,
    })
    .strict(),
  z
    .object({
      type: z.literal("host-left"),
    })
    .strict(),
]);
export const manualSignalSchema = z
  .object({
    type: z.enum(["offer", "answer"]),
    sdp: z.string().min(1).max(32_000),
  })
  .strict();

export type PartyWireMessage = z.infer<typeof partyWireSchema>;
export type LobbyActionMessage = z.infer<typeof lobbyActionSchema>;
export type PartyActionWire = z.infer<typeof partyActionSchema>;
export type ManualSignal = z.infer<typeof manualSignalSchema>;
export type ValidPartyReply = PartyReply & { party: PartyState | null };
export type ValidPlayerInput = PlayerInput;
export type ValidMatchSnapshot = MatchSnapshot;
