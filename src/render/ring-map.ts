import * as T from "three";

export class RingMap {
  private readonly group = new T.Group();
  private readonly clouds = new T.Group();
  private readonly ringRunway = new T.Group();
  private readonly dribbleDeck = new T.Group();
  private readonly dribbleGoal = new T.Group();
  private mode: "rings" | "dribble" = "rings";
  private readonly background: T.Color | T.Texture | null;
  private readonly fog: T.Fog | T.FogExp2 | null;

  constructor(private scene: T.Scene) {
    this.background = scene.background;
    this.fog = scene.fog;
    this.addClouds();
    this.addRingRunway();
    this.addDribbleTrack();
    this.group.add(
      this.clouds,
      this.ringRunway,
      this.dribbleDeck,
      this.dribbleGoal,
    );
    scene.add(this.group);
    this.group.visible = false;
    this.setMode("rings");
  }

  setMode(mode: "rings" | "dribble") {
    this.mode = mode;
    this.clouds.visible = mode === "rings";
    this.ringRunway.visible = mode === "rings";
    this.dribbleDeck.visible = mode === "dribble";
    this.dribbleGoal.visible = mode === "dribble";
  }

  setVisible(visible: boolean) {
    this.group.visible = visible;
    this.scene.background = visible ? new T.Color(0x05090e) : this.background;
    this.scene.fog = visible ? new T.Fog(0x07111a, 155, 420) : this.fog;
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
        checkerCtx.fillStyle = (x + y) % 2 === 0 ? "#327b7c" : "#245c64";
        checkerCtx.fillRect(x * square, y * square, square, square);
      }
    }
    checkerCtx.strokeStyle = "rgba(135,231,220,0.42)";
    checkerCtx.lineWidth = 2;
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
    gridTexture.wrapS = T.RepeatWrapping;
    gridTexture.wrapT = T.RepeatWrapping;
    gridTexture.repeat.set(6, 44);

    const deck = new T.Mesh(
      new T.PlaneGeometry(22, 190),
      new T.MeshStandardMaterial({
        map: gridTexture,
        color: 0xa9dfd5,
        roughness: 0.88,
        metalness: 0.12,
      }),
    );
    deck.rotation.x = -Math.PI / 2;
    deck.position.set(0, 0.015, -35);
    this.dribbleDeck.add(deck);

    const laneStrip = new T.Mesh(
      new T.BoxGeometry(2.4, 0.025, 190),
      new T.MeshStandardMaterial({
        color: 0x63d4ff,
        emissive: 0x1787ad,
        emissiveIntensity: 0.24,
        transparent: true,
        opacity: 0.72,
      }),
    );
    laneStrip.position.set(0, 0.035, -35);
    this.dribbleDeck.add(laneStrip);

    const frameMaterial = new T.MeshStandardMaterial({
      color: 0xf0f5ff,
      emissive: 0x8cacc5,
      emissiveIntensity: 0.28,
      roughness: 0.72,
      metalness: 0.18,
    });
    const postGeometry = new T.BoxGeometry(0.28, 4.2, 0.32);
    const leftPost = new T.Mesh(postGeometry, frameMaterial);
    leftPost.position.set(-4.6, 2.1, 0);
    const rightPost = new T.Mesh(postGeometry, frameMaterial);
    rightPost.position.set(4.6, 2.1, 0);
    const crossbar = new T.Mesh(
      new T.BoxGeometry(9.48, 0.28, 0.32),
      frameMaterial,
    );
    crossbar.position.set(0, 4.2, 0);
    const net = new T.Mesh(
      new T.PlaneGeometry(8.8, 3.8, 8, 5),
      new T.MeshStandardMaterial({
        color: 0xf3fdff,
        transparent: true,
        opacity: 0.22,
        side: T.DoubleSide,
        roughness: 0.8,
        metalness: 0.1,
        wireframe: true,
      }),
    );
    net.position.set(0, 2.1, -0.15);

    this.dribbleGoal.add(leftPost, rightPost, crossbar, net);
  }

  private addRingRunway() {
    const surface = new T.Mesh(
      new T.PlaneGeometry(24, 156),
      new T.MeshStandardMaterial({
        color: 0x526a70,
        roughness: 0.92,
        metalness: 0.04,
      }),
    );
    surface.rotation.x = -Math.PI / 2;
    surface.position.set(0, 0.018, -20);
    this.ringRunway.add(surface);

    const markingMaterial = new T.MeshStandardMaterial({
      color: 0xd2e4d7,
      emissive: 0x45675c,
      emissiveIntensity: 0.18,
      roughness: 0.8,
    });
    const stripe = (x: number, z: number, width: number, length: number) => {
      const mesh = new T.Mesh(
        new T.BoxGeometry(width, 0.025, length),
        markingMaterial,
      );
      mesh.position.set(x, 0.04, z);
      this.ringRunway.add(mesh);
    };

    stripe(-10.8, -20, 0.18, 152);
    stripe(10.8, -20, 0.18, 152);
    stripe(0, 42, 7.5, 0.2);
    stripe(0, 34, 5.5, 0.2);
    stripe(0, 26, 3.5, 0.2);
    for (const z of [16, 2, -12, -26, -40, -54, -68, -82]) {
      stripe(0, z, 0.12, 4.5);
    }

    const railMaterial = new T.MeshStandardMaterial({
      color: 0x91aeb0,
      emissive: 0x324c4d,
      emissiveIntensity: 0.2,
      metalness: 0.34,
      roughness: 0.55,
    });
    for (const x of [-11.65, 11.65]) {
      const rail = new T.Mesh(new T.BoxGeometry(0.35, 0.42, 156), railMaterial);
      rail.position.set(x, 0.21, -20);
      this.ringRunway.add(rail);
    }
  }

  setDribbleLevel(level: number, finish: { x: number; z: number }) {
    this.dribbleGoal.position.set(finish.x, 0, finish.z);
  }
}
