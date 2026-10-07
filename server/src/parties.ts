import type { FastifyInstance, FastifyRequest } from "fastify";
import { randomBytes, randomInt, randomUUID } from "node:crypto";
import {
  presetSchema,
  titles,
  type AccountData,
} from "../../shared/accounts.js";
import {
  arenaFields,
  partyAlphabet,
  partyModes,
  teamCapacity,
  normalizePartyCode,
  validPartyCode,
  type PartyMember,
  type PartyState,
  type PartyActions,
  type PartyReply,
  type PartyGame,
  type MatchSnapshot,
  type Vec3Tuple,
  type QuatTuple,
} from "../../shared/party.js";
import { neutralInput, type PlayerInput } from "../../shared/player.js";
import { starter } from "../../shared/catalog.js";
import type { ServerConfig } from "./config.js";
type Player = {
  member: PartyMember;
  code: string | null;
  seen: number;
  notice: string;
};
const vector = (value: unknown): value is Vec3Tuple =>
  Array.isArray(value) &&
  value.length === 3 &&
  value.every((n) => typeof n === "number" && Number.isFinite(n));
const quaternion = (value: unknown): value is QuatTuple =>
  Array.isArray(value) &&
  value.length === 4 &&
  value.every((n) => typeof n === "number" && Number.isFinite(n));
