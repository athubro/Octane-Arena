import { PartyClient } from "./game/party";
import { PartyPanel } from "./ui/party-panel";
import { HomeLobby } from "./render/home-lobby";
import RAPIER from "@dimforge/rapier3d-compat";
import * as T from "three";
import "./style.css";
import { Simulation } from "./physics/simulation";
import { FixedLoop } from "./physics/loop";
import { Input } from "./input/input";
import { Opponent } from "./ai/opponent";
import { Match } from "./game/match";
import { Pads } from "./game/pads";
import { GameCamera } from "./camera/camera";
import {
  carModel,
  ballModel,
  animateBall,
  animateWheels,
  disposeModel,
} from "./render/models";
import { drawArena } from "./render/arena";
import { Effects } from "./effects/effects";
import { GameAudio } from "./audio/audio";
import { DebugView } from "./debug/debug";
import { UI } from "./ui/ui";
import { P } from "./config/physics";
import { neutral } from "./input/types";
import { Settings, qualities } from "./game/settings";
import { Garage } from "./game/inventory";
import { SettingsPanel } from "./ui/settings-panel";
import { GaragePanel } from "./ui/garage-panel";
import { GaragePreview } from "./render/garage-preview";
import { Graphics } from "./render/graphics";
import { Hitboxes } from "./debug/hitboxes";
import { VehicleEffects } from "./effects/vehicle-effects";
import { GoalExplosion } from "./effects/goal-explosion";
import { Accounts } from "./game/accounts";
import { trainingActions } from "./input/bindings";
import { trainingAction } from "./game/training";
import { SkidMarks } from "./effects/skid-marks";
import { GoalPlanes } from "./effects/goal-plane";
import { BallTrails, FlipTrails } from "./effects/motion-trails";
import { PadRecharge } from "./render/pad-recharge";
import { DemolitionFlash } from "./effects/demolition-flash";
import { RingChallenge } from "./game/ring-challenge";
import { RingCourseView } from "./render/ring-course";
import { RingMap } from "./render/ring-map";
import type {
  MatchSnapshot,
  PartyGame,
  Vec3Tuple,
  QuatTuple,
} from "../shared/party";
import type { PlayerEntity, PlayerInput } from "../shared/player";

