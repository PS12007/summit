// Turns a photo into artwork: oil paint, pointillist dots, coloured symbols or a pencil sketch.
// Runs inside a worker (see stylize.worker.ts) on an OffscreenCanvas, so the app never freezes.
// Every size below is written for a 2000px-wide image and scaled by `k` for other sizes.

export type ArtStyle = "paint" | "dots" | "symbols" | "sketch" | "photo";

type Ctx = OffscreenCanvasRenderingContext2D;
type RGB = [number, number, number];

/** A photo as raw RGBA pixels. */
interface Px {
  w: number;
  h: number;
  d: Uint8ClampedArray;
}

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v: number, lo = 0, hi = 255) => (v < lo ? lo : v > hi ? hi : v);
const lumOf = (c: RGB) => (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;
const css = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

/** Box-blurred copy at 1/f the size — a cheap blur we can sample from at full-size coordinates. */
function shrink(src: Px, f: number): Px & { f: number } {
  f = Math.max(1, Math.round(f));
  const w = Math.ceil(src.w / f), h = Math.ceil(src.h / f);
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, n = 0;
      const y1 = Math.min(src.h, (y + 1) * f), x1 = Math.min(src.w, (x + 1) * f);
      for (let yy = y * f; yy < y1; yy++) {
        for (let xx = x * f; xx < x1; xx++) {
          const i = (yy * src.w + xx) * 4;
          r += src.d[i]; g += src.d[i + 1]; b += src.d[i + 2]; n++;
        }
      }
      const o = (y * w + x) * 4;
      d[o] = r / n; d[o + 1] = g / n; d[o + 2] = b / n; d[o + 3] = 255;
    }
  }
  return { w, h, d, f };
}

/** Colour at full-size coordinates (x, y), bilinear from a shrunk copy. */
function at(p: Px & { f: number }, x: number, y: number): RGB {
  const fx = clamp(x / p.f - 0.5, 0, p.w - 1), fy = clamp(y / p.f - 0.5, 0, p.h - 1);
  const x0 = fx | 0, y0 = fy | 0, x1 = Math.min(p.w - 1, x0 + 1), y1 = Math.min(p.h - 1, y0 + 1);
  const tx = fx - x0, ty = fy - y0;
  const out: RGB = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    const a = p.d[(y0 * p.w + x0) * 4 + c], b = p.d[(y0 * p.w + x1) * 4 + c];
    const e = p.d[(y1 * p.w + x0) * 4 + c], g = p.d[(y1 * p.w + x1) * 4 + c];
    out[c] = (a * (1 - tx) + b * tx) * (1 - ty) + (e * (1 - tx) + g * tx) * ty;
  }
  return out;
}

/** Push colours away from grey (s > 1) and nudge brightness. */
function vivid(c: RGB, s: number, bright = 1): RGB {
  const l = (c[0] + c[1] + c[2]) / 3;
  return [clamp((l + (c[0] - l) * s) * bright), clamp((l + (c[1] - l) * s) * bright), clamp((l + (c[2] - l) * s) * bright)];
}

const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Luminance gradient at (x, y), measured `r` pixels apart. */
function grad(p: Px & { f: number }, x: number, y: number, r: number): [number, number] {
  const gx = lumOf(at(p, x + r, y)) - lumOf(at(p, x - r, y));
  const gy = lumOf(at(p, x, y + r)) - lumOf(at(p, x, y - r));
  return [gx, gy];
}

function shuffle<T>(xs: T[], rand: () => number) {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = (rand() * (i + 1)) | 0;
    [xs[i], xs[j]] = [xs[j], xs[i]];
  }
}

/** Fine grain over the finished image, like canvas or paper texture. */
function grain(ctx: Ctx, w: number, h: number, amount: number, rand: () => number) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * amount;
    d[i] = clamp(d[i] + n); d[i + 1] = clamp(d[i + 1] + n); d[i + 2] = clamp(d[i + 2] + n);
  }
  ctx.putImageData(img, 0, 0);
}

