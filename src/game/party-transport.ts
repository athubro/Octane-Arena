import Peer, { type DataConnection } from "peerjs";
import { starter } from "../../shared/catalog";
import type { Preset } from "../../shared/catalog";
import type {
  MatchSnapshot,
  PartyActions,
  PartyReply,
} from "../../shared/party";
import type { PlayerInput } from "../../shared/player";
import { PartyAuthority, createPartyCode } from "./party-authority";
import {
  manualSignalSchema,
  partyWireSchema,
  type PartyActionWire,
  type PartyWireMessage,
} from "./party-wire";

const MAX_MESSAGE_BYTES = 64 * 1024;
const MAX_MESSAGES_PER_SECOND = 100;
const ICE_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};
const peerIdForCode = (code: string) => `octane-arena-${code.toLowerCase()}`;

export function createPartyToken() {
  const bytes = new Uint8Array(24);
  try {
    if (!globalThis.crypto?.getRandomValues)
      throw new Error("Secure random numbers unavailable");
    globalThis.crypto.getRandomValues(bytes);
  } catch {
    for (let i = 0; i < bytes.length; i++)
      bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export interface PartyTransportCallbacks {
  reply(reply: PartyReply): void;
  status(connected: boolean): void;
}

export interface PartyTransport {
  connected: boolean;
  host: boolean;
  manual: boolean;
  create(token: string, name: string, preset: Preset): Promise<PartyReply>;
  join(
    code: string,
    token: string,
    name: string,
    preset: Preset,
  ): Promise<PartyReply>;
  createManualHost(token: string, name: string, preset: Preset): PartyReply;
  makeManualOffer(
    code: string,
    token: string,
    name: string,
    preset: Preset,
  ): Promise<string>;
  answerManualOffer(offer: string): Promise<string>;
  acceptManualAnswer(answer: string): Promise<PartyReply>;
  action(
    token: string,
    action: keyof PartyActions,
    data: PartyActions[keyof PartyActions],
  ): Promise<PartyReply>;
  setAppearance(
    token: string,
    name: string,
    preset: Preset,
  ): Promise<PartyReply>;
  sendGameUpdate(
    token: string,
    input: PlayerInput,
    snapshot?: MatchSnapshot,
  ): Promise<PartyReply>;
  sweep(): void;
  close(): void;
}

type AppChannel = {
  send(data: string): void;
  close(): void;
  onData(listener: (data: unknown) => void): void;
  onClose(listener: () => void): void;
  onOpen(listener: () => void): void;
  isOpen(): boolean;
};

const peerChannel = (connection: DataConnection): AppChannel => ({
  send: (data) => connection.send(data),
  close: () => connection.close(),
  onData: (listener) => connection.on("data", listener),
  onClose: (listener) => connection.on("close", listener),
  onOpen: (listener) => connection.on("open", listener),
  isOpen: () => connection.open,
});

const nativeChannel = (channel: RTCDataChannel): AppChannel => ({
  send: (data) => channel.send(data),
  close: () => channel.close(),
  onData: (listener) =>
    channel.addEventListener("message", (event) =>
      listener((event as MessageEvent).data),
    ),
  onClose: (listener) => channel.addEventListener("close", listener),
  onOpen: (listener) => channel.addEventListener("open", listener),
  isOpen: () => channel.readyState === "open",
});

function encodeSignal(description: RTCSessionDescriptionInit) {
  const bytes = new TextEncoder().encode(
    JSON.stringify({ type: description.type, sdp: description.sdp }),
  );
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function decodeSignal(code: string) {
  if (!code || code.length > 48_000)
    throw new Error("INVALID MANUAL CONNECTION CODE");
  try {
    const normalized = code.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(
      normalized + "=".repeat((4 - (normalized.length % 4)) % 4),
    );
    const bytes = Uint8Array.from(binary, (character) =>
      character.charCodeAt(0),
    );
    return manualSignalSchema.parse(
      JSON.parse(new TextDecoder().decode(bytes)),
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "INVALID MANUAL CONNECTION CODE"
    )
      throw error;
    throw new Error("INVALID MANUAL CONNECTION CODE");
  }
}

function waitForIceGathering(peer: RTCPeerConnection) {
  if (peer.iceGatheringState === "complete") return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      peer.removeEventListener("icegatheringstatechange", changed);
      reject(
        new Error(
          "ICE GATHERING TIMED OUT — TRY AGAIN OR USE A DIFFERENT NETWORK",
        ),
      );
    }, 25_000);
    const changed = () => {
      if (peer.iceGatheringState !== "complete") return;
      window.clearTimeout(timeout);
      peer.removeEventListener("icegatheringstatechange", changed);
      resolve();
    };
    peer.addEventListener("icegatheringstatechange", changed);
  });
}

