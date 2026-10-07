import { Vector3 } from "three";

const spawn = new Vector3(0, 0.36, 51);
const openingRadius = 2.55;
const lookahead = 6;
const recordKey = "octane-arena-ring-streak-v1";

export type RingResult = "passed" | "missed" | null;

export class RingChallenge {
  streak = 0;
  best = 0;
  ringIndex = 0;
  readonly centers: Vector3[] = [];
  readonly direction = new Vector3();
  readonly lastPassedCenter = new Vector3();
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
    return this.centers[0];
  }

  get activeOpeningRadius() {
    return Math.max(1.65, openingRadius - this.streak * 0.012);
  }

  start() {
    this.streak = 0;
    this.ringIndex = 0;
    this.centers.length = 0;
    this.approachOrigin.copy(spawn);
    this.centers.push(
      new Vector3(0, 3, 20),
      new Vector3(2, 3.5, 6),
      new Vector3(4, 4, -8),
    );
    while (this.centers.length < lookahead) this.appendNext();
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
    if (before > 0 || after < 0 || distance > this.activeOpeningRadius)
      return "missed";

    this.lastPassedCenter.copy(center);
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
    this.centers.shift();
    this.appendNext();
    this.ringIndex = 0;
    this.updateDirection();
    return "passed";
  }

  private updateDirection() {
    this.direction
      .subVectors(this.activeCenter, this.approachOrigin)
      .normalize();
    if (this.direction.lengthSq() < 1e-8) this.direction.set(0, 0, -1);
  }

  private appendNext() {
    const last = this.centers[this.centers.length - 1],
      previous = this.centers[this.centers.length - 2] ?? this.approachOrigin,
      forward = new Vector3().subVectors(last, previous).normalize(),
      lateral = new Vector3(-forward.z, 0, forward.x).normalize(),
      index = this.streak + this.centers.length,
      bend = Math.sin(index * 1.71) * Math.min(4.5, 1.5 + index * 0.12),
      rise = Math.sin(index * 0.83) * Math.min(2.5, 0.7 + index * 0.06);
    this.centers.push(
      last
        .clone()
        .addScaledVector(forward, 16 + Math.min(5, index * 0.15))
        .addScaledVector(lateral, bend)
        .add(new Vector3(0, rise, 0)),
    );
  }

  static get gateOpeningRadius() {
    return openingRadius;
  }

  static get startingPosition() {
    return spawn.clone();
  }
}
