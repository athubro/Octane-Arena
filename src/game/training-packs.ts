import { P } from "../config/physics";
import { Euler, Quaternion } from "three";
import type { Simulation } from "../physics/simulation";
import type { Match } from "./match";
import { scoringTeam } from "./goals";

type TrainingObjective = "goal" | "clear";
type TrainingScenario =
  | "backboard-defense"
  | "corner-defense"
  | "last-man-save"
  | "wall-clear"
  | "awkward-aerial"
  | "double-tap"
  | "air-dribble"
  | "flip-reset"
  | "ground-possession"
  | "redirect"
  | "recovery"
  | "ceiling-play"
  | "low-boost"
  | "counterattack"
  | "rapid-sequence";

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
  aerial: boolean;
  scenario: string;
  instruction: string;
  objective: TrainingObjective;
  targetGoalX: number | null;
  minimumTouches: number;
  setupTouchRequired: boolean;
  firstTouchMustAdvance: boolean;
  rapidSequence: boolean;
  requireFlipReset: boolean;
  requireRecoveryBeforeTouch: boolean;
  requireRecoveryAfterTouch: boolean;
  playerBoost: number;
  carY: number;
  carRoll: number;
  carVX: number;
  carVY: number;
  carVZ: number;
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
  ["Rookie Reads", "EASY", "Gentle versions of real possessions, wall clears, and near-post reads."],
  ["First Rotation", "EASY", "Catch bounces, clear the sidewall, and start a simple counter."],
  ["Corner Pressure", "CASUAL", "Read corner rebounds and get the ball safely across the field."],
  ["Last Defender", "CASUAL", "Far-post shots and backboard danger with room to recover."],
  [
    "Aerial Rescue",
    "INTERMEDIATE",
    "Backboard saves, awkward aerial touches, and fast goalmouth redirects.",
  ],
  ["Wall and Backboard", "ADVANCED", "Fast wall exits, ceiling drops, and deliberate second touches."],
  ["Recovery Pressure", "HARD", "Land from awkward saves, then challenge with little boost and time."],
  [
    "Aerial Control",
    "VERY HARD",
    "Air dribbles, fast redirects, and controlled ceiling drops under pressure.",
  ],
  [
    "Counterattack Lab",
    "VERY HARD",
    "Long recoveries, far-post saves, and short-window counterattacks.",
  ],
  ["Overtime Trials", "PRO", "Flip resets, double taps, air dribbles, and chained save-to-wall-to-aerial finishes."],
] as const;

const scenarioOrder: readonly TrainingScenario[] = [
  "ground-possession",
  "redirect",
  "wall-clear",
  "low-boost",
  "corner-defense",
  "backboard-defense",
  "last-man-save",
  "awkward-aerial",
  "recovery",
  "ceiling-play",
  "counterattack",
  "double-tap",
  "air-dribble",
  "flip-reset",
  "rapid-sequence",
];
const scenarioCountByPack = [4, 5, 6, 7, 8, 9, 11, 13, 15, 15];

