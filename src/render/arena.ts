import * as T from "three";
import { arenaShell, goalShell } from "../arena/geometry";
import { P } from "../config/physics";
import type { Quality } from "../game/settings";
import { box, material } from "./models";
function turfTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#154e47";
  ctx.fillRect(0, 0, 512, 512);
  let seed = 73;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  for (let i = 0; i < 190; i++) {
    const x = random() * 512,
      y = random() * 512,
      radius = 12 + random() * 28;
    ctx.fillStyle = i % 2 ? "rgba(76, 141, 91, 0.12)" : "rgba(6, 35, 38, 0.14)";
    ctx.beginPath();
    ctx.ellipse(x, y, radius * 1.5, radius, random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 8500; i++) {
    const x = random() * 512,
      y = random() * 512,
      bladeHeight = 2 + random() * 5,
      lean = (random() - 0.5) * 3;
    const light = random() > 0.52;
    ctx.strokeStyle = light
      ? "rgba(112, 168, 105, 0.38)"
      : "rgba(2, 35, 37, 0.42)";
    ctx.lineWidth = 0.6 + random() * 0.9;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + lean, y - bladeHeight);
    ctx.stroke();
  }
  for (let i = 0; i < 2200; i++) {
    const x = random() * 512,
      y = random() * 512;
    ctx.fillStyle =
      i % 2 ? "rgba(159, 184, 106, 0.22)" : "rgba(1, 25, 31, 0.28)";
    ctx.fillRect(x, y, 1, 1);
  }
  const t = new T.CanvasTexture(c);
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.repeat.set(14, 18);
  t.colorSpace = T.SRGBColorSpace;
  return t;
}
function detailedTurfTextures() {
  const size = 2048,
    colorCanvas = document.createElement("canvas"),
    heightCanvas = document.createElement("canvas");
  colorCanvas.width = colorCanvas.height = size;
  heightCanvas.width = heightCanvas.height = size;
  const colorContext = colorCanvas.getContext("2d")!,
    heightContext = heightCanvas.getContext("2d")!;
  colorContext.fillStyle = "#174f3b";
  colorContext.fillRect(0, 0, size, size);
  heightContext.fillStyle = "#808080";
  heightContext.fillRect(0, 0, size, size);
  let seed = 731;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  for (let i = 0; i < 1200; i++) {
    const x = random() * size,
      y = random() * size,
      radius = 8 + random() * 38;
    colorContext.fillStyle =
      i % 2 ? "rgba(107, 157, 74, 0.09)" : "rgba(7, 34, 25, 0.11)";
    colorContext.beginPath();
    colorContext.ellipse(
      x,
      y,
      radius * (1.3 + random() * 0.8),
      radius,
      random() * Math.PI,
      0,
      Math.PI * 2,
    );
    colorContext.fill();
  }
  for (let i = 0; i < 48000; i++) {
    const x = random() * size,
      y = random() * size,
      length = 4 + random() * 10,
      lean = (random() - 0.5) * 6,
      bend = (random() - 0.5) * 5,
      lightness = Math.floor(75 + random() * 100),
      green = Math.floor(lightness * (0.8 + random() * 0.2)),
      width = 0.7 + random() * 1.2,
      light = random() > 0.43;
    colorContext.strokeStyle = light
      ? `rgba(${Math.floor(green * 0.72)}, ${green}, ${Math.floor(green * 0.66)}, ${0.2 + random() * 0.42})`
      : `rgba(${Math.floor(green * 0.24)}, ${Math.floor(green * 0.7)}, ${Math.floor(green * 0.48)}, ${0.24 + random() * 0.42})`;
    colorContext.lineWidth = width;
    colorContext.beginPath();
    colorContext.moveTo(x, y);
    colorContext.quadraticCurveTo(
      x + lean * 0.4 + bend,
      y - length * 0.45,
      x + lean,
      y - length,
    );
    colorContext.stroke();

    const height = Math.floor(115 + random() * 110);
    heightContext.strokeStyle = `rgba(${height}, ${height}, ${height}, ${0.35 + random() * 0.4})`;
    heightContext.lineWidth = width;
    heightContext.beginPath();
    heightContext.moveTo(x, y);
    heightContext.quadraticCurveTo(
      x + lean * 0.4 + bend,
      y - length * 0.45,
      x + lean,
      y - length,
    );
    heightContext.stroke();
  }
  const texture = (canvas: HTMLCanvasElement, isColor = false) => {
    const map = new T.CanvasTexture(canvas);
    map.wrapS = map.wrapT = T.RepeatWrapping;
    map.repeat.set(14, 18);
    map.anisotropy = 8;
    if (isColor) map.colorSpace = T.SRGBColorSpace;
    return map;
  };
  return { map: texture(colorCanvas, true), bumpMap: texture(heightCanvas) };
}
function grassGeometry(
  halfWidth: number,
  halfLength: number,
  tuftCount: number,
) {
  const bladesPerTuft = 3,
    vertexCount = tuftCount * bladesPerTuft * 3,
    positions = new Float32Array(vertexCount * 3),
    roots = new Float32Array(vertexCount * 3),
    colors = new Float32Array(vertexCount * 3),
    phases = new Float32Array(vertexCount);
  const palette = [0x3c8043, 0x56a04c, 0x79b85b, 0xa0c96c].map(
    (hex) => new T.Color(hex),
  );
  let seed = 1949;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  for (let tuft = 0; tuft < tuftCount; tuft++) {
    const rootX = (random() * 2 - 1) * halfWidth,
      rootZ = (random() * 2 - 1) * halfLength;
    for (let blade = 0; blade < bladesPerTuft; blade++) {
      const angle = random() * Math.PI,
        sideX = Math.cos(angle),
        sideZ = Math.sin(angle),
        width = 0.025 + random() * 0.04,
        height = 0.14 + random() * 0.22,
        leanX = (random() - 0.5) * 0.12,
        leanZ = (random() - 0.5) * 0.12,
        phase = random() * Math.PI * 2,
        shade = palette[Math.floor(random() * palette.length)],
        brightness = 0.82 + random() * 0.36,
        color = shade.clone().multiplyScalar(brightness);
      const vertices = [
        [-width * 0.5, 0, 0],
        [width * 0.5, 0, 0],
        [0, height, 1],
      ];
      for (let vertex = 0; vertex < 3; vertex++) {
        const index = (tuft * bladesPerTuft + blade) * 3 + vertex,
          offset = index * 3,
          [side, y, along] = vertices[vertex];
        positions[offset] = sideX * side + leanX * along;
        positions[offset + 1] = y;
        positions[offset + 2] = sideZ * side + leanZ * along;
        roots[offset] = rootX;
        roots[offset + 1] = 0.018;
        roots[offset + 2] = rootZ;
        colors[offset] = color.r;
        colors[offset + 1] = color.g;
        colors[offset + 2] = color.b;
        phases[index] = phase;
      }
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.BufferAttribute(positions, 3));
  geometry.setAttribute("aRoot", new T.BufferAttribute(roots, 3));
  geometry.setAttribute("aColor", new T.BufferAttribute(colors, 3));
  geometry.setAttribute("aPhase", new T.BufferAttribute(phases, 1));
  return geometry;
}
export function drawArena(scene: T.Scene, quality: Quality = "high") {
  const teamMaterials: {
    material: T.MeshBasicMaterial | T.LineBasicMaterial;
    color: number;
  }[] = [];
  const a = P.arena,
    group = new T.Group(),
    baseTurf = turfTexture(),
    floorMaterial = new T.MeshStandardMaterial({
      map: baseTurf,
      roughness: 0.95,
    }),
    grassMaterial = new T.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uCarData: {
          value: Array.from({ length: 4 }, () => new T.Vector4()),
        },
        uCarVelocities: {
          value: Array.from({ length: 4 }, () => new T.Vector3()),
        },
      },
      vertexShader: `
        attribute vec3 aRoot;
        attribute vec3 aColor;
        attribute float aPhase;
        uniform float uTime;
        uniform vec4 uCarData[4];
        uniform vec3 uCarVelocities[4];
        varying vec3 vColor;
        varying float vHeight;
        void main() {
          float heightAlong = clamp(position.y / 0.36, 0.0, 1.0);
          vec2 sway = vec2(
            sin(uTime * 1.8 + aPhase + aRoot.x * 0.17),
            cos(uTime * 1.35 + aPhase + aRoot.z * 0.14)
          ) * 0.045 * heightAlong;
          vec2 bend = sway;
          float pressure = 0.0;
          for (int i = 0; i < 4; i++) {
            vec4 car = uCarData[i];
            vec2 away = aRoot.xz - car.xy;
            float distanceToCar = length(away);
            float influence = (1.0 - smoothstep(0.55, 2.25, distanceToCar)) * car.z;
            vec3 velocity = uCarVelocities[i];
            vec2 heading = normalize(velocity.xz + vec2(0.0001, 0.0001));
            vec2 radial = away / max(distanceToCar, 0.001);
            float speed = min(length(velocity.xz) / 12.0, 1.0);
            bend += (radial * 0.62 + heading * speed * 0.9) * influence * 0.34 * heightAlong;
            pressure = max(pressure, influence);
          }
          vec3 transformed = aRoot + position;
          transformed.xz += bend;
          transformed.y -= position.y * pressure * 0.72;
          vColor = aColor;
          vHeight = heightAlong;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vHeight;
        void main() {
          float light = 0.76 + vHeight * 0.42;
          gl_FragColor = vec4(vColor * light, 1.0);
        }
      `,
      side: T.DoubleSide,
    }),
    grass = new T.Mesh(new T.BufferGeometry(), grassMaterial);
  grass.frustumCulled = false;
  grass.renderOrder = 1;
  group.add(grass);
  let detailedTurf: ReturnType<typeof detailedTurfTextures> | undefined,
    appliedQuality: Quality | undefined;
  const setQuality = (next: Quality) => {
    if (next === appliedQuality) return;
    appliedQuality = next;
    if (next === "ultra") detailedTurf ??= detailedTurfTextures();
    floorMaterial.map = next === "ultra" ? detailedTurf!.map : baseTurf;
    floorMaterial.bumpMap = next === "ultra" ? detailedTurf!.bumpMap : null;
    floorMaterial.bumpScale = next === "ultra" ? 0.018 : 0;
    floorMaterial.needsUpdate = true;
    const grassCounts = { low: 9000, medium: 16000, high: 26000, ultra: 38000 };
    grass.geometry.dispose();
    grass.geometry = grassGeometry(
      a.halfWidth - 0.8,
      a.halfLength + a.goalDepth - 0.8,
      grassCounts[next],
    );
  };
  setQuality(quality);
  scene.add(group);
  const floor = new T.Mesh(
    new T.PlaneGeometry(a.halfWidth * 2, a.halfLength * 2 + 2 * a.goalDepth),
    floorMaterial,
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);
  const stripe = new T.MeshBasicMaterial({
    color: 0x5ac7ac,
    transparent: true,
    opacity: 0.035,
    depthWrite: false,
  });
  for (let z = -48; z < 50; z += 12) {
    const m = new T.Mesh(new T.PlaneGeometry(77, 6), stripe);
    m.rotation.x = -Math.PI / 2;
    m.position.set(0, 0.008, z);
    group.add(m);
  }
  const shell = arenaShell(),
    geo = new T.BufferGeometry();
  geo.setAttribute("position", new T.BufferAttribute(shell.vertices, 3));
  const lower: number[] = [],
    upper: number[] = [];
  for (let i = 0; i < shell.indices.length; i += 3) {
    const tri = Array.from(shell.indices.slice(i, i + 3));
    (tri.every((v) => shell.vertices[v * 3 + 1] <= a.ramp + 0.01)
      ? lower
      : upper
    ).push(...tri);
  }
  geo.setIndex([...lower, ...upper]);
  geo.addGroup(0, lower.length, 0);
  geo.addGroup(lower.length, upper.length, 1);
  geo.computeVertexNormals();
  const wall = new T.Mesh(geo, [
    new T.MeshStandardMaterial({
      color: 0x78969c,
      roughness: 0.66,
      metalness: 0.25,
      side: T.DoubleSide,
    }),
    new T.MeshStandardMaterial({
      color: 0x3e566b,
      roughness: 0.55,
      metalness: 0.3,
      side: T.DoubleSide,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    }),
  ]);
  group.add(wall);
  // Ramp contour bands use the same generated positions as collision geometry.
  const bandPositions: number[] = [];
  const profileLength = shell.profileLength;
  for (const row of [0, 8, 14, 20])
    for (let i = row; i < shell.vertices.length / 3; i += profileLength) {
      const next = (i + profileLength) % (shell.vertices.length / 3);
      const ax = shell.vertices[i * 3],
        az = shell.vertices[i * 3 + 2],
        bx = shell.vertices[next * 3],
        bz = shell.vertices[next * 3 + 2];
      if (
        Math.abs(az) > 47 &&
        Math.abs(bz) > 47 &&
        Math.abs((ax + bx) / 2) < a.goalHalf + a.goalLip
      )
        continue;
      bandPositions.push(
        ax,
        shell.vertices[i * 3 + 1] + 0.025,
        az,
        bx,
        shell.vertices[next * 3 + 1] + 0.025,
        bz,
      );
    }
  const bands = new T.BufferGeometry();
  bands.setAttribute(
    "position",
    new T.Float32BufferAttribute(bandPositions, 3),
  );
  group.add(
    new T.LineSegments(
      bands,
      new T.LineBasicMaterial({
        color: 0xa6eeeb,
        transparent: true,
        opacity: 0.48,
      }),
    ),
  );
  const lines = new T.LineBasicMaterial({
    color: 0xb6ded1,
    transparent: true,
    opacity: 0.65,
  });
  const line = (points: T.Vector3[], mat: T.LineBasicMaterial = lines) => {
    const l = new T.Line(new T.BufferGeometry().setFromPoints(points), mat);
    group.add(l);
  };
  line([new T.Vector3(-37, 0.025, 0), new T.Vector3(37, 0.025, 0)]);
  const circle = (r: number, x: number, z: number, color = 0xb6ded1) => {
    const ps = [];
    for (let i = 0; i <= 96; i++) {
      const t = (i / 96) * Math.PI * 2;
      ps.push(new T.Vector3(x + r * Math.cos(t), 0.035, z + r * Math.sin(t)));
    }
    line(ps, new T.LineBasicMaterial({ color }));
  };
  circle(9, 0, 0);
  circle(0.3, 0, 0);
  for (const sign of [-1, 1]) {
    const color = sign > 0 ? 0x41d9f2 : 0xffb44f,
      glow = new T.MeshBasicMaterial({ color }),
      goal = new T.Group();
    group.add(goal);
    const lining = goalShell(sign),
      liningGeo = new T.BufferGeometry();
    liningGeo.setAttribute(
      "position",
      new T.BufferAttribute(lining.vertices, 3),
    );
    liningGeo.setIndex(new T.BufferAttribute(lining.indices, 1));
    liningGeo.computeVertexNormals();
    const liningMesh = new T.Mesh(
      liningGeo,
      new T.MeshStandardMaterial({
        color: 0x456172,
        metalness: 0.3,
        roughness: 0.62,
        side: T.DoubleSide,
      }),
    );
    liningMesh.receiveShadow = true;
    goal.add(liningMesh);
    box(
      goal,
      [0.18, a.goalHeight, 0.18],
      [-a.goalHalf, a.goalHeight / 2, sign * a.halfLength],
      glow,
    );
    box(
      goal,
      [0.18, a.goalHeight, 0.18],
      [a.goalHalf, a.goalHeight / 2, sign * a.halfLength],
      glow,
    );
    box(
      goal,
      [a.goalHalf * 2, 0.18, 0.18],
      [0, a.goalHeight, sign * a.halfLength],
      glow,
    );
    box(
      goal,
      [a.goalHalf * 2, a.goalHeight, 0.1],
      [0, a.goalHeight / 2, sign * (a.halfLength + a.goalDepth)],
      material(0x112a35),
    );
    const net = new T.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.23,
    });
    const marking = new T.LineBasicMaterial({ color });
    for (const material of [glow, net, marking])
      teamMaterials.push({ material, color });
    for (let x = -a.goalHalf; x <= a.goalHalf; x += 0.65)
      line(
        [
          new T.Vector3(x, 0, sign * (a.halfLength + a.goalDepth - 0.1)),
          new T.Vector3(
            x,
            a.goalHeight,
            sign * (a.halfLength + a.goalDepth - 0.1),
          ),
          new T.Vector3(x, a.goalHeight, sign * a.halfLength),
        ],
        net,
      );
    for (let y = 0; y <= a.goalHeight; y += 0.65)
      line(
        [
          new T.Vector3(-a.goalHalf, y, sign * a.halfLength),
          new T.Vector3(-a.goalHalf, y, sign * (a.halfLength + a.goalDepth)),
          new T.Vector3(a.goalHalf, y, sign * (a.halfLength + a.goalDepth)),
          new T.Vector3(a.goalHalf, y, sign * a.halfLength),
        ],
        net,
      );
    line(
      [
        new T.Vector3(-17, 0.04, sign * 48),
        new T.Vector3(-17, 0.04, sign * 37),
        new T.Vector3(17, 0.04, sign * 37),
        new T.Vector3(17, 0.04, sign * 48),
      ],
      marking,
    );
    // Original floating light canopy and terraced seating outside the playable shell.
    for (let side of [-1, 1]) {
      box(group, [0.12, 0.12, 44], [side * 40.9, 5, sign * 24], glow);
      box(group, [0.16, 0.16, 48], [side * 41.2, 19, sign * 24], glow);
    }
  }
  const seats = material(0x1d3945);
  for (const side of [-1, 1])
    for (let tier = 0; tier < 7; tier++) {
      box(
        group,
        [3, 0.45, 112],
        [side * (44 + tier * 2.5), 3 + tier * 1.4, 0],
        seats,
      );
    }
  const beacon = new T.MeshBasicMaterial({ color: 0xb7e6ef });
  for (const side of [-1, 1])
    for (let z = -45; z <= 45; z += 15) {
      box(group, [0.3, 20, 0.3], [side * 44, 10, z], material(0x304754));
      box(group, [4, 0.15, 1], [side * 42, 21, z], beacon);
    }
  // Light structural grid makes the enclosed ceiling visible without busy artwork.
  const gridMat = new T.LineBasicMaterial({
    color: 0x6aa0b1,
    transparent: true,
    opacity: 0.12,
  });
  for (let x = -36; x <= 36; x += 6)
    line([new T.Vector3(x, 20.4, -48), new T.Vector3(x, 20.4, 48)], gridMat);
  for (let z = -48; z <= 48; z += 6)
    line([new T.Vector3(-38, 20.4, z), new T.Vector3(38, 20.4, z)], gridMat);
  drawCity(group);
  return {
    setQuality,
    updateGrass(
      cars: readonly T.Object3D[],
      velocities: readonly T.Vector3[],
      time: number,
      enabled: boolean,
    ) {
      grassMaterial.uniforms.uTime.value = time;
      const carData = grassMaterial.uniforms.uCarData.value as T.Vector4[],
        carVelocities = grassMaterial.uniforms.uCarVelocities
          .value as T.Vector3[];
      for (let i = 0; i < carData.length; i++) {
        const car = cars[i],
          active = enabled && car?.visible && i < velocities.length;
        carData[i].set(
          car?.position.x ?? 0,
          car?.position.z ?? 0,
          active ? 1 : 0,
          0,
        );
        if (active) carVelocities[i].copy(velocities[i]);
        else carVelocities[i].set(0, 0, 0);
      }
    },
    setVisible(visible: boolean) {
      group.visible = visible;
    },
    setNeutral(neutral: boolean) {
      for (const entry of teamMaterials)
        entry.material.color.setHex(neutral ? 0xa8a8a8 : entry.color);
    },
  };
}

