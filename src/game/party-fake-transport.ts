import { starter } from "../../shared/catalog";
import type { Preset } from "../../shared/catalog";
import type {
  MatchSnapshot,
  PartyActions,
  PartyReply,
} from "../../shared/party";
import type { PlayerInput } from "../../shared/player";
import { PartyAuthority, createPartyCode } from "./party-authority";
import type {
  PartyTransport,
  PartyTransportCallbacks,
} from "./party-transport";

export class InMemoryPartyNetwork {
  authority: PartyAuthority | null = null;

  transport(callbacks: PartyTransportCallbacks): PartyTransport {
    return new InMemoryPartyTransport(this, callbacks);
  }
}

class InMemoryPartyTransport implements PartyTransport {
  connected = false;
  host = false;
  manual = false;
  private authority: PartyAuthority | null = null;
  private token = "";
  private unsubscribe: (() => void) | null = null;

  constructor(
    private network: InMemoryPartyNetwork,
    private callbacks: PartyTransportCallbacks,
  ) {}

  async create(token: string, name: string, preset: Preset) {
    this.close();
    const authority = new PartyAuthority();
    this.network.authority = authority;
    this.authority = authority;
    this.token = token;
    this.host = true;
    this.connected = true;
    this.unsubscribe = authority.subscribe((reply) =>
      this.callbacks.reply(reply),
    );
    authority.create(createPartyCode(), token, {
      id: "",
      name,
      title: "Rookie",
      avatarId: "helmet",
      preset,
      team: 0,
      ready: false,
      connected: true,
    });
    this.callbacks.status(true);
    return {
      playerId: authority.party!.hostId,
      party: authority.party,
      notice: "",
    };
  }

  async join(
    code: string,
    token: string,
    name: string,
    preset: Preset,
  ): Promise<PartyReply> {
    const authority = this.network.authority;
    if (!authority?.party || authority.party.code !== code)
      throw new Error("PARTY NOT FOUND — CHECK THE CODE");
    this.close();
    this.authority = authority;
    this.token = token;
    const result = authority.join(token, name, preset, (message) => {
      if ("type" in message) {
        this.callbacks.reply({
          playerId: "",
          party: null,
          notice: "HOST LEFT — PARTY ENDED",
        });
        this.callbacks.status(false);
        this.connected = false;
      } else this.callbacks.reply(message);
    });
    if (!result.ok) throw new Error(result.error);
    this.connected = true;
    this.callbacks.status(true);
    return result.reply;
  }

  createManualHost(token: string, name: string, preset: Preset) {
    void this.create(token, name, preset);
    return {
      playerId: this.network.authority!.party!.hostId,
      party: this.network.authority!.party,
      notice: "",
    };
  }

  async makeManualOffer(
    _code: string,
    _token: string,
    _name: string,
    _preset: Preset,
  ): Promise<string> {
    throw new Error(
      "MANUAL WEBRTC IS NOT AVAILABLE IN THE IN-MEMORY TEST TRANSPORT",
    );
  }

  async answerManualOffer(_offer: string): Promise<string> {
    throw new Error(
      "MANUAL WEBRTC IS NOT AVAILABLE IN THE IN-MEMORY TEST TRANSPORT",
    );
  }

  async acceptManualAnswer(_answer: string): Promise<PartyReply> {
    throw new Error(
      "MANUAL WEBRTC IS NOT AVAILABLE IN THE IN-MEMORY TEST TRANSPORT",
    );
  }

  async action(
    token: string,
    action: keyof PartyActions,
    data: PartyActions[keyof PartyActions],
  ) {
    const authority = this.requireAuthority();
    const wireAction =
      action === "leave" || action === "disconnect"
        ? { type: "leave" as const }
        : action === "startMatch"
          ? { type: "startMatch" as const }
          : action === "endMatch"
            ? { type: "endMatch" as const }
            : action === "team"
              ? {
                  type: "team" as const,
                  team: (data as PartyActions["team"]).team,
                }
              : action === "ready"
                ? {
                    type: "ready" as const,
                    ready: (data as PartyActions["ready"]).ready,
                  }
                : action === "mode"
                  ? {
                      type: "mode" as const,
                      mode: (data as PartyActions["mode"]).mode,
                    }
                  : action === "field"
                    ? {
                        type: "field" as const,
                        field: (data as PartyActions["field"]).field,
                      }
                  : action === "stage"
                    ? {
                        type: "stage" as const,
                        stage: (data as PartyActions["stage"]).stage,
                      }
                    : action === "kick"
                      ? {
                          type: "kick" as const,
                          playerId: (data as PartyActions["kick"]).playerId,
                        }
                      : null;
    if (!wireAction) throw new Error("CREATE OR JOIN A PARTY FIRST");
    const result = authority.action(token, wireAction);
    if (!result.ok) throw new Error(result.error);
    if (wireAction.type === "leave" && !result.reply.party) {
      this.connected = false;
      this.callbacks.status(false);
    }
    return result.reply;
  }

  async setAppearance(token: string, name: string, preset: Preset) {
    const result = this.requireAuthority().appearance(token, name, preset);
    if (!result.ok) throw new Error(result.error);
    return result.reply;
  }

  async sendGameUpdate(
    token: string,
    input: PlayerInput,
    snapshot?: MatchSnapshot,
  ) {
    const result = this.requireAuthority().gameUpdate(token, input, snapshot);
    if (!result.ok) throw new Error(result.error);
    return result.reply;
  }

  sweep() {
    this.authority?.sweep();
  }

  close() {
    this.unsubscribe?.();
    this.unsubscribe = null;
    if (this.host && this.authority?.party) this.authority.destroy();
    else if (this.authority && this.token) this.authority.drop(this.token);
    this.connected = false;
    this.host = false;
    this.callbacks.status(false);
  }

  private requireAuthority() {
    if (!this.authority?.party)
      throw new Error("PARTY CONNECTION LOST — RETRYING");
    return this.authority;
  }
}
