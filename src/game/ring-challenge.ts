import { Vector3 } from "three";

const course = [
  new Vector3(0, 3, 20),
  new Vector3(2, 3.5, 6),
  new Vector3(4, 4, -8),
  new Vector3(2, 4.5, -22),
  new Vector3(0, 5, -36),
  new Vector3(-2, 5.5, -50),
  new Vector3(-4, 5, -64),
  new Vector3(-2, 4.5, -78),
  new Vector3(0, 4, -92),
];
const spawn = new Vector3(0, 0.36, 51);
const openingRadius = 2.55;
const recordKey = "octane-arena-ring-streak-v1";

export type RingResult = "passed" | "missed" | null;

export class RingChallenge {
  streak = 0;
  best = 0;
  ringIndex = 0;
  readonly centers = course;
  readonly direction = new Vector3();
  private approachOrigin = new Vector3();
  private readonly segment = new Vector3();
  private readonly intersection = new Vector3();
  private readonly offset = new Vector3();

  constructor(
    private storage: Pick<
      Storage,
      "getItem" | "setItem"
    > | null = typeof localStorage === "undefined" ? null : localStorage,
  ) {
    try {
      const saved = Number(this.storage?.getItem(recordKey));
      if (Number.isSafeInteger(saved) && saved > 0) this.best = saved;
    } catch {
      this.storage = null;
    }
    this.start();
  }

  get count() {
    return this.centers.length;
  }

  get activeCenter() {
    return this.centers[this.ringIndex];
  }

  start() {
    this.streak = 0;
    this.ringIndex = 0;
    this.approachOrigin.copy(spawn);
    this.updateDirection();
  }

  cross(
    previous: { x: number; y: number; z: number },
    current: { x: number; y: number; z: number },
  ): RingResult {
    const center = this.activeCenter,
      before = this.segment.copy(previous).sub(center).dot(this.direction),
      after = this.offset.copy(current).sub(center).dot(this.direction);
    if (before * after > 0 || Math.abs(before - after) < 1e-5) return null;

    const t = before / (before - after);
    this.intersection
      .copy(previous)
      .addScaledVector(this.offset.copy(current).sub(previous), t);
    const distanceFromAxis = this.offset.copy(this.intersection).sub(center),
      distance = distanceFromAxis
        .addScaledVector(this.direction, -distanceFromAxis.dot(this.direction))
        .length();
    if (before > 0 || after < 0 || distance > openingRadius) return "missed";

    this.streak++;
    if (this.streak > this.best) {
      this.best = this.streak;
      try {
        this.storage?.setItem(recordKey, String(this.best));
      } catch {
        this.storage = null;
      }
    }
    this.approachOrigin.copy(center);
    this.ringIndex = (this.ringIndex + 1) % this.centers.length;
    this.updateDirection();
    return "passed";
  }

  private updateDirection() {
    this.direction
      .subVectors(this.activeCenter, this.approachOrigin)
      .normalize();
    if (this.direction.lengthSq() < 1e-8) this.direction.set(0, 0, -1);
  }

  static get gateOpeningRadius() {
    return openingRadius;
  }

  static get startingPosition() {
    return spawn.clone();
  }
}
