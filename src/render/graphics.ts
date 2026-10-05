import * as T from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { FXAAShader } from "three/addons/shaders/FXAAShader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { qualities, type Quality } from "../game/settings";
export class Graphics {
  quality: Quality = "high";
  private applied: Quality | null = null;
  private baseFog: { color: T.Color; near: number; far: number } | null = null;
  private composer: EffectComposer;
  private renderPass: RenderPass;
  private aa = new ShaderPass(FXAAShader);
  private environment: T.Texture | null = null;
  constructor(
    public renderer: T.WebGLRenderer,
    private scene: T.Scene,
    camera: T.Camera,
    private sun: T.DirectionalLight,
  ) {
    if (scene.fog instanceof T.Fog)
      this.baseFog = {
        color: scene.fog.color.clone(),
        near: scene.fog.near,
        far: scene.fog.far,
      };
    this.composer = new EffectComposer(renderer);
    this.renderPass = new RenderPass(this.scene, camera);
    this.composer.addPass(this.renderPass);
    this.composer.addPass(new OutputPass());
    this.composer.addPass(this.aa);
  }
  apply(quality: Quality) {
    if (quality === this.applied) return;
    this.applied = quality;
    this.quality = quality;
    const q = qualities[quality];
    if (quality === "ultra" || quality === "cinematic") {
      if (!this.environment) {
        const room = new RoomEnvironment(),
          pmrem = new T.PMREMGenerator(this.renderer);
        this.environment = pmrem.fromScene(room, 0.04).texture;
        room.dispose();
        pmrem.dispose();
      }
      this.scene.environment = this.environment;
      this.scene.environmentIntensity = quality === "cinematic" ? 1.1 : 0.8;
    } else {
      this.scene.environment = null;
      this.scene.environmentIntensity = 1;
    }
    if (this.baseFog && this.scene.fog instanceof T.Fog) {
      this.scene.fog.color.copy(this.baseFog.color);
      this.scene.fog.near =
        quality === "cinematic" ? Math.max(this.baseFog.near, 190) : this.baseFog.near;
      this.scene.fog.far =
        quality === "cinematic" ? Math.max(this.baseFog.far, 440) : this.baseFog.far;
    }
    this.renderer.shadowMap.enabled = q.shadows > 0;
    if (this.sun.shadow.mapSize.x !== q.shadows && q.shadows) {
      this.sun.shadow.mapSize.set(q.shadows, q.shadows);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
      this.sun.shadow.needsUpdate = true;
    }
    this.resize();
  }
  resize() {
    const ratio = Math.min(
      Math.min(devicePixelRatio, 1.75) * qualities[this.quality].scale,
      2,
    );
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(innerWidth, innerHeight);
    this.composer.setPixelRatio(ratio);
    this.composer.setSize(innerWidth, innerHeight);
    this.aa.uniforms.resolution.value.set(
      1 / (innerWidth * ratio),
      1 / (innerHeight * ratio),
    );
  }
  render(scene: T.Scene, camera: T.Camera) {
    if (qualities[this.quality].aa) {
      this.renderPass.scene = scene;
      this.renderPass.camera = camera;
      this.composer.render();
    } else this.renderer.render(scene, camera);
  }
}
