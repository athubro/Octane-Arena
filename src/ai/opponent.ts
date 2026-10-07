import { Vector3, Quaternion } from "three";
import type { Car } from "../car/car";
import { neutral, type Controls } from "../input/types";
import { P } from "../config/physics";

interface InterceptPlan {
  ballX: number;
  ballY: number;
  ballZ: number;
  contactX: number;
  contactZ: number;
  attackX: number;
  attackZ: number;
  time: number;
  airborne: boolean;
  ownGoalDanger: boolean;
  feasible: boolean;
}

export interface OpponentTelemetry {
  ball: [number, number, number];
  predictedIntercept: [number, number, number];
  car: [number, number, number];
  desiredPosition: [number, number, number];
  eta: number;
  steeringError: number;
  speedError: number;
  action: string;
  confidence: number;
  reason: string;
  feasible: boolean;
  prediction: [number, number, number][];
  history: {
    time: number;
    ball: [number, number, number];
    car: [number, number, number];
  }[];
}

/** Ranked rival with progressively faster reads, cleaner hits, and aerial play. */
export class Opponent {
  name = "";
  level = 3;
  private target = new Vector3();
  private predictedBall = new Vector3();
  private local = new Vector3();
  private attack = new Vector3();
  private inverse = new Quaternion();
  private path = new Vector3();
  private sideStep = new Vector3();
  private toOpponent = new Vector3();
  private localOpponent = new Vector3();
  private aerialPoint = new Vector3();
  private aerialLocal = new Vector3();
  private heatseekerDirection = new Vector3();
  private heatseekerVelocity = new Vector3();
  private readonly predictionStep = P.dt * 2;
  private readonly predictionHorizon = 240;
  private readonly predictedX = new Float32Array(this.predictionHorizon + 1);
  private readonly predictedY = new Float32Array(this.predictionHorizon + 1);
  private readonly predictedZ = new Float32Array(this.predictionHorizon + 1);
  private readonly predictedVX = new Float32Array(this.predictionHorizon + 1);
  private readonly predictedVY = new Float32Array(this.predictionHorizon + 1);
  private readonly predictedVZ = new Float32Array(this.predictionHorizon + 1);
  private predictedCount = 0;
  private predictedGoalTeam: number | null = null;
  private nextJump = 0;
  private directCommitUntil = 0;
  private aerialLaunchedAt = -Infinity;
  private aerialDoubleUsed = false;
  private heatseekerMode = false;
  private stateHistory: OpponentTelemetry["history"] = [];
  telemetry: OpponentTelemetry = {
    ball: [0, 0, 0],
    predictedIntercept: [0, 0, 0],
    car: [0, 0, 0],
    desiredPosition: [0, 0, 0],
    eta: 0,
    steeringError: 0,
    speedError: 0,
    action: "Approach",
    confidence: 0,
    reason: "Waiting for a decision cycle.",
    feasible: false,
    prediction: [],
    history: [],
  };
  constructor() {
    this.rename();
  }

  rename() {
    const names = [
      "Kestrel",
      "Vanta",
      "Rivet",
      "Flux",
      "Mistral",
      "Brisk",
      "Cinder",
      "Fable",
      "Quasar",
      "Tinker",
      "Relay",
      "Aster",
    ];
    this.name = names[Math.floor(Math.random() * names.length)];
  }

  reset() {
    this.nextJump = 0;
    this.directCommitUntil = 0;
    this.aerialLaunchedAt = -Infinity;
    this.aerialDoubleUsed = false;
    this.target.set(0, 0, 0);
    this.aerialPoint.set(0, 0, 0);
    this.stateHistory = [];
  }

  setHeatseekerMode(enabled: boolean) {
    this.heatseekerMode = enabled;
  }

