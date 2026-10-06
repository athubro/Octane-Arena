import * as T from "three";
import { arenaShell, goalShell } from "../arena/geometry";
import { P } from "../config/physics";
import type { Quality } from "../game/settings";
import type { ArenaField } from "../../shared/party";
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
function neoTokyoGroundTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1024;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createLinearGradient(0, 0, 1024, 1024);
  gradient.addColorStop(0, "#252b35");
  gradient.addColorStop(0.5, "#171d27");
  gradient.addColorStop(1, "#30303a");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1024, 1024);
  let seed = 8173;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  for (let i = 0; i < 24000; i++) {
    const x = random() * 1024,
      y = random() * 1024,
      light = random() > 0.5;
    ctx.fillStyle = light
      ? `rgba(127, 177, 194, ${random() * 0.08})`
      : `rgba(3, 8, 15, ${random() * 0.16})`;
    ctx.fillRect(x, y, 1 + random() * 3, 1 + random() * 2);
  }
  for (let i = 0; i < 34; i++) {
    const x = random() * 1024,
      y = random() * 1024;
    ctx.strokeStyle = i % 2 ? "rgba(54, 208, 238, .16)" : "rgba(255, 112, 74, .15)";
    ctx.lineWidth = 2 + random() * 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 70 + random() * 220, y + (random() - 0.5) * 16);
    ctx.stroke();
  }
  const texture = new T.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.repeat.set(5, 7);
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}
function cityFacadeTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256; canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 256, 512);
  g.addColorStop(0, "#aeb8b5"); g.addColorStop(.22, "#667b7e"); g.addColorStop(.55, "#304653"); g.addColorStop(1, "#172b3b");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 512);
  // A baked, still façade image: concrete bays, recessed dark glazing,
  // window reflections and subtle weathering. One small texture is shared by
  // every tower, so this adds detail without adding draw calls or animation.
  for (let y = 0; y < 512; y += 128) {
    ctx.fillStyle = "rgba(220,229,218,.12)"; ctx.fillRect(0, y, 256, 7);
    ctx.fillStyle = "rgba(8,19,27,.23)"; ctx.fillRect(0, y + 8, 256, 5);
  }
  for (let x = 8; x < 256; x += 34) {
    ctx.fillStyle = "#aebbb5"; ctx.fillRect(x, 0, 7, 512);
    for (let y = 10; y < 512; y += 30) {
      ctx.fillStyle = "rgba(6,17,25,.76)"; ctx.fillRect(x + 9, y - 1, 22, 23);
      const lit = (x * 3 + y) % 11 === 0;
      const glass = ctx.createLinearGradient(x + 10, y, x + 30, y + 20);
      glass.addColorStop(0, lit ? "#d7b77d" : "#608091");
      glass.addColorStop(.45, lit ? "#77715e" : "#203b4c");
      glass.addColorStop(1, lit ? "#a18b68" : "#456475");
      ctx.fillStyle = glass; ctx.fillRect(x + 11, y + 1, 18, 18);
      ctx.fillStyle = "rgba(225,241,238,.28)"; ctx.fillRect(x + 13, y + 2, 2, 16);
      ctx.fillStyle = "rgba(11,24,32,.82)"; ctx.fillRect(x + 19, y + 1, 1, 18);
      ctx.fillStyle = "rgba(198,213,207,.58)"; ctx.fillRect(x + 9, y + 21, 22, 2);
    }
  }
  const t = new T.CanvasTexture(canvas); t.colorSpace = T.SRGBColorSpace; return t;
}
function cityBillboardTexture(index: number) {
  const canvas = document.createElement("canvas"); canvas.width = 512; canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const palettes = [["#132b36", "#64e8e2", "#f5b66d"], ["#301b2b", "#ff668d", "#ffd27b"], ["#102638", "#54cfff", "#eee8d5"]];
  const [base, neon, warm] = palettes[index % palettes.length];
  const bg = ctx.createLinearGradient(0, 0, 512, 256);
  bg.addColorStop(0, base); bg.addColorStop(1, "#080f19");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 512, 256);
  ctx.fillStyle = "rgba(220,232,220,.12)";
  for (let x = 0; x < 512; x += 18) ctx.fillRect(x, 0, 1, 256);
  ctx.strokeStyle = neon; ctx.lineWidth = 7; ctx.strokeRect(12, 12, 488, 232);
  ctx.fillStyle = warm; ctx.fillRect(28, 32, 9, 190);
  ctx.fillStyle = neon; ctx.font = "bold 33px sans-serif"; ctx.textAlign = "left";
  ctx.fillText(index % 2 ? "TOKYO 24" : "NEO DISTRICT", 58, 82);
  ctx.fillStyle = "#e8e6d9"; ctx.font = "bold 64px sans-serif";
  ctx.fillText(index % 3 === 0 ? "光" : index % 3 === 1 ? "東京" : "夜", 58, 164);
  ctx.fillStyle = warm; ctx.font = "18px sans-serif"; ctx.fillText("CITY • NIGHT MARKET • EST. 2049", 180, 151);
  ctx.fillStyle = "rgba(220,239,234,.7)"; ctx.font = "13px sans-serif"; ctx.fillText("OPEN ALL NIGHT   /   03:17", 180, 185);
  const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; texture.anisotropy = 4;
  return texture;
}
function fieldGroundTexture(kind: "desert" | "rainforest") {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  const desert = kind === "desert";
  let seed = desert ? 19071 : 30793;
  const random = () =>
    ((seed = (seed * 1664525 + 1013904223) >>> 0) / 0x100000000);
  const frequencies = [3, 6, 12, 24, 48],
    noise = frequencies.map((frequency) =>
      Float32Array.from({ length: frequency * frequency }, random),
    );
  const sampleNoise = (u: number, v: number, octave: number) => {
    const frequency = frequencies[octave],
      grid = noise[octave],
      x = u * frequency,
      y = v * frequency,
      x0 = Math.floor(x) % frequency,
      y0 = Math.floor(y) % frequency,
      x1 = (x0 + 1) % frequency,
      y1 = (y0 + 1) % frequency,
      tx = (x - Math.floor(x)) ** 2 * (3 - 2 * (x - Math.floor(x))),
      ty = (y - Math.floor(y)) ** 2 * (3 - 2 * (y - Math.floor(y))),
      a = grid[y0 * frequency + x0] * (1 - tx) + grid[y0 * frequency + x1] * tx,
      b = grid[y1 * frequency + x0] * (1 - tx) + grid[y1 * frequency + x1] * tx;
    return a * (1 - ty) + b * ty;
  };
  const pixels = ctx.createImageData(canvas.width, canvas.height),
    weights = [0.48, 0.25, 0.14, 0.085, 0.045];
  for (let y = 0; y < canvas.height; y++)
    for (let x = 0; x < canvas.width; x++) {
      const u = x / canvas.width,
        v = y / canvas.height;
      let broad = 0;
      for (let octave = 0; octave < weights.length; octave++)
        broad += sampleNoise(u, v, octave) * weights[octave];
      const fine = sampleNoise(u, v, 4),
        grain = random() - 0.5,
        duneRipples = desert
          ? Math.sin(2 * Math.PI * (v * 9 + Math.sin(2 * Math.PI * u * 3) * 0.11))
          : 0,
        index = (y * canvas.width + x) * 4;
      pixels.data[index] = desert
        ? 205 + (broad - 0.5) * 32 + duneRipples * 7 + grain * 5
        : 24 + broad * 24 + fine * 8 + grain * 4;
      pixels.data[index + 1] = desert
        ? 160 + (broad - 0.5) * 30 + duneRipples * 9 + grain * 4
        : 63 + broad * 42 + fine * 16 + grain * 5;
      pixels.data[index + 2] = desert
        ? 101 + (broad - 0.5) * 24 + duneRipples * 5 + grain * 3
        : 43 + broad * 28 + fine * 10 + grain * 4;
      pixels.data[index + 3] = 255;
    }
  ctx.putImageData(pixels, 0, 0);
  const texture = new T.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.repeat.set(desert ? 4 : 6, desert ? 6 : 8);
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}
function drawDuneCrown(parent: T.Object3D) {
  const environment = new T.Group(),
    stone = new T.MeshStandardMaterial({ color: 0xd7b17a, roughness: 0.92 }),
    dune = new T.MeshStandardMaterial({ color: 0xd09b61, roughness: 1 });
  parent.add(environment);
  const pyramid = (x: number, z: number, radius: number, height: number) => {
    const geometry = new T.ConeGeometry(radius * Math.SQRT2, height, 4, 1),
      pyramidMesh = new T.Mesh(geometry, stone),
      courses = new T.Group(),
      courseMaterial = new T.LineBasicMaterial({
        color: 0x9b7046,
        transparent: true,
        opacity: 0.42,
      });
    geometry.rotateY(Math.PI / 4);
    pyramidMesh.position.set(x, height / 2, z);
    pyramidMesh.castShadow = pyramidMesh.receiveShadow = true;
    environment.add(pyramidMesh, courses);
    courses.position.set(x, 0, z);
    const courseCount = Math.max(5, Math.round(height / 4));
    for (let level = 1; level < courseCount; level++) {
      const fraction = level / courseCount,
        half = radius * (1 - fraction),
        y = height * fraction,
        points = [
          new T.Vector3(-half, y, -half),
          new T.Vector3(half, y, -half),
          new T.Vector3(half, y, half),
          new T.Vector3(-half, y, half),
        ],
        geometry = new T.BufferGeometry().setFromPoints(points),
        line = new T.LineLoop(geometry, courseMaterial);
      line.renderOrder = 1;
      courses.add(line);
    }
  };
  // All structures are beyond the end walls; none enter the playable bounds.
  pyramid(0, -119, 24, 34); pyramid(-32, -110, 15, 22); pyramid(34, -112, 17, 24);
  pyramid(0, 119, 22, 32); pyramid(-34, 111, 15, 22); pyramid(35, 111, 18, 25);
  for (const side of [-1, 1]) for (let i = 0; i < 7; i++) {
    const mound = new T.Mesh(new T.SphereGeometry(1, 18, 12), dune);
    mound.position.set(side * (68 + i * 7), -1.4, -72 + i * 24);
    mound.scale.set(24, 7 + (i % 3) * 2, 18); environment.add(mound);
  }
  return environment;
}
function drawEmeraldCanopy(parent: T.Object3D) {
  const environment = new T.Group(); parent.add(environment);
  const trunks = new T.InstancedMesh(new T.CylinderGeometry(.32, .62, 1, 7), new T.MeshStandardMaterial({ color: 0x49392b, roughness: 1 }), 72),
    leaves = new T.InstancedMesh(new T.DodecahedronGeometry(1, 1), new T.MeshStandardMaterial({ color: 0x3f7850, roughness: .9, vertexColors: true }), 216),
    dummy = new T.Object3D();
  trunks.castShadow = leaves.castShadow = true;
  let seed = 10017, leafIndex = 0;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 0x100000000);
  for (let i = 0; i < 72; i++) {
    const side = i % 2 ? -1 : 1, x = side * (59 + random() * 48), z = -116 + random() * 232, height = 15 + random() * 16;
    // Tree trunks remain at least 17 world units outside the side walls.
    dummy.position.set(x, height / 2, z); dummy.scale.set(1, height, 1); dummy.rotation.y = random() * 6; dummy.updateMatrix(); trunks.setMatrixAt(i, dummy.matrix);
    const hue = new T.Color().setHSL(.27 + random() * .08, .5, .34);
    for (let cluster = 0; cluster < 3; cluster++) {
      const angle = cluster * Math.PI * 2 / 3 + random(), spread = 1.7 + random() * 1.2;
      dummy.position.set(x + Math.cos(angle) * spread, height + random() * 2.8, z + Math.sin(angle) * spread);
      dummy.scale.set(3.5 + random() * 2, 3.5 + random() * 2, 3.5 + random() * 2); dummy.rotation.y = angle; dummy.updateMatrix();
      leaves.setMatrixAt(leafIndex, dummy.matrix); leaves.setColorAt(leafIndex++, hue.clone().offsetHSL((random() - .5) * .05, 0, (random() - .5) * .1));
    }
  }
  leaves.count = leafIndex; trunks.instanceMatrix.needsUpdate = leaves.instanceMatrix.needsUpdate = true;
  if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
  environment.add(trunks, leaves);
  const stone = new T.MeshStandardMaterial({ color: 0x59634b, roughness: .92 });
  for (const side of [-1, 1]) for (let level = 0; level < 4; level++) {
    const block = new T.Mesh(new T.BoxGeometry(16 - level * 2.3, 1.8, 12 - level * 1.8), stone);
    block.position.set(side * 59, 1 + level * 1.8, -89); block.castShadow = true; environment.add(block);
  }
  return environment;
}
function drawApexColiseum(parent: T.Object3D) {
  const environment = new T.Group(); parent.add(environment);
  const crowd = new T.InstancedMesh(new T.SphereGeometry(1, 8, 7), new T.MeshStandardMaterial({ color: 0xffffff, roughness: .56, vertexColors: true }), 900),
    dummy = new T.Object3D(), colors = [0x42b9c8, 0xe58659, 0xf0d27b, 0xe9edf0, 0x536eaa, 0x75a86a];
  crowd.castShadow = true;
  let seed = 81173, count = 0; const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 0x100000000);
  for (const side of [-1, 1]) for (let tier = 0; tier < 7; tier++) for (let z = -49; z <= 49; z += 2.15) {
    dummy.position.set(side * (45 + tier * 2.55), 4.15 + tier * 1.4, z + (random() - .5) * .4);
    dummy.scale.set(.36, .53, .34); dummy.rotation.y = random() * Math.PI; dummy.updateMatrix();
    crowd.setMatrixAt(count, dummy.matrix); crowd.setColorAt(count++, new T.Color(colors[Math.floor(random() * colors.length)]));
  }
  crowd.count = count; crowd.instanceMatrix.needsUpdate = true; if (crowd.instanceColor) crowd.instanceColor.needsUpdate = true;
  environment.add(crowd);
  const roof = new T.Mesh(new T.TorusGeometry(1, .026, 8, 160), new T.MeshStandardMaterial({ color: 0x9ae8f4, emissive: 0x2b8da8, emissiveIntensity: .72, metalness: .56, roughness: .32 }));
  roof.rotation.x = Math.PI / 2; roof.scale.set(53, 91, 1); roof.position.y = 32; environment.add(roof);
  const ribbon = new T.Mesh(new T.TorusGeometry(1, .08, 5, 160), new T.MeshBasicMaterial({ color: 0xffbb64 }));
  ribbon.rotation.x = Math.PI / 2; ribbon.scale.set(47, 83, 1); ribbon.position.y = 13; environment.add(ribbon);
  return environment;
}
function detailedTurfTextures() {
  const size = 4096,
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
  for (let i = 0; i < 96000; i++) {
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
    map.anisotropy = 16;
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
  const bladesPerTuft = 4,
    bladeCount = tuftCount * bladesPerTuft,
    roots = new Float32Array(bladeCount * 3),
    sides = new Float32Array(bladeCount * 2),
    leans = new Float32Array(bladeCount * 2),
    sizes = new Float32Array(bladeCount * 2),
    colors = new Float32Array(bladeCount * 3),
    phases = new Float32Array(bladeCount);
  const palette = [0x3c8043, 0x56a04c, 0x79b85b, 0xa0c96c].map(
    (hex) => new T.Color(hex),
  );
  let seed = 1949;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  const columns = Math.ceil(Math.sqrt((tuftCount * halfWidth) / halfLength)),
    rows = Math.ceil(tuftCount / columns);
  for (let tuft = 0; tuft < tuftCount; tuft++) {
    const column = tuft % columns,
      row = Math.floor(tuft / columns),
      rootX = ((column + random()) / columns) * halfWidth * 2 - halfWidth,
      rootZ = ((row + random()) / rows) * halfLength * 2 - halfLength;
    for (let blade = 0; blade < bladesPerTuft; blade++) {
      const angle = random() * Math.PI,
        sideX = Math.cos(angle),
        sideZ = Math.sin(angle),
        width = 0.025 + random() * 0.035,
        height = 0.075 + random() * 0.055,
        leanX = (random() - 0.5) * 0.18,
        leanZ = (random() - 0.5) * 0.18,
        phase = random() * Math.PI * 2,
        shade = palette[Math.floor(random() * palette.length)],
        brightness = 0.82 + random() * 0.36;
      const index = tuft * bladesPerTuft + blade,
        rootOffset = index * 3,
        pairOffset = index * 2,
        colorOffset = index * 3;
      roots[rootOffset] = rootX;
      roots[rootOffset + 1] = 0.018;
      roots[rootOffset + 2] = rootZ;
      sides[pairOffset] = sideX;
      sides[pairOffset + 1] = sideZ;
      leans[pairOffset] = leanX;
      leans[pairOffset + 1] = leanZ;
      sizes[pairOffset] = width;
      sizes[pairOffset + 1] = height;
      colors[colorOffset] = shade.r * brightness;
      colors[colorOffset + 1] = shade.g * brightness;
      colors[colorOffset + 2] = shade.b * brightness;
      phases[index] = phase;
    }
  }
  const geometry = new T.InstancedBufferGeometry();
  geometry.setAttribute(
    "position",
    new T.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0, 1, 1], 3),
  );
  geometry.setIndex([0, 1, 2]);
  geometry.setAttribute(
    "aRoot",
    new T.InstancedBufferAttribute(roots, 3),
  );
  geometry.setAttribute(
    "aSide",
    new T.InstancedBufferAttribute(sides, 2),
  );
  geometry.setAttribute(
    "aLean",
    new T.InstancedBufferAttribute(leans, 2),
  );
  geometry.setAttribute(
    "aSize",
    new T.InstancedBufferAttribute(sizes, 2),
  );
  geometry.setAttribute(
    "aColor",
    new T.InstancedBufferAttribute(colors, 3),
  );
  geometry.setAttribute(
    "aPhase",
    new T.InstancedBufferAttribute(phases, 1),
  );
  geometry.instanceCount = bladeCount;
  geometry.boundingSphere = new T.Sphere(
    new T.Vector3(0, 0.08, 0),
    Math.hypot(halfWidth, halfLength, 0.16),
  );
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
        attribute vec2 aSide;
        attribute vec2 aLean;
        attribute vec2 aSize;
        attribute vec3 aColor;
        attribute float aPhase;
        uniform float uTime;
        uniform vec4 uCarData[4];
        uniform vec3 uCarVelocities[4];
        varying vec3 vColor;
        varying float vHeight;
        varying vec2 vRoot;
        void main() {
          float heightAlong = clamp(position.y, 0.0, 1.0);
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
          vec3 blade = vec3(
            aSide.x * position.x * aSize.x + aLean.x * position.z * aSize.y,
            position.y * aSize.y,
            aSide.y * position.x * aSize.x + aLean.y * position.z * aSize.y
          );
          vec3 transformed = aRoot + blade;
          transformed.xz += bend;
          transformed.y -= blade.y * pressure * 0.72;
          vColor = aColor;
          vHeight = heightAlong;
          vRoot = aRoot.xz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vHeight;
        varying vec2 vRoot;
        void main() {
          float light = 0.68 + vHeight * 0.5;
          float variation = 0.96 + 0.04 * sin(vRoot.x * 4.7 + vRoot.y * 3.9);
          gl_FragColor = vec4(vColor * light * variation, 1.0);
        }
      `,
      side: T.DoubleSide,
    }),
    grass = new T.Mesh(new T.BufferGeometry(), grassMaterial);
  grass.frustumCulled = true;
  grass.renderOrder = 1;
  group.add(grass);
  let detailedTurf: ReturnType<typeof detailedTurfTextures> | undefined,
    appliedQuality: Quality | undefined;
  const setQuality = (next: Quality) => {
    if (next === appliedQuality) return;
    appliedQuality = next;
    const detailed = next === "ultra" || next === "cinematic";
    if (detailed) detailedTurf ??= detailedTurfTextures();
    floorMaterial.map = detailed ? detailedTurf!.map : baseTurf;
    floorMaterial.bumpMap = detailed ? detailedTurf!.bumpMap : null;
    floorMaterial.bumpScale = detailed ? 0.018 : 0;
    floorMaterial.needsUpdate = true;
    const grassCounts = {
      low: 55000,
      medium: 105000,
      high: 150000,
      ultra: 190000,
      cinematic: 225000,
    };
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
  const neoTokyo = drawNeoTokyo(group);
  neoTokyo.visible = false;
  const duneCrown = drawDuneCrown(group),
    emeraldCanopy = drawEmeraldCanopy(group),
    apexColiseum = drawApexColiseum(group);
  duneCrown.visible = emeraldCanopy.visible = apexColiseum.visible = false;
  let neoGround: T.CanvasTexture | undefined,
    fieldGrounds: Partial<Record<"dune-crown" | "emerald-canopy", T.CanvasTexture>> = {},
    cityEnvironment: T.Group | undefined,
    field: ArenaField = "lumen";
  const stripeMeshes: T.Mesh[] = [];
  const setField = (field: ArenaField) => {
    const isNeoTokyo = field === "neo-tokyo";
    if (isNeoTokyo) neoGround ??= neoTokyoGroundTexture();
    const isDesert = field === "dune-crown",
      isForest = field === "emerald-canopy",
      isCustomGround = isDesert || isForest;
    if (isDesert && !fieldGrounds["dune-crown"])
      fieldGrounds["dune-crown"] = fieldGroundTexture("desert");
    if (isForest && !fieldGrounds["emerald-canopy"])
      fieldGrounds["emerald-canopy"] = fieldGroundTexture("rainforest");
    const detailed = quality === "ultra" || quality === "cinematic";
    floorMaterial.map = isNeoTokyo
      ? neoGround!
      : isCustomGround
        ? fieldGrounds[isDesert ? "dune-crown" : "emerald-canopy"]!
        : detailed
          ? detailedTurf!.map
          : baseTurf;
    floorMaterial.bumpMap = isNeoTokyo || isCustomGround ? null : detailed ? detailedTurf!.bumpMap : null;
    floorMaterial.bumpScale = isNeoTokyo || isCustomGround ? 0 : detailed ? 0.018 : 0;
    floorMaterial.color.setHex(isNeoTokyo ? 0xc3d2d7 : 0xffffff);
    floorMaterial.roughness = isNeoTokyo ? 0.38 : isDesert ? 0.88 : isForest ? 0.95 : 0.95;
    floorMaterial.needsUpdate = true;
    neoTokyo.visible = isNeoTokyo;
    duneCrown.visible = isDesert;
    emeraldCanopy.visible = isForest;
    apexColiseum.visible = field === "apex-coliseum";
    if (cityEnvironment) cityEnvironment.visible = field === "lumen";
    grass.visible = !isNeoTokyo && !isDesert;
    stripeMeshes.forEach((mesh) => (mesh.visible = !isNeoTokyo && !isCustomGround));
  };
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
    stripeMeshes.push(m);
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
  const lumenCity = drawCity(group);
  cityEnvironment = lumenCity.group;
  lumenCity.setQuality(quality);
  setField(field);
  let cityQuality = quality;
  return {
    setQuality(next: Quality) {
      quality = next;
      setQuality(next);
      setField(field);
      if (cityQuality !== next) {
        cityQuality = next;
        lumenCity.setQuality(next);
      }
    },
    setField(next: ArenaField) {
      field = next;
      setField(next);
    },
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

function drawNeoTokyo(parent: T.Object3D) {
  const city = new T.Group(),
    facade = new T.MeshBasicMaterial({ map: cityFacadeTexture(), side: T.DoubleSide }),
    structure = new T.MeshStandardMaterial({
      color: 0x263647,
      metalness: 0.5,
      roughness: 0.38,
    }),
    trim = new T.MeshStandardMaterial({
      color: 0x52e5fa,
      emissive: 0x13a9dc,
      emissiveIntensity: 1.4,
      metalness: 0.45,
      roughness: 0.26,
    }),
    warm = new T.MeshStandardMaterial({
      color: 0xff9668,
      emissive: 0xea4b35,
      emissiveIntensity: 1.25,
      metalness: 0.35,
      roughness: 0.28,
    }),
    window = new T.MeshStandardMaterial({
      color: 0xa5e9ff,
      emissive: 0x3aa5d8,
      emissiveIntensity: 0.7,
      roughness: 0.25,
      metalness: 0.25,
    });
  parent.add(city);
  // Procedural skyline towers and lit facades keep this field self-contained.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 10; i++) {
      const z = -48 + i * 10.5,
        x = side * (P.arena.halfWidth + 10 + (i % 3) * 2),
        height = 18 + ((i * 19) % 26),
        width = 6 + (i % 4);
      box(city, [width, height, 8], [x, height / 2, z], structure).castShadow = false;
      const facadePanel = new T.Mesh(new T.PlaneGeometry(width * 0.88, height * 0.92), facade);
      facadePanel.position.set(x - side * (width / 2 + 0.025), height / 2, z);
      facadePanel.rotation.y = -side * Math.PI / 2;
      city.add(facadePanel);
      if (i % 3 === 0) {
        const poster = new T.Mesh(
          new T.PlaneGeometry(3.15, 1.58),
          new T.MeshBasicMaterial({
            map: cityBillboardTexture(i),
            side: T.DoubleSide,
            toneMapped: false,
          }),
        );
        poster.position.set(x - side * (width / 2 + 0.075), height * 0.58, z);
        poster.rotation.y = -side * Math.PI / 2;
        poster.castShadow = false;
        city.add(poster);
      }
      box(city, [width + 0.4, 0.3, 8.3], [x, height + 0.15, z], trim).castShadow = false;
      for (let level = 1.8; level < height - 1; level += 2.8) {
        box(
          city,
          [width * 0.62, 0.8, 0.12],
          [x, level, z - side * 4.08],
          (i + Math.floor(level)) % 4 === 0 ? warm : window,
        ).castShadow = false;
      }
      if (i % 2 === 0)
        box(city, [width + 0.8, 0.45, 0.6], [x, height * 0.63, z], warm).castShadow =
          false;
    }
    for (const z of [-39, 0, 39]) {
      box(city, [0.24, 27, 0.24], [side * 43.5, 13, z], structure).castShadow =
        false;
      box(city, [0.32, 0.2, 16], [side * 43.5, 27, z], trim).castShadow = false;
    }
    box(city, [0.45, 0.45, 108], [side * 43, 0.15, 0], trim).castShadow = false;
    // Decorative blossom trees stay outside the playable side wall.
    for (let i = 0; i < 9; i++) {
      const z = -47 + i * 11.5, x = side * (P.arena.halfWidth + 3.4);
      box(city, [1.5, 0.42, 3.4], [x, 0.2, z], structure).castShadow = false;
      const trunk = new T.Mesh(new T.CylinderGeometry(0.16, 0.27, 2.6, 7), new T.MeshStandardMaterial({ color: 0x554237, roughness: 1 }));
      trunk.position.set(x, 1.5, z); trunk.castShadow = true; city.add(trunk);
      for (let petal = 0; petal < 5; petal++) {
        const angle = petal * Math.PI * 2 / 5,
          crown = new T.Mesh(new T.SphereGeometry(1, 10, 8), new T.MeshStandardMaterial({ color: petal % 2 ? 0xec9bb7 : 0xf6bfd0, roughness: 0.86 }));
        crown.position.set(x + Math.cos(angle) * 1.1, 3.2 + (petal % 2) * 0.5, z + Math.sin(angle) * 1.1);
        crown.scale.set(1.2, 0.85, 1.2); crown.castShadow = true; city.add(crown);
      }
    }
  }
  const arch = new T.Mesh(
    new T.TorusGeometry(43, 0.22, 8, 96),
    trim,
  );
  arch.rotation.x = Math.PI / 2;
  arch.scale.set(1, 0.48, 1);
  arch.position.y = 14;
  city.add(arch);
  const secondArch = arch.clone();
  secondArch.material = warm;
  secondArch.position.z = P.arena.halfLength + 6;
  secondArch.scale.set(0.94, 0.45, 1);
  city.add(secondArch);
  return city;
}

/** Lumen District: original terraced towers, lit windows and elevated skybridges. */
function drawCity(scene: T.Object3D) {
  const city = new T.Group();
  scene.add(city);
  const concrete = material(0x243343, 0.5, 0.7),
    brickFacade = cityFacadeTexture(),
    facade = material(0xffffff, 0.12, 0.86),
    trim = material(0x405469, 0.6, 0.4);
  brickFacade.colorSpace = T.SRGBColorSpace;
  brickFacade.anisotropy = 8;
  facade.map = brickFacade;
  const windowMat = new T.MeshStandardMaterial({
    color: 0xf2cb8b,
    emissive: 0x9a6330,
    emissiveIntensity: 0.55,
    roughness: 0.3,
  });
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
    const tower = box(city, [width, height, 9], [x, height / 2 - 2, z], facade);
    tower.castShadow = false;
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
  let cinematicDistrict: T.Group | undefined;
  return {
    group: city,
    setQuality(quality: Quality) {
      const detailed = quality === "ultra" || quality === "cinematic";
      facade.bumpMap = detailed ? brickFacade : null;
      facade.bumpScale = detailed ? 0.018 : 0;
      facade.needsUpdate = true;
      if (quality === "cinematic") {
        cinematicDistrict ??= drawCinematicDistrict(city);
        cinematicDistrict.visible = true;
      } else if (cinematicDistrict) cinematicDistrict.visible = false;
    },
  };
}

function drawCinematicDistrict(parent: T.Object3D) {
  const district = new T.Group();
  parent.add(district);
  const ground = new T.Mesh(
    new T.PlaneGeometry(560, 680),
    material(0x202b36, 0.15, 0.92),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1.5;
  ground.receiveShadow = true;
  district.add(ground);

  const buildingCount = 64,
    bodyMaterial = new T.MeshStandardMaterial({
      color: 0x657987,
      metalness: 0.48,
      roughness: 0.32,
    }),
    roofMaterial = material(0x9aabb2, 0.72, 0.28),
    windowsMaterial = new T.MeshStandardMaterial({
      color: 0xffd89a,
      emissive: 0xf49a48,
      emissiveIntensity: 1.5,
      roughness: 0.22,
      metalness: 0.1,
    }),
    accentMaterial = new T.MeshStandardMaterial({
      color: 0x73eaff,
      emissive: 0x19bce5,
      emissiveIntensity: 1.2,
      metalness: 0.35,
      roughness: 0.3,
    }),
    bodies = new T.InstancedMesh(
      new T.BoxGeometry(1, 1, 1),
      bodyMaterial,
      buildingCount,
    ),
    roofs = new T.InstancedMesh(
      new T.BoxGeometry(1, 1, 1),
      roofMaterial,
      buildingCount,
    ),
    windows = new T.InstancedMesh(
      new T.BoxGeometry(0.7, 1.05, 0.08),
      windowsMaterial,
      12000,
    ),
    accents = new T.InstancedMesh(
      new T.BoxGeometry(0.18, 1, 0.14),
      accentMaterial,
      buildingCount * 2,
    ),
    dummy = new T.Object3D();
  bodies.castShadow = false;
  bodies.receiveShadow = false;
  roofs.castShadow = false;
  roofs.receiveShadow = false;
  let windowCount = 0,
    accentCount = 0,
    seed = 5021;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  for (let i = 0; i < buildingCount; i++) {
    const angle = (i / buildingCount) * Math.PI * 2 + (random() - 0.5) * 0.12,
      x = Math.cos(angle) * (132 + random() * 72),
      z = Math.sin(angle) * (158 + random() * 82),
      width = 9 + random() * 9,
      depth = 8 + random() * 8,
      height = 30 + random() * 74;
    dummy.position.set(x, height / 2 - 1.5, z);
    dummy.scale.set(width, height, depth);
    dummy.updateMatrix();
    bodies.setMatrixAt(i, dummy.matrix);
    bodies.setColorAt(
      i,
      new T.Color().setHSL(0.56 + random() * 0.04, 0.16, 0.32 + random() * 0.2),
    );
    dummy.position.set(x, height - 1.1, z);
    dummy.scale.set(width + 0.8, 0.9, depth + 0.8);
    dummy.updateMatrix();
    roofs.setMatrixAt(i, dummy.matrix);

    const levels = Math.floor(height / 4.5),
      columns = Math.max(2, Math.floor(width / 2.2));
    for (let level = 0; level < levels; level++)
      for (let col = 0; col < columns; col++)
        for (const side of [-1, 1]) {
          if (random() < 0.18 || windowCount >= windows.instanceMatrix.count)
            continue;
          const wx = x - width / 2 + ((col + 0.5) * width) / columns,
            wy = 1 + level * 4.5,
            wz = z + side * (depth / 2 + 0.045);
          dummy.position.set(wx, wy, wz);
          dummy.rotation.set(0, side < 0 ? Math.PI : 0, 0);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          windows.setMatrixAt(windowCount, dummy.matrix);
          windows.setColorAt(
            windowCount++,
            random() > 0.84
              ? new T.Color(0x83eaff)
              : new T.Color().setHSL(0.1, 0.55, 0.55 + random() * 0.25),
          );
        }
    dummy.rotation.set(0, 0, 0);
    for (const side of [-1, 1]) {
      dummy.position.set(
        x + side * (width / 2 + 0.12),
        height * 0.48,
        z - depth / 2 - 0.08,
      );
      dummy.scale.set(1, height * 0.76, 1);
      dummy.updateMatrix();
      accents.setMatrixAt(accentCount++, dummy.matrix);
    }
  }
  windows.count = windowCount;
  accents.count = accentCount;
  bodies.instanceMatrix.needsUpdate = true;
  roofs.instanceMatrix.needsUpdate = true;
  windows.instanceMatrix.needsUpdate = true;
  accents.instanceMatrix.needsUpdate = true;
  if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true;
  if (windows.instanceColor) windows.instanceColor.needsUpdate = true;
  district.add(bodies, roofs, windows, accents);
  return district;
}
