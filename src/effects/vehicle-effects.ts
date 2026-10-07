import * as T from "three";
import type { Car } from "../car/car";
import { P } from "../config/physics";

/** Continuous exhaust geometry plus world-space ribbons from the rear wheels. */
export class VehicleEffects {
  private flames = new T.Group();
  private glow: T.PointLight;
  private trails: {
    points: T.Vector3[];
    positions: Float32Array;
    mesh: T.Mesh<T.BufferGeometry, T.MeshBasicMaterial>;
  }[] = [];
  private sampleTime = 0;
  private fade = 0;
  private wasActive = false;
  private boostStyle = "plasma";
  private moneyCoins: T.Mesh[] = [];
  constructor(
    private model: T.Group,
    scene: T.Scene,
    color: number,
  ) {
    for (const x of [-0.22, 0.22]) {
      const outer = new T.Mesh(
        new T.ConeGeometry(0.14, 1.5, 10),
        new T.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.65,
          depthWrite: false,
          blending: T.AdditiveBlending,
        }),
      );
      outer.rotation.x = Math.PI / 2;
      outer.position.set(x, 0, 1.4);
      this.flames.add(outer);
      const inner = new T.Mesh(
        new T.ConeGeometry(0.065, 1, 8),
        new T.MeshBasicMaterial({
          color: 0xeaffff,
          transparent: true,
          opacity: 0.95,
          depthWrite: false,
          blending: T.AdditiveBlending,
        }),
      );
      inner.rotation.x = Math.PI / 2;
      inner.position.set(x, 0, 1.15);
      this.flames.add(inner);
    }
    this.glow = new T.PointLight(color, 0, 4, 2);
    this.glow.position.set(0, 0, 1);
    this.flames.add(this.glow);
    for (let i = 0; i < 5; i++) {
      const coin = new T.Mesh(
        new T.CylinderGeometry(0.075, 0.075, 0.025, 16),
        new T.MeshStandardMaterial({
          color: 0xffca48,
          metalness: 0.8,
          roughness: 0.28,
          emissive: 0x603800,
        }),
      );
      coin.rotation.z = Math.PI / 2;
      coin.position.set((i % 2 ? 1 : -1) * 0.24, (i - 2) * 0.11, 1.2 + i * 0.28);
      coin.userData.phase = i * 1.7;
      this.flames.add(coin);
      this.moneyCoins.push(coin);
    }
    model.add(this.flames);
    for (let wheel = 0; wheel < 2; wheel++) {
      const positions = new Float32Array(48 * 6 * 3),
        geo = new T.BufferGeometry();
      geo.setAttribute("position", new T.BufferAttribute(positions, 3));
      const mesh = new T.Mesh(
        geo,
        new T.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.7,
          side: T.DoubleSide,
          depthWrite: false,
          blending: T.AdditiveBlending,
        }),
      );
      mesh.frustumCulled = false;
      scene.add(mesh);
      this.trails.push({ points: [], positions, mesh });
    }
  }
  reset() {
    this.fade = 0;
    this.wasActive = false;
    for (const t of this.trails) {
      t.points.length = 0;
      t.mesh.visible = false;
    }
    this.flames.visible = false;
  }
  setColor(color: number, style = "plasma") {
    this.boostStyle = style;
    const colors =
      style === "money"
        ? [0x48d88a, 0xffce4d, 0x9effb9, 0xffe89a]
        : style === "confetti"
          ? [0xff4f87, 0xffcf43, 0x49d6ff, 0xb87bff]
          : style === "comet"
            ? [0x50e8ff, 0xd3fbff, 0x62aaff, 0xf5ffff]
            : style === "rainbow"
              ? [0xff5d62, 0xffca45, 0x62ed9c, 0x78a8ff]
              : style === "mint"
                ? [0x42e5bd, 0xb6fff0, 0x36a98e, 0xeffffb]
                : style === "ember"
                  ? [0xff7b36, 0xffd17a, 0xff4936, 0xffe7b5]
                  : [color, 0xeaffff, color, 0xd7faff];
    this.glow.color.setHex(colors[0]);
    for (const [i, trail] of this.trails.entries())
      trail.mesh.material.color.setHex(colors[i ? 2 : 0]);
    this.flames.children.forEach((child, i) => {
      if (!(child instanceof T.Mesh)) return;
      if (i < 4) child.material.color.setHex(colors[i]);
      if (this.moneyCoins.includes(child)) child.visible = false;
    });
    this.moneyCoins.forEach((coin) => (coin.visible = style === "money"));
  }
  previewBoost(time: number, enabled: boolean) {
    this.flames.visible = enabled;
    this.flames.scale.z =
      1 + 0.17 * Math.sin(time * 67) + 0.1 * Math.sin(time * 113);
    this.flames.position.z = 0.65 * (1 - this.flames.scale.z);
    this.glow.intensity = enabled ? 2.4 : 0;
    this.animateCoins(time, enabled);
  }
  dispose() {
    for (const t of this.trails) {
      t.mesh.removeFromParent();
      t.mesh.geometry.dispose();
      t.mesh.material.dispose();
    }
  }
  update(car: Car, dt: number, time: number, active: boolean) {
    if (!active && this.wasActive) this.reset();
    this.wasActive = active;
    this.flames.visible = active && car.boosting;
    this.flames.scale.z =
      1 + 0.17 * Math.sin(time * 67) + 0.1 * Math.sin(time * 113);
    this.flames.position.z = 0.65 * (1 - this.flames.scale.z);
    this.glow.intensity = car.boosting ? 2.4 : 0;
    this.animateCoins(time, active && car.boosting);
    const sonic = active && car.wheelContact.some(Boolean) && car.supersonic;
    if (!car.wheelContact.some(Boolean)) {
      this.fade = 0;
      this.trails.forEach((t) => (t.points.length = 0));
    }
    this.fade = T.MathUtils.lerp(
      this.fade,
      sonic ? 1 : 0,
      1 - Math.exp(-dt * (sonic ? 14 : 5)),
    );
    this.sampleTime += dt;
    if (this.sampleTime >= 1 / 90) {
      this.sampleTime = 0;
      this.trails.forEach((t, i) => {
        const index = car.wheelContact[i + 2] ? i + 2 : i;
        const p = car.wheelHits[index]
          .clone()
          .addScaledVector(car.normal, 0.025);
        if (t.points.length && p.distanceTo(t.points[0]) > 4)
          t.points.length = 0;
        t.points.unshift(p);
        if (t.points.length > 48) t.points.pop();
      });
    }
    const right = new T.Vector3(1, 0, 0).applyQuaternion(this.model.quaternion);
    for (const t of this.trails) {
      t.mesh.visible =
        this.fade > 0.02 && active && car.wheelContact.some(Boolean);
      t.mesh.material.opacity = this.fade * 0.7;
      let k = 0;
      for (let i = 0; i < t.points.length - 1; i++) {
        const width = 0.07 * (1 - i / 48),
          a = t.points[i],
          b = t.points[i + 1];
        for (const [p, side] of [
          [a, -1],
          [a, 1],
          [b, -1],
          [b, -1],
          [a, 1],
          [b, 1],
        ] as const) {
          t.positions[k++] = p.x + right.x * width * side;
          t.positions[k++] = p.y + right.y * width * side;
          t.positions[k++] = p.z + right.z * width * side;
        }
      }
      t.mesh.geometry.setDrawRange(0, k / 3);
      t.mesh.geometry.attributes.position.needsUpdate = true;
    }
  }
  private animateCoins(time: number, enabled: boolean) {
    this.moneyCoins.forEach((coin) => {
      coin.visible = enabled && this.boostStyle === "money";
      coin.rotation.y = time * 5 + coin.userData.phase;
      coin.position.y =
        Math.sin(time * 8 + coin.userData.phase) * 0.09 +
        (Number(coin.userData.phase) - 3.4) * 0.055;
    });
  }
}
