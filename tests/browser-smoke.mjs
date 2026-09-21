import { chromium, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";

// Keep the server and browser together: works in isolated execution containers too.
const server = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5173"],
  { stdio: ["ignore", "pipe", "pipe"] },
);
let serverLog = "";
server.stdout.on("data", (d) => {
  serverLog += d;
});
server.stderr.on("data", (d) => {
  serverLog += d;
});
let browser;
try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      clearInterval(poll);
      reject(new Error(serverLog || "Server startup timeout"));
    }, 30000);
    const poll = setInterval(() => {
      if (serverLog.includes("127.0.0.1:5173")) {
        clearInterval(poll);
        clearTimeout(timeout);
        resolve();
      }
    }, 100);
  });
  const executablePath = process.env.ALTAMETA_CHROMIUM_PATH;
  browser = await chromium.launch({
    headless: true,
    ...(executablePath
      ? {
          executablePath,
          args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
        }
      : {}),
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // Auth and account persistence are fixtures here; live isolation is tested separately.
  const user = {
    id: "smoke-user",
    email: "smoke@users.altameta.invalid",
    aud: "authenticated",
    role: "authenticated",
  };
  let cloud = { state: {}, revision: 0, username: "smoke" };
  const token = [
    { alg: "HS256", typ: "JWT" },
    { sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 },
    "fixture",
  ]
    .map((v) =>
      Buffer.from(typeof v === "string" ? v : JSON.stringify(v)).toString(
        "base64url",
      ),
    )
    .join(".");
  await page.route("https://*.supabase.co/auth/v1/**", async (route) => {
    const data = route.request().url().includes("/token")
      ? {
          access_token: token,
          refresh_token: "fixture",
          expires_in: 3600,
          token_type: "bearer",
          user,
        }
      : user;
    await route.fulfill({ json: data });
  });
  await page.route("https://*.supabase.co/rest/v1/**", async (route) => {
    if (route.request().url().includes("/rpc/save_demo_account")) {
      const body = route.request().postDataJSON();
      if (body.expected_revision !== cloud.revision) {
        await route.fulfill({ json: [] });
        return;
      }
      cloud = {
        ...cloud,
        state: body.next_state,
        revision: cloud.revision + 1,
      };
      await route.fulfill({ json: [{ revision: cloud.revision }] });
    } else await route.fulfill({ json: cloud });
  });
  await mkdir("test-results", { recursive: true });
  await page.goto("http://127.0.0.1:5173");
  await page.getByLabel("Username", { exact: true }).fill("smoke");
  await page.getByLabel("Password", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "LOG IN", exact: true }).click();
  await expect(page.getByText("Demo Balance", { exact: true })).toBeVisible();
  await page.waitForFunction(
    () =>
      JSON.parse(
        localStorage.getItem("altameta:cloud:smoke-user") || '{"data":{}}',
      ).data["duel:account:v1"],
  );
  await page.screenshot({ path: "test-results/home.png" });
  const balance = () =>
    page.evaluate(
      () =>
        JSON.parse(
          JSON.parse(localStorage.getItem("altameta:cloud:smoke-user")).data[
            "duel:account:v1"
          ],
        ).profile.coins,
    );
  expect(await balance()).toBe(10000);
  await page.getByRole("link", { name: /PLAY CHOOSE/ }).click();
  await page.getByRole("button", { name: /STACK.*Drop moving blocks/ }).click();
  await page.getByRole("button", { name: /PLAY THE LADDER/ }).click();
  await expect(
    page.getByRole("button", { name: "Cancel", exact: true }),
  ).toBeVisible();
  await page.waitForFunction(
    () =>
      JSON.parse(
        JSON.parse(localStorage.getItem("altameta:cloud:smoke-user")).data[
          "duel:account:v1"
        ],
      ).profile.coins === 9900,
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByText("Demo Balance", { exact: true })).toBeVisible();
  expect(await balance()).toBe(10000);
  await page.waitForTimeout(4500);
  expect(new URL(page.url()).pathname).toBe("/");
  console.log(
    "PASS: cancellation refunds the pending entry and does not navigate later",
  );

  // All requests to the friend backend are intercepted: no live challenges are created.
  const challenges = new Map();
  let failSubmit = false;
  await page.route(
    "https://*.supabase.co/functions/v1/friend-challenge",
    async (route) => {
      const body = route.request().postDataJSON(),
        ch = challenges.get(body.code);
      if (body.action === "submit") {
        if (failSubmit) {
          await route.abort("failed");
          return;
        }
        ch.creator_score = body.score;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: JSON.stringify({
          challenge: ch,
          winner: ch?.creator_score > ch?.guest_score ? "creator" : "guest",
        }),
      });
    },
  );
  const prepare = async (game, code) => {
    const ch = {
      id: code,
      code,
      game_id: game,
      seed: 1,
      wager_eur: 1,
      creator_name: "TEST",
      creator_avatar: "🎮",
      creator_score: null,
      creator_finished_at: null,
      guest_name: "FRIEND",
      guest_avatar: "🎮",
      guest_score: 2,
      guest_finished_at: null,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 86400000).toISOString(),
      score_mode: game === "reaction" ? "low" : "high",
      payment_mode: "in_person",
    };
    challenges.set(code, ch);
    await page.goto("http://127.0.0.1:5173/");
    await expect(
      page.getByText("Saved to account", { exact: true }),
    ).toBeVisible();
    const all = JSON.parse(cloud.state["altameta:friendSessions:v1"] || "{}");
    all[code] = {
      code,
      token: "fixture",
      role: "creator",
      seed: 1,
      expiresAt: ch.expires_at,
    };
    cloud.state["altameta:friendSessions:v1"] = JSON.stringify(all);
    await page.goto("http://127.0.0.1:5173/challenge/" + code);
    await page.getByRole("button", { name: "PLAY YOUR RUN" }).click();
    await page.waitForURL("**/play/" + (game === "memory" ? "memory" : game));
    await expect(page.getByText("Balance", { exact: true })).toBeVisible();
  };
  for (const game of [
    "reaction",
    "rhythm",
    "direction",
    "memory",
    "precision",
    "stack",
    "knife",
    "dash",
    "flappy",
  ]) {
    await prepare(game, "SMOKE-" + game);
    await expect(page.locator("main")).toBeVisible();
    await page.screenshot({ path: "test-results/" + game + ".png" });
    expect(await page.locator("vite-error-overlay").count()).toBe(0);
    if (game === "rhythm" || game === "direction") {
      await page.waitForFunction(
        () =>
          document.querySelectorAll(
            'main [aria-hidden="true"] span:not([hidden])',
          ).length > 0,
      );
      await page.screenshot({ path: "test-results/" + game + "-moving.png" });
    }
    if (game === "memory") {
      await expect(page.locator("section button")).toHaveCount(4);
      const boxes = await page.locator("section button").evaluateAll((nodes) =>
        nodes.map((n) => {
          const r = n.getBoundingClientRect();
          return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
        }),
      );
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i],
            b = boxes[j];
          expect(
            a.right <= b.x ||
              b.right <= a.x ||
              a.bottom <= b.y ||
              b.bottom <= a.y,
          ).toBe(true);
        }
    }
    console.log("PASS: " + game + " route and arena");
  }
  failSubmit = true;
  await prepare("flappy", "OFFLINE");
  await page.waitForURL("**/challenge/OFFLINE", { timeout: 20000 });
  await expect(
    page.getByRole("button", { name: "RETRY SCORE UPLOAD" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(
          JSON.parse(localStorage.getItem("altameta:cloud:smoke-user")).data[
            "altameta:pendingScore:OFFLINE"
          ],
        ).score,
    ),
  ).toBeGreaterThanOrEqual(0);
  failSubmit = false;
  await page.getByRole("button", { name: "RETRY SCORE UPLOAD" }).click();
  await expect(
    page.getByRole("button", { name: "RETRY SCORE UPLOAD" }),
  ).toHaveCount(0);
  expect(await balance()).toBe(10000);
  console.log("PASS: offline score recovery and IN PERSON balance isolation");
  await page.goto("http://127.0.0.1:5173/challenge/SMOKE-stack");
  await expect(
    page.getByRole("button", { name: "PLAY YOUR RUN" }),
  ).toBeVisible();
  console.log("PASS: earlier friend session survives newer challenges");
  expect(errors).toEqual([]);
  console.log("PASS: no browser page errors");
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