export class WebRtcPartyTransport implements PartyTransport {
  connected = false;
  host = false;
  manual = false;
  private peer: Peer | null = null;
  private authority: PartyAuthority | null = null;
  private localToken = "";
  private partyCode = "";
  private localName = "Guest";
  private localPreset: Preset = starter();
  private hostUnsubscribe: (() => void) | null = null;
  private hostChannels = new Map<AppChannel, string>();
  private pending = new Map<
    string,
    { resolve: (reply: PartyReply) => void; reject: (error: Error) => void }
  >();
  private requestCounter = 0;
  private guestChannel: AppChannel | null = null;
  private manualPeer: RTCPeerConnection | null = null;
  private hostManualPeers = new Set<RTCPeerConnection>();
  constructor(private callbacks: PartyTransportCallbacks) {}

  async create(token: string, name: string, preset: Preset) {
    this.setupHost(token, name, preset, createPartyCode());
    this.manual = false;
    const code = this.partyCode;
    try {
      await this.openHostPeer(code);
    } catch (error) {
      this.close();
      throw error;
    }
    this.connected = true;
    this.callbacks.status(true);
    return this.currentReply();
  }

  async join(code: string, token: string, name: string, preset: Preset) {
    this.resetGuest();
    this.manual = false;
    this.localToken = token;
    this.localName = name;
    this.localPreset = preset;
    this.partyCode = code;
    let peer: Peer;
    try {
      peer = new Peer({ config: ICE_CONFIG });
      this.peer = peer;
      await this.waitForPeerOpen(peer, 12_000);
    } catch {
      this.close();
      throw new Error(
        "BROKER UNREACHABLE — CHECK YOUR INTERNET OR USE MANUAL CODES",
      );
    }
    const connection = peer.connect(peerIdForCode(code), { reliable: true });
    this.guestChannel = peerChannel(connection);
    this.attachGuestChannel(this.guestChannel);
    const joined = this.waitForJoinReply();
    peer.on("error", (error) => {
      if (error.type === "peer-unavailable")
        this.rejectPending(new Error("PARTY NOT FOUND — CHECK THE CODE"));
    });
    try {
      const reply = await joined;
      this.connected = true;
      this.callbacks.status(true);
      return reply;
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      this.close();
      if (message && !message.includes("CONNECTION TIMED OUT")) throw error;
      throw new Error(
        "CONNECTION TIMED OUT — SCHOOL OR GUEST WI-FI OFTEN BLOCKS DEVICE-TO-DEVICE TRAFFIC. TRY MANUAL CODES.",
      );
    }
  }

  createManualHost(token: string, name: string, preset: Preset) {
    this.close();
    this.setupHost(token, name, preset, createPartyCode());
    this.manual = true;
    this.connected = true;
    this.callbacks.status(true);
    return this.currentReply();
  }

