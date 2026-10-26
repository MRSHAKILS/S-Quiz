/**
 * End-to-end smoke test: one host and three phones play a two-question quiz.
 * Run against a server started with AUTH_DEV_LOGIN=1 (see scripts/e2e.sh).
 * Asserts the user-visible contract: join, live play, scoring order, results page.
 */
import { chromium } from "playwright";
import assert from "node:assert/strict";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const exe = process.env.CHROMIUM_PATH; // optional override; default Playwright-managed browser
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const step = (m) => console.log(`✓ ${m}`);
const SHOTS = process.env.SHOTS_DIR; // optional: capture screenshots for design review
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  const landing = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await landing.goto(BASE);
  await shot(landing, "landing");
  // ---- host: sign in and author a quiz through the real UI
  const host = await (await browser.newContext()).newPage();
  await host.goto(`${BASE}/login`);
  await host.getByLabel("Local dev login").fill("E2E Host");
  await host.getByRole("button", { name: "Continue", exact: true }).click();
  await host.waitForURL("**/dashboard");
  step("host signed in");

  await host.goto(`${BASE}/quiz/new`);
  await host.getByLabel("Quiz title").fill("E2E Capitals");
  const fillQuestion = async (n, text, a, b, correct) => {
    await host.getByLabel(`Question ${n} text`).fill(text);
    await host.getByLabel("Option A text").nth(n - 1).fill(a);
    await host.getByLabel("Option B text").nth(n - 1).fill(b);
    await host.getByLabel(`Option ${correct} is correct`).nth(n - 1).check();
  };
  await fillQuestion(1, "Capital of France?", "Paris", "Rome", "A");
  await host.getByRole("button", { name: "+ Add question" }).click();
  await fillQuestion(2, "Capital of Italy?", "Paris", "Rome", "B");
  await shot(host, "editor");
  await host.getByRole("button", { name: "Save quiz" }).click();
  await host.waitForURL("**/dashboard");
  await host.getByText("E2E Capitals").waitFor();
  step("quiz created and listed");

  await host.getByRole("button", { name: "Host" }).first().click();
  await host.waitForURL("**/host/*");
  const code = new URL(host.url()).pathname.split("/").pop();
  assert.match(code, /^[A-HJ-NP-Z2-9]{6}$/);
  await host.getByAltText(/QR code/).waitFor();
  step(`session ${code} open with QR`);

  // ---- three phones join
  const phones = {};
  for (const name of ["Ann", "Bob", "Cy"]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 800 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/j/${code}`);
    await page.getByLabel("Pick a nickname").fill(name);
    await page.getByRole("button", { name: "Join quiz" }).click();
    await page.getByText("You're in!").waitFor();
    phones[name] = page;
  }
  await host.getByText("3 / 50").waitFor({ timeout: 10_000 });
  await shot(host, "host-lobby");
  await shot(phones.Ann, "player-lobby");
  step("3 players joined, host sees the roster");

  // a duplicate nickname is refused
  const dup = await (await browser.newContext()).newPage();
  await dup.goto(`${BASE}/j/${code}`);
  await dup.getByLabel("Pick a nickname").fill("ann");
  await dup.getByRole("button", { name: "Join quiz" }).click();
  await dup.getByText(/nickname is taken/i).waitFor();
  step("duplicate nickname rejected");

  await host.getByRole("button", { name: "Start quiz" }).click();

  const answer = async (page, text) => page.getByRole("button", { name: new RegExp(text) }).click();

  // ---- question 1: Ann fast+correct, Bob slow+correct, Cy wrong
  for (const p of Object.values(phones)) await p.getByRole("heading", { name: "Capital of France?" }).waitFor();
  await shot(phones.Ann, "player-question");
  await answer(phones.Ann, "Paris");
  await sleep(1500);
  await answer(phones.Bob, "Paris");
  await answer(phones.Cy, "Rome");
  await phones.Ann.getByText("✓ Correct").waitFor({ timeout: 15_000 });
  await phones.Cy.getByText("✗ Not quite").waitFor();
  await shot(phones.Ann, "player-reveal");
  await shot(host, "host-reveal");
  step("Q1 revealed: correct and incorrect feedback");

  await host.getByRole("button", { name: "Next question" }).click();

  // ---- question 2: everyone correct, Ann again first
  for (const p of Object.values(phones)) await p.getByRole("heading", { name: "Capital of Italy?" }).waitFor();
  await answer(phones.Ann, "Rome");
  await sleep(1000);
  await answer(phones.Bob, "Rome");
  await answer(phones.Cy, "Rome");
  await host.getByRole("button", { name: "Show final results" }).waitFor({ timeout: 15_000 });
  await host.getByRole("button", { name: "Show final results" }).click();

  await host.getByText("Final results").waitFor();
  await phones.Ann.getByText("You finished #1").waitFor();
  await phones.Bob.getByText("You finished #2").waitFor();
  await phones.Cy.getByText("You finished #3").waitFor();
  await shot(host, "host-final");
  step("final ranking is Ann, Bob, Cy");

  const res = await host.request.get(`${BASE}/results/${code}`);
  assert.equal(res.status(), 200);
  assert.match(await res.text(), /E2E Capitals/);
  step("results page persisted");

  console.log("\nE2E smoke test passed");
} finally {
  await browser.close();
}
