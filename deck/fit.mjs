// Does a fixed-page document actually fit its page?
//
//   node deck/fit.mjs one-pager
//
// A one-pager silently fails: overflow gets clipped by the sheet, or squeezes a
// flex sibling, and the PDF still renders "successfully". This measures the
// real laid-out height of every section against the page box and reports the
// exact overflow, so trimming is arithmetic rather than guesswork.
//
// Run build.mjs first (it emits the .build.html this reads).

import { existsSync, mkdtempSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const target = process.argv[2] ?? "one-pager";
const BUILD = join(here, `${target}.build.html`);
if (!existsSync(BUILD)) throw new Error(`No ${target}.build.html — run build.mjs first.`);

const CHROME = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].find((p) => existsSync(p));

const PORT = 9335;
const profile = mkdtempSync(join(tmpdir(), "deck-fit-"));
const chrome = spawn(
  CHROME,
  ["--headless=new", "--disable-gpu", "--no-sandbox", "--no-first-run",
   `--user-data-dir=${profile}`, `--remote-debugging-port=${PORT}`, "about:blank"],
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

  const res = await send(
    "Runtime.evaluate",
    {
      // The number that matters is the gap between the last block and the
      // footer — NOT a sum of scrollHeights. An absolutely-positioned child
      // (the drawing title block) inflates the masthead's scrollHeight well
      // past its laid-out height, which reports phantom overflow.
      expression: `(() => {
        const r = el => el ? el.getBoundingClientRect() : null;
        const sheet = document.querySelector('.sheet');
        const mast = document.querySelector('.mast');
        const foot = document.querySelector('.foot');
        const blockEls = [...document.querySelectorAll('.block')];
        const blocks = blockEls.map(b => ({
          id: (b.querySelector('.sec')?.textContent || '?').trim(),
          label: (b.querySelector('.h')?.textContent || '').trim().slice(0, 46),
          h: Math.round(r(b).height),
        }));
        const last = blockEls[blockEls.length - 1];
        return JSON.stringify({
          page: Math.round(r(sheet).height),
          mast: mast ? Math.round(r(mast).height) : 0,
          foot: foot ? Math.round(r(foot).height) : 0,
          blocks,
          contentBottom: last ? Math.round(r(last).bottom) : 0,
          footTop: foot ? Math.round(r(foot).top) : Math.round(r(sheet).bottom),
        });
      })()`,
      returnByValue: true,
    },
    sessionId,
  );
  const m = JSON.parse(res.result.value);

  console.log(`page box     ${m.page}px`);
  console.log(`masthead     ${m.mast}px`);
  m.blocks.forEach((b) => console.log(`  ${b.id.padEnd(4)} ${String(b.h).padStart(4)}px  ${b.label}`));
  console.log(`footer       ${m.foot}px`);
  console.log(`─────────────────────`);
  console.log(`last block ends at ${m.contentBottom}px · footer starts at ${m.footTop}px`);

  const slack = m.footTop - m.contentBottom;
  if (slack < 0) console.error(`\n✗ OVERFLOWS by ${-slack}px — trim that much or it gets clipped.`);
  else console.log(`\n✓ fits, ${slack}px of slack before the footer.`);
  process.exitCode = slack < 0 ? 1 : 0;
  ws.close();

} finally {
  chrome.kill();
}
