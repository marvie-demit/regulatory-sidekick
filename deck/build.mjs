// Build a document to PDF.
//
//   node deck/build.mjs            → pitch-deck.html   (16:9 landscape, 20 sheets)
//   node deck/build.mjs one-pager  → one-pager.html    (A4 portrait, 1 sheet)
//
// Page size comes from each document's own CSS @page rule — we pass
// preferCSSPageSize, so a new target needs no change here.
//
// Why this isn't just `chrome --print-to-pdf`:
//
//   1. Chrome refuses to apply a stylesheet linked over file:// (each file is
//      its own opaque origin), so the linked fonts.css silently renders in a
//      system font. The authored pitch-deck.html keeps the <link> so it stays
//      readable and editable; step 1 emits a self-contained .build.html.
//   2. The `--print-to-pdf` CLI switch snapshots the page before webfonts
//      resolve — verified here: it embedded only Segoe UI / Georgia fallbacks
//      even with the faces inlined as data URIs. Driving Chrome over the
//      DevTools Protocol lets us await document.fonts.ready first, and lets us
//      pass preferCSSPageSize so the CSS @page (13.333in x 7.5in = 16:9) wins.
//
// Edit pitch-deck.html, re-run this, and the PDF is regenerated and verified.

import { readFileSync, writeFileSync, existsSync, rmSync, statSync, mkdtempSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { inflateSync } from "node:zlib";

const here = dirname(fileURLToPath(import.meta.url));

const TARGETS = {
  "pitch-deck": "Regulatory-Sidekick-Pitch-Deck.pdf",
  "one-pager": "Regulatory-Sidekick-One-Pager.pdf",
};
const target = process.argv[2] ?? "pitch-deck";
if (!TARGETS[target])
  throw new Error(`Unknown target "${target}". Try: ${Object.keys(TARGETS).join(", ")}`);

const SRC = join(here, `${target}.html`);
const FONTS = join(here, "fonts.css");
const BUILD = join(here, `${target}.build.html`);
const PDF = join(here, TARGETS[target]);
const PORT = 9333;

const CHROME = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
].find((p) => existsSync(p));
if (!CHROME) throw new Error("No Chrome/Edge found to render the PDF.");

// --- 1. inline the fonts ---------------------------------------------------
const linkTag = '<link rel="stylesheet" href="fonts.css" />';
const html = readFileSync(SRC, "utf8");
if (!html.includes(linkTag))
  throw new Error(`Expected ${linkTag} in ${target}.html — did the head change?`);
writeFileSync(BUILD, html.replace(linkTag, `<style>\n${readFileSync(FONTS, "utf8")}</style>`));

// --- 2. render over CDP ----------------------------------------------------
const profile = mkdtempSync(join(tmpdir(), "deck-chrome-"));
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${PORT}`,
    "about:blank",
  ],
  { stdio: "ignore" },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function browserWsUrl() {
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (r.ok) return (await r.json()).webSocketDebuggerUrl;
    } catch {}
    await sleep(100);
  }
  throw new Error("Chrome never opened its debugging port.");
}

function cdp(ws) {
  let id = 0;
  const pending = new Map();
  const listeners = [];
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    } else listeners.forEach((fn) => fn(msg));
  });
  return {
    send(method, params = {}, sessionId) {
      const m = { id: ++id, method, params, ...(sessionId ? { sessionId } : {}) };
      ws.send(JSON.stringify(m));
      return new Promise((resolve, reject) => pending.set(m.id, { resolve, reject }));
    },
    once(method, sessionId) {
      return new Promise((resolve) => {
        const fn = (msg) => {
          if (msg.method === method && (!sessionId || msg.sessionId === sessionId)) {
            listeners.splice(listeners.indexOf(fn), 1);
            resolve(msg.params);
          }
        };
        listeners.push(fn);
      });
    },
  };
}

let pdfBase64, fontsOk;
try {
  const ws = new WebSocket(await browserWsUrl());
  await new Promise((res, rej) => {
    ws.addEventListener("open", res, { once: true });
    ws.addEventListener("error", rej, { once: true });
  });
  const c = cdp(ws);

  const { targetId } = await c.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await c.send("Target.attachToTarget", { targetId, flatten: true });

  await c.send("Page.enable", {}, sessionId);
  const loaded = c.once("Page.loadEventFired", sessionId);
  await c.send("Page.navigate", { url: `file:///${BUILD.replace(/\\/g, "/")}` }, sessionId);
  await loaded;

  // THE point of using CDP: don't print until the faces are actually resolved.
  const probe = await c.send(
    "Runtime.evaluate",
    {
      expression: `document.fonts.ready.then(() => [
        document.fonts.status,
        document.fonts.check("16px Geist"),
        document.fonts.check("16px Fraunces"),
      ].join("|"))`,
      awaitPromise: true,
      returnByValue: true,
    },
    sessionId,
  );
  fontsOk = probe.result.value;

  const res = await c.send(
    "Page.printToPDF",
    { printBackground: true, preferCSSPageSize: true, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0 },
    sessionId,
  );
  pdfBase64 = res.data;
  ws.close();
} finally {
  chrome.kill();
}

if (existsSync(PDF)) rmSync(PDF, { force: true });
writeFileSync(PDF, Buffer.from(pdfBase64, "base64"));

// --- 3. verify -------------------------------------------------------------
const buf = readFileSync(PDF);
const raw = buf.toString("latin1");
let inflated = "";
const re = /stream\r?\n/g;
let m;
while ((m = re.exec(raw))) {
  const s = m.index + m[0].length;
  const e = raw.indexOf("endstream", s);
  if (e < 0) continue;
  try {
    inflated += inflateSync(buf.subarray(s, e)).toString("latin1");
  } catch {}
}
const all = raw + inflated;
const faces = [...new Set([...all.matchAll(/\/BaseFont\s*\/([A-Za-z0-9+\-]+)/g)].map((x) => x[1]))];
const pages = (raw.match(/\/Type\s*\/Page[^s]/g) || []).length;
const box = (raw.match(/\/MediaBox\s*\[([^\]]+)\]/) || [])[1] ?? "0 0 0 0";
const [, , w, h] = box.split(/\s+/).map(Number);

console.log(`fonts.ready : ${fontsOk}   (status|Geist|Fraunces)`);
console.log(`pages       : ${pages}`);
console.log(`page size   : ${(w / 72).toFixed(3)}in x ${(h / 72).toFixed(3)}in`);
console.log(`embedded    : ${faces.join(", ") || "(none)"}`);
console.log(`size        : ${(statSync(PDF).size / 1024).toFixed(0)} KB`);

const brand = faces.filter((f) => /Geist|Fraunces/i.test(f));
if (brand.length < 2) {
  console.error("\n✗ Brand faces missing from the PDF.");
  process.exit(1);
}
console.log("\n✓ Brand faces embedded — deck matches the app.");