async function boot() {
  await RAPIER.init();
  const settings = new Settings(),
    garage = new Garage(),
    ui = new UI(),
    simulation = new Simulation(false, [
      { id: "player", name: "Guest", team: 0, controller: "local" },
      { id: "bot", name: "Rival", team: 1, controller: "bot" },
      { id: "reserve-blue", name: "Guest", team: 0, controller: "remote" },
      { id: "reserve-orange", name: "Guest", team: 1, controller: "remote" },
    ]),
    input = new Input(settings.value.bindings),
    opponent = new Opponent(),
    botBrains = simulation.cars.map(() => new Opponent()),
    match = new Match(),
    ringChallenge = new RingChallenge(),
    pads = new Pads(),
    audio = new GameAudio();
  ui.setProfile(garage.profile);
  document.querySelector("#rings-mode small")!.textContent =
    `BEAT YOUR BEST · ${ringChallenge.best} RINGS`;
  const renderer = new T.WebGLRenderer({
    antialias: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  document.getElementById("viewport")!.appendChild(renderer.domElement);
  const scene = new T.Scene();
  scene.background = new T.Color(0x28354c);
  scene.fog = new T.Fog(0x28354c, 105, 290);
  scene.add(new T.HemisphereLight(0xc5e8ff, 0x426453, 2.5));
  const sun = new T.DirectionalLight(0xffeed9, 3.2);
  sun.position.set(20, 50, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -55,
    right: 55,
    top: 65,
    bottom: -65,
    near: 1,
    far: 120,
  });
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  const arena = drawArena(scene, settings.value.quality);
  const grassVelocities = simulation.cars.map(() => new T.Vector3());
  const ringCourse = new RingCourseView(scene, ringChallenge);
  const ringMap = new RingMap(scene);
  const visuals = [
    carModel(
      new T.Color(garage.current.blue).getHex(),
      garage.current.body,
      garage.current.wheels,
      garage.current.decal,
    ),
    carModel(0xfa9c3e, "vector"),
    carModel(0x69e9ff),
    carModel(0xfa9c3e, "vector"),
  ];
  const cars = visuals.map((model) => {
      const root = new T.Group();
      root.add(model);
      return root;
    }),
    ball = ballModel();
  scene.add(...cars, ball);
  const goalPlanes = new GoalPlanes(scene, ball);
  const ballTrails = new BallTrails(scene);
  const flipTrails = cars.map(() => new FlipTrails(scene));
  const skidMarks = cars.map(() => new SkidMarks(scene));
  const demoFlashes = cars.map(() => new DemolitionFlash(scene));
  const ballShadow = new T.Mesh(
    new T.RingGeometry(0.95, 1.07, 48),
    new T.MeshBasicMaterial({
      color: 0xc2f9ec,
      transparent: true,
      opacity: 0.4,
      side: T.DoubleSide,
    }),
  );
  ballShadow.rotation.x = -Math.PI / 2;
  scene.add(ballShadow);
  const padMeshes = pads.items.map((p) => {
    const group = new T.Group(),
      ring = new T.Mesh(
        new T.TorusGeometry(p.large ? 0.95 : 0.5, 0.045, 6, 24),
        new T.MeshBasicMaterial({ color: 0xfeb84f }),
      );
    ring.rotation.x = Math.PI / 2;
    group.add(ring);
    const crystal = new T.Mesh(
      new T.OctahedronGeometry(p.large ? 0.3 : 0.14),
      new T.MeshBasicMaterial({ color: 0xffd181 }),
    );
    crystal.position.y = p.large ? 0.5 : 0.2;
    group.add(crystal);
    group.position.set(p.x, 0.06, p.z);
    scene.add(group);
    return group;
  });
  const camera = new T.PerspectiveCamera(
      76,
      innerWidth / innerHeight,
      0.05,
      340,
    ),
    cameraControl = new GameCamera(camera),
    effects = new Effects(scene),
    debug = new DebugView(scene, document.getElementById("debug")!);
  const padRecharge = padMeshes.map(
    (mesh, i) => new PadRecharge(mesh, pads.items[i].large),
  );
  const vehicleEffects = cars.map(
    (car, i) => new VehicleEffects(car, scene, i === 0 ? 0x69e9ff : 0xffb654),
  );
  const replaceCarVisual = (
    i: number,
    preset: PartyGame["players"][number]["preset"],
    color: string,
  ) => {
    cars[i].remove(visuals[i]);
    disposeModel(visuals[i]);
    visuals[i] = carModel(
      new T.Color(color).getHex(),
      preset.body,
      preset.wheels,
      preset.decal,
    );
    cars[i].add(visuals[i]);
    simulation.cars[i].setBody(preset.body);
    vehicleEffects[i].setColor(preset.boost === "ember" ? 0xffa548 : 0x69e9ff);
  };
  const explosion = new GoalExplosion(scene);
  const graphics = new Graphics(renderer, scene, camera, sun),
    hitboxes = new Hitboxes(scene);
  const preview = new GaragePreview(document.getElementById("garage-screen")!);
  const updatePreset = () => {
    const p = garage.current;
    cars[0].remove(visuals[0]);
    disposeModel(visuals[0]);
    visuals[0] = carModel(
      new T.Color(p.blue).getHex(),
      p.body,
      p.wheels,
      p.decal,
    );
    cars[0].add(visuals[0]);
    simulation.cars[0].setBody(p.body);
    simulation.cars[1].setBody("vector");
    vehicleEffects[0].setColor(p.boost === "ember" ? 0xffa548 : 0x69e9ff);
    preview.setPreset(p, garagePanel.team);
  };
  const garagePanel = new GaragePanel(garage, updatePreset, () => {
    ui.screen = "home";
    input.clear();
  });
  updatePreset();
  const resetEffects = () => {
    vehicleEffects.forEach((e) => e.reset());
    skidMarks.forEach((e) => e.reset());
    demoFlashes.forEach((e) => e.reset());
    explosion.reset();
    ballTrails.reset();
    flipTrails.forEach((e) => e.reset());
  };
  const applySettings = () => {
    audio.settings = settings.value.audio;
    audio.apply();
    cameraControl.settings = settings.value.camera;
    effects.density = qualities[settings.value.quality].particles;
    graphics.apply(settings.value.quality);
    arena.setQuality(settings.value.quality);
  };
  const settingsPanel = new SettingsPanel(settings, input, applySettings);
  const accounts = new Accounts(garage, settings, () => {
    applySettings();
    updatePreset();
    garagePanel.render();
    ui.setProfile(garage.profile);
  });
  const party = new PartyClient(garage),
    partyPanel = new PartyPanel(party),
    homeLobby = new HomeLobby(scene);
  let activePartyGameId: string | null = null,
    dismissedPartyGameId: string | null = null,
    lastRemoteSnapshot = -1,
    lastRemoteSnapshotAt = 0,
    networkSequence = 0,
    lastNetworkSend = 0;
  let pendingPartyJumpUntil = 0,
    partyJumpWasDown = false;
  const leaveDialog = document.createElement("dialog");
  leaveDialog.id = "leave-confirm";
  leaveDialog.setAttribute("aria-labelledby", "leave-title");
  leaveDialog.innerHTML =
    '<h2 id="leave-title">LEAVE MATCH?</h2><p>Are you sure you want to leave the game?</p><div><button id="leave-confirm-yes" class="nav-button">LEAVE MATCH</button><button id="leave-confirm-stay" class="nav-button primary" autofocus>STAY</button></div>';
  document.getElementById("app")!.append(leaveDialog);
  const stay = () => {
    leaveDialog.close();
    ui.leaveConfirmation = false;
    input.clear();
    if (match.phase === "paused") match.pause();
  };
  leaveDialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    stay();
  });
  leaveDialog.querySelector<HTMLButtonElement>("#leave-confirm-stay")!.onclick =
    stay;
  const loop = new FixedLoop();
  const start = (
    mode: "bot" | "freeplay" | "rings" = match.mode === "freeplay"
      ? "freeplay"
      : match.mode === "rings"
        ? "rings"
        : "bot",
  ) => {
    ui.modes(false);
    simulation.setRingCourse(mode === "rings", RingChallenge.startingPosition);
    arena.setVisible(mode !== "rings");
    ringMap.setVisible(mode === "rings");
    resetEffects();
    audio.unlock();
    input.clear();
    updatePreset();
    ringChallenge.start();
    ringCourse.syncActiveGate();
    opponent.rename();
    simulation.configurePlayers([
      {
        id: "player",
        name: garage.profile.name,
        team: 0,
        controller: "local",
      },
      { id: "bot", name: opponent.name, team: 1, controller: "bot" },
    ]);
    document.getElementById("bot-tag")!.textContent = opponent.name;
    activePartyGameId = null;
    match.start(simulation, mode);
    if (mode === "rings") {
      simulation.ballCollider.setCollisionGroups(0);
      simulation.ball.setEnabled(false);
    }
    arena.setNeutral(match.rules.training);
    goalPlanes.setNeutral(match.rules.training);
    pads.reset();
    loop.accumulator = 0;
    cameraControl.reset();
    cameraControl.ballMode = mode !== "rings";
    audio.tone(420, 0.12, 0.08, "sine");
  };
  const startParty = (game: PartyGame) => {
    const local = game.players.find((player) => player.id === party.playerId);
    if (!local) {
      party.message = "YOU ARE NOT A PARTICIPANT IN THIS MATCH";
      return;
    }
    const members = [
      local,
      ...game.players.filter((player) => player.id !== local.id),
    ];
    const roster: PlayerEntity[] = members.map((player) => ({
      id: player.id,
      name: player.name,
      team: player.team,
      controller: player.id === party.playerId ? "local" : "remote",
    }));
    if (game.mode === "2v2bots")
      roster.push(
        { id: "bot-circuit", name: "CIRCUIT", team: 1, controller: "bot" },
        { id: "bot-relay", name: "RELAY", team: 1, controller: "bot" },
      );
    simulation.configurePlayers(roster);
    updatePreset();
    members.forEach((player, i) =>
      replaceCarVisual(
        i,
        player.preset,
        player.team === 0 ? player.preset.blue : "#fa9c3e",
      ),
    );
    if (game.mode === "2v2bots") {
      replaceCarVisual(roster.length - 2, garage.current, "#fa9c3e");
      replaceCarVisual(roster.length - 1, garage.current, "#ffb654");
    }
    activePartyGameId = game.id;
    dismissedPartyGameId = null;
    lastRemoteSnapshot = -1;
    lastRemoteSnapshotAt = 0;
    networkSequence = 0;
    pendingPartyJumpUntil = 0;
    partyJumpWasDown = false;
    input.clear();
    resetEffects();
    ui.modes(false);
    simulation.setRingCourse(false);
    arena.setVisible(true);
    ringMap.setVisible(false);
    match.start(simulation, "party");
    arena.setNeutral(false);
    goalPlanes.setNeutral(false);
    pads.reset();
    loop.accumulator = 0;
    cameraControl.reset();
    audio.tone(420, 0.12, 0.08, "sine");
  };
  const home = () => {
    const game = party.state?.game;
    if (
      match.mode === "party" &&
      game?.status === "playing" &&
      party.state?.hostId === party.playerId
    )
      void party.action("endMatch");
    if (activePartyGameId) dismissedPartyGameId = activePartyGameId;
    activePartyGameId = null;
    leaveDialog.close();
    ui.leaveConfirmation = false;
    ui.modes(false);
    resetEffects();
    match.phase = "home";
    simulation.setRingCourse(false);
    arena.setVisible(true);
    ringMap.setVisible(false);
    arena.setNeutral(false);
    goalPlanes.setNeutral(false);
    simulation.reset();
    input.clear();
    audio.update(0, false, false);
  };
  ui.on("play", () => {
    audio.unlock();
    ui.modes(true);
  });
  ui.on("bot-mode", () => start("bot"));
  ui.on("freeplay-mode", () => start("freeplay"));
  ui.on("rings-mode", () => start("rings"));
  ui.on("garage-open", () => {
    ui.screen = "garage";
    garagePanel.customizing = false;
    garagePanel.render();
    updatePreset();
    input.clear();
  });
  ui.on("modes-back", () => ui.modes(false));
  ui.on("again", () => {
    if (match.mode !== "party") {
      start();
      return;
    }
    if (party.state?.hostId === party.playerId) void party.action("startMatch");
  });
  ui.on("resume", () => {
    if (match.mode !== "party" || party.state?.hostId === party.playerId)
      match.pause();
  });
  ui.on("home", home);
  leaveDialog.querySelector<HTMLButtonElement>("#leave-confirm-yes")!.onclick =
    home;
  ui.on("pause-home", () => {
    if (match.mode !== "bot") {
      home();
      return;
    }
    if (match.active) match.pause();
    ui.leaveConfirmation = true;
    input.clear();
    leaveDialog.showModal();
  });
  const openSettings = () => {
    if (match.active) match.pause();
    settingsPanel.open();
  };
  ui.on("settings-open", openSettings);
  ui.on("pause-settings", openSettings);
  ui.on("pause-controls", () => settingsPanel.open("controls"));
  ui.on("pause-reset", () => {
    if (match.mode === "rings") {
      start("rings");
    } else if (match.rules.training) {
      match.kickoff(simulation);
      resetEffects();
      pads.reset();
      cameraControl.reset();
    }
  });
  ui.root.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).closest("button")) {
      audio.unlock();
      audio.tone(560, 0.055, 0.04, "sine", "ui");
    }
  });
  window.addEventListener("blur", () => {
    if (
      match.active &&
      (match.mode !== "party" || party.state?.hostId === party.playerId)
    )
      match.pause();
  });
  document.addEventListener("visibilitychange", () => {
    if (
      document.hidden &&
      match.active &&
      (match.mode !== "party" || party.state?.hostId === party.playerId)
    )
      match.pause();
  });
  window.addEventListener("resize", () => {
    graphics.resize();
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  });
  let previous = performance.now(),
    fps = 60,
    frameCount = 0,
    tickCount = 0,
    statsTime = 0,
    ticksPerSecond = 0;
  const ringPrevious = new T.Vector3();
  const vectorTuple = (v: { x: number; y: number; z: number }): Vec3Tuple => [
      v.x,
      v.y,
      v.z,
    ],
    quaternionTuple = (q: {
      x: number;
      y: number;
      z: number;
      w: number;
    }): QuatTuple => [q.x, q.y, q.z, q.w],
    makeNetworkSnapshot = (): MatchSnapshot => ({
      sequence: ++networkSequence,
      phase: match.phase === "home" ? "finished" : match.phase,
      score: [match.score[0], match.score[1]],
      remaining: match.remaining,
      countdown: match.countdown,
      freeze: match.freeze,
      goTime: match.goTime,
      overtime: match.overtime,
      message: match.message,
      resetSequence: match.resetSequence,
      lastGoal: match.lastGoal,
      goalFocus: match.goalFocus
        ? [match.goalFocus.x, match.goalFocus.y, match.goalFocus.z]
        : null,
      clock: simulation.clock,
      lastTouchId: simulation.lastTouchId,
      ball: {
        position: vectorTuple(simulation.ball.translation()),
        rotation: quaternionTuple(simulation.ball.rotation()),
        velocity: vectorTuple(simulation.ball.linvel()),
        angularVelocity: vectorTuple(simulation.ball.angvel()),
        enabled: simulation.ball.isEnabled(),
      },
      cars: simulation.cars
        .filter((car) => car.active)
        .map((car) => ({
          id: car.id,
          position: vectorTuple(car.body.translation()),
          rotation: quaternionTuple(car.body.rotation()),
          velocity: vectorTuple(car.body.linvel()),
          angularVelocity: vectorTuple(car.body.angvel()),
          enabled: car.body.isEnabled(),
          boost: car.boost,
          boosting: car.boosting,
          demolitionState: car.demolitionState,
          respawnTimer: car.respawnTimer,
          supersonic: car.supersonic,
          forwardSpeed: car.forwardSpeed,
          steerAngle: car.steerAngle,
          grounded: car.grounded,
          wheelOrigins: car.wheelOrigins.map(vectorTuple),
          wheelHits: car.wheelHits.map(vectorTuple),
          wheelContact: [...car.wheelContact],
        })),
      pads: pads.items.map((pad) => pad.cooldown),
    });
  function frame(now: number) {
    const dt = Math.min((now - previous) / 1000, 0.1);
    previous = now;
    ringCourse.setVisible(match.mode === "rings" && match.phase !== "home");
    for (const pad of padMeshes) pad.visible = match.mode !== "rings";
    const controls = input.sample();
    const networkGame = party.state?.game ?? null;
    const remotePartyInput =
      match.mode === "party" &&
      activePartyGameId !== null &&
      party.state?.hostId !== party.playerId;
    if (remotePartyInput && controls.jump && !partyJumpWasDown)
      pendingPartyJumpUntil = now + 1000;
    partyJumpWasDown = controls.jump;
    if (remotePartyInput) input.takeAction("jump");
    const partyInputs = () => {
      const inputs = new Map<string, PlayerInput>();
      for (const [i, car] of simulation.cars.entries()) {
        if (!car.active) continue;
        inputs.set(
          car.id,
          car.controller === "local"
            ? controls
            : car.controller === "bot"
              ? botBrains[i].sample(
                  car,
                  simulation.ball.translation(),
                  simulation.clock,
                )
              : (networkGame?.inputs[car.id] ?? neutral()),
        );
      }
      return inputs;
    };
    if (
      networkGame?.status === "playing" &&
      Date.now() >= networkGame.startedAt &&
      networkGame.id !== activePartyGameId &&
      networkGame.id !== dismissedPartyGameId
    )
      startParty(networkGame);
    if (
      activePartyGameId &&
      networkGame?.id === activePartyGameId &&
      party.state?.hostId !== party.playerId &&
      networkGame.snapshot &&
      networkGame.snapshot.sequence > lastRemoteSnapshot
    ) {
      const previousPhase = match.phase,
        previousReset = match.resetSequence;
      simulation.applyNetworkSnapshot(networkGame.snapshot);
      match.applyNetworkSnapshot(networkGame.snapshot);
      if (previousReset !== match.resetSequence) {
        resetEffects();
        cameraControl.reset();
      }
      if (previousPhase === "playing" && match.phase === "goal") {
        const origin = new T.Vector3().copy(simulation.ball.translation()),
          color = origin.z < 0 ? 0x69e9ff : 0xffb654;
        explosion.trigger(origin, color);
        effects.burst(origin, color);
        vehicleEffects.forEach((e) => e.reset());
      }
      networkGame.snapshot.pads.forEach((cooldown, i) => {
        if (pads.items[i]) pads.items[i].cooldown = cooldown;
      });
      lastRemoteSnapshot = networkGame.snapshot.sequence;
      lastRemoteSnapshotAt = now;
    }
    if (
      activePartyGameId &&
      networkGame?.id === activePartyGameId &&
      networkGame.status === "finished" &&
      match.phase !== "finished"
    )
      match.finish();
    if (input.takeAction("camera"))
      cameraControl.ballMode = !cameraControl.ballMode;
    if (input.takeAction("debug")) debug.enabled = !debug.enabled;
    if (
      input.takeAction("pause") &&
      !document.querySelector("dialog[open]") &&
      (match.mode !== "party" || party.state?.hostId === party.playerId)
    ) {
      if (match.phase === "home") {
        if (partyPanel.escape()) {
          input.clear();
        } else if (ui.screen === "garage" && garagePanel.customizing) {
          garagePanel.customizing = false;
          garagePanel.render();
        } else ui.modes(false);
      } else match.pause();
    }
    input.takeAction("reset"); // Legacy binding never resets a competitive match.
    for (const action of trainingActions)
      if (input.takeAction(action)) {
        if (
          trainingAction(action, match, simulation) &&
          action === "trainingReset"
        ) {
          resetEffects();
          pads.reset();
          cameraControl.reset();
          loop.accumulator = 0;
        }
      }
    const remoteParty =
      match.mode === "party" &&
      activePartyGameId !== null &&
      networkGame?.id === activePartyGameId &&
      party.state?.hostId !== party.playerId;
    let alpha = 1;
    if (remoteParty) {
      loop.accumulator = 0;
      alpha =
        lastRemoteSnapshotAt > 0
          ? Math.min(1, Math.max(0, (now - lastRemoteSnapshotAt) / 100))
          : 1;
    } else if (match.active) {
      const result = loop.advance(dt, () => {
        const phase = match.phase;
        const resetSequence = match.resetSequence;
        const countdownNumber = Math.ceil(match.countdown);
        if (phase === "playing") {
          const wasDemolished = simulation.cars[0].demolitionState !== "active";
          if (match.mode === "rings")
            ringPrevious.copy(simulation.cars[0].body.translation());
          if (match.mode === "party") {
            simulation.step(partyInputs());
          } else
            simulation.step([
              controls,
              !match.rules.bot ||
              simulation.cars[1].demolitionState !== "active"
                ? neutral()
                : opponent.sample(
                    simulation.cars[1],
                    simulation.ball.translation(),
                    simulation.clock,
                  ),
            ]);
          if (match.mode === "rings") {
            const result = ringChallenge.cross(
              ringPrevious,
              simulation.cars[0].body.translation(),
            );
            if (result === "passed") {
              ringCourse.syncActiveGate();
              const previousIndex =
                (ringChallenge.ringIndex + ringChallenge.count - 1) %
                ringChallenge.count;
              effects.burst(ringChallenge.centers[previousIndex], 0xffd777);
              audio.tone(
                540 + Math.min(500, ringChallenge.streak * 35),
                0.14,
                0.08,
                "sine",
              );
            } else if (result === "missed") {
              match.score = [ringChallenge.streak, ringChallenge.best];
              match.phase = "finished";
              match.message = "RUN OVER";
              audio.tone(130, 0.35, 0.12, "triangle");
            }
          }
          if (wasDemolished && simulation.cars[0].demolitionState === "active")
            cameraControl.reset();
          for (const demo of simulation.demolitions)
            if (demo.age === 0) {
              demoFlashes[
                simulation.cars.findIndex((c) => c.id === demo.victimId)
              ].trigger(demo.position);
              effects.emit(
                demo.position,
                new T.Vector3(0, 2, 0),
                0xffc276,
                110,
              );
              effects.emit(demo.position, new T.Vector3(0, 5, 0), 0x74859a, 55);
              audio.tone(85, 0.45, 0.23, "sawtooth");
            }
          if (
            match.rules.infiniteBoost &&
            (match.mode === "rings" || settings.value.infiniteBoost)
          )
            simulation.cars[0].boost = 100;
          for (const pickup of pads.tick(simulation.cars)) {
            const pos = new T.Vector3().copy(pickup.car.body.translation());
            effects.emit(pos, new T.Vector3(0, 2, 0), 0xffcf70, 18);
            audio.tone(820, 0.16, 0.035, "sine");
            if (pickup.car === simulation.cars[0]) ui.pickup();
          }
          for (const c of simulation.cars)
            if (c.lastJump) audio.tone(340, 0.13, 0.04, "triangle");
          for (const h of simulation.hits)
            if (h.age === 0) {
              audio.tone(
                100 + Math.min(h.strength, 30) * 5,
                0.12,
                Math.min(0.14, h.strength * 0.008),
                "triangle",
              );
              effects.emit(
                h.position,
                new T.Vector3(),
                0xa5f9eb,
                Math.min(24, Math.ceil(h.strength)),
              );
            }
        }
        if (phase === "goal") {
          if (match.mode === "party") {
            simulation.step(partyInputs());
          } else simulation.step([controls, neutral()]);
          if (
            match.rules.infiniteBoost &&
            (match.mode === "rings" || settings.value.infiniteBoost)
          )
            simulation.cars[0].boost = 100;
        }
        match.tick(simulation);
        if (match.resetSequence !== resetSequence && match.rules.training) {
          resetEffects();
          pads.reset();
          cameraControl.reset();
        }
        if (
          phase === "countdown" &&
          Math.ceil(match.countdown) !== countdownNumber
        )
          audio.tone(match.phase === "playing" ? 760 : 420, 0.12, 0.08, "sine");
        if (phase === "playing" && match.phase === "goal") {
          audio.tone(100, 1.3, 0.2, "sawtooth");
          audio.tone(660, 0.9, 0.1, "triangle");
          const origin = new T.Vector3().copy(simulation.ball.translation()),
            color = match.rules.training
              ? 0xa8a8a8
              : origin.z < 0
                ? 0x69e9ff
                : 0xffb654;
          explosion.trigger(origin, color);
          effects.burst(origin, color);
          vehicleEffects.forEach((e) => e.reset());
        }
        if (phase !== "countdown" && match.phase === "countdown") {
          resetEffects();
          audio.tone(420, 0.12, 0.08, "sine");
          pads.reset();
          cameraControl.reset();
        }
      });
      if (result.steps > 0) input.takeAction("jump");
      alpha = match.phase === "countdown" ? 1 : result.alpha;
      tickCount += result.steps;
    } else loop.accumulator = 0;
    if (
      match.mode === "party" &&
      activePartyGameId &&
      networkGame?.id === activePartyGameId &&
      networkGame.status === "playing" &&
      Date.now() - lastNetworkSend >= 50
    ) {
      lastNetworkSend = Date.now();
      const queuedJump = remotePartyInput && pendingPartyJumpUntil > now;
      void party
        .sendGameUpdate(
          queuedJump ? { ...controls, jump: true } : controls,
          party.state?.hostId === party.playerId
            ? makeNetworkSnapshot()
            : undefined,
        )
        .then((sent) => {
          if (sent && queuedJump) pendingPartyJumpUntil = 0;
        });
    }
    simulation.cars.forEach((c, i) => {
      c.pose.render(cars[i], alpha);
      cars[i].visible = match.phase !== "home" && c.body.isEnabled();
      animateWheels(
        visuals[i],
        c.forwardSpeed,
        c.steerAngle,
        match.active ? dt : 0,
        match.phase !== "home" ? c : undefined,
        cars[i],
      );
    });
    simulation.cars.forEach((c, i) => grassVelocities[i].copy(c.body.linvel()));
    arena.updateGrass(
      cars,
      grassVelocities,
      now / 1000,
      match.phase !== "home",
    );
    simulation.ballPose.render(ball, alpha);
    animateBall(ball, now / 1000);
    ball.visible = simulation.ball.isEnabled() && match.mode !== "rings";
    goalPlanes.update(ball);
    ballShadow.visible = ball.visible;
    if (match.phase === "home") {
      cars[0].position.set(6, 0.32, 14);
      cars[0].rotation.set(0, -0.55, 0);
    }
    ballShadow.position.set(ball.position.x, 0.03, ball.position.z);
    ballShadow.scale.setScalar(1 + ball.position.y * 0.03);
    pads.items.forEach((p, i) => {
      padRecharge[i].update(p);
      const pulse = (p.pulse ?? 0) / 0.28;
      padMeshes[i].children[1].visible = p.cooldown === 0 || pulse > 0;
      padMeshes[i].children[1].scale.setScalar(p.cooldown ? pulse : 1);
      padMeshes[i].children[0].scale.setScalar(1 + (1 - pulse) * pulse * 2);
      padMeshes[i].children[1].rotation.y += dt;
      const mat = (
        padMeshes[i].children[0] as T.Mesh<
          T.BufferGeometry,
          T.MeshBasicMaterial
        >
      ).material;
      mat.color.setHex(pulse > 0 ? 0xffefad : p.cooldown ? 0x354b42 : 0xfeb84f);
    });
    if (match.phase === "playing" || match.phase === "goal")
      simulation.cars.forEach((c, i) => {
        if (c.boosting) {
          const rear = new T.Vector3(0, 0, 0.7)
            .applyQuaternion(cars[i].quaternion)
            .add(cars[i].position);
          effects.emit(
            rear,
            c.forward.clone().multiplyScalar(-5),
            i === 0
              ? garage.current.boost === "ember"
                ? 0xffa548
                : 0x7cf9ff
              : 0xffbb55,
            3,
          );
        }
        if (
          controls.slide &&
          i === 0 &&
          c.grounded &&
          Math.abs(c.forwardSpeed) > 5
        )
          effects.emit(cars[i].position, new T.Vector3(0, 0.2, 0), 0x9bbaab, 1);
      });
    const effectDt = match.phase === "paused" ? 0 : dt;
    const touched = simulation.cars.find(
      (c) => c.id === simulation.lastTouchId,
    );
    ballTrails.updateBall(
      ball,
      new T.Vector3().copy(simulation.ball.linvel()).length(),
      match.rules.training ? null : (touched?.team ?? null),
      effectDt,
      match.active && ball.visible,
      camera.position,
    );
    simulation.cars.forEach((c, i) =>
      flipTrails[i].updateCar(
        c,
        cars[i],
        effectDt,
        match.active && c.body.isEnabled(),
        camera.position,
      ),
    );
    effects.update(effectDt);
    explosion.update(effectDt);
    demoFlashes.forEach((e) => e.update(effectDt));
    simulation.cars.forEach((c, i) =>
      vehicleEffects[i].update(
        c,
        effectDt,
        now / 1000,
        (match.phase === "playing" || match.phase === "goal") &&
          c.body.isEnabled(),
      ),
    );
    simulation.cars.forEach((c, i) =>
      skidMarks[i].update(c, effectDt, match.active && c.body.isEnabled()),
    );
    if (match.phase !== "home") camera.clearViewOffset();
    if (match.phase !== "home")
      cameraControl.update(
        cars[0],
        ball,
        simulation,
        dt,
        false,
        now / 1000,
        match.phase === "goal" ? match.goalFocus : null,
      );
    const lobbyVisible = match.phase === "home" && ui.screen === "home";
    const partySetup =
      match.phase === "home" && !!party.state && party.state.stage !== "home";
    partyPanel.flow.updateVisibility(match.phase === "home");
    partyPanel.host.hidden = !lobbyVisible;
    homeLobby.update(
      party.state?.members ?? [
        {
          id: party.playerId,
          name: garage.profile.name,
          title: garage.profile.title,
          avatarId: garage.profile.avatarId ?? "helmet",
          preset: garage.current,
          team: null,
          ready: false,
        },
      ],
      camera,
      dt,
      now / 1000,
      lobbyVisible && !partySetup,
    );
    if (partySetup) {
      camera.clearViewOffset();
      camera.position.lerp(new T.Vector3(38, 27, 42), 1 - Math.exp(-dt * 5));
      camera.up.set(0, 1, 0);
      camera.lookAt(0, 0, 0);
      camera.fov = 58;
      camera.updateProjectionMatrix();
    }
    hitboxes.update(
      simulation,
      settings.value.showHitboxes && match.phase !== "home",
    );
    if (match.phase === "home" && ui.screen === "garage" && !partySetup) {
      preview.update(
        innerWidth,
        innerHeight,
        dt,
        garagePanel.customizing ? garagePanel.category : "body",
      );
      graphics.render(preview.renderScene, preview.camera);
    } else graphics.render(scene, camera);
    const tag = document.getElementById("bot-tag")!,
      botPoint = cars[1].position.clone().add(new T.Vector3(0, 1.05, 0)),
      distance = camera.position.distanceTo(botPoint),
      projected = botPoint.project(camera);
    tag.hidden =
      !match.rules.bot ||
      simulation.cars[1].demolitionState !== "active" ||
      match.phase === "home" ||
      Math.abs(projected.x) > 1 ||
      Math.abs(projected.y) > 1 ||
      projected.z > 1 ||
      projected.z < 0;
    if (!tag.hidden) {
      tag.style.left = `${(projected.x * 0.5 + 0.5) * innerWidth}px`;
      tag.style.top = `${(-projected.y * 0.5 + 0.5) * innerHeight}px`;
      tag.style.fontSize = `${T.MathUtils.clamp(22 - distance * 0.08, 14, 20)}px`;
    }
    frameCount++;
    statsTime += dt;
    if (statsTime >= 1) {
      fps = frameCount / statsTime;
      ticksPerSecond = Math.round(tickCount / statsTime);
      frameCount = 0;
      tickCount = 0;
      statsTime = 0;
    }
    debug.update(simulation, fps, ticksPerSecond);
    ui.update(
      match,
      simulation.cars[0].boost,
      cameraControl.ballMode,
      simulation.cars[0].supersonic,
    );
    ui.updateRingChallenge(
      ringChallenge.streak,
      ringChallenge.best,
      ringChallenge.ringIndex + 1,
      ringChallenge.count,
    );
    const again = document.getElementById("again") as HTMLButtonElement;
    again.disabled =
      match.mode === "party" && party.state?.hostId !== party.playerId;
    again.title = again.disabled ? "The party host starts the next match" : "";
    const resume = document.getElementById("resume") as HTMLButtonElement;
    resume.disabled =
      match.mode === "party" && party.state?.hostId !== party.playerId;
    resume.title = resume.disabled
      ? "Only the party host can resume the match"
      : "";
    audio.update(
      Math.abs(simulation.cars[0].forwardSpeed),
      simulation.cars[0].boosting,
      (match.phase === "playing" || match.phase === "goal") &&
        simulation.cars[0].body.isEnabled(),
      controls.throttle,
      match.phase === "home",
      simulation.cars[0].skidIntensity,
    );
    requestAnimationFrame(frame);
  }
  if (import.meta.env.DEV || new URLSearchParams(location.search).has("test"))
    Object.assign(window, {
      __arena: {
        simulation,
        match,
        ringChallenge,
        ringCourse,
        input,
        settings,
        garage,
        cameraControl,
        camera,
        graphics,
        audio,
        ui,
        visuals,
        hitboxes,
        vehicleEffects,
        pads,
        accounts,
        party,
        partyPanel,
        homeLobby,
        preview,
        garagePanel,
        skidMarks,
        goalPlanes,
        arena,
        explosion,
        ballTrails,
        flipTrails,
        padRecharge,
      },
    });
  requestAnimationFrame(frame);
}
boot().catch((error) => {
  console.error(error);
  document.querySelector("#app")!.innerHTML =
    '<p class="loading">The arena could not start. Please use a browser with WebGL 2 enabled and reload.<br>See the browser console for details.</p>';
});