  async makeManualOffer(
    code: string,
    token: string,
    name: string,
    preset: Preset,
  ) {
    this.resetGuest();
    this.manual = true;
    this.partyCode = code;
    this.localToken = token;
    this.localName = name;
    this.localPreset = preset;
    const peer = new RTCPeerConnection(ICE_CONFIG);
    this.manualPeer = peer;
    const channel = peer.createDataChannel("octane-arena-party");
    this.guestChannel = nativeChannel(channel);
    this.attachGuestChannel(this.guestChannel);
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    await waitForIceGathering(peer);
    if (!peer.localDescription)
      throw new Error("FAILED TO CREATE MANUAL OFFER");
    return encodeSignal(peer.localDescription);
  }

  async answerManualOffer(offerCode: string) {
    const authority = this.authority;
    if (!authority || !this.host)
      throw new Error("CREATE A MANUAL HOST PARTY FIRST");
    const description = decodeSignal(offerCode);
    if (description.type !== "offer") throw new Error("PASTE AN OFFER CODE");
    const peer = new RTCPeerConnection(ICE_CONFIG);
    this.hostManualPeers.add(peer);
    peer.addEventListener("connectionstatechange", () => {
      if (
        peer.connectionState === "closed" ||
        peer.connectionState === "failed"
      ) {
        this.hostManualPeers.delete(peer);
        peer.close();
      }
    });
    peer.addEventListener("datachannel", (event) =>
      this.attachHostChannel(
        nativeChannel((event as RTCDataChannelEvent).channel),
      ),
    );
    await peer.setRemoteDescription(description);
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    await waitForIceGathering(peer);
    if (!peer.localDescription)
      throw new Error("FAILED TO CREATE MANUAL ANSWER");
    return encodeSignal(peer.localDescription);
  }

  async acceptManualAnswer(answerCode: string) {
    const peer = this.manualPeer;
    if (!peer || !this.guestChannel)
      throw new Error("GENERATE AN OFFER CODE FIRST");
    const description = decodeSignal(answerCode);
    if (description.type !== "answer") throw new Error("PASTE AN ANSWER CODE");
    const joined = this.waitForJoinReply();
    await peer.setRemoteDescription(description);
    const reply = await joined;
    this.connected = true;
    this.callbacks.status(true);
    return joined;
  }

  async action(
    token: string,
    actionName: keyof PartyActions,
    data: PartyActions[keyof PartyActions],
  ): Promise<PartyReply> {
    const wireAction = this.normalizeAction(actionName, data);
    if (this.host && this.authority) {
      const result = this.authority.action(
        token,
        wireAction.type === "lobby" ? wireAction.action : wireAction,
      );
      if (!result.ok) throw new Error(result.error);
      if (wireAction.type === "leave" && !result.reply.party) this.finishHost();
      return result.reply;
    }
    const reply = await this.request({
      type: "action",
      requestId: this.nextRequestId(),
      action: wireAction,
    });
    if (wireAction.type === "leave") this.finishGuest();
    return reply;
  }

  async setAppearance(token: string, name: string, preset: Preset) {
    if (this.host && this.authority) {
      const result = this.authority.appearance(token, name, preset);
      if (!result.ok) throw new Error(result.error);
      return result.reply;
    }
    return this.request({
      type: "appearance",
      requestId: this.nextRequestId(),
      name,
      preset,
    });
  }

  async sendGameUpdate(
    token: string,
    input: PlayerInput,
    snapshot?: MatchSnapshot,
  ) {
    if (this.host && this.authority) {
      const result = this.authority.gameUpdate(token, input, snapshot);
      if (!result.ok) throw new Error(result.error);
      return result.reply;
    }

    return this.request({
      type: "gameUpdate",
      requestId: this.nextRequestId(),
      input,
      ...(snapshot ? { snapshot } : {}),
    });
  }

  sweep() {
    this.authority?.sweep();
  }

