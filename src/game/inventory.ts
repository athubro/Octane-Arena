import {
  inventory,
  palette,
  starter,
  type Preset,
  type CosmeticSlot,
} from "../../shared/catalog";
export * from "../../shared/catalog";
export interface Profile {
  name: string;
  title: string;
  level: number;
  avatarId?: string;
  xp?: number;
}
export class Garage {
  onSave?: () => void;
  profile: Profile = { name: "Guest", title: "Rookie", level: 1 };
  presets: Preset[] = [starter()];
  selected = "starter";
  constructor() {
    try {
      const data = JSON.parse(
        localStorage.getItem("octane-arena-garage") ?? "{}",
      );
      if (Array.isArray(data.presets) && data.presets.length) {
        this.presets = data.presets
          .slice(0, 24)
          .map((raw: Record<string, unknown>, i: number) => {
            const p = starter();
            p.id = `preset-${i}`;
            p.name = `Preset ${i + 1}`;
            for (const slot of Object.keys(inventory) as CosmeticSlot[]) {
              if (inventory[slot].some((item) => item.id === raw[slot]))
                (p[slot] as string) = raw[slot] as string;
            }
            for (const team of ["blue", "orange"] as const)
              if (palette.includes(raw[team] as string))
                p[team] = raw[team] as string;
            return p;
          });
        this.selected =
          this.presets[
            Math.max(
              0,
              Math.min(this.presets.length - 1, Number(data.index) || 0),
            )
          ].id;
      }
    } catch {
      /* A corrupt or unavailable save never prevents playing. */
    }
    this.profile.name = this.readDisplayName();
  }
  private readDisplayName() {
    try {
      const value = document.cookie
        .split(";")
        .map((entry) => entry.trim())
        .find((entry) => entry.startsWith("octane-arena-display-name="))
        ?.slice("octane-arena-display-name=".length);
      const name = value ? decodeURIComponent(value).trim() : "";
      return /^[A-Za-z0-9 _-]{1,24}$/.test(name) ? name : "Guest";
    } catch {
      return "Guest";
    }
  }
  setDisplayName(value: string) {
    const name = value.trim();
    if (!/^[A-Za-z0-9 _-]{1,24}$/.test(name)) return false;
    try {
      const secure = location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `octane-arena-display-name=${encodeURIComponent(name)}; Max-Age=31536000; Path=/; SameSite=Lax${secure}`;
    } catch {
      return false;
    }
    if (this.readDisplayName() !== name) return false;
    this.profile.name = name;
    return true;
  }
  get current() {
    return this.presets.find((p) => p.id === this.selected) ?? this.presets[0];
  }
  duplicate() {
    if (this.presets.length >= 24) return;
    const p = {
      ...this.current,
      id: crypto.randomUUID(),
      name: `Preset ${this.presets.length + 1}`,
    };
    this.presets.push(p);
    this.selected = p.id;
    this.save();
  }
  save() {
    if (this.onSave) {
      this.onSave();
      return;
    }
    try {
      localStorage.setItem(
        "octane-arena-garage",
        JSON.stringify({
          version: 1,
          presets: this.presets,
          index: this.presets.indexOf(this.current),
          profile: this.profile,
        }),
      );
    } catch {
      /* Session-only fallback. */
    }
  }
}