// ---------------- oil paint ----------------
// Big strokes first, then smaller ones only where the painting still differs from the photo
// (after Hertzmann, "Painterly Rendering with Curved Brush Strokes of Multiple Sizes").

function paint(ctx: Ctx, src: Px, k: number) {
  const { w, h } = src;
  const rand = rng(7);
  const base = shrink(src, 40 * k);
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = css(at(base, w / 2, h / 2));
  ctx.fillRect(0, 0, w, h);

  const radii = [32, 16, 8, 4.5].map((r) => Math.max(1.4, r * k));
  radii.forEach((R, layer) => {
    const ref = shrink(src, Math.max(1, R / 2.2));
    const cur = layer ? ctx.getImageData(0, 0, w, h).data : null;
    const grid = Math.max(2, Math.round(R * 0.9));
    const strokes: { pts: [number, number][]; c: RGB; R: number }[] = [];
    for (let y = 0; y < h + grid; y += grid) {
      for (let x = 0; x < w + grid; x += grid) {
        const cx = x + rand() * grid, cy = y + rand() * grid;
        const c = at(ref, cx, cy);
        if (cur) {
          const i = ((clamp(cy | 0, 0, h - 1)) * w + clamp(cx | 0, 0, w - 1)) * 4;
          const diff = Math.abs(cur[i] - c[0]) + Math.abs(cur[i + 1] - c[1]) + Math.abs(cur[i + 2] - c[2]);
          if (diff < 34 - layer * 4) continue;
        }
        // Follow the edges: each step goes across the brightness gradient.
        const pts: [number, number][] = [[cx, cy]];
        let px = cx, py = cy, dx = 0.8, dy = 0.6;
        const steps = layer === 0 ? 3 : 4;
        for (let s = 0; s < steps; s++) {
          const [gx, gy] = grad(ref, px, py, R);
          const m = Math.hypot(gx, gy);
          if (m > 0.004) {
            let nx = -gy / m, ny = gx / m;
            if (nx * dx + ny * dy < 0) (nx = -nx), (ny = -ny);
            dx = dx * 0.35 + nx * 0.65; dy = dy * 0.35 + ny * 0.65;
            const dm = Math.hypot(dx, dy) || 1;
            dx /= dm; dy /= dm;
          } else if (s === 0) {
            const a = -0.5 + (rand() - 0.5) * 0.6;
            dx = Math.cos(a); dy = Math.sin(a);
          }
          px += dx * R * 1.1; py += dy * R * 1.1;
          const pc = at(ref, px, py);
          if (s > 0 && Math.abs(pc[0] - c[0]) + Math.abs(pc[1] - c[1]) + Math.abs(pc[2] - c[2]) > 60) break;
          pts.push([px, py]);
        }
        // Slight colour variation per stroke, like paint that isn't perfectly mixed.
        const j = (rand() - 0.5) * 18;
        strokes.push({ pts, c: vivid([c[0] + j, c[1] + j * 0.8, c[2] + j * 0.6], 1.12), R });
      }
    }
    shuffle(strokes, rand);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const s of strokes) {
      ctx.strokeStyle = css(s.c, 0.94);
      ctx.lineWidth = s.R * (0.85 + rand() * 0.4);
      ctx.beginPath();
      ctx.moveTo(s.pts[0][0], s.pts[0][1]);
      if (s.pts.length === 1) ctx.lineTo(s.pts[0][0] + 0.1, s.pts[0][1]);
      for (let i = 1; i < s.pts.length; i++) {
        const [x0, y0] = s.pts[i - 1], [x1, y1] = s.pts[i];
        ctx.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
        if (i === s.pts.length - 1) ctx.lineTo(x1, y1);
      }
      ctx.stroke();
      // A lighter streak inside the stroke reads as bristle marks.
      if (s.R > 3 && rand() < 0.5) {
        ctx.strokeStyle = css(vivid(s.c, 1, 1.08), 0.25);
        ctx.lineWidth = s.R * 0.25;
        ctx.stroke();
      }
    }
  });
  grain(ctx, w, h, 12, rand);
}

