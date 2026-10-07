import * as T from "three";
import { RingChallenge } from "../game/ring-challenge";

export class RingCourseView {
  private gates: T.Group[] = [];
  private rings: T.Mesh[] = [];
  private labels: T.Sprite[] = [];
  private decorations: T.Object3D[] = [];
  private activeMaterial = new T.MeshStandardMaterial({
    color: 0xffd777,
    emissive: 0xff8b20,
    emissiveIntensity: 2.2,
    metalness: 0.22,
    roughness: 0.24,
  });
  private inactiveMaterial = new T.MeshStandardMaterial({
    color: 0x58d6ed,
    emissive: 0x147a9e,
    emissiveIntensity: 1,
    metalness: 0.28,
    roughness: 0.32,
  });
  constructor(
    private scene: T.Scene,
    private challenge: RingChallenge,
  ) {
    this.syncActiveGate();
    this.setVisible(false);
  }

  setVisible(visible: boolean) {
    for (const gate of this.gates) gate.visible = visible;
    for (const decoration of this.decorations) decoration.visible = visible;
  }

  syncActiveGate() {
    for (const gate of this.gates) {
      gate.parent?.remove(gate);
      gate.traverse((node) => {
        if (node instanceof T.Mesh) {
          node.geometry.dispose();
          if (Array.isArray(node.material))
            node.material.forEach((material) => material.dispose());
          else node.material.dispose();
        }
      });
    }
    for (const decoration of this.decorations) {
      decoration.parent?.remove(decoration);
      if (decoration instanceof T.Sprite) {
        decoration.material.map?.dispose();
        decoration.material.dispose();
      }
      if (decoration instanceof T.Mesh) {
        decoration.geometry.dispose();
        if (Array.isArray(decoration.material))
          decoration.material.forEach((material) => material.dispose());
        else decoration.material.dispose();
      }
    }
    this.gates = [];
    this.rings = [];
    this.labels = [];
    this.decorations = [];
    const normalAxis = new T.Vector3(0, 0, 1);
    this.challenge.centers.forEach((center, i) => {
      const gate = new T.Group(),
        halo = new T.Mesh(
          new T.TorusGeometry(3.24, 0.2, 8, 56),
          new T.MeshBasicMaterial({
            color: 0x56dff5,
            transparent: true,
            opacity: 0.11,
            depthWrite: false,
          }),
        ),
        ring = new T.Mesh(
          new T.TorusGeometry(3.08, 0.105, 10, 56),
          i === 0 ? this.activeMaterial : this.inactiveMaterial,
        );
      gate.position.copy(center);
      const previous =
        i === 0 ? this.challenge.lastPassedCenter : this.challenge.centers[i - 1];
      gate.quaternion.setFromUnitVectors(
        normalAxis,
        new T.Vector3().subVectors(center, previous).normalize(),
      );
      halo.scale.setScalar(1.08);
      gate.add(halo, ring);
      this.scene.add(gate);
      this.gates.push(gate);
      this.rings.push(ring);
      const labelMaterial = new T.SpriteMaterial({
        map: this.createLabel(this.challenge.streak + i + 1),
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      });
      labelMaterial.color.set(i === 0 ? 0xffd777 : 0xdaf8ff);
      const label = new T.Sprite(labelMaterial);
      label.position.copy(center).add(new T.Vector3(4.1, 3.8, 0));
      label.scale.set(2.3, 1.15, 1);
      this.scene.add(label);
      this.labels.push(label);
      this.decorations.push(label);
      if (i < this.challenge.centers.length - 1)
        this.addGuide(this.scene, center, this.challenge.centers[i + 1]);
    });
    this.rings.forEach((ring, i) => {
      ring.material =
        i === 0
          ? this.activeMaterial
          : this.inactiveMaterial;
      this.labels[i].material.color.set(
        i === 0 ? 0xffd777 : 0xdaf8ff,
      );
    });
  }

  private createLabel(index: number) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 128;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#102d40dd";
    context.fillRect(6, 6, 244, 116);
    context.strokeStyle = "#9beeff";
    context.lineWidth = 8;
    context.strokeRect(10, 10, 236, 108);
    context.fillStyle = "#ffffff";
    context.font = "bold 72px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(String(index).padStart(2, "0"), 128, 66);
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    return texture;
  }

  private addGuide(scene: T.Scene, from: T.Vector3, to: T.Vector3) {
    const direction = new T.Vector3().subVectors(to, from),
      length = direction.length(),
      guide = new T.Mesh(
        new T.CylinderGeometry(0.055, 0.055, length - 3, 6),
        new T.MeshStandardMaterial({
          color: 0x55dff5,
          emissive: 0x1598ba,
          emissiveIntensity: 0.72,
          transparent: true,
          opacity: 0.55,
        }),
      ),
      arrow = new T.Mesh(
        new T.ConeGeometry(0.42, 1, 8),
        new T.MeshStandardMaterial({
          color: 0x8aeaff,
          emissive: 0x1699b9,
          emissiveIntensity: 0.8,
        }),
      );
    guide.position.copy(from).add(to).multiplyScalar(0.5);
    guide.quaternion.setFromUnitVectors(
      new T.Vector3(0, 1, 0),
      direction.clone().normalize(),
    );
    scene.add(guide);
    this.decorations.push(guide);
    arrow.position.copy(from).addScaledVector(direction, 0.65);
    arrow.position.y -= 0.85;
    arrow.quaternion.setFromUnitVectors(
      new T.Vector3(0, 1, 0),
      direction.normalize(),
    );
    scene.add(arrow);
    this.decorations.push(arrow);
  }
}
