import * as T from "three";
import { carModel, disposeModel } from "./models";
import type { PartyMember } from "../../shared/party";
type Display = {
  model: T.Group;
  label: HTMLElement;
  key: string;
  target: T.Vector3;
  opacity: number;
  leaving: boolean;
};
export class HomeLobby {
  group = new T.Group();
  private displays = new Map<string, Display>();
  private count = 1;
  private yaw = 0;
  private polar = 1.17;
  private draggingPointer: number | null = null;
  private pointerX = 0;
  private pointerY = 0;
  area = document.createElement("div");
  labels = document.createElement("div");
  private canvas = document.querySelector<HTMLCanvasElement>("#viewport canvas");
  constructor(scene: T.Scene) {
    scene.add(this.group);
    this.area.id = "home-car-area";
    this.labels.id = "lobby-labels";
    document.getElementById("app")!.append(this.area, this.labels);
    this.canvas?.addEventListener("pointerdown", (event) => {
      if (this.area.hidden || event.button !== 0) return;
      this.draggingPointer = event.pointerId;
      this.pointerX = event.clientX;
      this.pointerY = event.clientY;
      this.canvas!.setPointerCapture(event.pointerId);
      this.canvas!.style.cursor = "grabbing";
    });
    this.canvas?.addEventListener("pointermove", (event) => {
      if (event.pointerId !== this.draggingPointer) return;
      if (event.pointerType === "mouse" && event.buttons === 0) {
        this.stopDragging();
        return;
      }
      this.yaw -= (event.clientX - this.pointerX) * 0.006;
      this.polar = T.MathUtils.clamp(
        this.polar + (event.clientY - this.pointerY) * 0.004,
        0.48,
        1.48,
      );
      this.pointerX = event.clientX;
      this.pointerY = event.clientY;
    });
    const endDrag = (event: PointerEvent) => {
      if (event.pointerId === this.draggingPointer) this.stopDragging();
    };
    this.canvas?.addEventListener("pointerup", endDrag);
    this.canvas?.addEventListener("pointercancel", endDrag);
    this.canvas?.addEventListener("lostpointercapture", endDrag);
    window.addEventListener("blur", () => this.stopDragging());
  }
  update(
    members: PartyMember[],
    camera: T.PerspectiveCamera,
    dt: number,
    time: number,
    visible: boolean,
  ) {
    this.group.visible = visible;
    this.area.hidden = !visible;
    this.labels.hidden = !visible;
    if (!visible) this.stopDragging();
    if (this.canvas) {
      this.canvas.style.cursor = visible ? "grab" : "default";
      this.canvas.style.touchAction = visible ? "none" : "";
    }
    if (!visible) return;
    const narrow = innerWidth < 760,
      columns = narrow ? Math.min(2, members.length) : members.length,
      rows = Math.ceil(members.length / columns);
    const active = new Set(members.map((m) => m.id));
    for (const [id, d] of this.displays) d.leaving = !active.has(id);
    members.forEach((m, i) => {
      const key = JSON.stringify(m.preset);
      let d = this.displays.get(m.id);
      if (d && d.key !== key) {
        const position = d.model.position.clone();
        this.group.remove(d.model);
        disposeModel(d.model);
        d.model = carModel(
          new T.Color(m.preset.blue).getHex(),
          m.preset.body,
          m.preset.wheels,
          m.preset.decal,
          m.preset.topper,
        );
        d.model.position.copy(position);
        this.group.add(d.model);
        d.key = key;
      }
      if (!d) {
        const model = carModel(
            new T.Color(m.preset.blue).getHex(),
            m.preset.body,
            m.preset.wheels,
            m.preset.decal,
            m.preset.topper,
          ),
          label = document.createElement("span");
        label.className = "lobby-name";
        this.labels.append(label);
        model.position.set(6, 0.31, 15);
        this.group.add(model);
        d = {
          model,
          label,
          key,
          target: new T.Vector3(),
          opacity: 0,
          leaving: false,
        };
        this.displays.set(m.id, d);
      }
      const row = Math.floor(i / columns),
        rowCount = Math.min(columns, members.length - row * columns);
      d.target.set(
        6 + ((i % columns) - (rowCount - 1) / 2) * 1.95,
        0.31,
        14 + row * 2.3 + (rows === 1 && i % 2 ? 0.18 : 0),
      );
      d.label.textContent = m.name;
      d.model.rotation.y = Math.PI + 0.38;
      d.leaving = false;
    });
    const ease = 1 - Math.exp(-dt * 15);
    this.count = T.MathUtils.lerp(this.count, members.length, ease);
    const rect = this.area.getBoundingClientRect(),
      spanX = (columns - 1) * 1.95 + 2.05,
      spanY = rows > 1 ? 3.5 : 1.9;
    const fov = 42,
      halfTan = Math.tan(T.MathUtils.degToRad(fov / 2));
    const distance = Math.max(
      2.7,
      spanX / (2 * halfTan * (rect.width / innerHeight)),
      spanY / (2 * halfTan * (rect.height / innerHeight)),
    );
    const target = new T.Vector3(6, 0.5, 14 + (rows - 1) * 1.15),
      position = target.clone().add(
        new T.Vector3(
          Math.sin(this.yaw) * Math.sin(this.polar) * distance,
          Math.cos(this.polar) * distance,
          Math.cos(this.yaw) * Math.sin(this.polar) * distance,
        ),
      );
    camera.position.lerp(position, ease);
    camera.up.set(0, 1, 0);
    camera.lookAt(target);
    camera.fov = fov;
    camera.setViewOffset(
      innerWidth,
      innerHeight,
      innerWidth / 2 - (rect.x + rect.width / 2),
      innerHeight / 2 - (rect.y + rect.height / 2),
      innerWidth,
      innerHeight,
    );
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    for (const [id, d] of this.displays) {
      d.model.position.lerp(d.target, ease);
      d.opacity = T.MathUtils.lerp(d.opacity, d.leaving ? 0 : 1, ease);
      d.model.traverse((o) => {
        if (o instanceof T.Mesh)
          for (const material of Array.isArray(o.material)
            ? o.material
            : [o.material]) {
            material.transparent = d.opacity < 0.995;
            material.opacity = d.opacity;
          }
      });
      const p = d.model.position
        .clone()
        .add(new T.Vector3(0, -0.06, 0.85))
        .project(camera);
      d.label.style.left = `${(p.x * 0.5 + 0.5) * innerWidth}px`;
      d.label.style.top = `${(-p.y * 0.5 + 0.5) * innerHeight}px`;
      d.label.style.opacity = String(d.opacity);
      if (d.leaving && d.opacity < 0.01) {
        this.group.remove(d.model);
        disposeModel(d.model);
        d.label.remove();
        this.displays.delete(id);
      }
    }
  }

  private stopDragging() {
    const pointer = this.draggingPointer;
    this.draggingPointer = null;
    if (pointer !== null && this.canvas?.hasPointerCapture(pointer))
      this.canvas.releasePointerCapture(pointer);
    if (this.canvas) this.canvas.style.cursor = "grab";
  }
}
