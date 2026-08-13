// Generate the bundle icon as a 512x512 PNG, with no image dependency.
//
// A .mcpb needs an icon and Claude Desktop shows it in the extensions list. A
// binary blob checked into the repo is a thing nobody can review or change; a
// script is both. PNG is a small enough format to write directly: a header,
// one zlib-compressed IDAT of filtered scanlines, and an end chunk.
//
//   node scripts/make-icon.mjs
//
// The mark: a document on the brand teal, with a coral rule where a signature
// would go — the product is drafts a human still has to sign.

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, "..", "assets", "icon.png");
const S = 512;

// Brand colours, matching app/globals.css.
const TEAL = [15, 61, 58];
const CREAM = [247, 244, 236];
const CORAL = [214, 90, 58];
const LINE = [206, 199, 185];

const px = Buffer.alloc(S * S * 3);
const set = (x, y, [r, g, b]) => {
  if (x < 0 || y < 0 || x >= S || y >= S) return;
  const i = (y * S + x) * 3;
  px[i] = r;
  px[i + 1] = g;
  px[i + 2] = b;
};

// Background.
for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) set(x, y, TEAL);

// The page: a portrait rectangle, centred, with a folded corner cut away.
const PW = 250;
const PH = 320;
const PX = (S - PW) / 2;
const PY = (S - PH) / 2;
const FOLD = 62;

for (let y = PY; y < PY + PH; y++) {
  for (let x = PX; x < PX + PW; x++) {
    // Cut the top-right corner on the diagonal.
    const fromRight = PX + PW - x;
    const fromTop = y - PY;
    if (fromTop < FOLD && fromRight < FOLD - fromTop) continue;
    set(x, y, CREAM);
  }
}
// The fold's own edge, so the corner reads as folded rather than clipped.
for (let t = 0; t < FOLD; t++) {
  set(PX + PW - (FOLD - t), PY + t, LINE);
  set(PX + PW - (FOLD - t) + 1, PY + t, LINE);
}

// Text lines. Regular grey rules, then a coral one: the signature that is not
// the agent's to write.
const lineX = PX + 34;
const lineW = PW - 68;
const rule = (top, w, colour, thick = 9) => {
  for (let y = top; y < top + thick; y++)
    for (let x = lineX; x < lineX + w; x++) set(x, y, colour);
};

let top = PY + 96;
for (let i = 0; i < 4; i++) {
  rule(top, i === 3 ? Math.round(lineW * 0.55) : lineW, LINE);
  top += 34;
}
rule(top + 26, Math.round(lineW * 0.72), CORAL, 13);

// --- encode ---------------------------------------------------------------

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(S, 0);
ihdr.writeUInt32BE(S, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // colour type: truecolour
// 10..12 = compression, filter, interlace — all 0

// Each scanline is prefixed with its filter byte. Filter 0 (none) keeps this
// honest and simple; the image is flat colour, so it compresses regardless.
const raw = Buffer.alloc(S * (S * 3 + 1));
for (let y = 0; y < S; y++) {
  raw[y * (S * 3 + 1)] = 0;
  px.copy(raw, y * (S * 3 + 1) + 1, y * S * 3, (y + 1) * S * 3);
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, png);
console.log(`icon: ${S}x${S} PNG — ${(png.length / 1024).toFixed(1)} KB`);
