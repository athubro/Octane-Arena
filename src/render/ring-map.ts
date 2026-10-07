import * as T from "three";

export class RingMap {
  private readonly group = new T.Group();
  private readonly background: T.Color | T.Texture | null;
  private readonly fog: T.Fog | T.FogExp2 | null;

  constructor(private scene: T.Scene) {
    this.background = scene.background;
    this.fog = scene.fog;
    this.addClouds();
    scene.add(this.group);
    this.group.visible = false;
  }

  setVisible(visible: boolean) {
    this.group.visible = visible;
    this.scene.background = visible ? new T.Color(0x79bde1) : this.background;
    this.scene.fog = visible ? new T.Fog(0x9bcde3, 150, 420) : this.fog;
  }

  private addBox(
    size: [number, number, number],
    position: [number, number, number],
    color: number,
  ) {
    const mesh = new T.Mesh(
      new T.BoxGeometry(...size),
      new T.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.36,
        metalness: 0.45,
        roughness: 0.35,
      }),
    );
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
  }

  private addChevron(z: number) {
    const material = new T.LineBasicMaterial({
      color: 0xa4e8f4,
      transparent: true,
      opacity: 0.76,
    });
    const points = [
      new T.Vector3(-1.5, 0.1, z - 0.8),
      new T.Vector3(0, 0.1, z + 0.8),
      new T.Vector3(1.5, 0.1, z - 0.8),
    ];
    this.group.add(
      new T.Line(new T.BufferGeometry().setFromPoints(points), material),
    );
  }

  private addClouds() {
    const cloudMaterial = new T.MeshStandardMaterial({
      color: 0xe8f7ff,
      roughness: 1,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
    });
    const formations = [
      [-58, -9, 15, 25],
      [52, -12, 8, 30],
      [-45, -18, -42, 32],
      [44, -15, -55, 26],
      [-30, -22, -100, 36],
      [38, -20, -118, 30],
      [78, -16, -16, 24],
      [-78, -17, -68, 28],
    ];
    for (const [x, y, z, scale] of formations) {
      const cloud = new T.Group();
      for (let i = 0; i < 5; i++) {
        const puff = new T.Mesh(new T.SphereGeometry(1, 12, 8), cloudMaterial);
        puff.position.set(
          (i - 2) * 0.72,
          Math.sin(i * 1.8) * 0.12,
          (i % 2) * 0.2,
        );
        puff.scale.set(1.15, 0.42 + (i % 3) * 0.08, 0.72);
        puff.castShadow = false;
        cloud.add(puff);
      }
      cloud.position.set(x, y, z);
      cloud.scale.setScalar(scale);
      this.group.add(cloud);
    }
  }
}
