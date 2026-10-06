import * as T from "three";

export interface ReplayPose {
  position: T.Vector3;
  rotation: T.Quaternion;
  visible: boolean;
}

export interface ReplayFrame {
  cars: ReplayPose[];
  ball: ReplayPose;
}

interface TimedReplayFrame extends ReplayFrame {
  time: number;
}

const HISTORY_SECONDS = 4;

function capture(object: T.Object3D): ReplayPose {
  return {
    position: object.position.clone(),
    rotation: object.quaternion.clone(),
    visible: object.visible,
  };
}

function interpolatePose(a: ReplayPose, b: ReplayPose, alpha: number) {
  return {
    position: a.position.clone().lerp(b.position, alpha),
    rotation: a.rotation.clone().slerp(b.rotation, alpha),
    visible: alpha < 0.5 ? a.visible : b.visible,
  };
}

/** Keeps a short render-pose history and plays it back once after a goal. */
export class GoalReplay {
  private history: TimedReplayFrame[] = [];
  private clip: TimedReplayFrame[] = [];
  private clock = 0;
  private playbackTime = 0;
  private playbackDuration = 0;
  private frame: ReplayFrame | null = null;
  active = false;
  presenting = false;

  get duration() {
    return this.playbackDuration;
  }

  record(
    delta: number,
    cars: readonly T.Object3D[],
    ball: T.Object3D,
    keepBallVisible = false,
  ) {
    if (this.presenting) return;
    this.clock += Math.max(0, Math.min(delta, 0.1));
    const ballPose = capture(ball);
    if (keepBallVisible) ballPose.visible = true;
    this.history.push({
      time: this.clock,
      cars: cars.map(capture),
      ball: ballPose,
    });
    while (
      this.history.length > 2 &&
      this.history[1].time < this.clock - HISTORY_SECONDS
    )
      this.history.shift();
  }

  start() {
    if (this.history.length < 2) return false;
    const end = this.history[this.history.length - 1].time,
      firstIndex = Math.max(
        0,
        this.history.findIndex(
          (frame) => frame.time >= end - HISTORY_SECONDS,
        ) - 1,
      );
    this.clip = this.history.slice(firstIndex);
    const sourceDuration =
      this.clip[this.clip.length - 1].time - this.clip[0].time;
    if (sourceDuration < 0.08) return false;
    this.playbackDuration = Math.max(
      1.6,
      Math.min(4.9, sourceDuration / 0.82),
    );
    this.playbackTime = 0;
    this.frame = this.sample(this.clip[0].time);
    this.active = true;
    this.presenting = true;
    return true;
  }

  advance(delta: number) {
    if (!this.presenting) return null;
    if (!this.active) return this.frame;
    this.playbackTime = Math.min(
      this.playbackDuration,
      this.playbackTime + Math.max(0, delta),
    );
    const progress = this.playbackTime / this.playbackDuration,
      start = this.clip[0].time,
      end = this.clip[this.clip.length - 1].time;
    this.frame = this.sample(start + (end - start) * progress);
    if (progress >= 1) this.active = false;
    return this.frame;
  }

  skip() {
    this.active = false;
    this.presenting = false;
    this.frame = null;
    this.clip = [];
  }

  reset() {
    this.skip();
    this.history = [];
    this.clock = 0;
    this.playbackTime = 0;
    this.playbackDuration = 0;
  }

  private sample(time: number): ReplayFrame {
    let index = 0;
    while (
      index + 1 < this.clip.length &&
      this.clip[index + 1].time < time
    )
      index++;
    const a = this.clip[index],
      b = this.clip[Math.min(index + 1, this.clip.length - 1)],
      span = b.time - a.time,
      alpha = span > 0 ? T.MathUtils.clamp((time - a.time) / span, 0, 1) : 0;
    return {
      cars: a.cars.map((pose, i) =>
        interpolatePose(pose, b.cars[i] ?? pose, alpha),
      ),
      ball: interpolatePose(a.ball, b.ball, alpha),
    };
  }
}
