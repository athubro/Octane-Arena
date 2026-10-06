import { P } from "../config/physics";
import type { Simulation } from "../physics/simulation";
import type { Match } from "./match";
import { scoringTeam } from "./goals";

export interface TrainingShot {
  carX: number;
  carZ: number;
  carYaw: number;
  ballX: number;
  ballY: number;
  ballZ: number;
  ballVX: number;
  ballVY: number;
  ballVZ: number;
  goalTeam: number;
  timer: number;
  cannon: boolean;
}

export interface TrainingPack {
  id: string;
  name: string;
  tier: string;
  description: string;
  difficulty: number;
  shots: TrainingShot[];
}

export interface TrainingPackRecord {
  best: number;
  last: number;
}

export type TrainingPackRecords = Record<string, TrainingPackRecord>;

const timerBases = [
  18, 17.25, 16.5, 15.75, 15, 14.25, 13.5, 12.75, 12, 11.25, 10.5,
];
const packNames = [
  ["Rookie Warmup", "EASY", "Clean ground shots with generous time."],
  ["First Touch", "EASY", "Build accuracy from varied starting lanes."],
  ["Angle School", "CASUAL", "Pick your line around changing ball positions."],
  ["Moving Targets", "CASUAL", "Read rolling balls and strike through them."],
  [
    "Aerial Class",
    "INTERMEDIATE",
    "Take off early and meet the ball in the air.",
  ],
  ["Crossbar Lab", "ADVANCED", "Control elevated shots under tighter clocks."],
  ["Wall Reads", "HARD", "Recover awkward wall passes and rebounds."],
  [
    "Air Control",
    "VERY HARD",
    "Track fast cannon launches and aerial crosses.",
  ],
  [
    "Pressure Cooker",
    "VERY HARD",
    "Short clocks, sharp angles, and late reads.",
  ],
  ["Overtime Trials", "PRO", "Eleven demanding shots with the least time."],
] as const;

function makeShot(difficulty: number, index: number): TrainingShot {
  const kind = index,
    goalTeam = (difficulty * 3 + index * 2) % 7 === 0 ? 1 : 0,
    goalSign = goalTeam === 0 ? -1 : 1,
    depth = Math.max(
      4.5,
      11 + ((index * 7) % 20) + difficulty * 0.72 - (kind === 8 ? 10 : 0),
    ),
    lane = ((index * 5 + difficulty * 3) % 7) - 3,
    edgeSign = index % 2 === 0 ? 1 : -1;
  let ballX = lane * (1.7 + difficulty * 0.22),
    ballY = P.ball.radius,
    ballVX = 0,
    ballVY = 0,
    ballVZ = 0,
    cannon = false;
  const ballZ = -goalSign * depth;

  if (kind === 1) {
    ballX += edgeSign * 3;
    ballVX = -edgeSign * (2.2 + difficulty * 0.52);
    ballVZ = goalSign * (1.5 + difficulty * 0.22);
  } else if (kind === 2) {
    ballX = edgeSign * (23 + difficulty * 0.85);
    ballVX = -edgeSign * (2.5 + difficulty * 0.42);
    ballVZ = goalSign * (2.2 + difficulty * 0.28);
  } else if (kind === 3) {
    ballY = 2.1 + difficulty * 0.24;
    ballVY = 0.8 + difficulty * 0.16;
    ballVZ = goalSign * (1 + difficulty * 0.24);
  } else if (kind === 4) {
    cannon = true;
    ballX += edgeSign * 5;
    ballY = 1.45 + difficulty * 0.12;
    ballVX = edgeSign * (4.5 + difficulty * 0.62);
    ballVY = 2.2 + difficulty * 0.38;
    ballVZ = goalSign * (5 + difficulty * 0.65);
  } else if (kind === 5) {
    ballX = edgeSign * (7 + difficulty * 0.8);
    ballVX = -edgeSign * (1 + difficulty * 0.2);
    ballVZ = goalSign * (4 + difficulty * 0.72);
  } else if (kind === 6) {
    ballY = 3.3 + difficulty * 0.19;
    ballX += edgeSign * 3.5;
    ballVX = -edgeSign * (1.3 + difficulty * 0.38);
    ballVY = -0.8;
    ballVZ = goalSign * (2 + difficulty * 0.36);
  } else if (kind === 7) {
    cannon = true;
    ballY = 1.5 + difficulty * 0.1;
    ballVX = edgeSign * (2 + difficulty * 0.4);
    ballVY = 5 + difficulty * 0.58;
    ballVZ = goalSign * (4 + difficulty * 0.58);
  } else if (kind === 8) {
    ballX = edgeSign * (15 + difficulty * 0.8);
    ballY = 2.3 + difficulty * 0.16;
    ballVY = -0.5;
    ballVZ = -goalSign * (3.5 + difficulty * 0.38);
  } else if (kind === 9) {
    cannon = true;
    ballX += edgeSign * 6;
    ballY = 1.2 + difficulty * 0.13;
    ballVX = -edgeSign * (5 + difficulty * 0.58);
    ballVY = 2 + difficulty * 0.32;
    ballVZ = goalSign * (8 + difficulty * 0.86);
  } else if (kind === 10) {
    ballX = edgeSign * (21 + difficulty * 0.75);
    ballY = 3.5 + difficulty * 0.17;
    ballVX = -edgeSign * (3 + difficulty * 0.42);
    ballVY = -1.2;
    ballVZ = goalSign * (4 + difficulty * 0.48);
  }

  const targetX =
      (((index * 3 + difficulty) % 5) - 2) * (1.5 + difficulty * 0.3),
    targetZ = goalSign * (P.arena.halfLength + 3) - ballZ,
    aimLength = Math.hypot(targetX - ballX, targetZ) || 1,
    dirX = (targetX - ballX) / aimLength,
    dirZ = targetZ / aimLength,
    sideX = -dirZ,
    sideZ = dirX,
    startDistance =
      7.5 + difficulty * 0.55 + (kind === 6 || kind === 7 ? 1.5 : 0),
    sideOffset = (((index + difficulty) % 3) - 1) * (0.7 + difficulty * 0.12),
    carX = Math.max(
      -P.arena.halfWidth + 5,
      Math.min(
        P.arena.halfWidth - 5,
        ballX - dirX * startDistance + sideX * sideOffset,
      ),
    ),
    carZ = Math.max(
      -P.arena.halfLength + 7,
      Math.min(
        P.arena.halfLength - 7,
        ballZ - dirZ * startDistance + sideZ * sideOffset,
      ),
    ),
    timer = Math.round((timerBases[index] - difficulty * 0.48) * 10) / 10;

  return {
    carX,
    carZ,
    carYaw: Math.atan2(-dirX, -dirZ),
    ballX,
    ballY,
    ballZ,
    ballVX,
    ballVY,
    ballVZ,
    goalTeam,
    timer,
    cannon,
  };
}