const scenarioCopy: Record<TrainingScenario, { title: string; task: string }> = {
  "backboard-defense": {
    title: "BACKBOARD DEFENSE",
    task: "FAST AERIAL THE AWKWARD REBOUND · CLEAR IT · LAND TO RECOVER",
  },
  "corner-defense": {
    title: "CORNER DEFENSE",
    task: "READ THE HIGH CORNER BOUNCE · CLEAR TO THE OPPOSITE SIDE",
  },
  "last-man-save": {
    title: "LAST-MAN SAVE",
    task: "ROTATE BACK · SAVE THE FAR-POST SHOT WITH A SIDEWAYS AERIAL",
  },
  "wall-clear": {
    title: "WALL CLEAR",
    task: "JUMP OFF THE SIDEWALL · CLEAR HARD WHILE KEEPING MOMENTUM",
  },
  "awkward-aerial": {
    title: "AWKWARD AERIAL",
    task: "BALL IS BEHIND AND ABOVE · AIR-ROLL · MAKE A CONTROLLED TOUCH",
  },
  "double-tap": {
    title: "DOUBLE TAP",
    task: "USE THE FIRST TOUCH TO SET UP THE BACKBOARD · HIT IT AGAIN",
  },
  "air-dribble": {
    title: "AIR DRIBBLE",
    task: "WALL SETUP · CONTROL THREE TOUCHES · FINISH IN THE CALLED CORNER",
  },
  "flip-reset": {
    title: "FLIP RESET",
    task: "WALL-TO-AIR · GET THE WHEEL RESET · SHOOT BEFORE CONTROL RUNS OUT",
  },
  "ground-possession": {
    title: "GROUND POSSESSION",
    task: "CATCH THE FAST BOUNCE · DIAGONAL FLICK INTO THE CALLED CORNER",
  },
  redirect: {
    title: "FAR-POST REDIRECT",
    task: "REDIRECT THE FAST CROSS TO THE FAR POST · MINIMAL REACTION TIME",
  },
  recovery: {
    title: "RECOVERY CHALLENGE",
    task: "RECOVER FROM THE MISSED AERIAL · LAND · IMMEDIATELY CHALLENGE",
  },
  "ceiling-play": {
    title: "CEILING PLAY",
    task: "FAST AERIAL FROM THE CEILING DROP · CONTROL THE SHOT",
  },
  "low-boost": {
    title: "LOW-BOOST PRESSURE",
    task: "ONLY 20–30 BOOST · MAKE THE DEFENSIVE CLEAR OR CONTROLLED PLAY",
  },
  counterattack: {
    title: "COUNTERATTACK",
    task: "RECOVER FROM THE SAVE · CARRY DOWNFIELD · FINISH IN THE CALLED CORNER",
  },
  "rapid-sequence": {
    title: "RAPID SEQUENCE",
    task: "SAVE · RECOVER ON THE SIDEWALL · JUMP OFF · AERIAL FINISH · NO RESET",
  },
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function makeShot(difficulty: number, index: number): TrainingShot {
  const pressure = difficulty / 9,
    unlocked = scenarioCountByPack[difficulty],
    scenario = scenarioOrder[(index * 11 + difficulty * 3) % unlocked],
    copy = scenarioCopy[scenario],
    edge = (index + difficulty) % 2 === 0 ? 1 : -1,
    halfWidth = P.arena.halfWidth,
    halfLength = P.arena.halfLength,
    goalTeam = 0,
    goalSign = -1;
  let ballX = edge * (4 + pressure * 3),
    ballY = P.ball.radius + 0.3,
    ballZ = -(halfLength - (26 - pressure * 5)),
    ballVX = 0,
    ballVY = 0,
    ballVZ = -2 - pressure * 2,
    carX = 0,
    carZ = 0,
    targetGoalX: number | null = null,
    objective: TrainingObjective = "goal",
    minimumTouches = 1,
    requireFlipReset = false,
    requireRecoveryBeforeTouch = false,
    requireRecoveryAfterTouch = false,
    firstTouchMustAdvance = false,
    rapidSequence = false,
    cannon = false,
    aerial = false,
    playerBoost = 100,
    carY = 0.36,
    carRoll = 0,
    carVX = 0,
    carVY = 0,
    carVZ = 0,
    setupTouchRequired = false,
    carYawOverride: number | null = null;

  switch (scenario) {
    case "ground-possession":
      ballX = edge * (4 + pressure * 4);
      ballY = P.ball.radius + 0.8 + pressure * 0.25;
      ballVY = 3 + pressure * 3.2;
      ballVX = -edge * (1 + pressure * 2);
      ballVZ = -2 - pressure * 3;
      minimumTouches = 2;
      targetGoalX = edge * (P.arena.goalHalf - 1.8);
      break;
    case "redirect":
      ballX = edge * (11 + pressure * 6);
      ballY = 3.2 + pressure * 2.6;
      ballZ = -(halfLength - 11 - pressure * 3);
      ballVX = -edge * (10 + pressure * 8);
      ballVY = 0.8 + pressure * 1.8;
      ballVZ = -3 - pressure * 4;
      targetGoalX = -edge * (P.arena.goalHalf - 1.8);
      aerial = difficulty >= 3;
      cannon = difficulty >= 4;
      break;
    case "wall-clear":
      objective = "clear";
      ballX = edge * (halfWidth - 2.6);
      ballY = 2.1 + pressure * 5.2;
      ballZ = 22 + pressure * 9;
      ballVX = -edge * (1.1 + pressure * 2.3);
      ballVY = 1.8 + pressure * 2.5;
      ballVZ = 4 + pressure * 6;
      aerial = difficulty >= 4;
      cannon = difficulty >= 6;
      break;
    case "low-boost":
      playerBoost = 20 + ((index + difficulty) % 3) * 5;
      if (index % 2 === 0) {
        objective = "clear";
        ballX = edge * (P.arena.goalHalf + 3 + pressure * 4);
        ballY = 2.6 + pressure * 3.4;
        ballZ = 26 + pressure * 8;
        ballVX = -edge * (3 + pressure * 4);
        ballVY = 1.5 + pressure * 2;
        ballVZ = 7 + pressure * 7;
        aerial = difficulty >= 5;
        cannon = difficulty >= 6;
      } else {
        ballX = edge * (6 + pressure * 5);
        ballY = P.ball.radius + 1.2;
        ballZ = -(halfLength - 22);
        ballVY = 2.2 + pressure * 2.3;
        ballVZ = -3 - pressure * 2;
        minimumTouches = 2;
        targetGoalX = -edge * (P.arena.goalHalf - 2);
      }
      break;
    case "corner-defense":
      objective = "clear";
      ballX = edge * (halfWidth - 5 - pressure * 1.5);
      ballY = 6 + pressure * 3.5;
      ballZ = 37 + pressure * 2;
      ballVX = -edge * (5 + pressure * 7);
      ballVY = 1.5 + pressure * 2;
      ballVZ = -7 - pressure * 5;
      aerial = true;
      cannon = difficulty >= 5;
      break;
    case "backboard-defense":
      objective = "clear";
      ballX = edge * (2.5 + pressure * 4);
      ballY = P.arena.goalHeight + 2 + pressure * 2;
      ballZ = halfLength + P.arena.goalDepth - 2;
      ballVX = -edge * (6 + pressure * 4);
      ballVY = -0.5 - pressure * 1.2;
      ballVZ = -15 - pressure * 8;
      aerial = true;
      cannon = difficulty >= 4;
      requireRecoveryAfterTouch = true;
      break;
    case "last-man-save":
      objective = "clear";
      ballX = edge * (P.arena.goalHalf * 0.72);
      ballY = 2.3 + pressure * 3;
      ballZ = 18 + pressure * 4;
      ballVX = -edge * (5 + pressure * 6);
      ballVY = 1.5 + pressure * 2;
      ballVZ = 10 + pressure * 8;
      carX = -edge * (3 + pressure * 2);
      carZ = 10 + pressure * 2;
      carYawOverride = Math.PI + edge * 0.5;
      carVX = edge * 1.5;
      carVZ = 10 + pressure * 4;
      aerial = true;
      cannon = difficulty >= 5;
      break;
    case "awkward-aerial":
      ballX = edge * (8 + pressure * 9);
      ballY = 8 + pressure * 4.5;
      ballZ = -(halfLength - 17 - pressure * 5);
      ballVX = -edge * (4 + pressure * 5);
      ballVY = -1 - pressure * 1.8;
      ballVZ = -4 - pressure * 5;
      carX = ballX + edge * 2;
      carZ = ballZ - 4.2;
      carY = 2.4;
      carRoll = edge * 0.85;
      carVZ = -3.5;
      carYawOverride = edge * 0.28;
      aerial = true;
      cannon = difficulty >= 5;
      break;
    case "double-tap":
      ballX = edge * (halfWidth - 7 - pressure * 2);
      ballY = 4.5 + pressure * 3;
      ballZ = -(halfLength - 21 - pressure * 4);
      ballVX = -edge * (5 + pressure * 5);
      ballVY = 2 + pressure * 2;
      ballVZ = -8 - pressure * 7;
      minimumTouches = 2;
      setupTouchRequired = true;
      targetGoalX = -edge * (P.arena.goalHalf - 2);
      aerial = true;
      cannon = difficulty >= 5;
      break;
    case "air-dribble":
      ballX = edge * (halfWidth - 4.5);
      ballY = 3 + pressure * 1.8;
      ballZ = -(halfLength - 28 - pressure * 5);
      ballVX = -edge * (2.5 + pressure * 3.5);
      ballVY = 2 + pressure * 1.8;
      ballVZ = -4 - pressure * 5;
      minimumTouches = 3;
      targetGoalX = edge * (P.arena.goalHalf - 1.4);
      aerial = true;
      cannon = difficulty >= 5;
      break;
    case "flip-reset":
      ballX = edge * (halfWidth - 5.5);
      ballY = 5 + pressure * 4;
      ballZ = -(halfLength - 24 - pressure * 4);
      ballVX = -edge * (4 + pressure * 4);
      ballVY = -0.8 - pressure * 1.3;
      ballVZ = -7 - pressure * 6;
      minimumTouches = 2;
      requireFlipReset = true;
      aerial = true;
      cannon = true;
      break;
    case "recovery":
      ballX = -edge * (7 + pressure * 6);
      ballY = 4 + pressure * 2.5;
      ballZ = -(halfLength - 24 - pressure * 5);
      ballVX = edge * (4 + pressure * 5);
      ballVY = -1 - pressure;
      ballVZ = -3 - pressure * 3;
      carY = 2.1 + pressure * 1.2;
      carRoll = edge * (0.8 + pressure * 0.25);
      carVZ = -3 - pressure * 2;
      requireRecoveryBeforeTouch = true;
      aerial = true;
      cannon = difficulty >= 6;
      break;
    case "ceiling-play":
      ballX = edge * (8 + pressure * 8);
      ballY = P.arena.height - P.ball.radius - 1.4;
      ballZ = -(halfLength - 16 - pressure * 5);
      ballVX = -edge * (3 + pressure * 4);
      ballVY = -2 - pressure * 1.6;
      ballVZ = -6 - pressure * 5;
      aerial = true;
      cannon = true;
      break;
    case "counterattack":
      ballX = edge * (4 + pressure * 5);
      ballY = 2.5 + pressure * 1.8;
      ballZ = 6 + pressure * 2;
      ballVX = -edge * (2 + pressure * 2);
      ballVY = 0.4 + pressure;
      ballVZ = -7 - pressure * 1.4;
      playerBoost = 25;
      carX = edge * (9 + pressure * 2);
      carZ = ballZ + 14 + pressure * 2.5;
      carY = 1.05;
      carRoll = edge * 0.28;
      carVZ = -11 - pressure * 2.5;
      minimumTouches = 2;
      firstTouchMustAdvance = true;
      targetGoalX = edge * (P.arena.goalHalf - 1.4);
      requireRecoveryBeforeTouch = true;
      break;
    case "rapid-sequence":
      ballX = edge * (halfWidth - 3.2);
      ballY = 4.5 + pressure * 2.4;
      ballZ = -6 - pressure * 3;
      ballVX = -edge * (5 + pressure * 4);
      ballVY = 1 + pressure * 1.6;
      ballVZ = 10 + pressure * 2;
      carX = edge * (halfWidth - 8.2);
      carZ = ballZ - 8.5;
      carY = 0.8 + pressure * 0.35;
      carRoll = edge * 0.32;
      carYawOverride = Math.PI;
      carVZ = 14 + pressure;
      minimumTouches = 2;
      firstTouchMustAdvance = true;
      rapidSequence = true;
      targetGoalX = -edge * (P.arena.goalHalf - 1.8);
      aerial = true;
      cannon = difficulty >= 7;
      break;
  }

  // Attacking feeds may cross the field or bounce, but must not arrive at the
  // goal on their own. The player has to provide the shot with a touch.
  if (objective === "goal" && scenario !== "counterattack" && scenario !== "rapid-sequence") {
    ballVZ = Math.max(0, ballVZ);
    cannon = false;
  }

  const targetX = targetGoalX ?? edge * (P.arena.goalHalf * 0.5),
    targetZ = goalSign * (halfLength + P.arena.goalDepth * 0.65),
    aimX = targetX - ballX,
    aimZ = targetZ - ballZ,
    aimLength = Math.hypot(aimX, aimZ) || 1,
    dirX = aimX / aimLength,
    dirZ = aimZ / aimLength,
    sideX = -dirZ,
    sideZ = dirX,
    startDistance = 7.5 + pressure * 3,
    sideOffset = ((index + difficulty) % 3 - 1) * (0.6 + pressure * 2.4);
  if (
    scenario !== "counterattack" &&
    scenario !== "rapid-sequence" &&
    scenario !== "last-man-save" &&
    scenario !== "awkward-aerial"
  ) {
    carX = clamp(
      ballX - dirX * startDistance + sideX * sideOffset,
      -halfWidth + 3,
      halfWidth - 3,
    );
    carZ = clamp(
      ballZ - dirZ * startDistance + sideZ * sideOffset,
      -halfLength + 4,
      halfLength - 4,
    );
  }
  const carYaw = carYawOverride ?? Math.atan2(-dirX, -dirZ),
    standardTimer =
      12.2 -
      difficulty * 0.68 -
      (cannon ? 0.65 : 0) -
      (aerial ? 0.45 : 0) -
      Math.max(0, minimumTouches - 1) * 0.25 +
      (index % 2) * 0.2,
    timer =
      Math.round(
        (scenario === "counterattack"
          ? Math.max(6.1, standardTimer)
          : scenario === "rapid-sequence"
            ? Math.max(7.2, 10.2 - difficulty * 0.22)
            : Math.max(5.2, standardTimer)) * 10,
      ) / 10;

  return {
    carX,
    carZ,
    carYaw,
    ballX,
    ballY,
    ballZ,
    ballVX,
    ballVY,
    ballVZ,
    goalTeam,
    timer,
    cannon:
      objective === "goal" ? false : cannon || (difficulty >= 6 && aerial),
    aerial,
    scenario: copy.title,
    instruction: copy.task,
    objective,
    targetGoalX,
    minimumTouches,
    setupTouchRequired,
    firstTouchMustAdvance,
    rapidSequence,
    requireFlipReset,
    requireRecoveryBeforeTouch,
    requireRecoveryAfterTouch,
    playerBoost,
    carY,
    carRoll,
    carVX,
    carVY,
    carVZ,
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
  private lastObservedTouchSequence = 0;
  private playerTouches = 0;
  private qualifiedTouches = 0;
  private playerHasRecovered = false;
  private recoveredAfterTouch = false;
  private clearReached = false;
  private lastPlayerTouchAt = -Infinity;
  private setupTouchCreated = false;
  private setupBouncedFromBackboard = false;
  private firstTouchAdvanced = false;
  private rapidSaveMade = false;
  private wallRecoveryMade = false;
  private wallJumpMade = false;

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

    const shot = this.currentShot,
      player = simulation.cars[0];
    if (player.grounded) this.playerHasRecovered = true;
    if (shot.rapidSequence && this.rapidSaveMade) {
      const p = player.body.translation();
      if (
        Math.abs(p.x) > P.arena.halfWidth - 4.4 &&
        p.y > 1.2 &&
        player.contactState !== "air"
      )
        this.wallRecoveryMade = true;
      if (this.wallRecoveryMade && player.lastJump) this.wallJumpMade = true;
    }
    if (shot.setupTouchRequired && this.setupTouchCreated) {
      const ball = simulation.ball.translation(),
        velocity = simulation.ball.linvel();
      if (
        ball.z < -(P.arena.halfLength + 1.5) &&
        velocity.z > 0.5
      )
        this.setupBouncedFromBackboard = true;
    }
    if (simulation.ballTouchSequence !== this.lastObservedTouchSequence) {
      this.lastObservedTouchSequence = simulation.ballTouchSequence;
      if (simulation.lastTouchId === player.id) {
        this.playerTouches++;
        this.lastPlayerTouchAt = simulation.clock;
        const ballVelocity = simulation.ball.linvel();
        if (this.playerTouches === 1 && shot.firstTouchMustAdvance) {
          this.firstTouchAdvanced = ballVelocity.z < -4;
          if (shot.rapidSequence) this.rapidSaveMade = this.firstTouchAdvanced;
        }
        const liftedSetup =
            !shot.setupTouchRequired ||
            this.setupTouchCreated ||
            (this.playerTouches === 1 && ballVelocity.y > 1.2),
          waitedForBackboard =
            !shot.setupTouchRequired ||
            this.playerTouches === 1 ||
            this.setupBouncedFromBackboard,
          firstTouchValid =
            !shot.firstTouchMustAdvance || this.firstTouchAdvanced,
          sequenceValid =
            !shot.rapidSequence ||
            this.playerTouches === 1 ||
            this.wallJumpMade;
        if (
          (!shot.requireRecoveryBeforeTouch || this.playerHasRecovered) &&
          liftedSetup &&
          waitedForBackboard &&
          firstTouchValid &&
          sequenceValid
        ) {
          if (shot.setupTouchRequired && this.playerTouches === 1)
            this.setupTouchCreated = true;
          this.qualifiedTouches++;
          this.message = shot.rapidSequence && this.playerTouches === 1
            ? "SAVE MADE · RECOVER ON THE WALL, THEN JUMP"
            : this.qualifiedTouches < shot.minimumTouches
            ? shot.setupTouchRequired && !this.setupBouncedFromBackboard
              ? "FIRST TOUCH SET · PLAY THE BACKBOARD REBOUND"
              : `TOUCH ${this.qualifiedTouches} · SET UP THE NEXT TOUCH`
            : shot.requireFlipReset && player.flipResetCount === 0
              ? "TOUCH REGISTERED · GET THE FLIP RESET"
              : "TOUCH REGISTERED · FINISH THE PLAY";
        } else if (shot.requireRecoveryBeforeTouch && !this.playerHasRecovered)
          this.message = "RECOVER FIRST · THEN CHALLENGE";
        else if (shot.firstTouchMustAdvance && !firstTouchValid)
          this.message = "SAVE THE BALL DOWNFIELD BEFORE THE FINISH";
        else if (shot.rapidSequence && !sequenceValid)
          this.message = "RECOVER ON THE SIDEWALL · JUMP OFF BEFORE THE AERIAL";
        else if (shot.setupTouchRequired && !liftedSetup)
          this.message = "LIFT THE FIRST TOUCH TO THE BACKBOARD";
        else this.message = "WAIT FOR THE BACKBOARD REBOUND · THEN TAP IT";
      }
    }
    if (
      shot.requireRecoveryAfterTouch &&
      this.playerTouches > 0 &&
      player.grounded &&
      simulation.clock - this.lastPlayerTouchAt > 0.12
    )
      this.recoveredAfterTouch = true;

    if (shot.objective === "clear" && this.qualifiedTouches > 0) {
      const ball = simulation.ball.translation(),
        velocity = simulation.ball.linvel(),
        crossedToAttackSide = ball.z < 0 && velocity.z < -4;
      if (crossedToAttackSide) this.clearReached = true;
      if (
        this.clearReached &&
        (!shot.requireRecoveryAfterTouch || this.recoveredAfterTouch)
      ) {
        this.score++;
        this.message = shot.requireRecoveryAfterTouch
          ? "CLEAR · RECOVERED · POINT"
          : "CLEAR TO THE OPPOSITE SIDE · POINT";
        return this.advance(match);
      }
    }

    if (match.phase === "goal") {
      const scored =
        !!match.goalFocus &&
        scoringTeam(match.goalFocus) === this.currentShot.goalTeam &&
        this.qualifiedTouches >= shot.minimumTouches &&
        (!shot.requireFlipReset || player.flipResetCount > 0) &&
        (!shot.requireRecoveryAfterTouch || this.recoveredAfterTouch) &&
        (shot.targetGoalX === null ||
          Math.abs(match.goalFocus.x - shot.targetGoalX) <= 2.8);
      if (scored) this.score++;
      this.message = scored ? "CALLED SHOT · POINT" : "GOAL · TASK INCOMPLETE";
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
      objective: shot.objective,
      scenario: shot.scenario,
      instruction: shot.instruction,
      timer: this.timeLeft,
      timerLimit: this.timerLimit,
      cannon: shot.cannon,
      aerial: shot.aerial,
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
    car.reset(shot.carX, shot.carZ, shot.carYaw, shot.carY);
    car.body.setRotation(
      new Quaternion().setFromEuler(
        new Euler(0, shot.carYaw, shot.carRoll, "YXZ"),
      ),
      true,
    );
    car.body.setLinvel(
      { x: shot.carVX, y: shot.carVY, z: shot.carVZ },
      true,
    );
    car.pose.snap();
    car.boost = shot.playerBoost;
    this.lastObservedTouchSequence = simulation.ballTouchSequence;
    this.playerTouches = 0;
    this.qualifiedTouches = 0;
    this.playerHasRecovered = car.grounded;
    this.recoveredAfterTouch = false;
    this.clearReached = false;
    this.lastPlayerTouchAt = -Infinity;
    this.setupTouchCreated = false;
    this.setupBouncedFromBackboard = false;
    this.firstTouchAdvanced = false;
    this.rapidSaveMade = false;
    this.wallRecoveryMade = false;
    this.wallJumpMade = false;
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
    // Hold the setup still long enough to read SAVE or SCORE before the feed.
    match.countdown = 1.25;
    match.phase = "countdown";
    match.freeze = 0;
    match.goalFocus = null;
    match.message = "";
    match.goTime = 0;
    this.timerLimit = shot.timer;
    this.timeLeft = shot.timer;
    this.transitionLeft = 0;
    this.message = shot.objective === "clear"
      ? "SAVE · CLEAR THE BALL TO THE OPPOSITE HALF"
      : "SCORE · THE FEED WILL NOT SCORE WITHOUT YOUR TOUCH";
  }
}
