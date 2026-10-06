import { Vector3, Quaternion } from "three";
import type { Car } from "../car/car";
import { neutral, type Controls } from "../input/types";
import { P } from "../config/physics";

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
  private nextJump = 0;
  private aerialLaunchedAt = -Infinity;
  private aerialDoubleUsed = false;
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
    this.aerialLaunchedAt = -Infinity;
    this.aerialDoubleUsed = false;
    this.target.set(0, 0, 0);
    this.aerialPoint.set(0, 0, 0);
  }

  sample(
    car: Car,
    ball: { x: number; y: number; z: number },
    time: number,
    ballVelocity: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 },
    opponents: readonly Car[] = [],
  ): Controls {
    const c = neutral();
    const p = car.body.translation();
    const skill = Math.max(0, Math.min(1, (this.level - 1) / 9));
    let shotTargetX = 0;
    if (skill > 0.65) {
      const opponentGoalZ = car.team === 0 ? -P.arena.halfLength : P.arena.halfLength;
      for (const other of opponents) {
        if (!other.active || !other.body.isEnabled() || other.team === car.team) continue;
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

    // Better ranks read the ball's momentum and take a cleaner line behind it.
    const lead = 0.04 + skill * 0.32;
    this.predictedBall.set(
      ball.x + ballVelocity.x * lead,
      ball.y + ballVelocity.y * lead,
      ball.z + ballVelocity.z * lead,
    );
    this.attack
      .set(
        shotTargetX - this.predictedBall.x,
        0,
        car.team === 0
          ? -(P.arena.halfLength + 5 - this.predictedBall.z)
          : P.arena.halfLength + 5 - this.predictedBall.z,
      )
      .normalize();

    // Offset the aim point away from the opponent's goal so a hit sends the
    // ball forward. Lower levels accept a wider, less deliberate approach.
    const offset = 2.15 + (1 - skill) * 1.25;
    this.target
      .set(this.predictedBall.x, 0, this.predictedBall.z)
      .addScaledVector(this.attack, -offset);
    const error = (1 - skill) * 1.05;
    this.target.x += Math.sin(time * (1.3 + skill) + car.team * 3) * error;
    this.target.z += Math.sin(time * 0.83 + car.team) * error * 0.7;

    // Skilled ranks project the ball's flight and drive to a shot line where
    // the car can meet it. The reachable window grows with rank and boost.
    const aerialSkill = Math.max(0, Math.min(1, (this.level - 5) / 5));
    let interceptTime = 0,
      interceptScore = Infinity;
    if (aerialSkill > 0 && ball.y > 2.25) {
      const velocity = car.body.linvel(),
        speed = Math.hypot(velocity.x, velocity.y, velocity.z),
        reachBonus = 2.4 + aerialSkill * 2.8 + Math.min(car.boost, 60) * 0.035;
      for (let flight = 0.32; flight <= 1.55; flight += 0.06) {
        const bx = ball.x + ballVelocity.x * flight,
          by = ball.y + ballVelocity.y * flight - 0.5 * P.gravity * flight * flight,
          bz = ball.z + ballVelocity.z * flight;
        if (by < 2.15 || by > P.arena.goalHeight + 8) continue;
        const aimX = shotTargetX - bx,
          aimZ = car.team === 0
            ? -(P.arena.halfLength + 5 - bz)
            : P.arena.halfLength + 5 - bz,
          aimLength = Math.hypot(aimX, aimZ) || 1,
          contactX = bx - (aimX / aimLength) * (1.25 + (1 - aerialSkill) * 0.3),
          contactZ = bz - (aimZ / aimLength) * (1.25 + (1 - aerialSkill) * 0.3),
          distance = Math.hypot(contactX - p.x, by - p.y, contactZ - p.z),
          reachable = (speed + 5 + aerialSkill * 5) * flight +
            0.5 * (3 + aerialSkill * 9) * flight * flight + reachBonus;
        if (distance > reachable * (0.82 + aerialSkill * 0.13)) continue;
        const score = flight * 0.78 + distance / Math.max(1, reachable) + Math.abs(by - 3) * 0.012;
        if (score >= interceptScore) continue;
        interceptScore = score;
        interceptTime = flight;
        this.aerialPoint.set(contactX, by - 0.15, contactZ);
      }
    }
    const hasAerialIntercept = Number.isFinite(interceptScore);
    if (hasAerialIntercept) this.target.set(this.aerialPoint.x, 0, this.aerialPoint.z);

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
    const reverse = absAngle > 2.35 && distance < 13;
    // Modulate throttle while turning so the car can actually follow its line.
    c.steer = Math.max(-1, Math.min(1, angle * (1.45 + skill * 0.8)));
    c.throttle = reverse ? -0.65 : absAngle > 1.4 ? 0.4 : 1;
    if (reverse) c.steer = -c.steer;
    c.slide = absAngle > 0.9 && Math.abs(car.forwardSpeed) > 7;
    const speedLimit = 9 + skill * 14;
    if (!reverse && car.forwardSpeed > speedLimit && absAngle < 0.7)
      c.throttle = 0;

    const aligned = absAngle < 0.38 + (1 - skill) * 0.35;
    const boostReserve = 8 + (1 - skill) * 24;
    c.boost =
      car.forwardSpeed < speedLimit - 1 &&
      aligned &&
      distance > 7 &&
      car.boost > boostReserve &&
      (skill > 0.35 || time % 5 < 2.2);
    if (nearestOpponent < 7) c.boost = false;
    if (nearestOpponent < 3.3 && nearestClosing > 1.5) {
      c.boost = false;
      c.throttle = -0.35;
      c.steer = -nearestSide * 0.85;
    }

    // Low ranks contest simple hops. Higher ranks time aerial takeoffs against
    // the predicted ball instead of jumping at its current position.
    const ballDistance = Math.hypot(ball.x - p.x, ball.z - p.z);
    const jumpHeight = 1.7 + skill * 2.7,
      jumpRange = 2.3 + skill * 1.2,
      aerialActive = time - this.aerialLaunchedAt < 1.6;
    if (car.grounded && time > this.nextJump) {
      const launchDistance = Math.hypot(this.aerialPoint.x - p.x, this.aerialPoint.z - p.z),
        launchAerial = aerialSkill > 0 && hasAerialIntercept &&
          launchDistance < 3.8 + aerialSkill * 4.4 && interceptTime > 0.25;
      if (launchAerial) {
        c.jump = true;
        this.aerialLaunchedAt = time;
        this.aerialDoubleUsed = false;
        this.nextJump = time + 1.65 - aerialSkill * 0.35;
      } else if (
        !hasAerialIntercept && ball.y > 1.45 && ball.y < jumpHeight &&
        ballDistance < jumpRange && aerialSkill < 0.6
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
      this.aerialLocal.copy(this.aerialPoint).sub(p).applyQuaternion(
        this.inverse.copy(car.body.rotation()).invert(),
      );
      const horizontal = Math.hypot(this.aerialLocal.x, this.aerialLocal.z),
        yawError = Math.atan2(this.aerialLocal.x, -this.aerialLocal.z),
        pitchError = Math.atan2(this.aerialLocal.y, Math.max(0.2, horizontal));
      c.pitch = Math.max(-1, Math.min(1, -pitchError * (1.1 + aerialSkill * 0.55)));
      c.yaw = Math.max(-1, Math.min(1, yawError * (1.05 + aerialSkill * 0.45)));
      c.roll = Math.max(-0.55, Math.min(0.55, car.right.y * 0.55));
      c.throttle = 1;
      c.boost = car.boost > 0 && Math.abs(yawError) < 1.05 && Math.abs(pitchError) < 0.9 &&
        (this.aerialPoint.y > p.y || aerialAge < 0.6);
    } else if (!car.grounded) {
      c.pitch = car.forward.y > 0.05 ? 0.3 : -0.22;
      c.roll = car.right.y * 0.65;
    }
    return c;
  }
}