export const TRAINING_PACKS: TrainingPack[] = packNames.map(
  ([name, tier, description], difficulty) => ({
    id: `training-${String(difficulty + 1).padStart(2, "0")}`,
    name,
    tier,
    description,
    difficulty: difficulty + 1,
    shots: Array.from({ length: 11 }, (_, index) =>
      makeShot(difficulty, index),
    ),
  }),
);

const SCORE_COOKIE = "octane-arena-training-scores";

export function readTrainingPackRecords(): TrainingPackRecords {
  const records: TrainingPackRecords = {};
  if (typeof document === "undefined") return records;
  try {
    const cookie = document.cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${SCORE_COOKIE}=`));
    if (!cookie) return records;
    const data = JSON.parse(
      decodeURIComponent(cookie.slice(SCORE_COOKIE.length + 1)),
    ) as Record<string, Partial<TrainingPackRecord>>;
    for (const pack of TRAINING_PACKS) {
      const value = data?.[pack.id];
      if (!value) continue;
      const best = Number(value.best),
        last = Number(value.last);
      if (
        Number.isInteger(best) &&
        best >= 0 &&
        best <= 11 &&
        Number.isInteger(last) &&
        last >= 0 &&
        last <= 11
      )
        records[pack.id] = { best, last };
    }
  } catch {
    /* Invalid or blocked cookies leave the pack scores session-only. */
  }
  return records;
}

function writeTrainingPackRecords(records: TrainingPackRecords) {
  if (typeof document === "undefined") return;
  try {
    const secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${SCORE_COOKIE}=${encodeURIComponent(JSON.stringify(records))}; Max-Age=31536000; Path=/; SameSite=Lax${secure}`;
  } catch {
    /* The current run still shows its result if cookies are unavailable. */
  }
}

export type TrainingPackTick = "shot" | "complete" | null;

/** Owns pack timing and shot setup while Match supplies the real game physics. */
export class TrainingPackRun {
  readonly records = readTrainingPackRecords();
  packId: string | null = null;
  score = 0;
  shotIndex = 0;
  timeLeft = 0;
  timerLimit = 0;
  transitionLeft = 0;
  active = false;
  completed = false;
  message = "";

  get pack() {
    return (
      TRAINING_PACKS.find((candidate) => candidate.id === this.packId) ?? null
    );
  }

