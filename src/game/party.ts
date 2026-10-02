import type { Garage } from "./inventory";
import type {
  MatchSnapshot,
  PartyActions,
  PartyReply,
  PartyState,
} from "../../shared/party";
import type { PlayerInput } from "../../shared/player";
import {
  createPartyToken,
  WebRtcPartyTransport,
  type PartyTransportCallbacks,
  type PartyTransport,
} from "./party-transport";

const TOKEN_KEY = "arena-webrtc-party-session";
const CODE_KEY = "arena-webrtc-party-code";
const ROLE_KEY = "arena-webrtc-party-role";
const MODE_KEY = "arena-webrtc-party-transport";

export class PartyClient {
  state: PartyState | null = null;
  playerId = "local";
  message = "";
  busy = false;
  connection: "offline" | "connected" = "offline";
  manualRejoinCode = "";
  private token = "";
  private ready: Promise<void>;
  private gameBusy = false;
  private fingerprint = "";
  private reconnectBusy = false;
  private transport: PartyTransport;

  constructor(
    private garage: Garage,
    public changed = () => {},
    transportOrFactory?:
      | PartyTransport
      | ((callbacks: {
          reply(reply: PartyReply): void;
          status(connected: boolean): void;
        }) => PartyTransport),
    sessionToken?: string,
  ) {
    const callbacks: PartyTransportCallbacks = {
      reply: (reply: PartyReply) => this.apply(reply),
      status: (connected: boolean) => {
        this.connection = connected ? "connected" : "offline";
        this.changed();
      },
    };
    this.transport =
      typeof transportOrFactory === "function"
        ? transportOrFactory(callbacks)
        : (transportOrFactory ?? new WebRtcPartyTransport(callbacks));
    if (sessionToken) {
      this.token = sessionToken;
    } else {
      try {
        this.token = sessionStorage.getItem(TOKEN_KEY) ?? createPartyToken();
        sessionStorage.setItem(TOKEN_KEY, this.token);
      } catch {
        this.token = createPartyToken();
      }
    }
    this.ready = this.initialize();
    window.setInterval(() => void this.poll(), 2000);
    window.addEventListener("pagehide", () => this.transport.close());
  }

  private async initialize() {
    let code = "";
    let manual = false;
    try {
      if (sessionStorage.getItem(ROLE_KEY) === "guest") {
        code = sessionStorage.getItem(CODE_KEY) ?? "";
        manual = sessionStorage.getItem(MODE_KEY) === "manual";
      }
    } catch {
      return;
    }
    if (!code) return;
    if (manual) {
      this.manualRejoinCode = code;
      this.message = "MANUAL REJOIN REQUIRED — GENERATE A NEW OFFER CODE";
      this.changed();
      return;
    }
    try {
      this.apply(
        await this.transport.join(
          code,
          this.token,
          this.garage.profile.name,
          this.garage.current,
        ),
      );
      this.connection = "connected";
      this.fingerprint = this.signature();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "PARTY RECONNECT FAILED";
      if (message.includes("PARTY NOT FOUND")) {
        this.clearStoredParty();
        this.state = null;
        this.message = "HOST LEFT — PARTY ENDED";
      } else {
        this.message = message;
      }
      this.changed();
    }
  }

  private apply(reply: PartyReply) {
    this.playerId = reply.playerId || this.playerId;
    this.state = reply.party;
    if (reply.notice) this.message = reply.notice;
    else if (
      reply.party &&
      this.transport.connected &&
      this.message.startsWith("CONNECTION DROPPED")
    )
      this.message = "";
    if (!reply.party) {
      this.clearStoredParty();
      this.manualRejoinCode = "";
    } else if (reply.playerId === reply.party.hostId) {
      this.storeParty(
        reply.party.code,
        "host",
        this.transport.manual ? "manual" : "broker",
      );
    }
    this.changed();
  }

  async action(
    action: keyof PartyActions,
    data: PartyActions[keyof PartyActions] = {},
  ) {
    if (this.busy) return false;
    this.busy = true;
    this.message = "";
    this.changed();
    try {
      await this.ready;
      let reply: PartyReply;
      if (action === "create") {
        reply = await this.transport.create(
          this.token,
          this.garage.profile.name,
          this.garage.current,
        );
        this.storeParty(reply.party!.code, "host");
      } else if (action === "join") {
        reply = await this.transport.join(
          (data as PartyActions["join"]).code,
          this.token,
          this.garage.profile.name,
          this.garage.current,
        );
        this.storeParty(reply.party!.code, "guest");
      } else {
        reply = await this.transport.action(this.token, action, data);
      }
      this.apply(reply);
      return true;
    } catch (error) {
      this.message =
        error instanceof Error ? error.message : "PARTY REQUEST FAILED";
      return false;
    } finally {
      this.busy = false;
      this.changed();
    }
  }

