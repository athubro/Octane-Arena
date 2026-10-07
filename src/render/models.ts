import * as T from "three";
import { P } from "../config/physics";
import { bodies, type BodyId } from "../game/inventory";
import { wheelMount, wheelRadius, wheelClearance } from "../car/wheels";
import type { Car } from "../car/car";
export const material = (color: number, metalness = 0.1, roughness = 0.65) =>
  new T.MeshStandardMaterial({ color, metalness, roughness });
export function box(
  parent: T.Object3D,
  size: number[],
  position: number[],
  mat: T.Material,
) {
  const m = new T.Mesh(
    new T.BoxGeometry(...(size as [number, number, number])),
    mat,
  );
  m.position.set(...(position as [number, number, number]));
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
export function carModel(
  color: number,
  bodyId: BodyId = "vector",
  wheels = "apex",
  decal = "none",
  topper = "none",
) {
  const g = new T.Group(),
    d = bodies[bodyId],
    rally = bodyId === "vector",
    coupe = bodyId === "riptide";
  const paint = material(color, 0.4, 0.42),
    dark = material(0x101c25, 0.45, 0.4),
    glass = material(0x446778, 0.7, 0.28);
  const W = d.halfWidth * 2,
    L = d.halfLength * 2,
    roof = d.hitboxY + d.halfHeight - 0.012;
  // Roof/body vertices stay within the physical top plane; wheels follow contact geometry.
  const hull = profileMesh(
    W - 0.04,
    rally
      ? [
          [-L / 2 + 0.02, -0.125],
          [-L / 2 + 0.02, 0.075],
          [-L * 0.36, 0.135],
          [L * 0.41, 0.135],
          [L / 2 - 0.02, 0.085],
          [L / 2 - 0.02, -0.125],
        ]
      : coupe
        ? [
            [-L / 2 + 0.02, -0.125],
            [-L / 2 + 0.02, -0.055],
            [-L * 0.34, 0.045],
            [-L * 0.16, 0.115],
            [L * 0.24, 0.105],
            [L / 2 - 0.02, 0.015],
            [L / 2 - 0.02, -0.125],
          ]
        : [
            [-L / 2 + 0.02, -0.125],
            [-L / 2 + 0.02, -0.015],
            [-L * 0.4, 0.045],
            [L * 0.4, 0.045],
            [L / 2 - 0.02, -0.005],
            [L / 2 - 0.02, -0.125],
          ],
    paint,
  );
  g.add(hull);
  const hoodY = rally ? 0.15 : coupe ? 0.105 : 0.07,
    hoodLength = L * (rally ? 0.27 : coupe ? 0.36 : 0.4),
    hoodZ = -L * (rally ? 0.335 : coupe ? 0.3 : 0.275),
    roofLength = L * (rally ? 0.49 : coupe ? 0.37 : 0.39),
    roofZ = L * (rally ? 0.085 : coupe ? 0.12 : 0.1);
  box(g, [W - 0.17, 0.07, hoodLength], [0, hoodY, hoodZ], paint);
  g.add(
    profileMesh(
      W - (rally ? 0.17 : 0.25),
      rally
        ? [
            [-L * 0.245, 0.135],
            [-L * 0.16, roof - 0.032],
            [L * 0.33, roof - 0.032],
            [L * 0.4, 0.135],
          ]
        : coupe
          ? [
              [-L * 0.24, 0.09],
              [-L * 0.11, roof - 0.04],
              [L * 0.17, roof - 0.04],
              [L * 0.34, 0.07],
            ]
          : [
              [-L * 0.2, 0.07],
              [-L * 0.095, roof - 0.032],
              [L * 0.29, roof - 0.032],
              [L * 0.36, 0.07],
            ],
      glass,
    ),
  );
  box(
    g,
    [W - (rally ? 0.14 : coupe ? 0.18 : 0.22), 0.025, roofLength],
    [0, roof - 0.0125, roofZ],
    paint,
  );
  box(g, [W, 0.045, 0.07], [0, -0.025, -L / 2], dark);
  box(
    g,
    [W - (rally ? 0.12 : coupe ? 0.16 : 0.01), 0.045, 0.09],
    [0, roof - 0.025, L * (rally ? 0.35 : coupe ? 0.38 : 0.44)],
    dark,
  );
  if (rally) {
    // Upright rally hatch: split side glazing, broad shoulders and a blunt grille.
    box(g, [W * 0.48, 0.075, 0.025], [0, 0.052, -L / 2 - 0.01], dark);
    for (const sign of [-1, 1])
      box(
        g,
        [0.03, roof - 0.16, 0.042],
        [(sign * (W - 0.16)) / 2, (roof + 0.11) / 2, L * 0.08],
        paint,
      );
    for (const side of [-1, 1])
      for (const end of [-1, 1]) {
        const flare = profileMesh(
          0.075,
          [
            [-0.22, -0.08],
            [-0.19, 0.055],
            [-0.1, 0.12],
            [0.1, 0.12],
            [0.19, 0.055],
            [0.22, -0.08],
            [0.175, -0.08],
            [0.14, 0.025],
            [0.075, 0.07],
            [-0.075, 0.07],
            [-0.14, 0.025],
            [-0.175, -0.08],
          ],
          dark,
        );
        flare.position.set(side * (W / 2 - 0.025), -0.025, end * d.axle);
        g.add(flare);
      }
  } else if (coupe) {
    // Fastback coupe styling stays within the body hitbox.
    for (const side of [-1, 1]) {
      box(
        g,
        [0.026, 0.12, L * 0.26],
        [side * (W * 0.37), roof - 0.09, L * 0.1],
        paint,
      );
      box(g, [0.06, 0.025, 0.19], [side * (W * 0.36), 0.045, -L * 0.3], dark);
    }
  }
  for (const sign of [-1, 1]) {
    box(
      g,
      [rally ? 0.16 : 0.12, rally ? 0.065 : 0.027, 0.02],
      [sign * W * 0.32, rally ? 0.06 : 0.057, -L / 2 - 0.005],
      new T.MeshBasicMaterial({ color: 0xcfffff }),
    );
    box(
      g,
      [rally ? 0.055 : 0.2, rally ? 0.1 : 0.025, 0.02],
      [sign * W * 0.29, rally ? 0.045 : 0.028, L / 2 + 0.005],
      new T.MeshBasicMaterial({ color: 0xff4b35 }),
    );
    box(g, [0.035, 0.04, L * 0.68], [sign * (W / 2 - 0.01), -0.075, 0], dark);
    box(g, [0.11, 0.075, 0.08], [sign * 0.21, -0.025, L / 2 + 0.015], dark);
    const vent = box(
      g,
      [0.09, 0.01, 0.18],
      [sign * 0.19, hoodY + 0.038, rally ? hoodZ : -L * 0.26],
      dark,
    );
    vent.rotation.y = sign * 0.15;
  }
  if (decal === "circuit")
    for (const sign of [-1, 1]) {
      const stripe = new T.MeshBasicMaterial({ color: 0xd7f4ed });
      box(
        g,
        [0.042, 0.008, hoodLength],
        [sign * 0.12, hoodY + 0.039, hoodZ],
        stripe,
      );
      box(
        g,
        [0.042, 0.008, roofLength],
        [sign * 0.12, roof + 0.003, roofZ],
        stripe,
      );
    }
  if (topper !== "none") {
    const cap = new T.Group();
    cap.position.set(0, roof + 0.035, roofZ);
    const topperMaterial = (color: number) =>
      new T.MeshStandardMaterial({ color, metalness: 0.25, roughness: 0.48 });
    const addMesh = (geometry: T.BufferGeometry, mat: T.Material, x: number, y: number, z: number) => {
      const mesh = new T.Mesh(geometry, mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      cap.add(mesh);
      return mesh;
    };
    if (topper === "cat-ears" || topper === "fox-ears") {
      const fox = topper === "fox-ears",
        fur = topperMaterial(fox ? 0xd46c3d : 0x263d4b),
        inner = topperMaterial(fox ? 0xffc18a : 0xf28db2);
      for (const side of [-1, 1]) {
        const ear = addMesh(new T.ConeGeometry(0.105, 0.28, 4), fur, side * 0.2, 0.13, 0);
        ear.rotation.z = -side * 0.2;
        if (!fox)
          addMesh(new T.ConeGeometry(0.052, 0.15, 4), inner, side * 0.2, 0.145, -0.004);
      }
    } else if (topper === "spike-crown") {
      const steel = topperMaterial(0xd9e6e9);
      for (let i = 0; i < 5; i++) {
        const x = (i - 2) * 0.105,
          spike = addMesh(new T.ConeGeometry(0.065, 0.24, 5), steel, x, 0.11, 0);
        spike.rotation.z = -x * 0.65;
      }
    } else if (topper === "shark-fin") {
      const fin = addMesh(
        new T.ConeGeometry(0.19, 0.38, 3),
        topperMaterial(0x4f91a4),
        0,
        0.16,
        0,
      );
      fin.rotation.x = -Math.PI / 2;
      fin.rotation.z = Math.PI;
    } else if (topper === "owl") {
      const body = topperMaterial(0x916c46),
        eye = new T.MeshBasicMaterial({ color: 0xffe8a3 }),
        pupil = new T.MeshBasicMaterial({ color: 0x18232b });
      addMesh(new T.SphereGeometry(0.16, 12, 10), body, 0, 0.1, 0);
      for (const side of [-1, 1]) {
        addMesh(new T.SphereGeometry(0.055, 10, 8), eye, side * 0.065, 0.14, -0.13);
        addMesh(new T.SphereGeometry(0.022, 8, 6), pupil, side * 0.065, 0.14, -0.17);
        const tuft = addMesh(new T.ConeGeometry(0.06, 0.12, 4), body, side * 0.1, 0.25, 0.02);
        tuft.rotation.z = -side * 0.4;
      }
    }
    g.add(cap);
  }
  const spins: T.Group[] = [],
    mounts: T.Group[] = [],
    steering: T.Group[] = [];
  for (let i = 0; i < 4; i++) {
    const x = (i % 2 ? 1 : -1) * (d.halfWidth + 0.005),
      z = (i < 2 ? -1 : 1) * d.axle;
    const pivot = new T.Group(),
      spin = new T.Group();
    pivot.position.copy(wheelMount(bodyId, i));
    pivot.position.y = -0.12;
    mounts.push(pivot);
    pivot.add(spin);
    g.add(pivot);
    const tyre = new T.Mesh(
      new T.CylinderGeometry(wheelRadius, wheelRadius, 0.115, 20),
      dark,
    );
    tyre.rotation.z = Math.PI / 2;
    tyre.castShadow = true;
    spin.add(tyre);
    const hubColor = wheels === "smiley" || wheels === "laugh"
        ? wheels === "laugh" ? 0xffae34 : 0xffd43b
        : wheels === "coin"
          ? 0xd89b37
          : wheels === "prism"
            ? 0x6edfea
            : wheels === "star"
              ? 0xb9e5ff
              : wheels === "turbine"
                ? 0x7f9da8
                : 0xa6cad3,
      hub = new T.Mesh(
      new T.CylinderGeometry(
        wheels === "disc" || wheels === "coin" ? 0.14 : 0.115,
        wheels === "disc" || wheels === "coin" ? 0.14 : 0.115,
        0.12,
        wheels === "disc" || wheels === "coin" ? 24 : 6,
      ),
      material(hubColor, 0.9, 0.25),
    );
    hub.rotation.z = Math.PI / 2;
    spin.add(hub);
    const spoke = box(spin, [0.125, 0.025, 0.26], [0, 0, 0], paint);
    if (wheels === "disc") spoke.rotation.x = Math.PI / 4;
    if (["smiley", "laugh", "coin", "turbine", "star", "prism", "retro"].includes(wheels)) {
      const face = new T.Group();
      for (const side of [-1, 1]) {
        const detail = new T.Group();
        detail.position.x = side * 0.065;
        detail.scale.x = side;
        face.add(detail);
        const ink = new T.MeshBasicMaterial({
          color: wheels === "smiley" || wheels === "laugh" ? 0x202934 : 0xeffbff,
        });
        const addDot = (y: number, z: number, radius: number) => {
          const dot = new T.Mesh(new T.SphereGeometry(radius, 8, 6), ink);
          dot.position.set(0, y, z);
          detail.add(dot);
        };
        const addLine = (points: T.Vector3[], radius = 0.012) => {
          const line = new T.Mesh(
            new T.TubeGeometry(new T.CatmullRomCurve3(points), 18, radius, 5, false),
            ink,
          );
          detail.add(line);
        };
        if (wheels === "smiley" || wheels === "laugh") {
          addDot(0.045, -0.045, 0.018);
          addDot(0.045, 0.045, 0.018);
          if (wheels === "smiley")
            addLine([
              new T.Vector3(0, -0.05, -0.065),
              new T.Vector3(0, -0.085, 0),
              new T.Vector3(0, -0.05, 0.065),
            ], 0.012);
          else {
            addLine([
              new T.Vector3(0, -0.025, -0.07),
              new T.Vector3(0, -0.09, -0.04),
              new T.Vector3(0, -0.095, 0.04),
              new T.Vector3(0, -0.025, 0.07),
            ], 0.018);
            for (let tooth = -1; tooth <= 1; tooth++)
              addLine([
                new T.Vector3(0, -0.055, tooth * 0.035),
                new T.Vector3(0, -0.085, tooth * 0.035),
              ], 0.006);
          }
        } else if (wheels === "coin") {
          const coinMark = new T.Mesh(
            new T.TorusGeometry(0.075, 0.009, 5, 20),
            new T.MeshBasicMaterial({ color: 0xffe69b }),
          );
          coinMark.position.x = 0;
          coinMark.rotation.y = Math.PI / 2;
          detail.add(coinMark);
          addLine([
            new T.Vector3(0, -0.055, 0),
            new T.Vector3(0, 0.055, 0),
          ], 0.017);
        } else if (wheels === "star") {
          for (let ray = 0; ray < 8; ray++) {
            const angle = (ray * Math.PI) / 4;
            addLine([
              new T.Vector3(0, 0, 0),
              new T.Vector3(0, Math.cos(angle) * 0.09, Math.sin(angle) * 0.09),
            ], ray % 2 ? 0.008 : 0.015);
          }
        } else {
          const count = wheels === "retro" ? 5 : wheels === "turbine" ? 7 : 6;
          for (let spokeIndex = 0; spokeIndex < count; spokeIndex++) {
            const angle = (spokeIndex * Math.PI * 2) / count,
              inner = wheels === "turbine" ? 0.025 : 0.035,
              outer = wheels === "turbine" ? 0.105 : 0.095;
            addLine([
              new T.Vector3(0, Math.cos(angle) * inner, Math.sin(angle) * inner),
              new T.Vector3(
                0,
                Math.cos(angle + (wheels === "turbine" ? 0.2 : 0)) * outer,
                Math.sin(angle + (wheels === "turbine" ? 0.2 : 0)) * outer,
              ),
            ], wheels === "retro" ? 0.016 : 0.01);
          }
        }
      }
      spin.add(face);
    }
    spins.push(spin);
    if (i < 2) steering.push(pivot);
  }
  g.userData.wheels = spins;
  g.userData.frontWheels = steering;
  g.userData.wheelMounts = mounts;
  g.userData.bodyId = bodyId;
  return g;
}
/** Original faceted side profile, extruded across the car; no imported models. */
function profileMesh(
  width: number,
  profile: [number, number][],
  mat: T.Material,
) {
  const shape = new T.Shape();
  shape.moveTo(profile[0][0], profile[0][1]);
  for (const [z, y] of profile.slice(1)) shape.lineTo(z, y);
  shape.closePath();
  const geo = new T.ExtrudeGeometry(shape, {
    depth: width,
    bevelEnabled: false,
    steps: 1,
  });
  // Extrusion initially uses XY silhouette and Z width; map it into world YZ.
  const positions = geo.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const z = positions.getX(i),
      y = positions.getY(i),
      x = width / 2 - positions.getZ(i);
    positions.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  const mesh = new T.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
export function animateWheels(
  model: T.Group,
  speed: number,
  steer: number,
  dt: number,
  car?: Car,
  pose?: T.Object3D,
) {
  for (const wheel of model.userData.wheels as T.Group[])
    wheel.rotation.x -= (speed * dt) / 0.18;
  for (const pivot of model.userData.frontWheels as T.Group[])
    pivot.rotation.y = T.MathUtils.lerp(
      pivot.rotation.y,
      steer,
      1 - Math.exp(-dt * 20),
    );
  if (car && pose)
    (model.userData.wheelMounts as T.Group[]).forEach((pivot, i) => {
      pivot.position.y = wheelClearance(
        car.world,
        pose.position,
        pose.quaternion,
        car.bodyId,
        i,
        car.collider,
        car.body,
        pivot.rotation.y,
      );
    });
}
export function disposeModel(model: T.Object3D) {
  model.traverse((o) => {
    if (o instanceof T.Mesh) {
      o.geometry.dispose();
      for (const m of Array.isArray(o.material) ? o.material : [o.material])
        m.dispose();
    }
  });
}
export function ballModel() {
  const g = new T.Group(),
    r = P.ball.radius;
  const core = new T.Mesh(
    new T.SphereGeometry(r - 0.009, 40, 28),
    material(0x172d38, 0.35, 0.6),
  );
  core.castShadow = true;
  g.add(core);
  const source = new T.IcosahedronGeometry(1, 1).getAttribute("position");
  const positions: number[] = [],
    normals: number[] = [],
    colors: number[] = [],
    lamps: T.Mesh[] = [];
  const write = (v: T.Vector3, color: T.Color) => {
    v.normalize();
    normals.push(v.x, v.y, v.z);
    positions.push(v.x * r, v.y * r, v.z * r);
    colors.push(color.r, color.g, color.b);
  };
  for (let face = 0; face < source.count / 3; face++) {
    const corners = [0, 1, 2].map((k) =>
      new T.Vector3().fromBufferAttribute(source, face * 3 + k),
    );
    const center = corners[0]
      .clone()
      .add(corners[1])
      .add(corners[2])
      .multiplyScalar(1 / 3);
    const [a, b, c] = corners.map((v) => v.lerp(center, 0.065));
    const point = (i: number, j: number) =>
      a
        .clone()
        .multiplyScalar(1 - (i + j) / 6)
        .addScaledVector(b, i / 6)
        .addScaledVector(c, j / 6);
    const color = new T.Color(
      face % 9 === 0 ? 0x385561 : face % 3 === 0 ? 0xc4d3d6 : 0xf0f3e9,
    );
    for (let i = 0; i < 6; i++)
      for (let j = 0; j < 6 - i; j++) {
        const triangle = [point(i, j), point(i + 1, j), point(i, j + 1)];
        if (face % 9 === 0 && i === 2 && j === 2) {
          const geo = new T.BufferGeometry().setFromPoints(
            triangle.map((v) => v.normalize().multiplyScalar(r)),
          );
          geo.setIndex([0, 1, 2]);
          const lamp = new T.Mesh(
            geo,
            new T.MeshBasicMaterial({ color: 0x9df8ea, side: T.DoubleSide }),
          );
          g.add(lamp);
          lamps.push(lamp);
        } else for (const v of triangle) write(v, color);
        if (i + j < 5)
          for (const v of [
            point(i + 1, j),
            point(i + 1, j + 1),
            point(i, j + 1),
          ])
            write(v, color);
      }
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new T.Float32BufferAttribute(normals, 3));
  geo.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  const panels = new T.Mesh(
    geo,
    new T.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.65,
      metalness: 0.2,
    }),
  );
  panels.castShadow = true;
  g.add(panels);
  g.userData.lamps = lamps;
  g.userData.radius = r;
  return g;
}
export function animateBall(ball: T.Group, time: number) {
  (
    ball.userData.lamps as T.Mesh<T.BufferGeometry, T.MeshBasicMaterial>[]
  ).forEach((lamp, i) =>
    lamp.material.color
      .setRGB(0.35, 0.85, 0.72)
      .multiplyScalar(0.65 + 0.35 * Math.sin(time * 1.5 + i * 1.7) ** 2),
  );
}
