/**
 * 경찰과 도둑 모드 검증 (Playwright).
 *  node scripts/smoke-police.mjs flow    → 게임 시작 → 모드 3개 → 세 모드 모두 실제 실행
 *  node scripts/smoke-police.mjs rules   → 체포 · 구출 · 탈출 · 승패 · 역할 랜덤 (실제 게임 인스턴스로 검증)
 *  node scripts/smoke-police.mjs ai      → AI끼리 여러 판 시뮬레이션 (규칙 종료 · 교착 여부)
 *  node scripts/smoke-police.mjs shots   → 화면 캡처
 */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const base = (process.env.SMOKE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const segment = process.argv[2] ?? "flow";

async function launch() {
  await mkdir(".checks", { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--enable-webgl", "--ignore-gpu-blocklist", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, ignoreHTTPSErrors: true });
  // 하드웨어 GPU가 없는 테스트 브라우저 전용: 저화질 + 느린 프레임 (실제 사용자 설정에는 영향 없음)
  await context.addInitScript(() => {
    localStorage.setItem("animal-village-icetag-v1", JSON.stringify({ quality: "low", sound: false }));
    window.requestAnimationFrame = (cb) => window.setTimeout(() => cb(performance.now()), 120);
    window.cancelAnimationFrame = (id) => window.clearTimeout(id);
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && /THREE\.|Shader Error|WebGL context/.test(m.text())) errors.push(m.text());
  });
  return { browser, context, page, errors };
}

/** 테스트 전용: React 파이버에서 현재 실행 중인 Game 인스턴스를 찾아 window.__g 에 저장 */
async function grabGame(page) {
  await page.waitForFunction(() => !!document.querySelector("canvas"), null, { timeout: 30000 });
  const ok = await page.evaluate(() => {
    const el = document.querySelector("canvas")?.parentElement;
    if (!el) return false;
    const key = Object.keys(el).find((k) => k.startsWith("__reactFiber$"));
    let fiber = key ? el[key] : null;
    while (fiber) {
      let h = fiber.memoizedState;
      while (h && typeof h === "object") {
        const v = h.memoizedState;
        if (v && typeof v === "object" && v.current && v.current.chars && v.current.mode && v.current.police !== undefined) {
          window.__g = v.current;
          return true;
        }
        h = h.next;
      }
      fiber = fiber.return;
    }
    return false;
  });
  assert.ok(ok, "실행 중인 Game 인스턴스를 찾지 못했습니다");
}

async function openModeSelect(page) {
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /게임 시작/ }).waitFor({ state: "visible", timeout: 30000 });
  await page.getByRole("button", { name: /게임 시작/ }).click();
  await page.getByText("MODE SELECT", { exact: true }).waitFor({ state: "visible", timeout: 30000 });
}

async function startMode(page, modeName, startLabel) {
  await page.getByRole("button").filter({ hasText: modeName }).first().click();
  await page.getByRole("button", { name: startLabel }).waitFor({ state: "visible", timeout: 30000 });
  await page.getByRole("button", { name: startLabel }).click();
  await grabGame(page);
}

async function backToMenu(page) {
  await page.keyboard.press("Escape");
  await page.getByText("일시정지", { exact: true }).waitFor({ state: "visible", timeout: 15000 });
  await page.getByRole("button", { name: "메인 메뉴", exact: true }).click();
  await page.getByRole("button", { name: /게임 시작/ }).waitFor({ state: "visible", timeout: 30000 });
}

