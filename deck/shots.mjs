// Screenshot individual sheets at full resolution for visual review.
//
//   node deck/shots.mjs 1 5 9          → pitch-deck sheets 1, 5, 9
//   node deck/shots.mjs one-pager 1    → the one-pager
//
// Writes deck/shots/<target>-NN.png. Uses the same CDP path as build.mjs so
// what you see is what the PDF renderer sees. Sheet geometry is MEASURED from
// the DOM rather than assumed, so this works for any page size (16:9 landscape
// or A4 portrait) without a hard-coded height/gap.

import { existsSync, mkdirSync, writeFileSync, mkdtempSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, "shots");
mkdirSync(OUT, { recursive: true });

const argv = process.argv.slice(2);
const target = /^\d+$/.test(argv[0] ?? "1") ? "pitch-deck" : argv.shift();
const BUILD = join(here, `${target}.build.html`);
const want = (argv.length ? argv : ["1"]).map(Number);

const CHROME = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].find((p) => existsSync(p));

const PORT = 9334;
const profile = mkdtempSync(join(tmpdir(), "deck-shot-"));
const chrome = spawn(
  CHROME,
  ["--headless=new", "--disable-gpu", "--no-sandbox", "--no-first-run",
   `--user-data-dir=${profile}`, `--remote-debugging-port=${PORT}`,
   "--window-size=1280,720", "about:blank"],
  { stdio: "ignore" },
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  let wsUrl;
  for (let i = 0; i < 100 && !wsUrl; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (r.ok) wsUrl = (await r.json()).webSocketDebuggerUrl;
    } catch {}
    if (!wsUrl) await sleep(100);
  }
  const ws = new WebSocket(wsUrl);
  await new Promise((res) => ws.addEventListener("open", res, { once: true }));

  let id = 0;
  const pending = new Map();
  const evs = [];
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
    else evs.forEach((f) => f(m));
  });
  const send = (method, params = {}, sessionId) =>
    new Promise((res) => {
      const m = { id: ++id, method, params, ...(sessionId ? { sessionId } : {}) };
      pending.set(m.id, res);
      ws.send(JSON.stringify(m));
    });
  const once = (method, sid) =>
    new Promise((res) => {
      const f = (m) => { if (m.method === method && (!sid || m.sessionId === sid)) { evs.splice(evs.indexOf(f), 1); res(m.params); } };
      evs.push(f);
    });

  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Page.enable", {}, sessionId);
  const loaded = once("Page.loadEventFired", sessionId);
  await send("Page.navigate", { url: `file:///${BUILD.replace(/\\/g, "/")}` }, sessionId);
  await loaded;
  await send("Runtime.evaluate", { expression: "document.fonts.ready", awaitPromise: true }, sessionId);

  // Measure each sheet's real position and size — no assumptions about page
  // geometry, so landscape slides and A4 portrait both work.
  const rects = await send(
    "Runtime.evaluate",
    {
      expression: `JSON.stringify([...document.querySelectorAll('.sheet')].map(el => {
        const r = el.getBoundingClientRect();
        return { x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height };
      }))`,
      returnByValue: true,
    },
    sessionId,
  );
  const boxes = JSON.parse(rects.result.value);

  for (const n of want) {
    const b = boxes[n - 1];
    if (!b) {
      console.warn(`sheet ${n} does not exist (${boxes.length} in ${target})`);
      continue;
    }
    const { data } = await send(
      "Page.captureScreenshot",
      { format: "png", captureBeyondViewport: true,
        clip: { x: b.x, y: b.y, width: b.w, height: b.h, scale: 1 } },
      sessionId,
    );
    const p = join(OUT, `${target}-${String(n).padStart(2, "0")}.png`);
    writeFileSync(p, Buffer.from(data, "base64"));
    console.log(`wrote ${p}  (${Math.round(b.w)}x${Math.round(b.h)})`);
  }
  ws.close();
} finally {
  chrome.kill();
}
