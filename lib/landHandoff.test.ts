import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { landDeskAction, landHandoffDocument, landLaunchHref, signLandHandoff, verifyLandHandoff } from "./landHandoff.ts";

const SECRET = "handoff-test-secret-32-characters!";
const NOW = 1_700_000_000_000;
const JTI = "fixed-jti-value-0001";
const TOKEN =
  "v1.eyJpc3MiOiJkYjM1Ny1odWIiLCJhdWQiOiJsYW5kIiwiZW1haWwiOiJwZXJzb25AZXhhbXBsZS5jb20iLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6MTcwMDAwMDA2MCwianRpIjoiZml4ZWQtanRpLXZhbHVlLTAwMDEifQ.0Ugo07AYBz_2b6C20KOC2btwAM5XaDeZalRUyAc0zo0";

describe("land handoff token", () => {
  it("matches the token Land verifies", () => {
    const token = signLandHandoff("Person@Example.com", SECRET, { nowMs: NOW, jti: JTI });
    assert.equal(token, TOKEN);
    assert.equal(verifyLandHandoff(TOKEN, SECRET, NOW)?.email, "person@example.com");
    assert.equal(verifyLandHandoff(TOKEN, SECRET, NOW + 120_000), null);
  });

  it("posts only to Land Desk and keeps the secret out of the page", () => {
    assert.equal(landLaunchHref("land", "https://168.db357.com"), "/auth/land-handoff");
    assert.equal(landLaunchHref("loan", "https://loan.db357.com"), "https://loan.db357.com");
    assert.equal(landDeskAction(""), "https://168.db357.com/auth/hub");
    assert.equal(landDeskAction("https://evil.example/steal"), "https://168.db357.com/auth/hub");
    assert.equal(landDeskAction("http://localhost:3001"), "http://localhost:3001/auth/hub");
    const page = landHandoffDocument(TOKEN, landDeskAction(""));
    assert.match(page, /action="https:\/\/168\.db357\.com\/auth\/hub"/);
    assert.match(page, new RegExp(`value="${TOKEN}"`));
    assert.equal(page.includes(SECRET), false);
  });
});