  close() {
    if (this.host && this.authority?.party) this.authority.destroy();
    this.hostUnsubscribe?.();
    this.hostUnsubscribe = null;
    this.peer?.destroy();
    this.peer = null;
    this.manualPeer?.close();
    this.manualPeer = null;
    for (const peer of this.hostManualPeers) peer.close();
    this.hostManualPeers.clear();
    this.guestChannel?.close();
    this.guestChannel = null;
    for (const channel of this.hostChannels.keys()) channel.close();
    this.hostChannels.clear();
    this.connected = false;
    this.host = false;
    this.authority = null;
    this.rejectPending(new Error("PARTY CONNECTION CLOSED"));
    this.callbacks.status(false);
  }

  private setupHost(token: string, name: string, preset: Preset, code: string) {
    this.close();
    this.host = true;
    this.localToken = token;
    this.localName = name;
    this.localPreset = preset;
    this.partyCode = code;
    this.authority = new PartyAuthority();
    this.hostUnsubscribe = this.authority.subscribe((reply) =>
      this.callbacks.reply(reply),
    );
    this.authority.create(code, token, {
      id: "",
      name,
      title: "Rookie",
      avatarId: "helmet",
      preset,
      team: 0,
      ready: false,
      connected: true,
    });
  }

  private async openHostPeer(code: string) {
    const peer = new Peer(peerIdForCode(code), { config: ICE_CONFIG });
    this.peer = peer;
    peer.on("connection", (connection) =>
      this.attachHostChannel(peerChannel(connection)),
    );
    try {
      await this.waitForPeerOpen(peer, 12_000);
    } catch (error) {
      const type = (error as Error & { type?: string }).type;
      if (type === "unavailable-id")
        throw new Error("PARTY CODE IS ALREADY IN USE — CREATE A NEW PARTY");
      throw new Error(
        "BROKER UNREACHABLE — CHECK YOUR INTERNET OR USE MANUAL CODES",
      );
    }
  }

