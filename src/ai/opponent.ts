import { Vector3, Quaternion } from "three";
import type { Car } from "../car/car";
import { neutral, type Controls } from "../input/types";
import { P } from "../config/physics";

/** A ground-focused rival whose aim, pace and reaction improve with ranked level. */
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
  private nextJump = 0;
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

    // Better ranks read the ball's momentum and take a cleaner line behind it.
    const lead = 0.04 + skill * 0.32;
    this.predictedBall.set(
      ball.x + ballVelocity.x * lead,
      ball.y + ballVelocity.y * lead,
      ball.z + ballVelocity.z * lead,
    );
    this.attack
      .set(
        -this.predictedBall.x,
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

    // Jump only for reachable balls; stronger ranks react sooner and reach
    // higher, while weaker ranks mostly contest low bouncing balls.
    const ballDistance = Math.hypot(ball.x - p.x, ball.z - p.z);
    const jumpHeight = 1.7 + skill * 2.7;
    const jumpRange = 2.3 + skill * 1.2;
    if (
      ball.y > 1.45 &&
      ball.y < jumpHeight &&
      ballDistance < jumpRange &&
      car.grounded &&
      time > this.nextJump
    ) {
      c.jump = true;
      this.nextJump = time + 1.25 - skill * 0.3;
    }
    if (!car.grounded) {
      c.pitch = car.forward.y > 0.05 ? 0.3 : -0.22;
      c.roll = car.right.y * 0.65;
    }
    return c;
  }
}
