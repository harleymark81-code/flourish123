/**
 * Flourish PWA icon generator — "F with bloom" mark.
 *
 * Renders the icon at every required size using the `canvas` package and writes
 * PNGs to ../public/icons/. Everything is laid out as a fraction of the canvas
 * size `S`, so a single design scales cleanly from 512 down to 16.
 *
 * Run:  node scripts/generate-icons.js
 */
const fs = require("fs");
const path = require("path");
const { createCanvas } = require("canvas");

const SIZES = [512, 192, 180, 152, 120, 76, 32, 16];
const OUT_DIR = path.join(__dirname, "..", "public", "icons");

const BG = "#130820";          // deep dark purple background
const F_COLOR = "#ffffff";     // bold white F
const PETALS = ["#6d28d9", "#7c3aed", "#9333ea", "#a855f7", "#c084fc"];
const GOLD_OUTER = "#f59e0b";
const GOLD_INNER = "#fbbf24";
const PETAL_COUNT = 7;

function roundRectPath(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawIcon(S) {
  const canvas = createCanvas(S, S);
  const ctx = canvas.getContext("2d");

  // ── Background: rounded square ──────────────────────────────────────────
  roundRectPath(ctx, 0, 0, S, S, 0.22 * S);
  ctx.fillStyle = BG;
  ctx.fill();

  // Shared geometry — the F stem and the bloom share a centre x.
  const t = 0.115 * S;                 // stroke thickness
  const stemLeftX = 0.343 * S;
  const stemCenterX = stemLeftX + t / 2;
  const stemTopY = 0.42 * S;
  const stemBottomY = 0.82 * S;
  const barR = t * 0.22;               // soft corners on the F strokes

  // ── F letterform (white, bottom half, left-aligned) ─────────────────────
  // Drawn before the bloom so the bloom appears to grow out of the stem top.
  ctx.fillStyle = F_COLOR;
  // stem
  roundRectPath(ctx, stemLeftX, stemTopY, t, stemBottomY - stemTopY, barR);
  ctx.fill();
  // top bar
  roundRectPath(ctx, stemLeftX, stemTopY, 0.30 * S, t, barR);
  ctx.fill();
  // crossbar
  roundRectPath(ctx, stemLeftX, 0.585 * S, 0.205 * S, t, barR);
  ctx.fill();

  // ── Flower bloom — 7 petals radiating from one centre, over the stem top ─
  const bloomX = stemCenterX;
  const bloomY = 0.30 * S;
  const pc = 0.095 * S;                // distance from centre to petal centre
  const ryBase = 0.092 * S;            // petal half-length
  const rx = 0.052 * S;                // petal half-width
  const startAngle = -Math.PI / 2;     // first petal points up

  for (let i = 0; i < PETAL_COUNT; i++) {
    const angle = startAngle + (i * 2 * Math.PI) / PETAL_COUNT;
    const ry = ryBase * (0.9 + 0.1 * (i % 3)); // slight length variation = layered look
    ctx.save();
    ctx.translate(bloomX, bloomY);
    ctx.rotate(angle);
    ctx.translate(0, -pc);
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = PETALS[i % PETALS.length];
    ctx.fill();
    ctx.restore();
  }

  // ── Gold centre over the petals ──────────────────────────────────────────
  ctx.beginPath();
  ctx.arc(bloomX, bloomY, 0.06 * S, 0, Math.PI * 2);
  ctx.fillStyle = GOLD_OUTER;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(bloomX, bloomY, 0.037 * S, 0, Math.PI * 2);
  ctx.fillStyle = GOLD_INNER;
  ctx.fill();

  return canvas;
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const S of SIZES) {
    const canvas = drawIcon(S);
    const file = path.join(OUT_DIR, `icon-${S}.png`);
    fs.writeFileSync(file, canvas.toBuffer("image/png"));
    console.log(`wrote ${path.relative(path.join(__dirname, ".."), file)} (${S}x${S})`);
  }
  console.log(`\nDone — ${SIZES.length} icons in ${path.relative(process.cwd(), OUT_DIR)}`);
}

main();