  start(packId: string, match: Match, simulation: Simulation) {
    if (!TRAINING_PACKS.some((pack) => pack.id === packId)) return false;
    this.packId = packId;
    this.score = 0;
    this.shotIndex = 0;
    this.transitionLeft = 0;
    this.active = true;
    this.completed = false;
    this.message = "GET READY";
    this.setupShot(match, simulation);
    return true;
  }

  stop() {
    this.active = false;
    this.completed = false;
    this.transitionLeft = 0;
    this.message = "";
  }

  restart(match: Match, simulation: Simulation) {
    return this.packId ? this.start(this.packId, match, simulation) : false;
  }

  tick(match: Match, simulation: Simulation, dt: number): TrainingPackTick {
    if (!this.active || !this.pack) return null;
    if (this.transitionLeft > 0) {
      this.transitionLeft = Math.max(0, this.transitionLeft - dt);
      if (this.transitionLeft === 0) {
        this.setupShot(match, simulation);
        return "shot";
      }
      return null;
    }

    if (match.phase === "goal") {
      const scored =
        !!match.goalFocus &&
        scoringTeam(match.goalFocus) === this.currentShot.goalTeam &&
        simulation.lastTouchId === simulation.cars[0].id;
      if (scored) this.score++;
      this.message = scored ? "GOAL · POINT" : "WRONG GOAL · NO POINT";
      return this.advance(match);
    }

    if (match.phase === "playing") {
      this.timeLeft = Math.max(0, this.timeLeft - dt);
      if (this.timeLeft === 0) {
        this.message = "TIME EXPIRED · NO POINT";
        simulation.ballCollider.setCollisionGroups(0);
        simulation.ball.setEnabled(false);
        return this.advance(match);
      }
    }
    return null;
  }

  get currentShot() {
    return (
      this.pack?.shots[Math.min(this.shotIndex, 10)] ??
      TRAINING_PACKS[0].shots[0]
    );
  }

  get view() {
    const pack = this.pack,
      shot = this.currentShot;
    return {
      active: this.active,
      completed: this.completed,
      packId: this.packId,
      name: pack?.name ?? "",
      tier: pack?.tier ?? "",
      shot: this.shotIndex,
      total: 11,
      score: this.score,
      goalTeam: shot.goalTeam,
      timer: this.timeLeft,
      timerLimit: this.timerLimit,
      cannon: shot.cannon,
      message: this.message,
      best: this.packId ? this.records[this.packId]?.best : undefined,
      last: this.packId ? this.records[this.packId]?.last : undefined,
    };
  }

  private get shot() {
    return this.pack!.shots[this.shotIndex];
  }

  private advance(match: Match): TrainingPackTick {
    this.shotIndex++;
    if (this.shotIndex >= 11) {
      this.finish(match);
      return "complete";
    }
    this.transitionLeft = 0.48;
    match.phase = "goal";
    match.freeze = 1.5;
    return null;
  }

  private finish(match: Match) {
    const previous = this.packId ? this.records[this.packId] : undefined;
    if (this.packId) {
      this.records[this.packId] = {
        best: Math.max(previous?.best ?? 0, this.score),
        last: this.score,
      };
      writeTrainingPackRecords(this.records);
    }
    this.active = false;
    this.completed = true;
    this.transitionLeft = 0;
    this.message = `PACK SCORE ${this.score} / 11`;
    match.phase = "finished";
    match.message = "PACK COMPLETE";
    match.score = [this.score, 0];
  }

  private setupShot(match: Match, simulation: Simulation) {
    const shot = this.shot,
      car = simulation.cars[0];
    simulation.reset();
    car.reset(shot.carX, shot.carZ, shot.carYaw);
    car.boost = 100;
    simulation.ball.setEnabled(true);
    simulation.ballCollider.setCollisionGroups(0xffffffff);
    simulation.ball.setTranslation(
      { x: shot.ballX, y: shot.ballY, z: shot.ballZ },
      true,
    );
    simulation.ball.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    simulation.ball.setLinvel(
      { x: shot.ballVX, y: shot.ballVY, z: shot.ballVZ },
      true,
    );
    simulation.ball.setAngvel({ x: 0, y: 0, z: 0 }, true);
    simulation.ballPose.snap();
    match.phase = "playing";
    match.freeze = 0;
    match.goalFocus = null;
    match.message = "";
    match.goTime = 0;
    this.timerLimit = shot.timer;
    this.timeLeft = shot.timer;
    this.transitionLeft = 0;
    this.message = shot.cannon ? "CANNON LAUNCH" : `SHOT ${this.shotIndex + 1}`;
  }
}