// ---------------- pointillism ----------------

function dots(ctx: Ctx, src: Px, k: number) {
  const { w, h } = src;
  const rand = rng(11);
  // A soft wash of the scene's own colours underneath, so gaps between dots don't look like holes.
  const wash = shrink(src, 48 * k);
  const paper: RGB = [244, 238, 226];
  for (let y = 0; y < h; y += 24 * k) {
    for (let x = 0; x < w; x += 24 * k) {
      ctx.fillStyle = css(mix(at(wash, x, y), paper, 0.55));
      ctx.fillRect(x, y, 24 * k + 1, 24 * k + 1);
    }
  }
  const passes = [
    { step: 20, r: 0.6, f: 8, s: 1.3 },
    { step: 12, r: 0.52, f: 4, s: 1.4 },
    { step: 8.5, r: 0.42, f: 2, s: 1.5 },
  ];
  for (const p of passes) {
    const step = Math.max(2.5, p.step * k);
    const ref = shrink(src, Math.max(1, p.f * k));
    const pts: [number, number, RGB][] = [];
    for (let y = 0; y < h + step; y += step) {
      for (let x = 0; x < w + step; x += step) {
        const cx = x + (rand() - 0.5) * step, cy = y + (rand() - 0.5) * step;
        let c = vivid(at(ref, cx, cy), p.s);
        // Pointillists placed separate dabs of neighbouring colours and let the eye blend them.
        const shift = (rand() - 0.5) * 70;
        const ch = (rand() * 3) | 0;
        c = [...c] as RGB;
        c[ch] = clamp(c[ch] + shift);
        pts.push([cx, cy, c]);
      }
    }
    shuffle(pts, rand);
    for (const [x, y, c] of pts) {
      ctx.fillStyle = css(c, 0.95);
      ctx.beginPath();
      ctx.arc(x, y, step * p.r * (0.8 + rand() * 0.35), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  grain(ctx, w, h, 8, rand);
}

// ---------------- symbols ----------------

const RAMP = " ..·:;-=+*xo%#";

function symbols(ctx: Ctx, src: Px, k: number) {
  const { w, h } = src;
  const rand = rng(5);
  const cell = Math.max(5, Math.round(11 * k));
  const ref = shrink(src, cell);
  ctx.fillStyle = "#0b0d12";
  ctx.fillRect(0, 0, w, h);
  ctx.font = `bold ${Math.round(cell * 1.25)}px Consolas, "Cascadia Mono", "Courier New", monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const rowH = Math.round(cell * 1.35);
  for (let y = 0; y < h + rowH; y += rowH) {
    for (let x = 0; x < w + cell; x += cell) {
      const c = at(ref, x + cell / 2, y + rowH / 2);
      const l = lumOf(c);
      // A faint tile of the cell's colour behind each symbol keeps the picture readable.
      ctx.fillStyle = css(c, 0.16);
      ctx.fillRect(x, y, cell, rowH);
      const ch = RAMP[Math.min(RAMP.length - 1, Math.floor(Math.pow(l, 0.85) * RAMP.length + (rand() - 0.5) * 1.2))] ?? " ";
      if (ch === " ") continue;
      // Brighten so the colours glow against the black.
      const m = Math.max(c[0], c[1], c[2]) || 1;
      const boost = Math.min(2.4, 235 / m);
      ctx.fillStyle = css(vivid([c[0] * boost, c[1] * boost, c[2] * boost], 1.35), 0.4 + l * 0.45);
      ctx.fillText(ch, x + cell / 2, y + rowH / 2);
    }
  }
}

// ---------------- coloured-pencil sketch ----------------

function sketch(ctx: Ctx, src: Px, k: number) {
  const { w, h } = src;
  const rand = rng(3);
  const paper: RGB = [247, 243, 234];
  ctx.fillStyle = css(paper);
  ctx.fillRect(0, 0, w, h);
  const ref = shrink(src, Math.max(1, 3 * k));
  const graphite: RGB = [52, 52, 60];

  // A faint watercolour wash first.
  const wash = shrink(src, 30 * k);
  ctx.globalAlpha = 0.42;
  for (let y = 0; y < h; y += 10 * k) {
    for (let x = 0; x < w; x += 10 * k) {
      ctx.fillStyle = css(vivid(at(wash, x, y), 1.25, 1.08));
      ctx.fillRect(x, y, 10 * k + 1, 10 * k + 1);
    }
  }
  ctx.globalAlpha = 1;
  ctx.lineCap = "round";

  // Cross-hatching: more directions of lines where the photo is darker.
  const layers = [
    { a: -0.9, min: 0.12 },
    { a: 0.75, min: 0.4 },
    { a: -0.1, min: 0.62 },
    { a: 1.45, min: 0.8 },
  ];
  const step = Math.max(2, 4.2 * k);
  for (const L of layers) {
    for (let y = 0; y < h + step; y += step) {
      for (let x = 0; x < w + step; x += step) {
        const cx = x + (rand() - 0.5) * step * 1.4, cy = y + (rand() - 0.5) * step * 1.4;
        const c = at(ref, cx, cy);
        const dark = 1 - lumOf(c);
        if (dark < L.min + (rand() - 0.5) * 0.12) continue;
        const a = L.a + (rand() - 0.5) * 0.25;
        const len = (7 + rand() * 9) * k;
        const col = mix(vivid(c, 1.5, 0.8), graphite, 0.12 + dark * 0.3);
        ctx.strokeStyle = css(col, 0.22 + dark * 0.45);
        ctx.lineWidth = Math.max(0.6, (0.7 + rand() * 0.6) * k);
        ctx.beginPath();
        ctx.moveTo(cx - Math.cos(a) * len / 2, cy - Math.sin(a) * len / 2);
        ctx.lineTo(cx + Math.cos(a) * len / 2, cy + Math.sin(a) * len / 2);
        ctx.stroke();
      }
    }
  }

  // Outlines along strong edges.
  const estep = Math.max(2, 3 * k);
  for (let y = 0; y < h; y += estep) {
    for (let x = 0; x < w; x += estep) {
      const [gx, gy] = grad(ref, x, y, 2.5 * k);
      const m = Math.hypot(gx, gy);
      if (m < 0.07 + rand() * 0.05) continue;
      const nx = -gy / m, ny = gx / m;
      const len = (5 + rand() * 7) * k;
      ctx.strokeStyle = css(graphite, Math.min(0.75, 0.2 + m * 2.2));
      ctx.lineWidth = Math.max(0.6, 0.9 * k);
      ctx.beginPath();
      ctx.moveTo(x - nx * len / 2, y - ny * len / 2);
      ctx.lineTo(x + nx * len / 2, y + ny * len / 2);
      ctx.stroke();
    }
  }
  grain(ctx, w, h, 10, rand);
}

const STYLES = { paint, dots, symbols, sketch };

/** Draws `style` onto ctx (already sized like `src`). */
export function stylize(ctx: Ctx, src: ImageData, style: Exclude<ArtStyle, "photo">, scale = src.width / 2000) {
  STYLES[style](ctx, { w: src.width, h: src.height, d: src.data }, scale);
}

/** Average brightness overall and where the greeting sits (top-left), 0–1. */
export function measure(ctx: Ctx, w: number, h: number): { avg: number; hero: number } {
  const d = ctx.getImageData(0, 0, w, h).data;
  let all = 0, n = 0, hero = 0, hn = 0;
  for (let y = 0; y < h; y += 8) {
    for (let x = 0; x < w; x += 8) {
      const i = (y * w + x) * 4;
      const l = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
      all += l; n++;
      if (x < w * 0.6 && y < h * 0.35) (hero += l), hn++;
    }
  }
  return { avg: all / n, hero: hero / hn };
}
