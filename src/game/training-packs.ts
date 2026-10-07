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

const packNames = [
  ["Rookie Warmup", "EASY", "Ground shots, gentle rolls, and wide open nets."],
  ["First Touch", "EASY", "Side lanes and rolling touches introduce shot placement."],
  ["Angle School", "CASUAL", "Turn awkward wide balls back toward the far post."],
  ["Moving Targets", "CASUAL", "Read moving crosses, wall rolls, and rising balls."],
  [
    "Aerial Class",
    "INTERMEDIATE",
    "Meet high crosses and redirect rebounds before they drop.",
  ],
  ["Crossbar Lab", "ADVANCED", "Clear the bar from high, off-center feeds."],
  ["Wall Reads", "HARD", "Cannon feeds skim the wall and backboard at bad angles."],
  [
    "Air Control",
    "VERY HARD",
    "Fast aerial cannon shots arrive from the ceiling and sidewall.",
  ],
  [
    "Pressure Cooker",
    "VERY HARD",
    "Reverse-moving balls, corner rebounds, and narrow far-post lines.",
  ],
  ["Overtime Trials", "PRO", "Obscure cannon setups: backboard clears, ceiling drops, and wall redirects."],
] as const;

type ShotPattern =
  | "ground"
  | "roll"
  | "diagonal"
  | "wide"
  | "pop"
  | "wall-roll"
  | "cross"
  | "backboard"
  | "corner"
  | "drop"
  | "reverse"
  | "pinch"
  | "ceiling"
  | "wall-aerial"
  | "crossbar";

