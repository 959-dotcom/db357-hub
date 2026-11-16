import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DMCK_LAUNCH_PATH,
  dmckDeskAction,
  dmckHandoffDocument,
  signDmckHandoff,
  verifyDmckHandoff,
} from "./dmckHandoff.ts";

const SECRET = "handoff-test-secret-32-characters!";
const NOW = 1_700_000_000_000;
const JTI = "fixed-jti-value-0001";
const TOKEN =
  "v1.eyJpc3MiOiJkYjM1Ny1odWIiLCJhdWQiOiJkbWNrIiwiZW1haWwiOiJwZXJzb25AZXhhbXBsZS5jb20iLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6MTcwMDAwMDA2MCwianRpIjoiZml4ZWQtanRpLXZhbHVlLTAwMDEifQ.CiLOgS2seJ9QTIOeYKBQt8U5yY15lOMm0yj14IXg7Ts";
const LAND_TOKEN =
  "v1.eyJpc3MiOiJkYjM1Ny1odWIiLCJhdWQiOiJsYW5kIiwiZW1haWwiOiJwZXJzb25AZXhhbXBsZS5jb20iLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6MTcwMDAwMDA2MCwianRpIjoiZml4ZWQtanRpLXZhbHVlLTAwMDEifQ.0Ugo07AYBz_2b6C20KOC2btwAM5XaDeZalRUyAc0zo0";

describe("dmck handoff token", () => {
  it("matches the token DM-CK verifies", () => {
    const token = signDmckHandoff("Person@Example.com", SECRET, { nowMs: NOW, jti: JTI });
    assert.equal(token, TOKEN);
    assert.equal(verifyDmckHandoff(TOKEN, SECRET, NOW)?.email, "person@example.com");
    assert.equal(verifyDmckHandoff(TOKEN, SECRET, NOW + 120_000), null);
    assert.equal(verifyDmckHandoff(LAND_TOKEN, SECRET, NOW), null);
  });

  it("posts only to DM-CK and keeps the secret out of the page", () => {
    assert.equal(DMCK_LAUNCH_PATH, "/auth/dmck-handoff");
    assert.equal(dmckDeskAction(""), "https://spinlytics-db357.vercel.app/auth/hub");
    assert.equal(dmckDeskAction("https://evil.example/steal"), "https://spinlytics-db357.vercel.app/auth/hub");
    assert.equal(dmckDeskAction("https://www.db357.com/dmck"), "https://www.db357.com/dmck/auth/hub");
    assert.equal(dmckDeskAction("https://db357.com/dmck/"), "https://db357.com/dmck/auth/hub");
    assert.equal(dmckDeskAction("https://www.db357.com/dashboard"), "https://spinlytics-db357.vercel.app/auth/hub");
    assert.equal(dmckDeskAction("http://localhost:3000"), "http://localhost:3000/auth/hub");
    const page = dmckHandoffDocument(TOKEN, dmckDeskAction(""));
    assert.match(page, /action="https:\/\/spinlytics-db357\.vercel\.app\/auth\/hub"/);
    assert.match(page, new RegExp(`value="${TOKEN}"`));
    assert.equal(page.includes(SECRET), false);
  });
});
