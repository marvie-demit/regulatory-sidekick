"use client";

import { useEffect, useRef } from "react";

// Immersive landing backdrop: a life-science composition rendered on the GPU —
// two drifting double helices, a suspension of molecular nodes and bonds, over
// a soft warped assay field. Tinted with the brand tokens from globals.css.
//
// Deliberately restrained: the landing copy sits on top of it, so the helices
// are placed out toward the thirds, everything stays high-luminance, and a
// cream veil is multiplied back in over the centre to keep the headline at
// full contrast. If WebGL is unavailable the canvas never paints and the CSS
// gradient underneath shows instead.

const VERT = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FRAG = `
precision highp float;

uniform vec2  u_res;
uniform float u_time;
uniform vec2  u_pointer;
// Half-width of the copy column, in the same height-normalised units as sp.
// The landing copy is a FIXED pixel width (max-w-xl), so as the viewport
// narrows it occupies a larger fraction of the screen. Placing the helices at
// a fixed fraction of width would let them slide under the text exactly when
// the window gets smaller — so both the helix offset and the legibility veil
// are derived from this instead of guessed.
uniform float u_safe;
uniform vec3  u_cream;
uniform vec3  u_sage;
uniform vec3  u_teal;
uniform vec3  u_deep;
uniform vec3  u_coral;

const float PI = 3.14159265;

// --- hashing / noise -------------------------------------------------------
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

// Four octaves — the structural layers carry the detail now, so the field
// underneath does not need to.
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = m * p;
    a *= 0.5;
  }
  return v;
}

mat2 rot(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat2(c, -s, s, c);
}

// --- double helix ----------------------------------------------------------
// Returns (strand coverage, rung coverage, coral-rung coverage) for a helix
// running up the local y axis. Both strands are the same sine curve half a
// turn apart; cos of the phase doubles as a depth cue, so the strand swinging
// toward the viewer is drawn slightly wider and stronger.
vec3 helix(vec2 p, float amp, float freq, float speed, float width, float t, float seed) {
  float a = p.y * freq + t * speed;
  float ca = cos(a);
  float xa = amp * sin(a);
  float xb = -xa;

  // Horizontal distance over-thickens the line where the curve is steep;
  // dividing by the slope normal restores an even width.
  float slope = amp * freq * ca;
  float corr = inversesqrt(1.0 + slope * slope);

  float da = abs(p.x - xa) * corr;
  float db = abs(p.x - xb) * corr;

  float za = ca * 0.5 + 0.5;
  float zb = 0.5 - ca * 0.5;
  float wa = width * (0.80 + 0.30 * za);
  float wb = width * (0.80 + 0.30 * zb);

  float sa = smoothstep(wa, wa * 0.30, da) * (0.68 + 0.32 * za);
  float sb = smoothstep(wb, wb * 0.30, db) * (0.68 + 0.32 * zb);
  float strand = max(sa, sb);

  // Base pairs: quantise y into rungs and draw the three nearest so none
  // pops in at a cell boundary.
  float rs = freq * 1.35 / PI;
  float base = floor(p.y * rs);
  float rung = 0.0;
  float coral = 0.0;

  for (int k = -1; k <= 1; k++) {
    float n = base + float(k);
    float yc = (n + 0.5) / rs;
    float ac = yc * freq + t * speed;
    float x0 = amp * sin(ac);
    float cx = clamp(p.x, min(x0, -x0), max(x0, -x0));
    float d = length(vec2(p.x - cx, p.y - yc));
    float w = width * 0.72;
    float cov = smoothstep(w, w * 0.30, d);
    // Fade out where the strands cross in projection and the rung has no room.
    cov *= smoothstep(0.10, 0.42, abs(sin(ac)));
    float isCoral = step(0.88, hash(vec2(n, seed)));
    rung += cov * (1.0 - isCoral);
    coral += cov * isCoral;
  }

  return vec3(strand, min(rung, 1.0), min(coral, 1.0));
}

// --- molecular suspension --------------------------------------------------
vec2 nodePos(vec2 cell, float t) {
  vec2 h = hash2(cell);
  return cell + 0.15 + 0.70 * h + 0.05 * sin(t * 0.25 + h * 6.2831853);
}

// Returns (node coverage, bond coverage). Bonds only form between neighbours
// that happen to drift close together, which keeps the result irregular
// instead of reading as a regular lattice.
vec2 molecules(vec2 p, float t) {
  vec2 gp = p * 3.4;
  vec2 ip = floor(gp);
  float nodes = 0.0;
  float bonds = 0.0;

  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 cell = ip + vec2(float(x), float(y));
      vec2 n0 = nodePos(cell, t);
      nodes = max(nodes, smoothstep(0.085, 0.020, length(gp - n0)));

      for (int b = 0; b < 2; b++) {
        vec2 n1 = nodePos(cell + (b == 0 ? vec2(1.0, 0.0) : vec2(0.0, 1.0)), t);
        vec2 ab = n1 - n0;
        float len = length(ab);
        if (len < 1.25) {
          vec2 pa = gp - n0;
          float h = clamp(dot(pa, ab) / dot(ab, ab), 0.0, 1.0);
          float d = length(pa - ab * h);
          bonds = max(bonds, smoothstep(0.018, 0.004, d) * smoothstep(1.25, 0.75, len));
        }
      }
    }
  }
  return vec2(nodes, bonds);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float aspect = u_res.x / u_res.y;
  // Centred, height-normalised space: y spans [-0.5, 0.5] at any aspect.
  vec2 sp = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
  float t = u_time;

  // --- base field ---
  vec2 p = sp * 2.4;
  vec2 q = vec2(fbm(p + t * 0.05), fbm(p + vec2(5.2, 1.3) - t * 0.04));
  float f = fbm(p + 2.6 * q);

  // Palette comes in as uniforms so a partner's subdomain repaints the backdrop
  // with their colours. Defaults match the house tokens in globals.css.
  vec3 cream = u_cream;
  vec3 sage  = u_sage;
  vec3 teal  = u_teal;
  vec3 deep  = u_deep;
  vec3 coral = u_coral;

  vec3 col = mix(cream, sage, smoothstep(0.28, 0.80, f));
  col = mix(col, teal, smoothstep(0.60, 1.05, f) * clamp(dot(q, q) * 1.4, 0.0, 1.0) * 0.26);

  // --- molecular suspension, sitting in the field ---
  vec2 mol = molecules(sp + vec2(t * 0.010, t * 0.006), t);
  col = mix(col, teal, mol.y * 0.20);
  col = mix(col, deep, mol.x * 0.28);

  // --- helices ---
  // How much horizontal room is left beside the copy column. Both terms are
  // uniform for the whole draw, so the branch below is fully coherent.
  float narrow = smoothstep(1.15, 0.78, (aspect * 0.5) / (u_safe + 0.12));

  if (narrow < 0.99) {
    // Wide layout: a helix down each flank, outside the copy column.
    float ox = max(0.34 * aspect, u_safe + 0.10);
    float k = 1.0 - narrow;

    vec2 h1p = rot(0.20) * (sp - vec2(-ox, 0.0));
    vec3 h1 = helix(h1p, 0.115, 7.5, 0.30, 0.0060, t, 11.0);

    vec2 h2p = rot(-0.15) * (sp - vec2(ox, 0.04));
    vec3 h2 = helix(h2p, 0.150, 5.4, -0.24, 0.0075, t, 27.0);

    // Back helix first, so the nearer one overlaps it.
    col = mix(col, teal,  h1.y * 0.44 * k);
    col = mix(col, coral, h1.z * 0.66 * k);
    col = mix(col, deep,  h1.x * 0.56 * k);

    col = mix(col, teal,  h2.y * 0.48 * k);
    col = mix(col, coral, h2.z * 0.72 * k);
    col = mix(col, deep,  h2.x * 0.62 * k);
  }

  if (narrow > 0.01) {
    // Cramped layout (phones): no room beside the copy, so the helices run
    // across the free bands above and below it instead of vanishing off-screen.
    vec2 t1p = rot(1.5708 + 0.10) * (sp - vec2(0.0, 0.36));
    vec3 t1 = helix(t1p, 0.070, 8.0, 0.28, 0.0060, t, 43.0);

    vec2 t2p = rot(1.5708 - 0.08) * (sp - vec2(0.0, -0.36));
    vec3 t2 = helix(t2p, 0.085, 6.2, -0.22, 0.0068, t, 61.0);

    col = mix(col, teal,  t1.y * 0.44 * narrow);
    col = mix(col, coral, t1.z * 0.66 * narrow);
    col = mix(col, deep,  t1.x * 0.56 * narrow);

    col = mix(col, teal,  t2.y * 0.46 * narrow);
    col = mix(col, coral, t2.z * 0.70 * narrow);
    col = mix(col, deep,  t2.x * 0.60 * narrow);
  }

  // --- pointer light: subtle parallax cue, not a spotlight ---
  float pd = length((uv - u_pointer) * vec2(aspect, 1.0));
  col += vec3(0.020, 0.030, 0.026) * smoothstep(0.50, 0.0, pd);

  // --- legibility veil ---
  // A soft-edged column sized to the actual copy block, so text always sits on
  // near-pure cream no matter what the structural layers are doing behind it,
  // plus a gentler radial term that keeps the transition from reading as a card.
  float d = length((uv - vec2(0.5, 0.52)) * vec2(aspect, 1.0));
  float protectX = 1.0 - smoothstep(u_safe * 0.92, u_safe * 1.55, abs(sp.x));
  float protectY = 1.0 - smoothstep(0.20, 0.46, abs(sp.y + 0.02));
  float veil = max(protectX * protectY * 0.94, smoothstep(0.62, 0.0, d) * 0.55);
  col = mix(col, cream, clamp(veil, 0.0, 1.0));

  // --- edge vignette, cooling toward the corners ---
  col = mix(col, sage * 0.94, smoothstep(0.55, 1.15, d) * 0.5);

  // --- fine grain: paper, not gradient mesh ---
  float g = hash(gl_FragCoord.xy + fract(u_time) * 91.7);
  col += (g - 0.5) * 0.014;

  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(
  gl: WebGLRenderingContext,
  type: number,
  src: string,
): WebGLShader | null {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.error("[bg] shader compile failed:", gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

// House palette, matching the :root tokens in globals.css. A partner theme
// overrides any subset of these.
const HOUSE_PALETTE = {
  cream: "#fbf7ee",
  sage: "#e0ece7",
  teal: "#16504a",
  deep: "#0b2a26",
  coral: "#d8593a",
};

/** "#rrggbb" -> [r, g, b] in 0..1, or null if it isn't a valid 6-digit hex. */
function glColor(hex: string | null | undefined): [number, number, number] | null {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return null;
  return [
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  ];
}

export function ImmersiveBackground({
  palette,
}: {
  /** Partner brand colours; anything omitted falls back to the house palette. */
  palette?: {
    primary?: string | null;
    mid?: string | null;
    accent?: string | null;
    surface?: string | null;
  } | null;
} = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Serialised so the effect re-runs when the palette actually changes, without
  // depending on a fresh object identity every render.
  const paletteKey = JSON.stringify(palette ?? null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl =
      (canvas.getContext("webgl", {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        powerPreference: "low-power",
      }) as WebGLRenderingContext | null) ?? null;
    // No WebGL (old browser, blocked, software-render refused): leave the
    // canvas blank and let the CSS gradient underneath stand in.
    if (!gl) return;

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;

    const prog = gl.createProgram();
    if (!prog) return;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error("[bg] program link failed:", gl.getProgramInfoLog(prog));
      return;
    }
    gl.useProgram(prog);

    // Two triangles covering clip space.
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    const aPos = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "u_res");
    const uTime = gl.getUniformLocation(prog, "u_time");
    const uPointer = gl.getUniformLocation(prog, "u_pointer");
    const uSafe = gl.getUniformLocation(prog, "u_safe");

    // Palette is constant for the life of the program — set once, not per frame.
    {
      const p = (JSON.parse(paletteKey) ?? null) as {
        primary?: string | null;
        mid?: string | null;
        accent?: string | null;
        surface?: string | null;
      } | null;
      const pick = (
        override: string | null | undefined,
        fallback: string,
      ): [number, number, number] =>
        glColor(override) ?? (glColor(fallback) as [number, number, number]);

      const set = (name: string, rgb: [number, number, number]) => {
        const loc = gl.getUniformLocation(prog, name);
        if (loc) gl.uniform3f(loc, rgb[0], rgb[1], rgb[2]);
      };
      set("u_cream", pick(p?.surface, HOUSE_PALETTE.cream));
      set("u_sage", pick(p?.surface, HOUSE_PALETTE.sage));
      set("u_teal", pick(p?.mid, HOUSE_PALETTE.teal));
      set("u_deep", pick(p?.primary, HOUSE_PALETTE.deep));
      set("u_coral", pick(p?.accent, HOUSE_PALETTE.coral));
    }

    // Mirrors the copy column in app/page.tsx: the paragraph is `max-w-xl`
    // (36rem = 576px), plus breathing room. If that class changes, change this.
    const CONTENT_HALF_PX = 288;
    const SAFE_PAD_PX = 56;

    // The helices are thin line art, so this cannot drop as low as a pure
    // gradient field would tolerate — 0.85 keeps the strands clean while
    // still saving fill on high-DPI screens.
    const RENDER_SCALE = 0.85;
    let width = 0;
    let height = 0;

    // Measure the element, not the window: the canvas is what actually gets
    // painted, and a ResizeObserver also recovers if it is first laid out at
    // zero size (hidden tab, deferred layout) and only gets real dimensions
    // later — a window resize event would never fire for that.
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2) * RENDER_SCALE;
      const w = Math.floor(canvas.clientWidth * dpr);
      const h = Math.floor(canvas.clientHeight * dpr);
      if (w <= 0 || h <= 0) return;
      if (w === width && h === height) return;
      width = w;
      height = h;
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uRes, w, h);
      // Height-normalised, matching the shader's sp space. CSS px throughout —
      // the dpr cancels, since sp divides by the same resolution.
      gl.uniform1f(
        uSafe,
        (CONTENT_HALF_PX + SAFE_PAD_PX) / Math.max(1, canvas.clientHeight),
      );
    };

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointer = { x: 0.5, y: 0.55 };
    const target = { x: 0.5, y: 0.55 };

    const onPointerMove = (e: PointerEvent) => {
      target.x = e.clientX / window.innerWidth;
      target.y = 1.0 - e.clientY / window.innerHeight;
    };

    let raf = 0;
    let running = true;
    const start = performance.now();

    const draw = (now: number) => {
      if (width <= 0 || height <= 0) return;
      // Frozen composition for reduced-motion — still rendered, just not moving.
      const t = reduced.matches ? 14.0 : (now - start) / 1000;
      pointer.x += (target.x - pointer.x) * 0.05;
      pointer.y += (target.y - pointer.y) * 0.05;
      gl.uniform1f(uTime, t);
      gl.uniform2f(uPointer, pointer.x, pointer.y);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const loop = (now: number) => {
      if (!running) return;
      draw(now);
      raf = requestAnimationFrame(loop);
    };

    const startLoop = () => {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(loop);
    };
    const stopLoop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    const onVisibility = () => {
      // Reduced motion never runs a loop — without this guard, returning to the
      // tab would start one that redraws an identical frame forever.
      if (reduced.matches) return;
      if (document.hidden) stopLoop();
      else startLoop();
    };

    const onResize = () => {
      resize();
      // The animated path repaints anyway; the frozen path has to be nudged.
      if (reduced.matches) draw(performance.now());
    };

    const ro = new ResizeObserver(onResize);
    ro.observe(canvas);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      stopLoop();
    };

    resize();
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);
    canvas.addEventListener("webglcontextlost", onContextLost);

    if (reduced.matches) {
      running = false;
      draw(performance.now());
    } else {
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      raf = requestAnimationFrame(loop);
    }

    return () => {
      stopLoop();
      ro.disconnect();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, [paletteKey]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_50%_45%,#fbf7ee_0%,#eef4f0_55%,#e2ebe6_100%)]"
    >
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