const validSnapshot = (value: unknown): value is MatchSnapshot => {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<MatchSnapshot>;
  const phases = ["countdown", "playing", "goal", "paused", "finished"];
  const ball = snapshot.ball;
  if (
    !Number.isSafeInteger(snapshot.sequence) ||
    !phases.includes(snapshot.phase ?? "") ||
    !Array.isArray(snapshot.score) ||
    snapshot.score.length !== 2 ||
    !snapshot.score.every((n) => Number.isFinite(n) && n >= 0) ||
    ![
      snapshot.remaining,
      snapshot.countdown,
      snapshot.freeze,
      snapshot.goTime,
      snapshot.clock,
    ].every((n) => typeof n === "number" && Number.isFinite(n)) ||
    !Number.isSafeInteger(snapshot.resetSequence) ||
    typeof snapshot.overtime !== "boolean" ||
    typeof snapshot.message !== "string" ||
    snapshot.message.length > 160 ||
    !(
      snapshot.lastTouchId === null || typeof snapshot.lastTouchId === "string"
    ) ||
    !(
      snapshot.lastGoal === null ||
      (typeof snapshot.lastGoal === "object" &&
        typeof snapshot.lastGoal.scorerId === "string" &&
        snapshot.lastGoal.scorerId.length <= 100 &&
        (snapshot.lastGoal.team === 0 || snapshot.lastGoal.team === 1) &&
        typeof snapshot.lastGoal.ownGoal === "boolean")
    ) ||
    !(snapshot.goalFocus === null || vector(snapshot.goalFocus)) ||
    !ball ||
    !vector(ball.position) ||
    !quaternion(ball.rotation) ||
    !vector(ball.velocity) ||
    !vector(ball.angularVelocity) ||
    typeof ball.enabled !== "boolean" ||
    !Array.isArray(snapshot.cars) ||
    snapshot.cars.length < 1 ||
    snapshot.cars.length > 4 ||
    !Array.isArray(snapshot.pads) ||
    snapshot.pads.length > 30 ||
    !snapshot.pads.every((n) => typeof n === "number" && Number.isFinite(n))
  )
    return false;
  return snapshot.cars.every(
    (car) =>
      car !== null &&
      typeof car === "object" &&
      typeof car.id === "string" &&
      car.id.length > 0 &&
      car.id.length <= 100 &&
      vector(car.position) &&
      quaternion(car.rotation) &&
      vector(car.velocity) &&
      vector(car.angularVelocity) &&
      typeof car.enabled === "boolean" &&
      typeof car.boost === "number" &&
      Number.isFinite(car.boost) &&
      car.boost >= 0 &&
      car.boost <= 100 &&
      typeof car.boosting === "boolean" &&
      ["active", "demolished", "respawning"].includes(car.demolitionState) &&
      typeof car.respawnTimer === "number" &&
      Number.isFinite(car.respawnTimer) &&
      typeof car.supersonic === "boolean" &&
      typeof car.forwardSpeed === "number" &&
      Number.isFinite(car.forwardSpeed) &&
      typeof car.steerAngle === "number" &&
      Number.isFinite(car.steerAngle) &&
      typeof car.grounded === "boolean" &&
      Array.isArray(car.wheelOrigins) &&
      car.wheelOrigins.length === 4 &&
      car.wheelOrigins.every(vector) &&
      Array.isArray(car.wheelHits) &&
      car.wheelHits.length === 4 &&
      car.wheelHits.every(vector) &&
      Array.isArray(car.wheelContact) &&
      car.wheelContact.length === 4 &&
      car.wheelContact.every((contact) => typeof contact === "boolean"),
  );
};
export function registerParties(
  app: FastifyInstance,
  config: ServerConfig,
  account: (req: FastifyRequest) => AccountData | null,
) {
  const players = new Map<string, Player>(),
    parties = new Map<string, PartyState>();
  const cookieName = config.production ? "__Host-oa_party" : "oa_party";
  const tokenFor = (req: FastifyRequest) =>
    typeof req.headers["x-arena-party"] === "string"
      ? req.headers["x-arena-party"]
      : (req.cookies[cookieName] ?? "");
  const fail = (status: number, message: string) => {
    throw Object.assign(new Error(message), {
      statusCode: status,
      partyFault: true,
    });
  };
  const leave = (p: Player) => {
    const party = p.code ? parties.get(p.code) : null;
    p.code = null;
    p.member.ready = false;
    p.member.team = null;
    if (!party) return;
    if (party.game?.status === "playing") party.game.status = "finished";
    party.members = party.members.filter((m) => m.id !== p.member.id);
    if (!party.members.length) {
      parties.delete(party.code);
      inputSeen.delete(party.code);
    } else if (party.hostId === p.member.id) party.hostId = party.members[0].id;
  };
  const prune = () => {
    for (const [token, p] of players)
      if (Date.now() - p.seen > 45000) {
        leave(p);
        players.delete(token);
      }
  };
  const timer = setInterval(prune, 5000);
  timer.unref();
  app.addHook("onClose", async () => clearInterval(timer));
  const get = (req: FastifyRequest) => {
    prune();
    const p = players.get(tokenFor(req));
    if (!p) return fail(401, "PARTY SESSION EXPIRED");
    p.seen = Date.now();
    return p;
  };
  const refresh = (p: Player, req: FastifyRequest, preset: unknown) => {
    const parsed = presetSchema.safeParse(preset);
    if (!parsed.success) return fail(400, "INVALID CAR PRESET");
    const a = account(req);
    if (a)
      for (const key of [
        "body",
        "wheels",
        "boost",
        "topper",
        "decal",
        "explosion",
      ] as const)
        if (!a.owned[key]?.includes(parsed.data[key]))
          return fail(403, "COSMETIC NOT OWNED");
    Object.assign(p.member, {
      name: a?.username ?? "Guest",
      title: titles.find((t) => t.id === a?.titleId)?.name ?? "Rookie",
      avatarId: a?.avatarId ?? "helmet",
      preset: parsed.data,
    });
  };
  const inputSeen = new Map<string, Map<string, number>>();
  const state = (p: Player): PartyReply => {
    const party = p.code ? (parties.get(p.code) ?? null) : null;
    if (party?.game) {
      const seen = inputSeen.get(party.code);
      party.game.inputs = Object.fromEntries(
        party.game.players.map(({ id }) => [
          id,
          seen && Date.now() - (seen.get(id) ?? 0) < 300
            ? (party.game!.inputs[id] ?? neutralInput())
            : neutralInput(),
        ]),
      );
    }
    return {
      playerId: p.member.id,
      party,
      notice: p.notice,
    };
  };
  app.post(
    "/api/party/session",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (req, reply) => {
      prune();
      let token = (req.body as { newSession?: boolean })?.newSession
          ? ""
          : tokenFor(req),
        p = token ? players.get(token) : undefined;
      if (!p) {
        if (players.size >= 10000) return fail(503, "PARTY SERVICE BUSY");
        token = randomBytes(32).toString("base64url");
        p = {
          member: {
            id: randomUUID(),
            name: "Guest",
            title: "Rookie",
            avatarId: "helmet",
            preset: starter(),
            team: null,
            ready: false,
          },
          code: null,
          seen: Date.now(),
          notice: "",
        };
        players.set(token!, p);
      }
      refresh(p, req, (req.body as { preset?: unknown })?.preset);
      p.seen = Date.now();
      reply.setCookie(cookieName, token!, {
        httpOnly: true,
        secure: config.production,
        sameSite: config.production ? "none" : "lax",
        partitioned: config.production,
        path: "/",
        maxAge: 86400,
      });
      return { ...state(p), sessionToken: token };
    },
  );
  app.get("/api/party", async (req) => state(get(req)));
  // Server-sent lobby snapshots: updates arrive without waiting for the
  // recovery poll. Inputs and physics never travel on this channel.
  const streams = new Set<() => void>();
  app.addHook("preClose", async () => {
    for (const close of streams) close();
  });
  app.get("/api/party/events", async (req, reply) => {
    const p = get(req);
    for (const [key, value] of Object.entries(reply.getHeaders()))
      if (value !== undefined) reply.raw.setHeader(key, value);
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    reply.hijack();
    let previous = "",
      heartbeat = 0;
    const publish = () => {
      // Only incoming client requests renew presence; a half-open stream must
      // not keep a disconnected player in the party forever.
      if (players.get(tokenFor(req)) !== p) {
        close();
        return;
      }
      const data = JSON.stringify(state(p));
      if (data !== previous) {
        reply.raw.write(`data: ${data}\n\n`);
        previous = data;
      } else if (++heartbeat % 40 === 0) reply.raw.write(": heartbeat\n\n");
    };
    const interval = setInterval(publish, 100);
    const close = () => {
      clearInterval(interval);
      streams.delete(close);
      reply.raw.end();
    };
    streams.add(close);
    reply.raw.on("close", close);
    publish();
  });
  app.post("/api/party/create", async (req) => {
    const p = get(req);
    if (p.code) return state(p);
    let code: string;
    do {
      code = Array.from(
        { length: 6 },
        () => partyAlphabet[randomInt(partyAlphabet.length)],
      ).join("");
    } while (parties.has(code));
    p.code = code;
    p.notice = "";
    p.member.team = 0;
    p.member.ready = false;
    parties.set(code, {
      code,
      hostId: p.member.id,
      members: [p.member],
      mode: "1v1",
      field: "lumen",
      stage: "home",
      game: null,
    });
    return state(p);
  });
  app.post("/api/party/join", async (req) => {
    const p = get(req),
      raw = (req.body as { code?: unknown })?.code;
    if (typeof raw !== "string" || raw.length > 32)
      return fail(400, "INVALID CODE");
    const code = normalizePartyCode(raw);
    if (!validPartyCode(code)) return fail(400, "INVALID CODE");
    const party = parties.get(code);
    if (!party) return fail(404, "PARTY NOT FOUND");
    if (party.game?.status === "playing") return fail(409, "MATCH IN PROGRESS");
    if (p.code === code) return state(p);
    if (party.members.length >= 4) return fail(409, "PARTY FULL");
    if (
      party.stage === "teams" &&
      party.mode !== "2v2" &&
      party.members.length >= 2
    )
      return fail(409, "THIS MODE HAS TWO PLAYER SLOTS");
    leave(p);
    p.code = code;
    p.notice = "";
    p.member.team =
      party.stage === "teams"
        ? null
        : (([0, 1] as const).find(
            (team) =>
              party.members.filter((m) => m.team === team).length <
              teamCapacity(party.mode, team),
          ) ?? null);
    party.members.push(p.member);
    return state(p);
  });
  app.post("/api/party/leave", async (req) => {
    const p = get(req);
    leave(p);
    p.notice = "";
    return state(p);
  });
  app.post("/api/party/kick", async (req) => {
    const p = get(req),
      party = p.code ? parties.get(p.code) : null;
    if (!party || party.hostId !== p.member.id)
      return fail(403, "ONLY THE HOST CAN KICK");
    const target = (req.body as { playerId?: unknown })?.playerId;
    if (target === p.member.id) return fail(400, "CANNOT KICK YOURSELF");
    const victim = Array.from(players.values()).find(
      (v) => v.member.id === target && v.code === party.code,
    );
    if (!victim) return fail(404, "PLAYER NOT FOUND");
    leave(victim);
    victim.notice = "YOU WERE REMOVED FROM THE PARTY";
    return state(p);
  });
  app.put("/api/party/appearance", async (req) => {
    const p = get(req);
    refresh(p, req, (req.body as { preset?: unknown })?.preset);
    return state(p);
  });
  app.post("/api/party/team", async (req) => {
    const p = get(req),
      party = p.code ? parties.get(p.code) : null,
      team = (req.body as PartyActions["team"])?.team;
    if (!party) return fail(409, "JOIN A PARTY FIRST");
    if (party.game?.status === "playing") return fail(409, "MATCH IN PROGRESS");
    if (team !== null && team !== 0 && team !== 1)
      return fail(400, "INVALID TEAM");
    if (
      team !== null &&
      party.members.filter((m) => m.id !== p.member.id && m.team === team)
        .length >= teamCapacity(party.mode, team)
    )
      return fail(409, "TEAM FULL");
    p.member.team = team;
    p.member.ready = false;
    return state(p);
  });
  app.post("/api/party/ready", async (req) => {
    const p = get(req),
      ready = (req.body as PartyActions["ready"])?.ready;
    if (!p.code) return fail(409, "JOIN A PARTY FIRST");
    if (typeof ready !== "boolean") return fail(400, "INVALID READY STATE");
    if (ready && p.member.team === null)
      return fail(409, "CHOOSE A TEAM FIRST");
    p.member.ready = ready;
    return state(p);
  });
  app.post("/api/party/mode", async (req) => {
    const p = get(req),
      party = p.code ? parties.get(p.code) : null,
      mode = (req.body as PartyActions["mode"])?.mode;
    if (!party || party.hostId !== p.member.id)
      return fail(403, "ONLY THE HOST CAN CHANGE MODE");
    if (party.game?.status === "playing") return fail(409, "MATCH IN PROGRESS");
    if (!partyModes.some((m) => m.id === mode))
      return fail(400, "INVALID MODE");
    if (party.stage === "teams")
      return fail(409, "RETURN TO MODE SELECTION FIRST");
    party.mode = mode;
    const counts = [0, 0];
    for (const m of party.members) {
      m.ready = false;
      if (m.team !== null && ++counts[m.team] > teamCapacity(mode, m.team))
        m.team = null;
    }
    return state(p);
  });
  app.post("/api/party/field", async (req) => {
    const p = get(req),
      party = p.code ? parties.get(p.code) : null,
      field = (req.body as PartyActions["field"])?.field;
    if (!party || party.hostId !== p.member.id)
      return fail(403, "ONLY THE HOST CAN CHANGE THE FIELD");
    if (party.game?.status === "playing") return fail(409, "MATCH IN PROGRESS");
    if (!arenaFields.some(({ id }) => id === field))
      return fail(400, "INVALID FIELD");
    party.field = field;
    return state(p);
  });
  app.post("/api/party/stage", async (req) => {
    const p = get(req),
      party = p.code ? parties.get(p.code) : null;
    if (!party || party.hostId !== p.member.id)
      return fail(403, "ONLY THE HOST CAN CONTINUE");
    if (party.game?.status === "playing") return fail(409, "MATCH IN PROGRESS");
    const stage = (req.body as PartyActions["stage"])?.stage;
    if (stage !== "home" && stage !== "mode" && stage !== "teams")
      return fail(400, "INVALID LOBBY STAGE");
    if (stage === "teams" && party.stage !== "mode")
      return fail(409, "CHOOSE A MODE FIRST");
    if (stage === "teams" && party.mode !== "2v2" && party.members.length > 2)
      return fail(409, "CHOOSE 2 VS 2 FOR MORE THAN TWO PLAYERS");
    if (stage === "teams")
      for (const m of party.members) {
        m.team = null;
        m.ready = false;
      }
    party.stage = stage;
    return state(p);
  });
  app.post("/api/party/game/start", async (req) => {
    const p = get(req),
      party = p.code ? parties.get(p.code) : null;
    if (!party || party.hostId !== p.member.id)
      return fail(403, "ONLY THE HOST CAN START THE MATCH");
    if (party.stage !== "teams") return fail(409, "CHOOSE TEAMS FIRST");
    if (party.game?.status === "playing")
      return fail(409, "MATCH ALREADY IN PROGRESS");
    const members = party.members,
      assigned = members.every((m) => m.team !== null),
      blue = members.filter((m) => m.team === 0).length,
      orange = members.filter((m) => m.team === 1).length;
    if (
      !assigned ||
      (party.mode === "1v1" &&
        (members.length !== 2 || blue !== 1 || orange !== 1)) ||
      (party.mode === "heatseeker" &&
        (members.length !== 2 || blue !== 1 || orange !== 1)) ||
      (party.mode === "2v2" && (members.length < 2 || !blue || !orange)) ||
      (party.mode === "2v2bots" && (!blue || orange))
    )
      return fail(409, "FILL BOTH SIDES BEFORE STARTING");
    const players: PartyGame["players"] = members.map((m) => ({
      id: m.id,
      name: m.name,
      preset: m.preset,
      team: m.team!,
    }));
    party.game = {
      id: randomUUID(),
      mode: party.mode,
      status: "playing",
      startedAt: Date.now() + 750,
      players,
      inputs: Object.fromEntries(players.map(({ id }) => [id, neutralInput()])),
      snapshot: null,
    };
    inputSeen.set(
      party.code,
      new Map(players.map(({ id }) => [id, Date.now()])),
    );
    return state(p);
  });
  app.post(
    "/api/party/game/input",
    { config: { rateLimit: { max: 6000, timeWindow: "1 minute" } } },
    async (req) => {
      const p = get(req),
        party = p.code ? parties.get(p.code) : null,
        game = party?.game,
        body = req.body as { input?: unknown; snapshot?: unknown };
      if (!party || !game || game.status !== "playing")
        return fail(409, "NO ACTIVE MATCH");
      const player = game.players.find((member) => member.id === p.member.id);
      if (!player) return fail(403, "NOT A MATCH PARTICIPANT");
      const raw = body?.input;
      if (
        !raw ||
        typeof raw !== "object" ||
        !["throttle", "steer", "pitch", "yaw", "roll"].every(
          (key) =>
            typeof (raw as Record<string, unknown>)[key] === "number" &&
            Number.isFinite((raw as Record<string, number>)[key]) &&
            Math.abs((raw as Record<string, number>)[key]) <= 1,
        ) ||
        !["jump", "boost", "slide"].every(
          (key) => typeof (raw as Record<string, unknown>)[key] === "boolean",
        ) ||
        ["dodgeX", "dodgeY"].some(
          (key) =>
            (raw as Record<string, unknown>)[key] !== undefined &&
            (typeof (raw as Record<string, unknown>)[key] !== "number" ||
              !Number.isFinite((raw as Record<string, number>)[key]) ||
              Math.abs((raw as Record<string, number>)[key]) > 1),
        )
      )
        return fail(400, "INVALID MATCH INPUT");
      game.inputs[p.member.id] = raw as PlayerInput;
      inputSeen.get(party.code)?.set(p.member.id, Date.now());
      if (body.snapshot !== undefined) {
        if (p.member.id !== party.hostId)
          return fail(403, "ONLY THE HOST CAN PUBLISH MATCH STATE");
        const snapshot = body.snapshot;
        if (
          !validSnapshot(snapshot) ||
          Buffer.byteLength(JSON.stringify(snapshot)) > 24000
        )
          return fail(400, "INVALID MATCH SNAPSHOT");
        if (!game.snapshot || snapshot.sequence > game.snapshot.sequence)
          game.snapshot = snapshot;
        if (snapshot.phase === "finished") game.status = "finished";
      }
      return state(p);
    },
  );
  app.post("/api/party/game/end", async (req) => {
    const p = get(req),
      party = p.code ? parties.get(p.code) : null;
    if (!party || party.hostId !== p.member.id)
      return fail(403, "ONLY THE HOST CAN END THE MATCH");
    if (party.game) party.game.status = "finished";
    return state(p);
  });
  app.post("/api/party/disconnect", async (req) => {
    const p = get(req);
    leave(p);
    p.notice = "";
    return state(p);
  });
}
