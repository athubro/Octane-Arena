# WebRTC party and match networking

Party play uses the host player's browser as the authority. Create or join a
party from the published game page; no Node server, terminal, or hosting account
is needed. This works from the GitHub Pages repository path
`https://athubro.github.io/Octane-Arena/`.

## How it connects

- The host creates a six-character party code. PeerJS derives the host's broker
  peer ID from that code; guests use the code to connect.
- The public PeerJS broker is used only to exchange the initial connection
  information. Game/lobby state and party match inputs/snapshots travel over
  WebRTC data channels.
- A public STUN server is configured to discover direct network paths. **No
  TURN relay is configured.** Some school, guest, and carrier Wi-Fi networks
  block device-to-device traffic; WebRTC cannot guarantee a connection there.
- The host validates membership and lobby actions, owns the party state, and
  runs the authoritative party match simulation. Guests cannot claim their own
  team/ready state, kick players, or change the host's mode/stage.
- Parties use guest identities. Garage presets stay on each browser and
  persistent accounts remain an independent optional API.
- Party state exists only in the host tab. If the host leaves or closes the
  page, the party ends; host migration is not supported. A dropped guest is
  marked disconnected and may reconnect with the same tab token for up to 45
  seconds.

The account API does not select or relay party traffic. The legacy party HTTP/SSE
routes and `npm run lan` server remain for older clients and regression tests;
the current game frontend does not use them.

## Normal connection

1. Open the game on both devices. The game must be served from an origin with
   WebRTC support; use the GitHub Pages HTTPS address for real devices.
2. The host selects **CREATE PARTY** and shares the displayed six-character
   code.
3. The other player selects **JOIN PARTY**, enters the code, and joins.
4. The host chooses the mode and both players choose teams. The host starts the
   match from the team screen.
5. Keep the host tab open while playing.

The party panel and manual dialog explain that there is no TURN relay. On a
connection timeout, the UI also warns that school or guest Wi-Fi may block
device-to-device traffic.

## Manual codes (no broker)

Use **MANUAL CODES** if the PeerJS broker is unreachable or the normal join
cannot complete:

1. On the host device, choose **MANUAL CODES → HOST PARTY**. Share the displayed
   party code.
2. On the joining device, choose **MANUAL CODES → JOIN PARTY**, enter that
   party code, then select **GENERATE OFFER**. Wait for ICE gathering to finish.
3. Copy the full offer textarea to the host using any available messaging or
   copy/paste method.
4. The host pastes the offer and selects **CREATE ANSWER**. Wait for ICE
   gathering, then sends the full answer textarea back to the joining device.
5. The joining device pastes the answer and selects **CONNECT**.

Manual signaling uses native `RTCPeerConnection` and non-trickle ICE; it does
not contact the PeerJS broker. It still needs a direct WebRTC network route and
does not bypass Wi-Fi/firewall restrictions. The offer/answer codes can be long.

## Verification

The normal CI checks do not contact the public broker. Run:

```sh
npm test
npm test --prefix server
npm run build
```

The deterministic authority tests cover create, join, leave, kick, team, ready,
mode, stage, match start/input/snapshot authority, host-left, dropped peers, and
same-token rejoin. `tests/party-webrtc-browser.cjs` exercises a host and two
guests through the lobby using the in-memory fake transport; run it with Vite
serving the app and Playwright available to the test environment:

```sh
npm run dev
node tests/party-webrtc-browser.cjs
```

## Two-device manual checklist

- Open the deployed Pages URL on two devices, create a party on one, and join
  by code on the other.
- Confirm both member lists update, then choose a mode, assign opposite teams,
  and start a match.
- Drive both cars and verify controls, score, clock, and match snapshots update
  on both devices.
- Close and reopen the guest tab within 45 seconds and verify it rejoins with
  the same member identity. Then close the host tab and verify the party ends.
- Repeat using manual offer/answer codes with broker access blocked if possible.
- Try the same devices on school/guest Wi-Fi and record whether direct traffic is
  blocked; no result is guaranteed without TURN.

## Not verified here

The public broker was not tested, no real two-device WebRTC session was run, and
school/guest Wi-Fi behavior is unknown. The manual browser test also requires a
Playwright installation that is not part of this repository's runtime
dependencies.
