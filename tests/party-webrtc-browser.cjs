const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");

(async () => {
  const browser = await chromium.launch({
    ...(process.env.CHROME_PATH
      ? { executablePath: process.env.CHROME_PATH }
      : {}),
    headless: true,
    args: ["--enable-unsafe-swiftshader"],
  });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const base = process.env.GAME_URL || "http://127.0.0.1:5173";
    await page.goto(`${base}/?test`);
    await page.waitForFunction(() => !!window.__arena?.garage);
    const result = await page.evaluate(async () => {
      const [{ PartyClient }, { InMemoryPartyNetwork }] = await Promise.all([
        import("/src/game/party.ts"),
        import("/src/game/party-fake-transport.ts"),
      ]);
      const network = new InMemoryPartyNetwork();
      const client = (token) =>
        new PartyClient(
          window.__arena.garage,
          () => {},
          (callbacks) => network.transport(callbacks),
          token,
        );
      const host = client("host-browser-session-token-0123456789");
      const first = client("first-browser-session-token-0123456789");
      const second = client("second-browser-session-token-0123456789");
      const created = await host.action("create");
      const code = host.state?.code;
      const joined1 = await first.action("join", { code });
      const joined2 = await second.action("join", { code });
      const enteredMode = await host.action("stage", { stage: "mode" });
      const mode = await host.action("mode", { mode: "2v2" });
      const enteredTeams = await host.action("stage", { stage: "teams" });
      const team0 = await host.action("team", { team: 0 });
      const team1 = await first.action("team", { team: 1 });
      const secondTeam = await second.action("team", { team: 0 });
      return {
        created,
        joined1,
        joined2,
        enteredMode,
        mode,
        enteredTeams,
        team0,
        team1,
        secondTeam,
        hostMembers: host.state?.members.length,
        guestMembers: first.state?.members.length,
        guestTeams: first.state?.members.map((member) => member.team),
        identifiers: [host.playerId, first.playerId, second.playerId],
      };
    });
    assert.ok(result.created && result.joined1 && result.joined2);
    assert.ok(result.enteredMode && result.mode && result.enteredTeams);
    assert.ok(result.team0 && result.team1 && result.secondTeam);
    assert.equal(result.hostMembers, 3);
    assert.equal(result.guestMembers, 3);
    assert.deepEqual(result.guestTeams, [0, 1, 0]);
    assert.equal(new Set(result.identifiers).size, 3);
    assert.deepEqual(errors, []);
    console.log(
      "PASS host and two guests complete WebRTC lobby flow over fake transport",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
