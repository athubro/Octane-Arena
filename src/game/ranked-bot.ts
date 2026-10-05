const levelKey = "octane-arena-ranked-cpu-level-v1";
const eloKey = "octane-arena-ranked-cpu-elo-v1";

function read(key: string, fallback: number) {
  try {
    const n = Number(localStorage.getItem(key));
    return Number.isSafeInteger(n) && n >= 0 ? n : fallback;
  } catch { return fallback; }
}

export class RankedBotRating {
  level = Math.max(1, Math.min(10, read(levelKey, 3)));
  elo = read(eloKey, 0);

  setLevel(level: number) {
    this.level = Math.max(1, Math.min(10, Math.round(level)));
    this.save();
  }

  winReward() { return 8 + this.level * 4; }

  recordWin() {
    this.elo += this.winReward();
    this.save();
    return this.elo;
  }

  private save() {
    try {
      localStorage.setItem(levelKey, String(this.level));
      localStorage.setItem(eloKey, String(this.elo));
    } catch { /* Ranked play still works when storage is unavailable. */ }
  }
}
