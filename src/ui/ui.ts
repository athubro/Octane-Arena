import type { Match } from "../game/match";
import type { Profile } from "../game/inventory";
import {
  TRAINING_PACKS,
  type TrainingPackRecords,
} from "../game/training-packs";
import { icon } from "./icons";
export class UI {
  rankedResult = "";
  trainingPackResult = false;
  trainingPackName = "";
  leaveConfirmation = false;
  root = document.querySelector<HTMLDivElement>("#app")!;
  screen: "home" | "modes" | "fields" | "packs" | "garage" = "home";
  constructor() {
    this.root.innerHTML = `<div id="viewport"></div><div id="home-shade"></div><header id="brand"><h1>OCTANE <span>ARENA</span></h1><small class="brand-version">V6</small></header>
    <section id="menu" class="screen"><nav class="home-nav"><button id="play" class="nav-button primary">PLAY <span aria-hidden="true">↗</span></button><button id="garage-open" class="nav-button">GARAGE</button><button id="settings-open" class="nav-button">SETTINGS</button></nav></section>
    <button id="profile" aria-label="Open profile"><div class="avatar">${icon("profile")}</div><div><b id="profile-name">Guest</b><span id="profile-title">Rookie</span></div><div class="level"><small>LEVEL</small><b id="profile-level">1</b></div></button>
    <section id="modes" class="screen full-screen" hidden><h2>PLAY</h2><nav class="mode-tabs" aria-label="Game mode category"><button id="standard-modes-tab" aria-pressed="true">STANDARD</button><button id="extra-modes-tab" aria-pressed="false">EXTRA MODES</button></nav><div class="mode-grid standard-mode-grid"><button id="bot-mode" class="mode-card">${icon("bot")}<strong>AGAINST A BOT</strong></button><button id="heatseeker-mode" class="mode-card"><span class="heatseeker-mode-icon" aria-hidden="true">🔥</span><strong>HEATSEEKER VS BOT</strong><small>THE BALL HUNTS THE LAST PLAYER'S GOAL</small></button><button id="freeplay-mode" class="mode-card">${icon("freeplay")}<strong>FREE PLAY</strong></button><button id="training-packs-mode" class="mode-card"><span class="training-pack-emblem" aria-hidden="true">11</span><strong>TRAINING PACKS</strong><small>10 PACKS · 11 SHOTS EACH · SAVE YOUR BEST SCORE</small></button><button id="ranked-mode" class="mode-card">${icon("ranked")}<strong>RANKED CPU</strong><small>CHOOSE A CPU LEVEL · EARN CPU ELO ON WINS</small></button><button class="mode-card" disabled title="Friend matches are coming later">${icon("friend")}<strong>AGAINST A FRIEND</strong><i>${icon("lock")}</i></button></div><div class="mode-grid extra-mode-grid" hidden><button id="rings-mode" class="mode-card"><span class="rings-mode-icon" aria-hidden="true">◎</span><strong>RING RUSH</strong><small>FLY THROUGH NUMBERED RINGS IN ORDER. ONE MISS ENDS YOUR STREAK.</small></button></div><footer class="screen-footer"><button id="modes-back" class="back-button">← BACK</button></footer></section>
    <section id="training-pack-select" class="screen full-screen" hidden><header class="training-pack-header"><h2>TRAINING PACKS</h2><p>Eleven timed situations per pack. Read the SAVE or SCORE callout before each feed; complete the called play before time expires.</p><p class="pack-controls-note">CONTROLLER: RT/LT DRIVE · LEFT STICK STEER/AIR PITCH · A JUMP · B BOOST · X POWERSLIDE · Y BALL CAM · START PAUSE</p></header><div id="training-pack-list" class="training-pack-list"></div><footer class="screen-footer"><button id="packs-back" class="back-button">← MODES</button><span>BEST SCORES SAVE IN THIS BROWSER</span></footer></section>
    <section id="fields" class="screen full-screen" hidden><h2>SELECT FIELD</h2><label id="cpu-level-control" class="cpu-level-control" hidden>CPU LEVEL <select id="cpu-level">${["ROOKIE", "NOVICE", "CHALLENGER", "COMPETITOR", "SKILLED", "ADVANCED", "EXPERT", "ELITE", "MASTER", "PRO"].map((rank, i) => `<option value="${i + 1}">LEVEL ${i + 1} · ${rank}</option>`).join("")}</select><span id="cpu-elo-label">CPU ELO 0</span></label><div class="field-grid"><button class="field-card lumen-field" data-field="lumen" aria-pressed="true"><strong>LUMEN DISTRICT</strong><small>THE ORIGINAL STADIUM</small></button><button class="field-card neo-field" data-field="neo-tokyo" aria-pressed="false"><strong>NEO TOKYO</strong><small>NEON CITY ARENA</small></button><button class="field-card dune-field" data-field="dune-crown" aria-pressed="false"><strong>DUNE CROWN</strong><small>PYRAMIDS AT THE EDGE OF THE DESERT</small></button><button class="field-card rainforest-field" data-field="emerald-canopy" aria-pressed="false"><strong>EMERALD CANOPY</strong><small>TROPICAL RAINFOREST ARENA</small></button><button class="field-card coliseum-field" data-field="apex-coliseum" aria-pressed="false"><strong>APEX COLISEUM</strong><small>PLAY UNDER THE LIGHTS</small></button></div><footer class="screen-footer"><button id="fields-back" class="back-button">← MODES</button><button id="field-start" class="nav-button primary">START MATCH</button></footer></section>
    <section id="garage-screen" class="screen full-screen" hidden></section>
    <div id="hud" hidden><div class="scoreboard"><span id="score-cyan">0</span><time id="clock">5:00</time><span id="score-amber">0</span></div><div id="ring-score" hidden><strong id="ring-streak">0</strong><span>RING STREAK</span><b id="ring-best">BEST 0</b><small id="ring-next">RING 1 / 9</small></div><section id="training-pack-hud" hidden><header><b id="training-pack-title"></b><span id="training-pack-tier"></span></header><div class="training-pack-hud-row"><strong id="training-pack-shot">SHOT 01 / 11</strong><span id="training-pack-target"></span><span id="training-pack-aerial" hidden>↑ AERIAL</span><span id="training-pack-cannon" hidden>◆ CANNON</span></div><small id="training-pack-task"></small><div class="training-pack-timer"><i id="training-pack-timer-fill"></i></div><div class="training-pack-hud-row"><span id="training-pack-points">0 POINTS</span><time id="training-pack-time">0.0</time></div><small id="training-pack-message" aria-live="polite"></small></section><div id="notice" aria-live="polite"></div><div id="replay-prompt" hidden>GOAL REPLAY · PRESS X TO SKIP</div><div id="countdown" aria-live="polite"></div><div class="camera-status"><i></i><b id="camera-mode">BALL CAMERA</b></div><div class="boost-hud"><svg viewBox="0 0 160 160" aria-hidden="true"><path class="boost-track" d="M128 128 A68 68 0 1 0 32 128" pathLength="100"/><path id="boost-fill" d="M32 128 A68 68 0 1 1 128 128" pathLength="100"/></svg><div id="boost">100</div><div id="boost-label">BOOST</div></div><div id="bot-tag" hidden></div></div>
    <section id="pause" class="modal" hidden><div class="modal-card"><h2>PAUSED</h2><button id="resume" class="nav-button primary">RESUME</button><button id="pause-settings" class="nav-button">SETTINGS</button><button id="pause-controls" class="nav-button">CONTROLS</button><button id="pause-reset" class="nav-button">RESET</button><button id="pause-home" class="nav-button">LEAVE MATCH</button></div></section>
    <section id="result" class="modal" hidden><div class="modal-card"><h2 id="result-title"></h2><p id="result-score"></p><button id="again" class="nav-button primary">PLAY AGAIN</button><button id="home" class="nav-button">HOME</button></div></section><dialog id="settings"></dialog><dialog id="account" aria-label="Account"></dialog><pre id="debug" hidden></pre>`;
    this.packModeMenu();
    const rankedModeControl = document.createElement("label");
    rankedModeControl.id = "cpu-ranked-mode-control";
    rankedModeControl.className = "cpu-level-control";
    rankedModeControl.hidden = true;
    rankedModeControl.innerHTML = `RANKED MODE <select id="cpu-ranked-mode" aria-label="Ranked CPU mode"><option value="bot">STANDARD</option><option value="heatseeker">HEATSEEKER</option></select>`;
    const rankedOptions = document.createElement("div");
    rankedOptions.id = "ranked-options";
    rankedOptions.className = "ranked-options";
    rankedOptions.hidden = true;
    rankedOptions.innerHTML = `<div class="ranked-options-heading"><strong>RANKED CPU SETTINGS</strong><span>Choose the rules and rival level</span></div>`;
    rankedOptions.append(
      rankedModeControl,
      document.getElementById("cpu-level-control")!,
    );
    document.querySelector("#fields .field-grid")!.before(rankedOptions);
  }
  private packModeMenu() {
    const standard = document.querySelector<HTMLElement>(".standard-mode-grid")!,
      extra = document.querySelector<HTMLElement>(".extra-mode-grid")!,
      hub = document.createElement("div");
    hub.className = "mode-hub-grid";
    const sections = [
      ["CASUAL MATCH", ["bot-mode", "heatseeker-mode"]],
      ["RANKED", ["ranked-mode"]],
      ["PRACTICE", ["freeplay-mode", "rings-mode"]],
      ["TRAINING", ["training-packs-mode"]],
    ] as const;
    for (const [title, ids] of sections) {
      const section = document.createElement("section"),
        heading = document.createElement("h3"),
        actions = document.createElement("div");
      section.className = "mode-group";
      heading.textContent = title;
      actions.className = "mode-options";
      for (const id of ids) {
        const button = document.getElementById(id)!;
        button.className = "mode-card mode-option";
        actions.append(button);
      }
      section.append(heading, actions);
      hub.append(section);
    }
    document.getElementById("friend-mode")?.remove();
    document.querySelector(".mode-tabs")!.hidden = true;
    standard.before(hub);
    standard.hidden = true;
    extra.hidden = true;
  }
  on(id: string, fn: () => void) {
    document.getElementById(id)!.addEventListener("click", fn);
  }
  modes(show: boolean) {
    this.screen = show ? "modes" : "home";
    if (show) this.modeTab(false);
  }
  modeTab(extra: boolean) {
    document
      .querySelector(".standard-mode-grid")
      ?.toggleAttribute("hidden", extra);
    document
      .querySelector(".extra-mode-grid")
      ?.toggleAttribute("hidden", !extra);
    document
      .getElementById("standard-modes-tab")
      ?.setAttribute("aria-pressed", String(!extra));
    document
      .getElementById("extra-modes-tab")
      ?.setAttribute("aria-pressed", String(extra));
  }
  fields(show: boolean) {
    this.screen = show ? "fields" : "modes";
  }
  packs(show: boolean) {
    this.screen = show ? "packs" : "modes";
  }
  renderTrainingPacks(records: TrainingPackRecords) {
    const list = document.getElementById("training-pack-list");
    if (!list) return;
    list.innerHTML = TRAINING_PACKS.map((pack, index) => {
      const record = records[pack.id],
        score = record
          ? `BEST ${record.best}/11 · LAST ${record.last}/11`
          : "NOT PLAYED";
      return `<button class="training-pack-card" data-training-pack="${pack.id}"><span class="training-pack-number">PACK ${String(index + 1).padStart(2, "0")}</span><span class="training-pack-tier">${pack.tier}</span><strong>${pack.name}</strong><small>${pack.description}</small><b>${score}</b><i>11 SHOTS ↗</i></button>`;
    }).join("");
  }
  updateTrainingPack(view: {
    active: boolean;
    completed: boolean;
    name: string;
    tier: string;
    shot: number;
    total: number;
    score: number;
    goalTeam: number;
    objective: "goal" | "clear";
    scenario: string;
    instruction: string;
    timer: number;
    timerLimit: number;
    cannon: boolean;
    aerial: boolean;
    message: string;
  }) {
    const panel = document.getElementById("training-pack-hud")!;
    panel.hidden = !view.active;
    this.trainingPackResult = view.completed;
    this.trainingPackName = view.active || view.completed ? view.name : "";
    if (!view.active && !view.completed) return;
    document.getElementById("training-pack-title")!.textContent = view.name;
    document.getElementById("training-pack-tier")!.textContent = view.tier;
    document.getElementById("training-pack-shot")!.textContent =
      `SHOT ${String(Math.min(view.shot + 1, view.total)).padStart(2, "0")} / ${view.total}`;
    document.getElementById("training-pack-target")!.textContent =
      view.objective === "goal"
        ? `SCORE ${view.goalTeam === 0 ? "CYAN" : "AMBER"}`
        : "SAVE · CLEAR OPPOSITE HALF";
    document.getElementById("training-pack-task")!.textContent =
      `${view.scenario} · ${view.instruction}`;
    document.getElementById("training-pack-points")!.textContent =
      `${view.score} ${view.score === 1 ? "POINT" : "POINTS"}`;
    document.getElementById("training-pack-time")!.textContent =
      `${Math.max(0, view.timer).toFixed(1)}s`;
    document.getElementById("training-pack-cannon")!.hidden = !view.cannon;
    document.getElementById("training-pack-aerial")!.hidden = !view.aerial;
    document.getElementById("training-pack-message")!.textContent =
      view.message;
    const fraction =
      view.timerLimit > 0
        ? Math.max(0, Math.min(1, view.timer / view.timerLimit))
        : 0;
    document.getElementById("training-pack-timer-fill")!.style.transform =
      `scaleX(${fraction})`;
  }
  setProfile(profile: Profile) {
    document.querySelector("#profile .avatar")!.innerHTML = icon(
      profile.avatarId ?? "helmet",
    );
    document.getElementById("profile-name")!.textContent = profile.name;
    document.getElementById("profile-title")!.textContent = profile.title;
    document.getElementById("profile-level")!.textContent = String(
      profile.level,
    );
  }
  pickup() {
    const hud = document.querySelector(".boost-hud")!;
    hud.getAnimations().forEach((a) => a.cancel());
    hud.animate(
      [
        { filter: "brightness(2)", transform: "scale(1.08)" },
        { filter: "brightness(1)", transform: "scale(1)" },
      ],
      { duration: 280, easing: "ease-out" },
    );
  }
  update(
    m: Match,
    boost: number,
    ballCamera: boolean,
    sonic: boolean,
    replaying = false,
  ) {
    const set = (id: string, text: string) => {
      const e = document.getElementById(id)!;
      if (e.textContent !== text) {
        e.textContent = text;
        if (
          (id.startsWith("score-") || id === "notice" || id === "countdown") &&
          text &&
          !matchMedia("(prefers-reduced-motion: reduce)").matches
        )
          e.animate(
            [
              { filter: "brightness(2.5)", opacity: 0.4 },
              { filter: "brightness(1)", opacity: 1 },
            ],
            { duration: 240 },
          );
      }
    };
    const home = m.phase === "home";
    document.getElementById("replay-prompt")!.hidden = !replaying;
    const ringMode = m.mode === "rings";
    document.getElementById("pause-reset")!.hidden =
      !m.rules.training && !ringMode;
    document.getElementById("pause-reset")!.textContent = ringMode
      ? "RESTART RUN"
      : "RESET";
    document.getElementById("ring-score")!.hidden = !ringMode;
    (document.querySelector(".scoreboard") as HTMLElement).hidden =
      !m.rules.scoreboard;
    for (const [id, show] of [
      ["menu", home && this.screen === "home"],
      ["brand", home && this.screen === "home"],
      ["profile", home && this.screen === "home"],
      ["home-shade", home],
      ["modes", home && this.screen === "modes"],
      ["fields", home && this.screen === "fields"],
      ["training-pack-select", home && this.screen === "packs"],
      ["garage-screen", home && this.screen === "garage"],
      ["hud", !home && m.phase !== "finished"],
      ["pause", m.phase === "paused" && !this.leaveConfirmation],
      ["result", m.phase === "finished"],
    ] as const)
      document.getElementById(id)!.hidden = !show;
    this.root.dataset.screen = home ? this.screen : "game";
    set("score-cyan", String(m.score[0]));
    set("score-amber", String(m.score[1]));
    const t = Math.ceil(m.remaining);
    set(
      "clock",
      m.mode === "rings"
        ? "RING RUSH"
        : m.mode === "freeplay"
          ? this.trainingPackName || "FREE PLAY"
          : m.overtime
            ? "OT"
            : `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`,
    );
    set("boost", String(Math.ceil(boost)));
    document.getElementById("boost-fill")!.style.strokeDasharray =
      `${boost} 100`;
    set("boost-label", sonic ? "SUPERSONIC" : "BOOST");
    set(
      "notice",
      m.phase === "goal"
        ? m.message
        : m.overtime && m.phase === "countdown"
          ? "OVERTIME"
          : "",
    );
    set(
      "countdown",
      m.phase === "countdown"
        ? String(Math.ceil(m.countdown))
        : m.phase === "playing" && m.goTime > 0
          ? "GO!"
          : "",
    );
    set(
      "camera-mode",
      replaying ? "GOAL REPLAY" : ballCamera ? "BALL CAMERA" : "CAR CAMERA",
    );
    set("result-title", m.message);
    set(
      "result-score",
      this.trainingPackResult
        ? `TRAINING PACK SCORE ${m.score[0]} / 11`
        : ringMode
          ? `RINGS ${m.score[0]} · BEST ${m.score[1]}`
          : `${m.score[0]} — ${m.score[1]}${this.rankedResult}`,
    );
    (document.getElementById("again") as HTMLButtonElement).textContent = this
      .trainingPackResult
      ? "RETRY PACK"
      : "PLAY AGAIN";
  }

  updateRingChallenge(
    streak: number,
    best: number,
    ring: number,
    total: number,
  ) {
    document.getElementById("ring-streak")!.textContent = String(streak);
    document.getElementById("ring-best")!.textContent = `BEST ${best}`;
    document.getElementById("ring-next")!.textContent =
      `NEXT RING ${String(ring).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
    document.querySelector("#rings-mode small")!.textContent =
      `FLY NUMBERED RINGS IN ORDER · BEST ${best}`;
  }
}
