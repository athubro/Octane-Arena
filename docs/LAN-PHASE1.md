# Play over Wi-Fi

Party and party-match traffic now uses browser-to-browser WebRTC. A separate
LAN party server is not required: open the GitHub Pages game (or another
WebRTC-capable origin) on the host device and on each joining device, then use
the party code shown in the lobby.

The host browser is authoritative for party membership, mode/team rules, match
inputs, physics, and snapshots. Keep the host tab open. Host departure ends the
party; migration is not supported. Garage presets remain local to each browser.

The public PeerJS service is only an introduction broker. If it is unavailable,
**MANUAL CODES** uses native WebRTC offer/answer signaling without that broker.
Both methods use STUN but no TURN relay, so some school, guest, and carrier
networks may block device-to-device traffic. See the
[WebRTC guide](WEBRTC-LOBBY.md) for the connection steps, limitations, and
two-device checklist.

`npm run lan` and the server's HTTP/SSE party endpoints remain in the
repository for legacy clients and server regression coverage, but the current
frontend does not use them for party or match networking. The API server is
still optional for accounts.
