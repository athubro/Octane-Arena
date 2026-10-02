import * as T from "three";
import { RingChallenge } from "../game/ring-challenge";

export class RingCourseView {
  private gates: T.Group[] = [];
  private rings: T.Mesh[] = [];
  private activeMaterial = new T.MeshStandardMaterial({
    color: 0xffd777,
    emissive: 0x9b4e12,
    emissiveIntensity: 1.4,
    metalness: 0.22,
    roughness: 0.24,
  });
  private inactiveMaterial = new T.MeshStandardMaterial({
    color: 0x54b8cb,
    emissive: 0x164d71,
    emissiveIntensity: 0.6,
    metalness: 0.28,
    roughness: 0.32,
  });
  private orientation = new T.Quaternion();

  constructor(
    scene: T.Scene,
    private challenge: RingChallenge,
  ) {
    challenge.centers.forEach((center, i) => {
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
        challenge.centers[
          (i + challenge.centers.length - 1) % challenge.centers.length
        ];
      gate.quaternion.setFromUnitVectors(
        new T.Vector3(0, 0, 1),
        new T.Vector3().subVectors(center, previous).normalize(),
      );
      halo.scale.setScalar(1.08);
      gate.add(halo, ring);
      scene.add(gate);
      this.gates.push(gate);
      this.rings.push(ring);
    });
    this.syncActiveGate();
  }

  setVisible(visible: boolean) {
    for (const gate of this.gates) gate.visible = visible;
  }

  syncActiveGate() {
    const normalAxis = new T.Vector3(0, 0, 1);
    this.orientation.setFromUnitVectors(normalAxis, this.challenge.direction);
    this.gates[this.challenge.ringIndex].quaternion.copy(this.orientation);
    this.rings.forEach((ring, i) => {
      ring.material =
        i === this.challenge.ringIndex
          ? this.activeMaterial
          : this.inactiveMaterial;
    });
  }
}