  sample(
    car: Car,
    ball: { x: number; y: number; z: number },
    time: number,
    ballVelocity: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 },
    opponents: readonly Car[] = [],
    heatseekerTargetTeam: number | null = null,
  ): Controls {
    const c = neutral();
    const p = car.body.translation();
    this.stateHistory.push({
      time,
      ball: [ball.x, ball.y, ball.z],
      car: [p.x, p.y, p.z],
    });
    if (this.stateHistory.length > 8) this.stateHistory.shift();
    const skill = Math.max(0, Math.min(1, (this.level - 1) / 9));
    let shotTargetX = 0;
    if (skill > 0.65) {
      const opponentGoalZ =
        car.team === 0 ? -P.arena.halfLength : P.arena.halfLength;
      for (const other of opponents) {
        if (!other.active || !other.body.isEnabled() || other.team === car.team)
          continue;
        const defender = other.body.translation();
        if (
          Math.abs(defender.z - opponentGoalZ) < 18 &&
          Math.abs(defender.x) < P.arena.goalHalf + 5
        ) {
          const corner = P.arena.goalHalf * (0.58 + skill * 0.18);
          shotTargetX = defender.x >= 0 ? -corner : corner;
          break;
        }
      }
    }

    const currentBallDistance = Math.hypot(ball.x - p.x, ball.z - p.z),
      carVelocity = car.body.linvel(),
      carSpeed = Math.hypot(carVelocity.x, carVelocity.y, carVelocity.z),
      ownGoalSign = car.team === 0 ? 1 : -1,
      aerialSkill = Math.max(0, Math.min(1, (this.level - 5) / 5)),
      plan = this.planIntercept(
        car,
        ball,
        ballVelocity,
        shotTargetX,
        ownGoalSign,
        skill,
        aerialSkill,
        this.heatseekerMode ? heatseekerTargetTeam : null,
      ),
      interceptTime = plan.time,
      hasAerialIntercept = aerialSkill > 0 && plan.airborne && plan.feasible,
      ownGoalDanger = plan.ownGoalDanger;
    this.predictedBall.set(plan.ballX, plan.ballY, plan.ballZ);
    this.attack.set(plan.attackX, 0, plan.attackZ).normalize();
    this.target.set(plan.contactX, 0, plan.contactZ);
    if (hasAerialIntercept)
      this.aerialPoint.set(plan.contactX, plan.ballY - 0.15, plan.contactZ);

    // Ranks below pro retain small aiming error. The pro uses the selected
    // collision-safe shot line without wandering its contact point.
    const error = (1 - skill) * 1.05;
    this.target.x += Math.sin(time * (1.3 + skill) + car.team * 3) * error;
    this.target.z += Math.sin(time * 0.83 + car.team) * error * 0.7;

    // A close commit is valid only from behind the ball on the chosen shot
    // line. If the bot is on the wrong side it must circle to the safe line,
    // rather than ploughing through the ball toward its own net.
    const ballFromCarX = this.predictedBall.x - p.x,
      ballFromCarZ = this.predictedBall.z - p.z,
      safeSide =
        ballFromCarX * this.attack.x + ballFromCarZ * this.attack.z > 0.45,
      forwardAlignment =
        car.forward.x * this.attack.x + car.forward.z * this.attack.z,
      closeShot =
        skill > 0.78 &&
        currentBallDistance < 4.6 + skill * 3.2 &&
        safeSide &&
        forwardAlignment > 0.15 &&
        (!hasAerialIntercept || plan.ballY < 4.4 || currentBallDistance < 3.4);
    if (closeShot) this.directCommitUntil = time + 0.3;
    const directCommit =
      closeShot ||
      (skill > 0.78 &&
        time < this.directCommitUntil &&
        safeSide &&
        forwardAlignment > 0.15);
    if (!safeSide && currentBallDistance < 10) {
      // Go around the ball before lining up behind it. Driving straight to
      // the contact point from the goal side would hit it toward our own net.
      const sideX = -this.attack.z,
        sideZ = this.attack.x,
        side =
          (p.x - this.predictedBall.x) * sideX +
            (p.z - this.predictedBall.z) * sideZ >=
          0
            ? 1
            : -1;
      this.target.set(
        this.predictedBall.x - this.attack.x * 1.8 + sideX * side * 3.4,
        0,
        this.predictedBall.z - this.attack.z * 1.8 + sideZ * side * 3.4,
      );
    }
    if (directCommit) {
      this.target.set(
        this.predictedBall.x - this.attack.x * 1.35,
        0,
        this.predictedBall.z - this.attack.z * (ownGoalDanger ? 1.9 : 1.35),
      );
    }

    // Route around a rival who is standing in the driving line. The bot
    // contests the ball, but does not turn a normal approach into a demo run.
    this.path.set(this.target.x - p.x, 0, this.target.z - p.z);
    let pathLengthSq = this.path.lengthSq();
    let nearestOpponent = Infinity;
    let nearestClosing = 0;
    let nearestSide = 1;
    for (const other of opponents) {
      if (!other.active || !other.body.isEnabled() || other.team === car.team)
        continue;
      const otherPosition = other.body.translation();
      this.toOpponent.set(otherPosition.x - p.x, 0, otherPosition.z - p.z);
      const opponentDistance = this.toOpponent.length();
      if (opponentDistance < nearestOpponent) {
        nearestOpponent = opponentDistance;
        const velocity = car.body.linvel();
        nearestClosing =
          opponentDistance > 0
            ? (velocity.x * this.toOpponent.x +
                velocity.z * this.toOpponent.z) /
              opponentDistance
            : 0;
        this.localOpponent
          .copy(this.toOpponent)
          .applyQuaternion(this.inverse.copy(car.body.rotation()).invert());
        nearestSide =
          this.localOpponent.x === 0
            ? Math.sin(time * 2 + car.team) < 0
              ? -1
              : 1
            : Math.sign(this.localOpponent.x);
      }

      // Pro ranks commit through a challenge instead of orbiting the ball to
      // route around a nearby opponent. Lower ranks still take the safer path.
      if (skill >= 0.85) continue;
      if (pathLengthSq < 1e-6) continue;
      const along = Math.max(
        0,
        Math.min(1, this.toOpponent.dot(this.path) / pathLengthSq),
      );
      if (along <= 0 || along >= 1) continue;
      const separation = this.localOpponent
        .copy(this.toOpponent)
        .addScaledVector(this.path, -along)
        .length();
      if (separation >= 4.5) continue;
      this.sideStep.set(-this.path.z, 0, this.path.x).normalize();
      const side = this.toOpponent.dot(this.sideStep) >= 0 ? -1 : 1;
      this.target.addScaledVector(this.sideStep, side * (4.5 - separation));
      this.path.set(this.target.x - p.x, 0, this.target.z - p.z);
      pathLengthSq = this.path.lengthSq();
    }

    this.local
      .copy(this.target)
      .sub(p)
      .applyQuaternion(this.inverse.copy(car.body.rotation()).invert());
    const angle = Math.atan2(this.local.x, -this.local.z);
    const distance = this.local.length();
    const absAngle = Math.abs(angle);
    const reverse = skill < 0.85 && absAngle > 2.35 && distance < 13;
    c.steer = Math.max(-1, Math.min(1, angle * (1.45 + skill * 0.8)));
    c.throttle = 0;
    if (reverse) c.steer = -c.steer;
    c.slide =
      absAngle > (skill >= 0.85 ? 1.2 : 0.85) &&
      Math.abs(car.forwardSpeed) > (skill >= 0.85 ? 10 : 5) &&
      distance > (skill >= 0.85 ? 12 : 3.5);
    // Choose speed from braking distance. The old fixed speed gate only
    // coasted when fast, so a pro bot kept sliding past its approach point.
    const maxApproachSpeed =
        skill >= 0.99
          ? Math.min(car.maxLinearSpeed * 0.92, P.car.maxSpeed * 1.3)
          : 8 + skill * 14,
      distanceToContact = Math.max(0, distance - 1.5),
      contactSpeed = 6 + skill * 4,
      turnFactor = Math.max(0.35, 1 - Math.max(0, absAngle - 0.35) * 0.4),
      desiredSpeed =
        Math.min(
          maxApproachSpeed,
          Math.sqrt(contactSpeed * contactSpeed + 36 * distanceToContact),
        ) * turnFactor;
    if (reverse) c.throttle = -0.65;
    else if (car.forwardSpeed > desiredSpeed + 0.7) c.throttle = -1;
    else if (car.forwardSpeed < desiredSpeed - 0.7) c.throttle = 1;
    else if (absAngle > 1.7 && distance > 3) c.throttle = 0.3;

    const aligned = absAngle < 0.38 + (1 - skill) * 0.35;
    const boostReserve = 8 + (1 - skill) * 24;
    c.boost =
      c.throttle > 0 &&
      car.forwardSpeed < desiredSpeed - 1 &&
      aligned &&
      distance > 7 &&
      Math.abs(car.lateralSlip) < 4 &&
      car.boost > boostReserve &&
      (skill > 0.35 || time % 5 < 2.2);
    if (nearestOpponent < 7 && skill < 0.85) c.boost = false;
    if (nearestOpponent < 3.3 && nearestClosing > 1.5 && skill < 0.85) {
      c.boost = false;
      c.throttle = -0.35;
      c.steer = -nearestSide * 0.85;
    }

    // Low ranks contest simple hops. Higher ranks time aerial takeoffs against
    // the predicted ball instead of jumping at its current position.
    const ballDistance = currentBallDistance;
    const jumpHeight = 1.7 + skill * 2.7,
      jumpRange = 2.3 + skill * 1.2,
      aerialActive = time - this.aerialLaunchedAt < 1.6;
    if (car.grounded && time > this.nextJump) {
      const launchDistance = Math.hypot(
          this.aerialPoint.x - p.x,
          this.aerialPoint.z - p.z,
        ),
        launchAerial =
          aerialSkill > 0 &&
          hasAerialIntercept &&
          launchDistance < 3.8 + aerialSkill * 4.4 &&
          interceptTime > 0.25;
      if (launchAerial) {
        c.jump = true;
        this.aerialLaunchedAt = time;
        this.aerialDoubleUsed = false;
        this.nextJump = time + 1.65 - aerialSkill * 0.35;
      } else if (
        !hasAerialIntercept &&
        ball.y > 1.45 &&
        ball.y < jumpHeight &&
        ballDistance < jumpRange &&
        aerialSkill < 0.6
      ) {
        c.jump = true;
        this.nextJump = time + 1.25 - skill * 0.3;
      }
    }
    const aerialAge = time - this.aerialLaunchedAt;
    if (aerialActive && aerialAge >= 0 && !car.grounded) {
      // Hold the first jump for height, then use a clean second impulse.
      c.jump = aerialAge < 0.17;
      if (aerialAge >= 0.25 && aerialAge < 0.27 && !this.aerialDoubleUsed) {
        c.jump = true;
        this.aerialDoubleUsed = true;
      }
      this.aerialLocal
        .copy(this.aerialPoint)
        .sub(p)
        .applyQuaternion(this.inverse.copy(car.body.rotation()).invert());
      const horizontal = Math.hypot(this.aerialLocal.x, this.aerialLocal.z),
        yawError = Math.atan2(this.aerialLocal.x, -this.aerialLocal.z),
        pitchError = Math.atan2(this.aerialLocal.y, Math.max(0.2, horizontal));
      c.pitch = Math.max(
        -1,
        Math.min(1, -pitchError * (1.1 + aerialSkill * 0.55)),
      );
      c.yaw = Math.max(-1, Math.min(1, yawError * (1.05 + aerialSkill * 0.45)));
      c.roll = Math.max(-0.55, Math.min(0.55, car.right.y * 0.55));
      const distanceToIntercept = this.aerialLocal.length(),
        aerialSpeedLimit = Math.min(
          car.maxLinearSpeed * 0.8,
          Math.sqrt(64 + 30 * Math.max(0, distanceToIntercept - 1.5)),
        );
      c.throttle = distanceToIntercept > 2.5 ? 1 : 0;
      c.boost =
        car.boost > 0 &&
        distanceToIntercept > 5 &&
        carSpeed < aerialSpeedLimit &&
        Math.abs(yawError) < 0.72 &&
        Math.abs(pitchError) < 0.62 &&
        (this.aerialPoint.y > p.y || aerialAge < 0.45);
    } else if (!car.grounded) {
      c.pitch = car.forward.y > 0.05 ? 0.3 : -0.22;
      c.roll = car.right.y * 0.65;
    }
    const action =
        aerialActive && !car.grounded
          ? "Aerial interception"
          : directCommit
            ? "Challenge"
            : ownGoalDanger
              ? "Defensive clear"
              : !safeSide
                ? "Reposition behind ball"
                : "Controlled approach",
      reason = !plan.feasible
        ? "No reachable predicted contact; taking the safest available fallback."
        : ownGoalDanger
          ? "Predicted ball path threatens the own goal; favor a defensive contact."
          : !safeSide
            ? "Approach from the goal side would create a poor touch; circling to the safe side."
            : hasAerialIntercept
              ? "Aerial target is based on the predicted ball position and estimated arrival time."
              : "Selected the earliest reachable point on a safe approach line.",
      prediction = [0, 12, 24, 36, 48, 60, 72]
        .filter((i) => i < this.predictedCount)
        .map(
          (i) =>
            [this.predictedX[i], this.predictedY[i], this.predictedZ[i]] as [
              number,
              number,
              number,
            ],
        );
    this.telemetry = {
      ball: [ball.x, ball.y, ball.z],
      predictedIntercept: [plan.ballX, plan.ballY, plan.ballZ],
      car: [p.x, p.y, p.z],
      desiredPosition: [this.target.x, this.target.y, this.target.z],
      eta: interceptTime,
      steeringError: angle,
      speedError: desiredSpeed - car.forwardSpeed,
      action,
      confidence: Math.max(
        0,
        Math.min(
          1,
          (plan.feasible ? 0.72 : 0.25) +
            (safeSide ? 0.16 : 0) +
            (absAngle < 0.5 ? 0.12 : 0),
        ),
      ),
      reason,
      feasible: plan.feasible,
      prediction,
      history: this.stateHistory.map((state) => ({
        ...state,
        ball: [...state.ball],
        car: [...state.car],
      })),
    };
    return c;
  }

  /** Predict the ball with fixed substeps, gravity, damping, and stadium rebounds. */
  private predictBallTrajectory(
    ball: { x: number; y: number; z: number },
    velocity: { x: number; y: number; z: number },
    heatseekerTargetTeam: number | null,
  ) {
    const a = P.arena,
      r = P.ball.radius,
      dt = this.predictionStep,
      drag = 1 / (1 + P.ball.drag * dt);
    let x = ball.x,
      y = ball.y,
      z = ball.z,
      vx = velocity.x,
      vy = velocity.y,
      vz = velocity.z;
    this.predictedGoalTeam = null;
    this.predictedCount = 1;
    this.predictedX[0] = x;
    this.predictedY[0] = y;
    this.predictedZ[0] = z;
    this.predictedVX[0] = vx;
    this.predictedVY[0] = vy;
    this.predictedVZ[0] = vz;

    for (let i = 1; i <= this.predictionHorizon; i++) {
      vy -= P.gravity * dt;
      x += vx * dt;
      y += vy * dt;
      z += vz * dt;
      vx *= drag;
      vy *= drag;
      vz *= drag;

      if (y < r) {
        y = r;
        if (vy < 0) vy = Math.abs(vy) < 1 ? 0 : -vy * P.ball.restitution;
        vx *= 0.985;
        vz *= 0.985;
      } else if (y > a.height - r) {
        y = a.height - r;
        if (vy > 0) vy = -vy * 0.58;
      }

      const inGoalMouth =
        Math.abs(x) < a.goalHalf - r && y >= 0 && y < a.goalHeight - r;
      let inGoalTunnel = false;
      if (Math.abs(z) > a.halfLength - r) {
        if (inGoalMouth) {
          inGoalTunnel = true;
          if (Math.abs(x) > a.goalHalf - r) {
            x = Math.sign(x) * (a.goalHalf - r);
            vx = -Math.sign(x) * Math.abs(vx) * 0.65;
          }
          if (y > a.goalHeight - r) {
            y = a.goalHeight - r;
            vy = -Math.abs(vy) * 0.58;
          }
          if (Math.abs(z) > a.halfLength + a.goalDepth - r) {
            z = Math.sign(z) * (a.halfLength + a.goalDepth - r);
            vz = -Math.sign(z) * Math.abs(vz) * 0.65;
          }
          if (
            Math.abs(z) > a.halfLength + r &&
            Math.abs(x) < a.goalHalf - r &&
            y >= 0 &&
            y < a.goalHeight - r
          ) {
            this.predictedGoalTeam = z < 0 ? 0 : 1;
          }
        } else if (Math.abs(x) <= a.halfWidth - a.corner) {
          z = Math.sign(z) * (a.halfLength - r);
          if (vz * Math.sign(z) > 0) vz = -vz * 0.68;
        }
      }

      if (!inGoalTunnel) {
        // The field shell rounds both corners and curves inward at floor and
        // ceiling. Approximate that cross-section before resolving its normal.
        const lowerY = Math.max(0, Math.min(a.ramp, y)),
          lowerInset =
            y < a.ramp
              ? a.ramp *
                (1 - Math.sqrt(Math.max(0, 1 - (1 - lowerY / a.ramp) ** 2)))
              : 0,
          upperY = Math.max(0, Math.min(a.ramp, y - (a.height - a.ramp))),
          upperInset =
            y > a.height - a.ramp
              ? a.ramp *
                (1 - Math.sqrt(Math.max(0, 1 - (upperY / a.ramp) ** 2)))
              : 0,
          inset = Math.max(lowerInset, upperInset),
          width = a.halfWidth - r - inset,
          length = a.halfLength - r - inset,
          corner = Math.max(0.1, a.corner - r),
          cornerX = width - corner,
          cornerZ = length - corner,
          ax = Math.abs(x),
          az = Math.abs(z);
        let nx = 0,
          nz = 0,
          correction = 0;
        if (ax > cornerX && az > cornerZ) {
          const dx = ax - cornerX,
            dz = az - cornerZ,
            distance = Math.hypot(dx, dz);
          if (distance > corner) {
            nx = (Math.sign(x) * dx) / (distance || 1);
            nz = (Math.sign(z) * dz) / (distance || 1);
            correction = distance - corner;
          }
        } else if (ax > width) {
          nx = Math.sign(x);
          correction = ax - width;
        } else if (az > length) {
          nz = Math.sign(z);
          correction = az - length;
        }
        if (correction > 0) {
          x -= nx * correction;
          z -= nz * correction;
          const outwardSpeed = vx * nx + vz * nz;
          if (outwardSpeed > 0) {
            vx -= nx * outwardSpeed * 1.68;
            vz -= nz * outwardSpeed * 1.68;
            vx *= 0.985;
            vz *= 0.985;
          }
        }
      }

      if (heatseekerTargetTeam !== null) {
        const speed = Math.hypot(vx, vy, vz),
          targetZ =
            (heatseekerTargetTeam === 0 ? -1 : 1) *
            (a.halfLength + a.goalDepth - 1.2);
        if (speed > 1e-4) {
          this.heatseekerDirection.set(-x, 2.1 - y, targetZ - z).normalize();
          this.heatseekerVelocity
            .set(vx, vy, vz)
            .normalize()
            .lerp(this.heatseekerDirection, 0.018)
            .normalize()
            .multiplyScalar(speed);
          vx = this.heatseekerVelocity.x;
          vy = this.heatseekerVelocity.y;
          vz = this.heatseekerVelocity.z;
        }
      }

      this.predictedX[i] = x;
      this.predictedY[i] = y;
      this.predictedZ[i] = z;
      this.predictedVX[i] = vx;
      this.predictedVY[i] = vy;
      this.predictedVZ[i] = vz;
      this.predictedCount = i + 1;
      if (this.predictedGoalTeam !== null) break;
    }
  }

  /** Choose the earliest collision point the car can reach on a safe shot line. */
  private planIntercept(
    car: Car,
    ball: { x: number; y: number; z: number },
    ballVelocity: { x: number; y: number; z: number },
    shotTargetX: number,
    ownGoalSign: number,
    skill: number,
    aerialSkill: number,
    heatseekerTargetTeam: number | null,
  ): InterceptPlan {
    this.predictBallTrajectory(ball, ballVelocity, heatseekerTargetTeam);
    const p = car.body.translation(),
      velocity = car.body.linvel(),
      carSpeed = Math.hypot(velocity.x, velocity.z),
      attackingGoalZ = -ownGoalSign * (P.arena.halfLength + 5),
      maxIndex =
        this.predictedGoalTeam === null
          ? this.predictedCount
          : Math.max(1, this.predictedCount - 1);
    let best: InterceptPlan | null = null,
      bestScore = Infinity,
      fallback: InterceptPlan | null = null,
      fallbackScore = Infinity;

    for (let i = 1; i < maxIndex; i++) {
      const bx = this.predictedX[i],
        by = this.predictedY[i],
        bz = this.predictedZ[i],
        t = i * this.predictionStep;
      if (by < P.ball.radius || by > P.arena.height - P.ball.radius) continue;
      const ownGoalDanger =
          ownGoalSign * bz > P.arena.halfLength - 18 ||
          (ownGoalSign * this.predictedVZ[i] > 3 &&
            ownGoalSign * bz > P.arena.halfLength - 32),
        airborne = by > 2.05;
      if (airborne && aerialSkill < 0.12) continue;
      if (airborne && by > P.arena.goalHeight + 0.5) continue;

      const targetX = ownGoalDanger
          ? bx >= 0
            ? -P.arena.goalHalf * 1.7
            : P.arena.goalHalf * 1.7
          : shotTargetX,
        aimX = targetX - bx,
        aimZ = attackingGoalZ - bz,
        aimLength = Math.hypot(aimX, aimZ) || 1,
        attackX = aimX / aimLength,
        attackZ = aimZ / aimLength,
        offset = 1.55 + (1 - skill) * 0.6,
        contactX = bx - attackX * offset,
        contactZ = bz - attackZ * offset,
        routeX = contactX - p.x,
        routeZ = contactZ - p.z,
        distance = Math.hypot(routeX, routeZ),
        dirX = routeX / (distance || 1),
        dirZ = routeZ / (distance || 1),
        facingDot = Math.max(
          -1,
          Math.min(1, car.forward.x * dirX + car.forward.z * dirZ),
        ),
        turnAngle = Math.acos(facingDot),
        turnTime = Math.min(
          1.55,
          (turnAngle / (1.25 + carSpeed * 0.055)) * (1 - skill * 0.2),
        ),
        driveTime = Math.max(0, t - turnTime),
        velocityAlong = velocity.x * dirX + velocity.z * dirZ,
        initialSpeed =
          turnAngle < 0.8
            ? Math.max(0, velocityAlong)
            : Math.max(0, velocityAlong) * 0.35,
        acceleration =
          8.5 +
          skill * 6.5 +
          (car.boost > 0 ? 3 + skill * 3 : 0) +
          (airborne ? aerialSkill * 3 : 0),
        reachable = Math.min(
          car.maxLinearSpeed * driveTime,
          initialSpeed * driveTime + 0.5 * acceleration * driveTime * driveTime,
        ),
        distanceNeeded = Math.max(0, distance - 1.2),
        deficit = distanceNeeded - reachable,
        requiredRise = Math.max(0, by - (p.y + 0.95)),
        aerialTime = Math.max(0, t - 0.28),
        aerialReach =
          1.75 +
          aerialSkill * 0.7 +
          (aerialSkill >= 0.35
            ? 0.5 * (3.5 + aerialSkill * 4) * aerialTime ** 2 +
              aerialSkill * 2.3 * aerialTime
            : 0),
        heightReachable = !airborne || requiredRise <= aerialReach,
        feasible = deficit <= 0 && heightReachable,
        plan: InterceptPlan = {
          ballX: bx,
          ballY: by,
          ballZ: bz,
          contactX,
          contactZ,
          attackX,
          attackZ,
          time: t,
          airborne,
          ownGoalDanger,
          feasible,
        };
      if (feasible) {
        const score = t + (ownGoalDanger ? -0.18 : 0) + requiredRise * 0.012;
        if (score < bestScore) {
          best = plan;
          bestScore = score;
        }
      }
      const unreachablePenalty =
          Math.max(0, deficit) +
          (heightReachable ? 0 : (requiredRise - aerialReach) * 2.5),
        score = unreachablePenalty + t * 0.08 + (ownGoalDanger ? 0 : 0.2);
      if (score < fallbackScore) {
        fallback = plan;
        fallbackScore = score;
      }
    }

    if (best) return best;
    if (fallback) return fallback;

    const bx = ball.x,
      by = Math.max(P.ball.radius, ball.y),
      bz = ball.z,
      ownGoalDanger = ownGoalSign * bz > P.arena.halfLength - 18,
      targetX = ownGoalDanger
        ? bx >= 0
          ? -P.arena.goalHalf * 1.7
          : P.arena.goalHalf * 1.7
        : shotTargetX,
      aimX = targetX - bx,
      aimZ = attackingGoalZ - bz,
      length = Math.hypot(aimX, aimZ) || 1,
      attackX = aimX / length,
      attackZ = aimZ / length;
    return {
      ballX: bx,
      ballY: by,
      ballZ: bz,
      contactX: bx - attackX * 1.8,
      contactZ: bz - attackZ * 1.8,
      attackX,
      attackZ,
      time: 0.2,
      airborne: by > 2.05,
      ownGoalDanger,
      feasible: false,
    };
  }
}
