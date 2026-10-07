import * as T from "three";
export class GoalExplosion {
  private group = new T.Group();
  private age = 10;
  private effect = "pulse";
  private flash: T.Mesh<T.SphereGeometry, T.MeshBasicMaterial>;
  private rings: T.Mesh<T.TorusGeometry, T.MeshBasicMaterial>[] = [];
  private light = new T.PointLight(0x7cf9ff, 0, 55, 1.5);
  private forest = new T.Group();
  private blueOut = new T.Group();
  private skull = new T.Group();
  private blueWash!: T.Mesh<T.SphereGeometry, T.MeshBasicMaterial>;
  private blueFloor!: T.Mesh<T.PlaneGeometry, T.MeshBasicMaterial>;
  constructor(scene: T.Scene, scale = 1) {
    this.group.scale.setScalar(scale);
    this.flash = new T.Mesh(
      new T.SphereGeometry(1, 24, 16),
      new T.MeshBasicMaterial({
        color: 0x7cf9ff,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
        blending: T.AdditiveBlending,
        side: T.DoubleSide,
      }),
    );
    this.group.add(this.flash, this.light);
    for (let i = 0; i < 3; i++) {
      const ring = new T.Mesh(
        new T.TorusGeometry(1, 0.035, 6, 80),
        new T.MeshBasicMaterial({
          color: 0x7cf9ff,
          transparent: true,
          depthWrite: false,
          blending: T.AdditiveBlending,
        }),
      );
      ring.rotation.set(i * 0.7, i * 0.4, 0);
      this.group.add(ring);
      this.rings.push(ring);
    }
    this.buildForest();
    this.buildBlueOut();
    this.buildSkull();
    this.group.add(this.forest, this.blueOut, this.skull);
    scene.add(this.group);
    this.group.visible = false;
  }
  private buildForest() {
    this.forest.visible = false;
    for (let vine = 0; vine < 5; vine++) {
      const angle = (vine / 5) * Math.PI * 2,
        points = Array.from({ length: 7 }, (_, i) => {
          const t = i / 6,
            radius = 0.2 + t * (1.4 + (vine % 2) * 0.5),
            turn = angle + t * 1.7;
          return new T.Vector3(
            Math.cos(turn) * radius,
            t * (5.5 + (vine % 3) * 0.6),
            Math.sin(turn) * radius,
          );
        }),
        curve = new T.CatmullRomCurve3(points),
        material = new T.MeshStandardMaterial({
          color: vine % 2 ? 0x4c9c4b : 0x2d7047,
          roughness: 0.7,
          transparent: true,
          opacity: 1,
          depthWrite: false,
        });
      this.forest.add(
        new T.Mesh(new T.TubeGeometry(curve, 24, 0.075, 7, false), material),
      );
      for (let leaf = 1; leaf <= 4; leaf++) {
        const t = leaf / 5,
          point = curve.getPoint(t),
          leafMesh = new T.Mesh(
            new T.SphereGeometry(0.19, 8, 6),
            new T.MeshStandardMaterial({
              color: leaf % 2 ? 0x8fd15b : 0x4fae67,
              roughness: 0.6,
              transparent: true,
              opacity: 1,
              depthWrite: false,
            }),
          );
        leafMesh.position.copy(point);
        leafMesh.position.x += Math.cos(angle + leaf) * 0.28;
        leafMesh.position.z += Math.sin(angle + leaf) * 0.28;
        leafMesh.scale.set(1.3, 0.45, 0.65);
        this.forest.add(leafMesh);
      }
    }
  }
  private buildBlueOut() {
    this.blueOut.visible = false;
    this.blueWash = new T.Mesh(
      new T.SphereGeometry(105, 32, 20),
      new T.MeshBasicMaterial({
        color: 0x064dff,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
        side: T.BackSide,
      }),
    );
    this.blueWash.renderOrder = 2;
    this.blueOut.add(this.blueWash);
    this.blueFloor = new T.Mesh(
      new T.PlaneGeometry(140, 140),
      new T.MeshBasicMaterial({
        color: 0x155cff,
        transparent: true,
        opacity: 0.36,
        depthWrite: false,
        side: T.DoubleSide,
      }),
    );
    this.blueFloor.rotation.x = -Math.PI / 2;
    this.blueFloor.position.y = -0.08;
    this.blueFloor.renderOrder = 3;
    this.blueOut.add(this.blueFloor);
    for (let i = 0; i < 4; i++) {
      const ring = new T.Mesh(
        new T.TorusGeometry(1, 0.045, 8, 64),
        new T.MeshBasicMaterial({
          color: 0x52a7ff,
          transparent: true,
          opacity: 1,
          depthWrite: false,
          blending: T.AdditiveBlending,
        }),
      );
      ring.rotation.set(i * 0.57, i * 0.41, i * 0.24);
      this.blueOut.add(ring);
    }
  }
  private buildSkull() {
    this.skull.visible = false;
    const bone = new T.MeshStandardMaterial({
        color: 0xe5dfc8,
        roughness: 0.68,
        transparent: true,
        opacity: 1,
        depthWrite: false,
      }),
      shadow = new T.MeshBasicMaterial({
        color: 0x101820,
        transparent: true,
        opacity: 1,
        depthWrite: false,
      });
    const add = (geometry: T.BufferGeometry, material: T.Material, x: number, y: number, z: number) => {
      const mesh = new T.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      this.skull.add(mesh);
      return mesh;
    };
    add(new T.SphereGeometry(0.72, 20, 16), bone, 0, 0.25, 0);
    add(new T.BoxGeometry(0.84, 0.34, 0.56), bone, 0, -0.34, -0.02);
    for (const side of [-1, 1]) {
      add(new T.SphereGeometry(0.23, 12, 10), shadow, side * 0.29, 0.24, -0.55);
      add(new T.ConeGeometry(0.08, 0.3, 4), bone, side * 0.39, -0.42, -0.3);
    }
    add(new T.ConeGeometry(0.08, 0.18, 3), shadow, 0, -0.06, -0.69);
  }
  trigger(
    position: { x: number; y: number; z: number },
    color: number,
    effect = "pulse",
  ) {
    this.age = 0;
    this.effect = ["forest-growth", "blue-out", "skull"].includes(effect)
      ? effect
      : "pulse";
    this.group.position.copy(position);
    this.blueFloor.position.set(0, -position.y + 0.035, -position.z);
    this.group.visible = true;
    this.flash.visible = this.effect === "pulse";
    this.rings.forEach((ring) => (ring.visible = this.effect === "pulse"));
    this.forest.visible = this.effect === "forest-growth";
    this.blueOut.visible = this.effect === "blue-out";
    this.skull.visible = this.effect === "skull";
    this.forest.scale.setScalar(0.12);
    this.blueOut.scale.setScalar(0.65);
    this.skull.scale.setScalar(0.2);
    this.flash.material.color.setHex(color);
    this.light.color.setHex(color);
    this.rings.forEach((r) => r.material.color.setHex(color));
  }
  reset() {
    this.age = 10;
    this.group.visible = false;
  }
  update(dt: number) {
    this.age += dt;
    this.group.visible = this.age < 2.8;
    if (!this.group.visible) return;
    const t = this.age;
    if (this.effect === "pulse") {
      this.flash.scale.setScalar(0.4 + t * 12);
      this.flash.material.opacity = Math.max(0, 0.65 - t * 0.65);
      this.light.intensity = Math.max(0, 70 * (1 - t / 1.6));
      this.rings.forEach((r, i) => {
        r.scale.setScalar(1 + Math.max(0, t - i * 0.1) * (11 + i * 2));
        r.material.opacity = Math.max(0, 1 - t / 2.8);
        r.rotation.z += dt * (i + 1) * 0.2;
      });
    } else if (this.effect === "forest-growth") {
      this.forest.scale.setScalar(0.12 + Math.min(1, t * 1.6) * 1.55);
      this.forest.rotation.y += dt * 0.38;
      this.setOpacity(this.forest, Math.max(0, 1 - t / 2.8));
    } else if (this.effect === "blue-out") {
      this.blueOut.scale.setScalar(0.65 + Math.min(1, t * 1.3) * 0.35);
      this.blueWash.material.opacity = 0.42 * Math.max(0, 1 - t / 2.8);
      this.blueFloor.material.opacity = 0.36 * Math.max(0, 1 - t / 2.8);
      this.blueOut.children.slice(1).forEach((child, i) => {
        child.scale.setScalar(1 + t * (8 + i * 1.5));
        child.rotation.z += dt * (i % 2 ? -1 : 1) * 0.3;
        const material = (child as T.Mesh).material;
        if (material instanceof T.MeshBasicMaterial)
          material.opacity = Math.max(0, 1 - t / 2.8);
      });
    } else {
      this.skull.scale.setScalar(0.2 + Math.min(1, t * 2.1) * 1.05);
      this.skull.rotation.y += dt * 0.35;
      this.setOpacity(this.skull, Math.max(0, 1 - t / 2.8));
    }
  }
  private setOpacity(group: T.Group, opacity: number) {
    group.traverse((object) => {
      const material = (object as T.Mesh).material;
      if (!material) return;
      for (const item of Array.isArray(material) ? material : [material])
        if ("opacity" in item) item.opacity = opacity;
    });
  }
}
