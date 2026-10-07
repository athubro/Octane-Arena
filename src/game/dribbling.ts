export type DribbleMode =
  | "dribbling-race"
  | "solo-dribbling"
  | "bot-ranked";

export interface DribblePoint {
  x: number;
  y: number;
  z: number;
}

export class DribblingChallenge {
  readonly levelCount = 20;
  level = 0;
  best = 0;
  progress = 0;
  completed = false;
  checkpoints: DribblePoint[] = [];
  finish: DribblePoint = { x: 0, y: 1.6, z: -30 };

  start(level = 0) {
    this.level = Math.min(Math.max(level, 0), this.levelCount - 1);
    this.progress = 0;
    this.completed = false;
    this.checkpoints = [];
    const segmentLength = 24 + this.level * 4.8;
    for (let i = 0; i < 6; i++) {
      const t = i / 5;
      this.checkpoints.push({
        x: Math.sin((this.level + 1) * 0.9 + i * 1.3) * (2.8 + this.level * 0.32),
        y: 1.4 + (i % 2) * 0.3,
        z: 12 - segmentLength * t,
      });
    }
    this.finish = {
      x: Math.sin((this.level + 1) * 1.7) * (2.1 + this.level * 0.25),
      y: 1.6,
      z: -segmentLength - 5,
    };
  }

  advance(position: { x: number; y: number; z: number }) {
    while (this.progress < this.checkpoints.length) {
      const target = this.checkpoints[this.progress];
      if (position.z > target.z) break;
      this.progress += 1;
    }
    if (this.progress >= this.checkpoints.length) {
      this.completed = true;
      return { complete: true, level: this.level + 1, total: this.levelCount };
    }
    return {
      complete: false,
      level: this.level + 1,
      total: this.levelCount,
      progress: this.progress,
      next: this.checkpoints[this.progress],
    };
  }

  completeLevel() {
    this.best = Math.max(this.best, this.level + 1);
    this.level = Math.min(this.level + 1, this.levelCount - 1);
    this.start(this.level);
  }
}
