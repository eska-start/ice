import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const base = (process.env.SMOKE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const segment = process.argv[2] ?? "all";
const captureScreens = process.env.SMOKE_SCREENSHOTS !== "0";

async function prepareSoftwareRenderer(context) {
  // Only the isolated CI profile is throttled. Real players retain the original
  // game's graphics preferences, rendering loop, and local save data.
  await context.addInitScript(() => {
    localStorage.setItem(
      "animal-village-icetag-v1",
      JSON.stringify({ quality: "low", sound: false }),
    );
    window.requestAnimationFrame = (callback) =>
      window.setTimeout(() => callback(performance.now()), 150);
    window.cancelAnimationFrame = (id) => window.clearTimeout(id);
  });
}

function watch(page, errors) {
  page.on("pageerror", (error) => errors.add(error.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /THREE\.WebGLProgram|Shader Error|Error creating WebGL context/.test(message.text())
    ) {
      errors.add(message.text());
    }
  });
}

async function checkDesktop(browser, errors) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
  try {
    await prepareSoftwareRenderer(context);
    const page = await context.newPage();
    watch(page, errors);
    await page.goto(base, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /게임 시작/ }).waitFor({
      state: "visible", timeout: 30000,
    });
    await page.waitForTimeout(1000);
    assert.ok(await page.locator("canvas").count() > 0, "Desktop menu has a 3D canvas");
    if (captureScreens) await page.screenshot({ path: ".checks/ice-tag-desktop.png" });
    console.log("PASS: desktop game menu and 3D canvas");

    await page.getByRole("button", { name: /게임 시작/ }).click();
    await page.getByText("MODE SELECT", { exact: true }).waitFor({ state: "visible" });
    await page.getByRole("button").filter({ hasText: "얼음땡" }).first().click();
    await page.getByRole("button", { name: /얼음땡\s+시작/ }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: /얼음땡\s+시작/ }).click();
    await page.getByText(/^ROUND/).first().waitFor({ state: "visible", timeout: 30000 });
    await page.waitForTimeout(1000);
    if (captureScreens) await page.screenshot({ path: ".checks/ice-tag-gameplay.png" });
    await page.keyboard.down("KeyW");
    await page.waitForTimeout(200);
    await page.keyboard.up("KeyW");
    await page.keyboard.press("Escape");
    await page.getByText("일시정지", { exact: true }).waitFor({ state: "visible" });
    await page.getByRole("button", { name: "메인 메뉴", exact: true }).click();
    await page.getByRole("button", { name: /게임 시작/ }).waitFor({ state: "visible" });
    console.log("PASS: mode selection, single-player start, keyboard pause and menu return");
  } finally {
    await context.close();
  }
}

async function checkMobile(browser, errors) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
    ignoreHTTPSErrors: true,
  });
  try {
    await prepareSoftwareRenderer(context);
    const page = await context.newPage();
    watch(page, errors);
    await page.goto(base, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /게임 시작/ }).waitFor({
      state: "visible", timeout: 30000,
    });
    await page.waitForTimeout(1000);
    if (captureScreens) await page.screenshot({ path: ".checks/ice-tag-mobile.png" });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      true,
      "Mobile menu has no horizontal overflow",
    );
    console.log("PASS: mobile game menu without horizontal overflow");

    await page.goto(`${base}/archives`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "압축파일 업로드", exact: true }).waitFor({ state: "visible" });
    const listing = await context.request.get(`${base}/api/files`);
    assert.equal(listing.status(), 200);
    assert.ok(Array.isArray((await listing.json()).files), "Database-backed file listing is available");
    console.log("PASS: original archive uploader and database-backed file API preserved");

    for (const file of ["menu-bg.jpg", "map-plaza.jpg", "map-beach.jpg", "map-snow.jpg", "map-night.jpg"]) {
      const response = await context.request.get(`${base}/images/${file}`);
      assert.equal(response.status(), 200, file);
    }
    assert.equal((await context.request.get(`${base}/api/health`)).status(), 200);
    console.log("PASS: all game image assets and API health");
  } finally {
    await context.close();
  }
}

async function main() {
  assert.ok(["all", "desktop", "mobile"].includes(segment), "Use desktop, mobile, or all");
  if (captureScreens) await mkdir(".checks", { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--enable-webgl", "--ignore-gpu-blocklist", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  try {
    const errors = new Set();
    if (segment !== "mobile") await checkDesktop(browser, errors);
    if (segment !== "desktop") await checkMobile(browser, errors);
    assert.deepEqual([...errors], [], "No JavaScript runtime or shader errors");
    console.log(`PASS: ${segment} browser checks; zero runtime or shader errors`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