// ---------------------------------------------------------------------------------------------- flow
async function flow() {
  const { browser, page, errors } = await launch();
  try {
    await openModeSelect(page);
    const cards = page.getByText("LIVE 3D PREVIEW", { exact: true });
    assert.equal(await cards.count(), 3, "모드 카드는 정확히 3개여야 합니다");
    const names = await page.evaluate(() =>
      [...document.querySelectorAll("button")].filter((b) => b.textContent.includes("LIVE 3D PREVIEW")).map((b) => b.textContent),
    );
    for (const n of ["얼음땡", "오재미", "경찰과 도둑"]) assert.ok(names.some((t) => t.includes(n)), `${n} 카드 없음`);
    assert.ok(!names.some((t) => t.includes("undefined")), "카드 텍스트 오류");
    await page.screenshot({ path: ".checks/mode-select.png" });
    console.log("PASS: 게임 시작 → 모드 선택에 정확히 3개 (얼음땡 · 오재미 · 경찰과 도둑)");

    // 기존 얼음땡 그대로 실행
    await startMode(page, "얼음땡", /얼음땡\s+시작/);
    let info = await page.evaluate(() => ({ mode: __g.mode, n: __g.chars.length, police: __g.police, rounds: __g.totalRounds, time: __g.time }));
    assert.deepEqual([info.mode, info.n, info.police, info.rounds], ["icetag", 6, null, 3]);
    assert.ok(info.time > 80 && info.time <= 90, "얼음땡 제한시간 90초 유지");
    console.log("PASS: 얼음땡 선택 → 기존 얼음땡 실행 (6명 · 3라운드 · 90초 · 감옥 없음)");
    await backToMenu(page);

    // 기존 오재미 그대로 실행
    await page.getByRole("button", { name: /게임 시작/ }).click();
    await page.getByText("MODE SELECT", { exact: true }).waitFor({ state: "visible" });
    await startMode(page, "오재미", /오재미\s+.*시작/);
    info = await page.evaluate(() => ({ mode: __g.mode, n: __g.chars.length, police: __g.police, rounds: __g.totalRounds }));
    assert.deepEqual([info.mode, info.n, info.police, info.rounds], ["ojaemi", 6, null, 1]);
    console.log("PASS: 오재미 선택 → 기존 오재미 실행 (3 VS 3 · 감옥 없음)");
    await backToMenu(page);

    // 경찰과 도둑: 실제 게임 실행
    await page.getByRole("button", { name: /게임 시작/ }).click();
    await page.getByText("MODE SELECT", { exact: true }).waitFor({ state: "visible" });
    await page.getByRole("button").filter({ hasText: "경찰과 도둑" }).first().click();
    await page.getByText("역할은 시작할 때 무작위로 정해져요").waitFor({ state: "visible", timeout: 30000 });
    assert.equal(await page.getByRole("button", { name: /멀티플레이/ }).isDisabled(), true, "경찰과 도둑은 싱글 전용");
    await page.screenshot({ path: ".checks/police-setup.png" });
    await page.getByRole("button", { name: /경찰과 도둑\s+시작/ }).click();
    await grabGame(page);
    info = await page.evaluate(() => {
      const g = __g;
      const cops = g.chars.filter((c) => c.role === "tagger");
      const robbers = g.chars.filter((c) => c.role === "runner");
      return {
        mode: g.mode, n: g.chars.length, cops: cops.length, robbers: robbers.length, hasPolice: !!g.police,
        copTeams: [...new Set(cops.map((c) => c.team))], robTeams: [...new Set(robbers.map((c) => c.team))],
        time: g.time, exits: g.police.exits.length, jail: [g.police.jail.x, g.police.jail.z],
        playerRole: g.player.role, ai: g.chars.filter((c) => !c.isPlayer).length,
      };
    });
    assert.equal(info.mode, "police");
    assert.equal(info.n, 6);
    assert.deepEqual([info.cops, info.robbers], [3, 3]);
    assert.deepEqual(info.copTeams, ["blue"]);
    assert.deepEqual(info.robTeams, ["red"]);
    assert.ok(info.hasPolice && info.exits === 2, "감옥과 탈출구 2개 생성");
    assert.equal(info.ai, 5, "플레이어 1명 + AI 5명");
    console.log(`PASS: 경찰과 도둑 선택 → 실제 게임 실행 (경찰 3 · 도둑 3 · 탈출구 2 · 내 역할: ${info.playerRole === "tagger" ? "경찰" : "도둑"})`);
    await page.getByText(/경찰과 도둑 · \d+ SEC/).first().waitFor({ state: "visible", timeout: 20000 });
    await page.waitForFunction(() => __g.phase === "playing", null, { timeout: 90000 });
    console.log("PASS: 카운트다운 종료 후 플레이 시작");
    assert.deepEqual(errors, [], "런타임/셰이더 오류 없음");
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------------------------- rules
// 소프트웨어 렌더링 환경은 프레임이 느리므로, 규칙 검증은 게임 루프를 직접(update) 구동해 결정적으로 확인한다.
async function rules() {
  const { browser, page, errors } = await launch();
  try {
    await openModeSelect(page);
    await startMode(page, "경찰과 도둑", /경찰과 도둑\s+시작/);
    await page.waitForFunction(() => __g.phase === "playing", null, { timeout: 90000 });
    await page.evaluate(() => {
      window.__step = (n) => { for (let i = 0; i < n; i++) __g.update(0.05); };
      window.__free = (x, z, r) => { // (x,z) 근처에서 이동 가능한 자리
        for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (__g.nav.isFree(px, pz)) return [px, pz]; }
        return [x, z];
      };
    });

    // 기본 위치 / 충돌체 / 감옥 구조
    const geo = await page.evaluate(() => {
      const g = __g, j = g.police.jail;
      const walls = g.world.colliders.filter((c) => c.type === "box" && Math.abs(c.x - j.x) < 2.2 && Math.abs(c.z - j.z) < 2.2);
      const blocked = g.chars.filter((c) => !g.nav.isFree(c.pos.x, c.pos.z)).length;
      return { walls: walls.length, blocked, exits: g.police.exits, jail: [j.x, j.z] };
    });
    assert.ok(geo.walls >= 4, "감옥 창살 충돌체 4개 이상");
    assert.equal(geo.blocked, 0, "모든 캐릭터가 이동 가능한 자리에서 시작");
    console.log(`PASS: 감옥(${geo.jail.map((v) => v.toFixed(1))}) · 탈출구 ${geo.exits.map((e) => `(${e.x.toFixed(1)},${e.z.toFixed(1)})`).join(" ")} · 시작 위치 유효`);

    // ---- 체포: 경찰이 닿으면 도둑은 감옥으로
    const arrest = await page.evaluate(() => {
      const g = __g, j = g.police.jail;
      const cop = g.chars.find((c) => c.role === "tagger" && c.status === "alive");
      const r = g.chars.find((c) => c.role === "runner" && c.status === "alive");
      const tagsBefore = cop.st.tags;
      // AI 도둑은 붙으면 비상 대시로 빠져나갈 수 있어(정상 동작) 검증 동안만 잠시 행동불능 처리
      r.pos.set(cop.pos.x + 0.6, 0, cop.pos.z); r.grace = 0; r.stun = 5; r.stunType = "hit";
      __step(3);
      return { status: r.status, d: Math.hypot(r.pos.x - j.x, r.pos.z - j.z), tags: cop.st.tags - tagsBefore, label: !!r.label };
    });
    assert.equal(arrest.status, "frozen", "체포된 도둑은 수감 상태");
    assert.ok(arrest.d < 1.7, "체포된 도둑은 감옥 안으로 이동");
    assert.equal(arrest.tags, 1);
    console.log("PASS: 경찰이 도둑에게 닿으면 체포 → 감옥으로 이동");

    // ---- 갇힌 도둑은 스스로 움직일 수 없다 / 창살은 통과 불가
    const held = await page.evaluate(() => {
      const g = __g, j = g.police.jail;
      const prisoner = g.chars.find((c) => c.status === "frozen");
      const x0 = prisoner.pos.x, z0 = prisoner.pos.z;
      prisoner.move.set(1, 0, 0);
      __step(20);
      const free = g.chars.find((c) => c.role === "runner" && c.status === "alive");
      const [sx, sz] = __free(j.x, j.z, 2.6);
      free.pos.set(sx, 0, sz); free.vel.set(0, 0, 0); free.grace = 99;
      const dir = Math.atan2(j.x - sx, j.z - sz);
      for (let i = 0; i < 30; i++) { free.vel.set(Math.sin(dir) * 6, 0, Math.cos(dir) * 6); free.move.set(Math.sin(dir), 0, Math.cos(dir)); g.update(0.05); }
      const inside = Math.abs(free.pos.x - j.x) < 1.4 && Math.abs(free.pos.z - j.z) < 1.4;
      free.grace = 0;
      return { moved: Math.hypot(prisoner.pos.x - x0, prisoner.pos.z - z0), inside };
    });
    assert.ok(held.moved < 0.05, "수감된 도둑은 제자리");
    assert.equal(held.inside, false, "창살은 통과할 수 없음");
    console.log("PASS: 갇힌 도둑은 움직일 수 없고, 창살 안으로는 들어갈 수 없음");

    // ---- 구출: 경찰이 막지 못하는 동안 다른 도둑이 감옥에 접근해 머문다
    const rescue = await page.evaluate(() => {
      const g = __g, j = g.police.jail;
      g.chars.filter((c) => c.role === "tagger").forEach((c) => { c.stun = 99; c.stunType = "hit"; });
      const prisoner = g.chars.find((c) => c.status === "frozen");
      const rescuer = g.chars.find((c) => c.role === "runner" && c.status === "alive");
      rescuer.grace = 0; rescuer.stun = 0;
      const [sx, sz] = __free(j.x, j.z, 2.5);
      let progress = 0, steps = 0;
      while (prisoner.status === "frozen" && steps < 80) {
        rescuer.pos.set(sx, 0, sz); rescuer.vel.set(0, 0, 0); rescuer.move.set(0, 0, 0); rescuer.ai.goal = null;
        g.update(0.05); steps++; progress = Math.max(progress, g.rescueT);
      }
      return { after: prisoner.status, progress, steps, thaws: rescuer.st.thaws, d: Math.hypot(prisoner.pos.x - j.x, prisoner.pos.z - j.z) };
    });
    assert.ok(rescue.progress > 0.3, "구출 게이지가 차올라야 함");
    assert.ok(rescue.steps >= 20, `순간 구출이 아니라 잠시 머물러야 함 (${rescue.steps}스텝)`);
    assert.equal(rescue.after, "alive", "구출되면 풀려남");
    assert.ok(rescue.d > 2.3, "풀려난 도둑은 감옥 밖에 위치");
    assert.ok(rescue.thaws >= 1);
    console.log(`PASS: 다른 도둑이 감옥에 접근해 ${(rescue.steps * 0.05).toFixed(1)}초 머물면 갇힌 도둑 구출`);

    // ---- 탈출구는 열리기 전에는 작동하지 않는다
    const locked = await page.evaluate(() => {
      const g = __g, e = g.police.exits[0];
      const r = g.chars.find((c) => c.role === "runner" && c.status === "alive");
      const wasOpen = g.exitOpen;
      const [ex, ez] = __free(e.x, e.z, 0.2);
      r.pos.set(ex, 0, ez); r.stun = 0; r.grace = 5;
      __step(4);
      return { wasOpen, status: r.status, phase: g.phase, policeT: g.policeT };
    });
    assert.equal(locked.wasOpen, false, "초기에는 탈출구 잠김");
    assert.equal(locked.status, "alive", "잠긴 탈출구에서는 탈출 불가");
    assert.equal(locked.phase, "playing");
    console.log("PASS: 탈출구는 열리기 전에는 탈출 불가");

    // ---- 탈출: 열린 탈출구에 도착하면 탈출 → 도둑팀 승리
    const esc = await page.evaluate(() => {
      const g = __g;
      // 열리는 순간 탈출구 위에 서 있던 도둑이 바로 탈출하지 않도록 모두 중립 위치로 이동
      const [nx, nz] = __free(2, 9, 0.1);
      g.chars.filter((c) => c.role === "runner" && c.status === "alive").forEach((c) => { c.pos.set(nx, 0, nz); c.vel.set(0, 0, 0); c.grace = 5; });
      g.policeT = 20.5; __step(3);
      const open = g.exitOpen;
      const e = g.police.exits[1];
      const r = g.chars.find((c) => c.role === "runner" && c.status === "alive");
      r.stun = 0; r.pos.set(e.x + 0.3, 0, e.z);
      __step(3);
      return { open, status: r.status, phase: g.phase, res: g.roundResults[0] ?? null, flagged: r.rs.out };
    });
    assert.equal(esc.open, true, "20초 후 탈출구 개방");
    assert.equal(esc.status, "out", "도착한 도둑은 탈출");
    assert.equal(esc.phase, "roundEnd");
    assert.deepEqual([esc.res.winner, esc.res.reason], ["runner", "escaped"]);
    console.log("PASS: 탈출구 개방(20초) → 도착한 도둑 탈출 → 도둑팀 승리");

    // ---- 결과 화면
    await page.evaluate(() => { let n = 0; while (__g.phase !== "final" && n++ < 400) __g.update(0.05); });
    await page.getByText(/도둑팀 승리 · 탈출 성공/).waitFor({ state: "visible", timeout: 20000 });
    await page.screenshot({ path: ".checks/police-final-escape.png" });
    console.log("PASS: 결과 화면에 경찰과 도둑 전용 요약 표시");

    // ---- 경찰 승리: 모든 도둑 체포
    const copWin = await page.evaluate(() => {
      const g = __g;
      g.restart(); g.phase = "playing"; g.phaseT = 0;
      const cop = g.chars.find((c) => c.role === "tagger");
      cop.stun = 0;
      for (const r of g.chars.filter((c) => c.role === "runner")) {
        // AI 도둑은 붙으면 비상 대시로 빠져나가므로, 체포 규칙 검증을 위해 잠시 행동불능 처리
        r.grace = 0; r.stun = 5; r.stunType = "hit"; r.pos.set(cop.pos.x + 0.4, 0, cop.pos.z);
        __step(3);
      }
      return { phase: g.phase, res: g.roundResults[0] ?? null, jailed: g.chars.filter((c) => c.status === "frozen").length };
    });
    assert.equal(copWin.jailed, 3);
    assert.deepEqual([copWin.res.winner, copWin.res.reason], ["tagger", "all_jailed"]);
    console.log("PASS: 경찰이 모든 도둑을 잡으면 경찰팀 승리");

    // ---- 시간 종료: 도둑이 버티면 도둑팀 승리
    const timeUp = await page.evaluate(() => {
      const g = __g;
      g.restart(); g.phase = "playing"; g.phaseT = 0;
      g.chars.forEach((c) => { if (c.role === "tagger") { c.stun = 99; c.stunType = "hit"; } });
      g.time = 0.2;
      __step(10);
      return { res: g.roundResults[0] ?? null };
    });
    assert.deepEqual([timeUp.res.winner, timeUp.res.reason], ["runner", "timeout"]);
    console.log("PASS: 제한 시간 동안 도둑이 살아남으면 도둑팀 승리");

    // ---- 역할 랜덤 배정 (게임 시작마다)
    const roles = await page.evaluate(() => {
      const seen = { tagger: 0, runner: 0 };
      let bad = 0;
      for (let i = 0; i < 60; i++) {
        __g.restart();
        seen[__g.player.role]++;
        if (__g.chars.filter((c) => c.role === "tagger").length !== 3) bad++;
      }
      return { ...seen, bad };
    });
    assert.equal(roles.bad, 0, "항상 경찰 3 · 도둑 3");
    assert.ok(roles.tagger >= 10 && roles.runner >= 10, `역할 무작위 배정 (경찰 ${roles.tagger} / 도둑 ${roles.runner})`);
    console.log(`PASS: 시작할 때 역할 무작위 배정 (60회 중 경찰 ${roles.tagger} · 도둑 ${roles.runner}, 항상 3 VS 3)`);
    assert.deepEqual(errors, [], "런타임 오류 없음");
    console.log("PASS: 런타임/셰이더 오류 없음");
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------------------------- ai
async function ai() {
  const { browser, page, errors } = await launch();
  try {
    await openModeSelect(page);
    await startMode(page, "경찰과 도둑", /경찰과 도둑\s+시작/);
    const out = await page.evaluate(() => {
      const g = __g;
      g.chars.forEach((c) => { c.isPlayer = false; }); // 플레이어도 AI로 → 6명 전원 AI 대전
      const stats = { matches: 0, cops: 0, robbers: 0, escaped: 0, timeout: 0, allJailed: 0, arrests: 0, rescues: 0, maxJailed: 0, stuck: 0, secs: [] };
      const t0 = performance.now();
      for (let m = 0; m < 14 && performance.now() - t0 < 50000; m++) {
        g.restart();
        let steps = 0, lastMove = 0, frozenPos = 0;
        while (g.phase !== "final" && steps < 7000) {
          g.update(0.05);
          steps++;
          stats.maxJailed = Math.max(stats.maxJailed, g.chars.filter((c) => c.status === "frozen").length);
        }
        const r = g.roundResults[0];
        stats.matches++;
        if (!r) { stats.stuck++; continue; }
        if (r.winner === "tagger") { stats.cops++; stats.allJailed++; } else { stats.robbers++; if (r.reason === "escaped") stats.escaped++; else stats.timeout++; }
        stats.arrests += g.chars.reduce((a, c) => a + c.st.tags, 0);
        stats.rescues += g.chars.reduce((a, c) => a + c.st.thaws, 0);
        stats.secs.push(Math.round(180 - g.time));
      }
      return stats;
    });
    console.log("AI 대전 결과:", JSON.stringify(out));
    assert.equal(out.stuck, 0, "모든 판이 규칙대로 종료되어야 함 (교착 없음)");
    assert.ok(out.matches >= 6, "충분한 판 수 시뮬레이션");
    assert.ok(out.arrests > 0, "AI 경찰이 도둑을 체포함");
    const avg = out.secs.reduce((a, b) => a + b, 0) / Math.max(1, out.secs.length);
    console.log(`밸런스: 경찰 ${out.cops}승 · 도둑 ${out.robbers}승 · 평균 ${avg.toFixed(0)}초`);
    if (!(out.cops > 0 && out.robbers > 0)) console.warn("WARN: 한쪽 팀만 이기는 편향이 있습니다");
    console.log(`PASS: AI 6명 전원 대전 ${out.matches}판 — 경찰 ${out.cops}승 · 도둑 ${out.robbers}승 (탈출 ${out.escaped} · 시간 ${out.timeout}) · 체포 ${out.arrests} · 구출 ${out.rescues}`);
    assert.deepEqual(errors, [], "런타임 오류 없음");
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------------------------- shots
async function shots() {
  const { browser, page, errors } = await launch();
  try {
    await openModeSelect(page);
    await startMode(page, "경찰과 도둑", /경찰과 도둑\s+시작/);
    await page.waitForFunction(() => __g.phase === "playing", null, { timeout: 90000 });
    await page.evaluate(() => {
      const g = __g;
      // 감옥이 보이도록: 플레이어를 감옥 근처로, 도둑 한 명을 수감
      const j = g.police.jail;
      const cop = g.chars.find((c) => c.role === "tagger" && c !== g.player);
      const r = g.chars.find((c) => c.role === "runner" && c !== g.player);
      r.pos.set(cop.pos.x + 0.4, 0, cop.pos.z);
      g.policeT = 25;
      g.player.pos.set(j.x + 4.5, 0, j.z + 3);
    });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: ".checks/police-gameplay.png" });
    console.log("captured police-gameplay.png");
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
}

const table = { flow, rules, ai, shots };
assert.ok(table[segment], "flow | rules | ai | shots");
table[segment]().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