  private waitForPeerOpen(peer: Peer, timeout: number) {
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        peer.off("open", onOpen);
        peer.off("error", onError);
        if (error) reject(error);
        else resolve();
      };
      const onOpen = () => finish();
      const onError = (error: Error) => finish(error);
      const timer = window.setTimeout(
        () => finish(new Error("PARTY BROKER TIMED OUT")),
        timeout,
      );
      peer.on("open", onOpen);
      peer.on("error", onError);
    });
  }

  private attachHostChannel(channel: AppChannel) {
    let token = "",
      invalid = 0,
      rateStart = Date.now(),
      received = 0;
    this.hostChannels.set(channel, token);
    channel.onData((raw) => {
      if (typeof raw !== "string") {
        invalid++;
        if (invalid >= 8) channel.close();
        return;
      }
      if (new TextEncoder().encode(raw).length > MAX_MESSAGE_BYTES) {
        channel.close();
        return;
      }
      if (Date.now() - rateStart >= 1000) {
        rateStart = Date.now();
        received = 0;
      }
      if (++received > MAX_MESSAGES_PER_SECOND) {
        channel.close();
        return;
      }
      let value: unknown;
      try {
        value = JSON.parse(raw);
      } catch {
        invalid++;
        if (invalid >= 8) channel.close();
        return;
      }
      const parsed = partyWireSchema.safeParse(value);
      if (!parsed.success) {
        if (
          value &&
          typeof value === "object" &&
          "type" in value &&
          typeof value.type === "string" &&
          ![
            "join",
            "action",
            "appearance",
            "gameUpdate",
            "result",
            "state",
            "host-left",
          ].includes(value.type)
        )
          return;
        invalid++;
        if (invalid >= 8) channel.close();
        return;
      }
      const message = parsed.data;
      if (!token) {
        if (message.type !== "join") {
          invalid++;
          if (invalid >= 8) channel.close();
          return;
        }
        token = message.token;
        this.hostChannels.set(channel, token);
        const result = this.authority!.join(
          token,
          message.name,
          message.preset,
          (reply) => {
            if ("type" in reply && reply.type === "host-left")
              this.send(channel, reply);
            else this.send(channel, { type: "state", reply });
          },
        );
        if (!result.ok) {
          this.send(channel, {
            type: "result",
            requestId: "join",
            ok: false,
            error: result.error,
          });
          window.setTimeout(() => channel.close(), 250);
        } else {
          this.send(channel, { type: "state", reply: result.reply });
        }
        return;
      }
      this.handleHostMessage(token, channel, message);
    });
    channel.onClose(() => {
      const activeToken = this.hostChannels.get(channel);
      this.hostChannels.delete(channel);
      if (activeToken) this.authority?.drop(activeToken);
    });
    channel.onOpen(() => {
      if (channel.isOpen()) this.callbacks.status(true);
    });
  }

  private handleHostMessage(
    token: string,
    channel: AppChannel,
    message: PartyWireMessage,
  ) {
    if (message.type === "action") {
      const result = this.authority!.action(
        token,
        message.action.type === "lobby"
          ? message.action.action
          : message.action,
      );
      this.send(channel, {
        type: "result",
        requestId: message.requestId,
        ok: result.ok,
        ...(!result.ok ? { error: result.error } : {}),
        reply: result.reply,
      });
      if (message.action.type === "leave" && !result.reply.party)
        window.setTimeout(() => channel.close(), 250);
      return;
    }
    if (message.type === "appearance") {
      const result = this.authority!.appearance(
        token,
        message.name,
        message.preset,
      );
      this.send(channel, {
        type: "result",
        requestId: message.requestId,
        ok: result.ok,
        ...(!result.ok ? { error: result.error } : {}),
        reply: result.reply,
      });
      return;
    }
    if (message.type === "gameUpdate") {
      const result = this.authority!.gameUpdate(
        token,
        message.input,
        message.snapshot,
      );
      this.send(channel, {
        type: "result",
        requestId: message.requestId,
        ok: result.ok,
        ...(!result.ok ? { error: result.error } : {}),
        reply: result.reply,
      });
    }
  }

  private attachGuestChannel(channel: AppChannel) {
    this.guestChannel = channel;
    channel.onData((raw) => {
      if (
        typeof raw !== "string" ||
        new TextEncoder().encode(raw).length > MAX_MESSAGE_BYTES
      )
        return;
      let value: unknown;
      try {
        value = JSON.parse(raw);
      } catch {
        return;
      }
      const parsed = partyWireSchema.safeParse(value);
      if (!parsed.success) return;
      const message = parsed.data;
      if (message.type === "host-left") {
        this.callbacks.reply({
          playerId: "",
          party: null,
          notice: "HOST LEFT — PARTY ENDED",
        });
        this.close();
      } else if (message.type === "state") {
        this.callbacks.reply(message.reply);
        if (!message.reply.party) this.finishGuest();
        const pendingJoin = this.pending.get("join");
        if (pendingJoin) {
          this.pending.delete("join");
          pendingJoin.resolve(message.reply);
        }
      } else if (message.type === "result") {
        const pending = this.pending.get(message.requestId);
        if (pending) {
          this.pending.delete(message.requestId);
          if (message.reply) this.callbacks.reply(message.reply);
          if (message.ok && message.reply) pending.resolve(message.reply);
          else
            pending.reject(new Error(message.error ?? "PARTY ACTION FAILED"));
        }
      }
    });
    channel.onClose(() => {
      if (this.host) return;
      this.connected = false;
      this.callbacks.status(false);
      this.guestChannel = null;
      this.manualPeer?.close();
      this.manualPeer = null;
    });
    channel.onOpen(() => {
      if (this.host) return;
      this.connected = true;
      this.callbacks.status(true);
      if (this.localToken)
        this.send(channel, {
          type: "join",
          token: this.localToken,
          name: this.localName,
          preset: this.localPreset,
        });
    });
  }

  private waitForJoinReply() {
    return new Promise<PartyReply>((resolve, reject) => {
      const requestId = "join";
      const timeout = window.setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error("CONNECTION TIMED OUT"));
      }, 15_000);
      this.pending.set(requestId, {
        resolve: (reply) => {
          window.clearTimeout(timeout);
          resolve(reply);
        },
        reject: (error) => {
          window.clearTimeout(timeout);
          reject(error);
        },
      });
    });
  }

  private async request(message: PartyWireMessage): Promise<PartyReply> {
    const channel = this.guestChannel;
    if (!channel?.isOpen()) throw new Error("PARTY CONNECTION LOST — RETRYING");
    const requestId = "requestId" in message ? message.requestId : "";
    const response = new Promise<PartyReply>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error("PARTY REQUEST TIMED OUT"));
      }, 7000);
      this.pending.set(requestId, {
        resolve: (reply) => {
          window.clearTimeout(timeout);
          resolve(reply);
        },
        reject: (error) => {
          window.clearTimeout(timeout);
          reject(error);
        },
      });
    });
    this.send(channel, message);
    return response;
  }

  private send(channel: AppChannel, message: unknown) {
    const raw = JSON.stringify(message);
    if (new TextEncoder().encode(raw).length > MAX_MESSAGE_BYTES) {
      channel.close();
      throw new Error("PARTY MESSAGE TOO LARGE");
    }
    if (channel.isOpen()) channel.send(raw);
  }

  private nextRequestId() {
    return `r${++this.requestCounter}`;
  }

  private normalizeAction(
    action: keyof PartyActions,
    data: PartyActions[keyof PartyActions],
  ): PartyActionWire {
    if (action === "leave" || action === "disconnect")
      return { type: "leave" as const };
    if (action === "startMatch") return { type: "startMatch" as const };
    if (action === "endMatch") return { type: "endMatch" as const };
    if (action === "team")
      return {
        type: "lobby" as const,
        action: {
          type: "team" as const,
          team: (data as PartyActions["team"]).team,
        },
      };
    if (action === "ready")
      return {
        type: "lobby" as const,
        action: {
          type: "ready" as const,
          ready: (data as PartyActions["ready"]).ready,
        },
      };
    if (action === "mode")
      return {
        type: "lobby" as const,
        action: {
          type: "mode" as const,
          mode: (data as PartyActions["mode"]).mode,
        },
      };
    if (action === "stage")
      return {
        type: "lobby" as const,
        action: {
          type: "stage" as const,
          stage: (data as PartyActions["stage"]).stage,
        },
      };
    if (action === "kick")
      return {
        type: "lobby" as const,
        action: {
          type: "kick" as const,
          playerId: (data as PartyActions["kick"]).playerId,
        },
      };
    throw new Error("CREATE OR JOIN A PARTY FIRST");
  }

  private currentReply() {
    if (!this.authority?.party) throw new Error("PARTY CREATION FAILED");
    return {
      playerId: this.authority.party.hostId,
      party: this.authority.party,
      notice: "",
    };
  }

  private finishHost() {
    this.peer?.destroy();
    this.peer = null;
    this.manualPeer?.close();
    this.manualPeer = null;
    for (const peer of this.hostManualPeers) peer.close();
    this.hostManualPeers.clear();
    this.connected = false;
    this.host = false;
    this.authority = null;
    this.callbacks.status(false);
  }

  private finishGuest() {
    this.peer?.destroy();
    this.peer = null;
    this.manualPeer?.close();
    this.manualPeer = null;
    this.guestChannel?.close();
    this.guestChannel = null;
    this.connected = false;
    this.callbacks.status(false);
    this.rejectPending(new Error("PARTY CONNECTION CLOSED"));
  }

  private resetGuest() {
    this.guestChannel?.close();
    this.guestChannel = null;
    this.peer?.destroy();
    this.peer = null;
    this.manualPeer?.close();
    this.manualPeer = null;
    this.pending.clear();
    this.connected = false;
    this.host = false;
  }

  private rejectPending(error: Error) {
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }
}