/** Lumen District: original terraced towers, lit windows and elevated skybridges. */
function drawCity(scene: T.Object3D) {
  const city = new T.Group();
  scene.add(city);
  const concrete = material(0x243343, 0.5, 0.7),
    trim = material(0x405469, 0.6, 0.4);
  const windowMat = new T.MeshBasicMaterial({ color: 0xf2cb8b });
  const windows = new T.InstancedMesh(
    new T.BoxGeometry(0.65, 0.9, 0.08),
    windowMat,
    2200,
  );
  let count = 0;
  const dummy = new T.Object3D();
  for (let i = 0; i < 32; i++) {
    const t = (i / 32) * Math.PI * 2,
      x = Math.cos(t) * (82 + (i % 3) * 8),
      z = Math.sin(t) * (97 + (i % 4) * 6),
      height = 18 + ((i * 17) % 39),
      width = 7 + (i % 5);
    box(city, [width, height, 9], [x, height / 2 - 2, z], concrete).castShadow =
      false;
    box(city, [width + 1, 0.7, 10], [x, height - 2, z], trim).castShadow =
      false;
    box(city, [width * 0.6, 5, 6], [x, height + 0.5, z], concrete).castShadow =
      false;
    const strip = box(
      city,
      [0.12, height * 0.75, 0.12],
      [x - width / 2 - 0.1, height * 0.4, z - 4.6],
      new T.MeshBasicMaterial({ color: i % 2 ? 0x79d9df : 0xf6ba77 }),
    );
    strip.castShadow = false;
    for (let level = 2; level < height - 4; level += 2.4)
      for (let col = -width / 2 + 1; col < width / 2; col += 1.6)
        for (const side of [-1, 1]) {
          if (
            (i + Math.floor(level) + Math.floor(col)) % 3 === 0 ||
            count >= 2200
          )
            continue;
          dummy.position.set(x + col, level, z + side * 4.55);
          dummy.updateMatrix();
          windows.setMatrixAt(count++, dummy.matrix);
        }
    if (i % 5 === 0) {
      const mast = box(city, [0.15, 8, 0.15], [x, height + 6, z], trim);
      mast.castShadow = false;
      box(
        city,
        [0.6, 0.3, 0.6],
        [x, height + 10, z],
        new T.MeshBasicMaterial({ color: 0xff8173 }),
      );
    }
  }
  windows.count = count;
  windows.instanceMatrix.needsUpdate = true;
  city.add(windows);
  for (const side of [-1, 1]) {
    box(city, [5, 1.2, 150], [side * 71, 17, 0], concrete).castShadow = false;
    box(
      city,
      [0.12, 0.15, 150],
      [side * 68.5, 17.8, 0],
      new T.MeshBasicMaterial({ color: 0x8be9e2 }),
    );
    for (const z of [-50, 0, 50])
      box(city, [1, 17, 1], [side * 71, 8.5, z], trim).castShadow = false;
  }
  const moon = new T.Mesh(
    new T.SphereGeometry(5, 20, 16),
    new T.MeshBasicMaterial({ color: 0xffdfb0 }),
  );
  moon.position.set(-65, 75, -130);
  city.add(moon);
}