  async createManualHost() {
    await this.ready;
    const reply = this.transport.createManualHost(
      this.token,
      this.garage.profile.name,
      this.garage.current,
    );
    this.storeParty(reply.party!.code, "host", "manual");
    this.apply(reply);
    return reply.party!.code;
  }

  makeManualOffer(code: string) {
    return this.transport.makeManualOffer(
      code,
      this.token,
      this.garage.profile.name,
      this.garage.current,
    );
  }

  answerManualOffer(offer: string) {
    return this.transport.answerManualOffer(offer);
  }

  async acceptManualAnswer(code: string, answer: string) {
    const reply = await this.transport.acceptManualAnswer(answer);
    this.storeParty(code, "guest", "manual");
    this.manualRejoinCode = "";
    this.message = "";
    this.apply(reply);
  }

  async sendGameUpdate(input: PlayerInput, snapshot?: MatchSnapshot) {
    if (this.gameBusy || !this.connection || !this.state?.game) return false;
    this.gameBusy = true;
    try {
      await this.ready;
      this.apply(
        await this.transport.sendGameUpdate(this.token, input, snapshot),
      );
      return true;
    } catch {
      this.message = "MATCH CONNECTION LOST — INPUTS NOT SYNCING";
      return false;
    } finally {
      this.gameBusy = false;
      this.changed();
    }
  }

  private async poll() {
    await this.ready;
    if (this.busy || this.gameBusy) return;
    if (this.transport.host) {
      this.transport.sweep();
      if (this.state && this.signature() !== this.fingerprint) {
        this.fingerprint = this.signature();
        try {
          this.apply(
            await this.transport.setAppearance(
              this.token,
              this.garage.profile.name,
              this.garage.current,
            ),
          );
        } catch (error) {
          this.message =
            error instanceof Error ? error.message : "APPEARANCE UPDATE FAILED";
        }
      }
      return;
    }
    if (
      this.state &&
      !this.transport.connected &&
      !this.transport.manual &&
      !this.reconnectBusy
    ) {
      this.reconnectBusy = true;
      try {
        await this.transport.join(
          this.state.code,
          this.token,
          this.garage.profile.name,
          this.garage.current,
        );
        this.connection = "connected";
        this.message = "";
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (message.includes("PARTY NOT FOUND")) {
          this.state = null;
          this.clearStoredParty();
          this.message = "HOST LEFT — PARTY ENDED";
        } else if (message) {
          this.message = message;
        }
      } finally {
        this.reconnectBusy = false;
        this.changed();
      }
      return;
    }
    if (this.state && !this.transport.connected && this.transport.manual) {
      if (!this.message)
        this.message = "CONNECTION DROPPED — USE MANUAL CODES TO REJOIN";
      this.changed();
    }
    if (this.state && this.transport.connected) {
      const signature = this.signature();
      if (signature !== this.fingerprint) {
        try {
          this.apply(
            await this.transport.setAppearance(
              this.token,
              this.garage.profile.name,
              this.garage.current,
            ),
          );
          this.fingerprint = signature;
        } catch (error) {
          this.message =
            error instanceof Error ? error.message : "APPEARANCE UPDATE FAILED";
        }
      }
    }
  }

  private signature() {
    return JSON.stringify([this.garage.current, this.garage.profile]);
  }

  private storeParty(
    code: string,
    role: "host" | "guest",
    mode: "broker" | "manual" = "broker",
  ) {
    try {
      sessionStorage.setItem(CODE_KEY, code);
      sessionStorage.setItem(ROLE_KEY, role);
      sessionStorage.setItem(MODE_KEY, mode);
    } catch {
      /* Rejoin state remains in memory for this tab. */
    }
  }

  private clearStoredParty() {
    try {
      sessionStorage.removeItem(CODE_KEY);
      sessionStorage.removeItem(ROLE_KEY);
      sessionStorage.removeItem(MODE_KEY);
    } catch {
      /* The in-memory party state is authoritative for this tab. */
    }
  }
}