// Each pack has its own shot order and skill focus. Later packs deliberately
// stop repeating the same centered setup: most of their feeds start high,
// outside the goal mouth, or moving away from the target.
const shotPlans: readonly (readonly ShotPattern[])[] = [
  ["ground", "roll", "ground", "diagonal", "roll", "wide", "ground", "diagonal", "roll", "wide", "ground"],
  ["roll", "wide", "diagonal", "pop", "ground", "wall-roll", "pop", "roll", "diagonal", "wide", "ground"],
  ["wide", "wall-roll", "pop", "diagonal", "corner", "roll", "drop", "cross", "wall-roll", "diagonal", "cross"],
  ["cross", "corner", "backboard", "wall-roll", "pop", "reverse", "wide", "cross", "corner", "backboard", "roll"],
  ["reverse", "cross", "wall-aerial", "backboard", "corner", "drop", "wall-roll", "cross", "pop", "reverse", "wall-aerial"],
  ["backboard", "wall-aerial", "ceiling", "corner", "reverse", "cross", "pinch", "crossbar", "drop", "backboard", "wall-aerial"],
  ["wall-aerial", "backboard", "pinch", "ceiling", "corner", "reverse", "crossbar", "wall-aerial", "drop", "pinch", "backboard"],
  ["ceiling", "pinch", "backboard", "wall-aerial", "crossbar", "reverse", "corner", "ceiling", "pinch", "drop", "wall-aerial"],
  ["reverse", "backboard", "ceiling", "corner", "pinch", "crossbar", "wall-aerial", "reverse", "drop", "backboard", "ceiling"],
  ["backboard", "ceiling", "wall-aerial", "pinch", "crossbar", "reverse", "corner", "backboard", "ceiling", "wall-aerial", "pinch"],
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function makeShot(difficulty: number, index: number): TrainingShot {
  const pressure = difficulty / 9,
    pattern = shotPlans[difficulty][index],
    goalTeam = (difficulty + index) % 2,
    goalSign = goalTeam === 0 ? -1 : 1,
    edge = (index + difficulty) % 2 === 0 ? 1 : -1;
  let ballX = edge * (4 + pressure * 3),
    ballY = P.ball.radius,
    distanceToGoal = 27 - pressure * 8,
    ballVX = 0,
    ballVY = 0,
    ballVZ = 0,
    cannon = false,
    targetX = edge * (1 + pressure * 3);

  switch (pattern) {
    case "ground":
      ballX = ((index % 3) - 1) * (1 + pressure * 4);
      distanceToGoal = 32 - pressure * 10;
      break;
    case "roll":
      ballX = edge * (5 + pressure * 6);
      distanceToGoal = 25 - pressure * 7;
      ballVX = -edge * (1.5 + pressure * 2.2);
      ballVZ = goalSign * (1 + pressure * 1.8);
      targetX = -edge * (1 + pressure * 3);
      break;
    case "diagonal":
      ballX = edge * (9 + pressure * 11);
      distanceToGoal = 22 - pressure * 6;
      ballVX = -edge * (2 + pressure * 2.5);
      ballVZ = goalSign * (1.5 + pressure * 2);
      targetX = -edge * (2 + pressure * 4);
      break;
    case "wide":
      ballX = edge * (21 + pressure * 12);
      distanceToGoal = 19 - pressure * 5;
      ballY = P.ball.radius + pressure * 1.2;
      ballVX = -edge * (2.5 + pressure * 2.5);
      ballVZ = goalSign * (1.2 + pressure * 2.4);
      targetX = -edge * (1 + pressure * 4);
      break;
    case "pop":
      ballX = edge * (3 + pressure * 7);
      distanceToGoal = 22 - pressure * 6;
      ballY = 2.4 + pressure * 3.5;
      ballVY = 1.8 + pressure * 2.8;
      ballVZ = goalSign * (1 + pressure * 1.5);
      targetX = -edge * (1 + pressure * 3);
      break;
    case "wall-roll":
      ballX = edge * (P.arena.halfWidth - 2.2);
      distanceToGoal = 15 - pressure * 3;
      ballY = P.ball.radius + 0.25 + pressure * 0.8;
      ballVX = -edge * (0.8 + pressure * 1.8);
      ballVZ = goalSign * (2 + pressure * 2);
      targetX = edge * (1 + pressure * 2);
      break;
    case "cross":
      ballX = edge * (13 + pressure * 7);
      distanceToGoal = 18 - pressure * 4;
      ballY = 4 + pressure * 3;
      ballVX = -edge * (3 + pressure * 2.5);
      ballVY = 1 + pressure * 2;
      ballVZ = goalSign * (2 + pressure * 2.5);
      targetX = -edge * (2 + pressure * 4);
      cannon = difficulty >= 4;
      break;
    case "backboard":
      // Outside the post, already near the back wall, and moving back out.
      // The player must intercept it and redirect across the mouth.
      ballX = edge * (P.arena.goalHalf + 2.2 + pressure * 2.8);
      distanceToGoal = 3.5 + pressure * 2.5;
      ballY = 4.2 + pressure * 4.5;
      ballVX = -edge * (2.2 + pressure * 2.8);
      ballVY = -0.8 - pressure * 1.5;
      ballVZ = -goalSign * (1.8 + pressure * 2.5);
      targetX = -edge * (2 + pressure * 4);
      cannon = difficulty >= 5;
      break;
    case "corner":
      // A near-post feed starts outside the scoring frame and must be cut
      // sharply back across the goal mouth.
      ballX = edge * (P.arena.goalHalf + 4 + pressure * 3);
      distanceToGoal = 4 + pressure * 3;
      ballY = 1.5 + pressure * 2.3;
      ballVX = -edge * (4 + pressure * 4);
      ballVY = 0.5 + pressure * 1.5;
      ballVZ = goalSign * (1.5 + pressure * 2.2);
      targetX = -edge * (3 + pressure * 3);
      cannon = difficulty >= 6;
      break;
    case "drop":
      ballX = edge * (10 + pressure * 12);
      distanceToGoal = 15 - pressure * 6;
      ballY = 7 + pressure * 6;
      ballVX = edge * (1 + pressure * 2);
      ballVY = -1.2 - pressure * 1.8;
      ballVZ = goalSign * (1.5 + pressure * 2);
      targetX = -edge * (1 + pressure * 4);
      cannon = difficulty >= 5;
      break;
    case "reverse":
      // The ball travels away from the called goal, so a straight chase
      // cannot score; the player has to beat it to a useful touch.
      ballX = edge * (11 + pressure * 10);
      distanceToGoal = 7 + pressure * 8;
      ballY = 2.2 + pressure * 3.2;
      ballVX = -edge * (3 + pressure * 4);
      ballVY = -0.5 - pressure;
      ballVZ = -goalSign * (2.2 + pressure * 3.2);
      targetX = -edge * (2 + pressure * 4);
      cannon = difficulty >= 6;
      break;
    case "pinch":
      ballX = edge * (P.arena.halfWidth - 5.5);
      distanceToGoal = 10 + pressure * 7;
      ballY = 3.2 + pressure * 4.2;
      ballVX = -edge * (5 + pressure * 3.5);
      ballVY = 1 + pressure * 1.5;
      ballVZ = goalSign * (4 + pressure * 2.5);
      targetX = -edge * (3 + pressure * 3);
      cannon = true;
      break;
    case "ceiling":
      ballX = edge * (12 + pressure * 10);
      distanceToGoal = 5 + pressure * 8;
      ballY = 11 + pressure * 5.5;
      ballVX = -edge * (2 + pressure * 2.5);
      ballVY = -2.2 - pressure * 1.5;
      ballVZ = goalSign * (2.5 + pressure * 2.5);
      targetX = -edge * (2 + pressure * 4);
      cannon = true;
      break;
    case "wall-aerial":
      ballX = edge * (P.arena.halfWidth - 4.2);
      distanceToGoal = 9 + pressure * 10;
      ballY = 5 + pressure * 5.5;
      ballVX = -edge * (4 + pressure * 3.5);
      ballVY = 1.8 + pressure * 2.2;
      ballVZ = goalSign * (3 + pressure * 2.5);
      targetX = -edge * (2 + pressure * 4);
      cannon = true;
      break;
    case "crossbar":
      ballX = edge * (4 + pressure * 5);
      distanceToGoal = 2.5 + pressure * 4.5;
      ballY = 7.5 + pressure * 5;
      ballVX = -edge * (2.5 + pressure * 3.5);
      ballVY = -1.2 - pressure * 2;
      ballVZ = goalSign * (1.5 + pressure * 3);
      targetX = -edge * (2 + pressure * 3);
      cannon = true;
      break;
  }

  const ballZ = goalSign * (P.arena.halfLength - distanceToGoal),
    targetZ = goalSign * (P.arena.halfLength + P.arena.goalDepth * 0.65),
    aimX = targetX - ballX,
    aimZ = targetZ - ballZ,
    aimLength = Math.hypot(aimX, aimZ) || 1,
    dirX = aimX / aimLength,
    dirZ = aimZ / aimLength,
    sideX = -dirZ,
    sideZ = dirX,
    startDistance = 8.5 + pressure * 2.5 + (cannon ? 1.2 : 0),
    sideOffset =
      ((index + difficulty) % 3 - 1) * (0.8 + pressure * 3.2),
    carX = clamp(
      ballX - dirX * startDistance + sideX * sideOffset,
      -P.arena.halfWidth + 3,
      P.arena.halfWidth - 3,
    ),
    carZ = clamp(
      ballZ - dirZ * startDistance + sideZ * sideOffset,
      -P.arena.halfLength + 4,
      P.arena.halfLength - 4,
    ),
    timer = Math.round(
      Math.max(
        6.2,
        18.5 - difficulty * 0.93 - (cannon ? 1.3 : 0) + (index % 3) * 0.55,
      ) * 10,
    ) / 10;

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
