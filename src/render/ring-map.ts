import * as T from "three";

export class RingMap {
  private readonly group = new T.Group();
  private readonly clouds = new T.Group();
  private readonly dribbleDeck = new T.Group();
  private readonly dribbleGoal = new T.Group();
  private mode: "rings" | "dribble" = "rings";
  private readonly background: T.Color | T.Texture | null;
  private readonly fog: T.Fog | T.FogExp2 | null;

  constructor(private scene: T.Scene) {
    this.background = scene.background;
    this.fog = scene.fog;
    this.addClouds();
    this.addDribbleTrack();
    this.group.add(this.clouds, this.dribbleDeck, this.dribbleGoal);
    scene.add(this.group);
    this.group.visible = false;
    this.setMode("rings");
  }

  setMode(mode: "rings" | "dribble") {
    this.mode = mode;
    this.clouds.visible = mode === "rings";
    this.dribbleDeck.visible = mode === "dribble";
    this.dribbleGoal.visible = mode === "dribble";
  }

  setVisible(visible: boolean) {
    this.group.visible = visible;
    this.scene.background = visible ? new T.Color(0x79bde1) : this.background;
    this.scene.fog = visible ? new T.Fog(0x9bcde3, 150, 420) : this.fog;
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
      this.clouds.add(cloud);
    }
  }

  private addDribbleTrack() {
    const checkerCanvas = document.createElement("canvas");
    checkerCanvas.width = 256;
    checkerCanvas.height = 256;
    const checkerCtx = checkerCanvas.getContext("2d");
    const square = 32;
    if (!checkerCtx) return;

    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        checkerCtx.fillStyle = (x + y) % 2 === 0 ? "#d4f1ff" : "#7abbd8";
        checkerCtx.fillRect(x * square, y * square, square, square);
      }
    }
    checkerCtx.strokeStyle = "rgba(255,255,255,0.58)";
    checkerCtx.lineWidth = 3;
    for (let i = 0; i <= 8; i++) {
      checkerCtx.beginPath();
      checkerCtx.moveTo(i * square, 0);
      checkerCtx.lineTo(i * square, 256);
      checkerCtx.stroke();
      checkerCtx.beginPath();
      checkerCtx.moveTo(0, i * square);
      checkerCtx.lineTo(256, i * square);
      checkerCtx.stroke();
    }

    const gridTexture = new T.CanvasTexture(checkerCanvas);
    gridTexture.colorSpace = T.SRGBColorSpace;

    const deck = new T.Mesh(
      new T.BoxGeometry(18, 0.18, 118),
      new T.MeshStandardMaterial({
        map: gridTexture,
        color: 0xcaf0ff,
        transparent: true,
        opacity: 0.9,
        roughness: 0.88,
        metalness: 0.12,
      }),
    );
    deck.position.set(0, -0.08, -18);
    this.dribbleDeck.add(deck);

    const laneStrip = new T.Mesh(
      new T.BoxGeometry(2.4, 0.06, 118),
      new T.MeshStandardMaterial({
        color: 0x63d4ff,
        emissive: 0x1787ad,
        emissiveIntensity: 0.24,
        transparent: true,
        opacity: 0.72,
      }),
    );
    laneStrip.position.set(0, 0.04, -18);
    this.dribbleDeck.add(laneStrip);

    const goalFrame = new T.Mesh(
      new T.BoxGeometry(10, 4.4, 0.35),
      new T.MeshStandardMaterial({
        color: 0xf0f5ff,
        emissive: 0x8cacc5,
        emissiveIntensity: 0.28,
        roughness: 0.72,
        metalness: 0.18,
      }),
    );
    goalFrame.position.set(0, 2.1, 56);

    const net = new T.Mesh(
      new T.PlaneGeometry(8.8, 3.8),
      new T.MeshStandardMaterial({
        color: 0xf3fdff,
        transparent: true,
        opacity: 0.55,
        side: T.DoubleSide,
        roughness: 0.8,
        metalness: 0.1,
      }),
    );
    net.position.set(0, 2.1, 56.2);
    net.rotation.y = Math.PI;

    this.dribbleGoal.add(goalFrame, net);
  }
}
