import { PartyClient } from "../game/party";
import { icon } from "./icons";
import { PartyFlow } from "./party-flow";
import { normalizePartyCode, validPartyCode } from "../../shared/party";
export class PartyPanel {
  host = document.createElement("section");
  flow: PartyFlow;
  private joining = false;
  private selected: string | null = null;
  private manualDialog = document.createElement("dialog");
  constructor(public party: PartyClient) {
    this.host.id = "party-panel";
    this.host.setAttribute("aria-label", "Party");
    this.host.innerHTML = `<div class="party-top"><button id="party-code" title="Copy party code" hidden></button><div id="party-members" role="group" aria-label="Party members"></div><div id="party-actions" hidden><b></b><button id="party-kick">KICK</button><button id="party-dismiss" aria-label="Close player actions">×</button></div></div><div class="party-controls"><button id="party-create" class="party-button">CREATE PARTY</button><button id="party-join-open" class="party-button">JOIN PARTY</button><button id="party-manual-open" class="party-button">MANUAL CODES</button><form id="party-join" hidden><input id="party-input" aria-label="Party code" placeholder="ENTER CODE" maxlength="6" autocomplete="off" spellcheck="false"><button class="party-button" type="submit">JOIN</button><button class="party-button" type="button" id="party-cancel">CANCEL</button></form><button id="party-leave" class="party-button" hidden>LEAVE PARTY</button></div><div class="party-network-note">WEBRTC · NO TURN RELAY · SOME WI-FI NETWORKS BLOCK DEVICE-TO-DEVICE TRAFFIC</div><div id="party-message" role="status" aria-live="polite"></div>`;
    document.getElementById("app")!.append(this.host);
    this.manualDialog.id = "party-manual";
    this.manualDialog.setAttribute("aria-label", "Manual WebRTC connection");
    this.manualDialog.innerHTML = `<section><header><h2>MANUAL WEBRTC CONNECTION</h2><button type="button" id="manual-close" aria-label="Close">×</button></header><p>No broker is used for manual codes. There is no TURN relay; school or guest Wi-Fi may still block device-to-device traffic.</p><nav><button type="button" class="party-button" id="manual-host-open">HOST PARTY</button><button type="button" class="party-button" id="manual-join-open">JOIN PARTY</button></nav><div id="manual-host" hidden><b>PARTY CODE: <span id="manual-host-code"></span></b><label>Paste the joiner's offer code here<textarea id="manual-host-offer" rows="5" spellcheck="false"></textarea></label><button type="button" class="party-button" id="manual-answer">CREATE ANSWER</button><label>Send this answer code to the joiner<textarea id="manual-host-answer" rows="5" readonly spellcheck="false"></textarea></label></div><div id="manual-join" hidden><label>Party code<input id="manual-code" maxlength="6" autocomplete="off" spellcheck="false"></label><button type="button" class="party-button" id="manual-offer">GENERATE OFFER</button><label>Send this offer code to the host<textarea id="manual-guest-offer" rows="5" readonly spellcheck="false"></textarea></label><label>Paste the host's answer code here<textarea id="manual-guest-answer" rows="5" spellcheck="false"></textarea></label><button type="button" class="party-button" id="manual-connect">CONNECT</button></div><p id="manual-message" role="status" aria-live="polite"></p></section>`;
    document.getElementById("app")!.append(this.manualDialog);
    this.flow = new PartyFlow(party);
    const start = document.createElement("button");
    start.id = "party-start";
    start.className = "party-button";
    start.textContent = "START GAME";
    start.onclick = () => void party.action("stage", { stage: "mode" });
    this.host.querySelector(".party-controls")!.prepend(start);
    const find = (id: string) =>
      this.host.querySelector<HTMLElement>("#" + id)!;
    find("party-create").onclick = () => void party.action("create");
    find("party-manual-open").onclick = () => {
      this.manualDialog.showModal();
    };
    find("party-join-open").onclick = () => {
      this.joining = true;
      party.message = "";
      this.render();
      this.host.querySelector<HTMLInputElement>("input")!.focus();
    };
    find("party-cancel").onclick = () => {
      this.escape();
      find("party-join-open").focus();
    };
    find("party-dismiss").onclick = () => {
      this.selected = null;
      this.render();
    };
    find("party-leave").onclick = () => void party.action("leave");
    find("party-kick").onclick = () => {
      if (this.selected) void party.action("kick", { playerId: this.selected });
    };
    find("party-code").onclick = async () => {
      try {
        await navigator.clipboard.writeText(party.state!.code);
        party.message = "CODE COPIED";
      } catch {
        party.message = "COPY CODE: " + party.state!.code;
      }
      this.render();
    };
    const manual = (selector: string) =>
      this.manualDialog.querySelector<HTMLElement>(selector)!;
    manual("#manual-close").onclick = () => this.manualDialog.close();
    manual("#manual-host-open").onclick = async () => {
      const message = manual("#manual-message");
      message.textContent = "";
      try {
        const code =
          party.state?.hostId === party.playerId
            ? party.state.code
            : await party.createManualHost();
        manual("#manual-host-code").textContent = code;
        manual("#manual-host").hidden = false;
        manual("#manual-join").hidden = true;
      } catch (error) {
        message.textContent =
          error instanceof Error ? error.message : "FAILED TO CREATE PARTY";
      }
    };
    manual("#manual-join-open").onclick = () => {
      manual("#manual-host").hidden = true;
      manual("#manual-join").hidden = false;
      if (party.state && party.state.hostId !== party.playerId)
        (manual("#manual-code") as HTMLInputElement).value = party.state.code;
      else if (party.manualRejoinCode)
        (manual("#manual-code") as HTMLInputElement).value =
          party.manualRejoinCode;
      manual("#manual-code").focus();
    };
    manual("#manual-answer").onclick = async () => {
      const message = manual("#manual-message");
      message.textContent = "GATHERING ICE CANDIDATES…";
      try {
        const answer = await party.answerManualOffer(
          (manual("#manual-host-offer") as HTMLTextAreaElement).value.trim(),
        );
        (manual("#manual-host-answer") as HTMLTextAreaElement).value = answer;
        message.textContent = "ANSWER READY — COPY IT TO THE JOINER";
      } catch (error) {
        message.textContent =
          error instanceof Error ? error.message : "FAILED TO CREATE ANSWER";
      }
    };
    manual("#manual-offer").onclick = async () => {
      const code = normalizePartyCode(
        (manual("#manual-code") as HTMLInputElement).value,
      );
      const message = manual("#manual-message");
      if (!validPartyCode(code)) {
        message.textContent = "INVALID PARTY CODE";
        return;
      }
      message.textContent = "GATHERING ICE CANDIDATES…";
      try {
        const offer = await party.makeManualOffer(code);
        (manual("#manual-guest-offer") as HTMLTextAreaElement).value = offer;
        message.textContent = "OFFER READY — COPY IT TO THE HOST";
      } catch (error) {
        message.textContent =
          error instanceof Error ? error.message : "FAILED TO CREATE OFFER";
      }
    };
    manual("#manual-connect").onclick = async () => {
      const code = normalizePartyCode(
        (manual("#manual-code") as HTMLInputElement).value,
      );
      const message = manual("#manual-message");
      try {
        await party.acceptManualAnswer(
          code,
          (manual("#manual-guest-answer") as HTMLTextAreaElement).value.trim(),
        );
        this.manualDialog.close();
      } catch (error) {
        message.textContent =
          error instanceof Error ? error.message : "CONNECTION FAILED";
      }
    };
    this.host.querySelector<HTMLInputElement>("input")!.oninput = (e) => {
      const input = e.target as HTMLInputElement;
      input.value = normalizePartyCode(input.value);
    };
    this.host.querySelector("form")!.onsubmit = async (e) => {
      e.preventDefault();
      const code = normalizePartyCode(
        this.host.querySelector<HTMLInputElement>("input")!.value,
      );
      if (!validPartyCode(code)) {
        party.message = "INVALID CODE";
        this.render();
        return;
      }
      if (await party.action("join", { code })) {
        this.joining = false;
        this.render();
      }
    };
    window.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Escape" && !this.host.hidden && this.escape()) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      },
      true,
    );
    party.changed = () => this.render();
    this.render();
  }
  escape() {
    if (!this.joining && !this.selected) return false;
    this.joining = false;
    this.selected = null;
    this.render();
    return true;
  }
  render() {
    const p = this.party,
      s = p.state;
    const get = (id: string) => this.host.querySelector<HTMLElement>("#" + id)!;
    get("party-create").hidden = !!s || this.joining;
    get("party-join-open").hidden = !!s || this.joining;
    get("party-manual-open").hidden =
      (!!s &&
        p.connection !== "offline" &&
        s.hostId !== p.playerId) ||
      this.joining;
    get("party-join").hidden = !!s || !this.joining;
    get("party-leave").hidden = !s;
    get("party-code").hidden = !s;
    get("party-code").textContent = s ? `PARTY  ${s.code}` : "";
    get("party-message").textContent = p.message;
    const start = get("party-start") as HTMLButtonElement;
    start.hidden = !s;
    start.disabled = p.busy || s?.hostId !== p.playerId;
    start.title =
      s?.hostId === p.playerId
        ? "Choose a game mode"
        : "The party host starts the game setup";
    this.flow.render();
    const strip = get("party-members"),
      signature = JSON.stringify([
        s?.members.map((m) => [
          m.id,
          m.name,
          m.avatarId,
          m.team,
          m.ready,
          m.connected,
        ]),
        s?.hostId,
        this.selected,
      ]);
    if (strip.dataset.signature !== signature) {
      const focusId = (document.activeElement as HTMLElement)?.dataset.player;
      strip.replaceChildren();
      strip.dataset.signature = signature;
      s?.members.forEach((m) => {
        const b = document.createElement("button");
        b.className = "party-avatar";
        b.dataset.player = m.id;
        b.dataset.team = String(m.team);
        b.title = `${m.name} · ${m.team === null ? "Unassigned" : m.team === 0 ? "Blue" : "Orange"}${m.connected === false ? " · Disconnected" : ""}`;
        if (m.connected === false) b.classList.add("disconnected");
        b.setAttribute(
          "aria-label",
          b.title + (m.id === s.hostId ? " — Party leader" : ""),
        );
        b.setAttribute("aria-pressed", String(this.selected === m.id));
        b.innerHTML =
          icon(m.avatarId) +
          (m.id === s.hostId
            ? '<span class="leader" aria-hidden="true">♛</span>'
            : "");
        b.onclick = () => {
          this.selected = this.selected === m.id ? null : m.id;
          this.render();
        };
        strip.append(b);
        if (focusId === m.id) b.focus();
      });
    }
    const member = s?.members.find((m) => m.id === this.selected);
    if (!member) this.selected = null;
    get("party-actions").hidden = !member;
    get("party-actions").querySelector("b")!.textContent = member?.name ?? "";
    get("party-kick").hidden =
      !member || s?.hostId !== p.playerId || member.id === p.playerId;
    for (const b of this.host.querySelectorAll<HTMLButtonElement>(
      ".party-controls button,#party-kick",
    ))
      b.disabled =
        p.busy || (b.id === "party-start" && s?.hostId !== p.playerId);
  }
}
