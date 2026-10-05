import { Vector3, Quaternion } from "three";
import type { Car } from "../car/car";
import { neutral, type Controls } from "../input/types";
import { P } from "../config/physics";
export class Opponent {
  name = "";
  level = 3;
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
  private target = new Vector3();
  private local = new Vector3();
  private goalDirection = new Vector3();
  private inverse = new Quaternion();
  private nextJump = 0;
  sample(
    car: Car,
    ball: { x: number; y: number; z: number },
    time: number,
  ): Controls {
    const c = neutral(),
      p = car.body.translation();
    const attackSign = car.team === 0 ? -1 : 1;
    this.goalDirection
      .set(-ball.x, 0, attackSign * (P.arena.halfLength + 5 - ball.z))
      .normalize();
    this.target
      .set(ball.x, 0, ball.z)
      .addScaledVector(this.goalDirection, -4);
    const progress =
      (p.x - ball.x) * this.goalDirection.x +
      (p.z - ball.z) * this.goalDirection.z;
    if (progress > 2)
      this.target
        .set(ball.x, 0, ball.z)
        .addScaledVector(this.goalDirection, -8);
    else if (this.target.distanceTo(p) < 3)
      this.target
        .set(ball.x, 0, ball.z)
        .addScaledVector(this.goalDirection, 6);
    const distance = this.target.distanceTo(p);
    this.local
      .copy(this.target)
      .sub(p)
      .applyQuaternion(this.inverse.copy(car.body.rotation()).invert());
    const angle = Math.atan2(this.local.x, -this.local.z);
    c.steer = Math.max(-1, Math.min(1, angle * 2));
    const skill = Math.max(0, Math.min(1, (this.level - 1) / 9));
    c.throttle = 0.72 + skill * 0.28;
    c.slide = Math.abs(angle) > 1 && Math.abs(car.forwardSpeed) > 4;
    c.boost = Math.abs(angle) < 0.18 + (1 - skill) * 0.12 && distance > 9 && car.boost > 15 && (skill > 0.25 || time % 4 < 2.5);
    if (Math.abs(angle) > 2.4 && distance < 9) {
      c.throttle = -1;
      c.steer = -c.steer;
    }
    if (
      ball.y > 1.4 &&
      ball.y < 4 + skill * 2 &&
      new Vector3().copy(ball).distanceTo(p) < 4 &&
      car.grounded &&
      time > this.nextJump
    ) {
      c.jump = true;
      this.nextJump = time + 1.5;
    }
    if (!car.grounded) {
      c.pitch = car.forward.y > 0 ? 0.4 : -0.3;
      c.roll = car.right.y * 0.8;
    }
    return c;
  }
}
