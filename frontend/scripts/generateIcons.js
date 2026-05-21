/**
 * Flourish PWA icon generator — "F bloom with cherry blossom centre" mark.
 *
 * Manual one-off — `canvas` is intentionally NOT a project dependency so
 * Netlify never has to build it. The generated PNGs in public/icons/ are
 * committed directly to the repo.
 *
 * Run once locally: npm install canvas --no-save && node scripts/generateIcons.js
 *
 * Renders the icon at every required size and writes PNGs to ../public/icons/.
 * Everything is laid out as a fraction of the canvas size `S`, so a single
 * design scales cleanly from 512 down to 16.
 *
 * Note on the bloom centre: the app's "cherry blossom" is the 🌸 emoji the
 * login screen renders (AuthScreen.jsx). node-canvas can't reliably draw a
 * colour emoji, so per spec we approximate it with 5 soft pink ellipse petals
 * around a white-pink centre — no outlines, no shadows.
 */
const fs = require("fs");
const path = require("path");
const { createCanvas } = require("canvas");

const SIZES = [512, 192, 180, 152, 120, 76, 32, 16];
const OUT_DIR = path.join(__dirname, "..", "public", "icons");

const BG = "#130820";          // deep dark purple background
const F_COLOR = "#ffffff";     // bold white F
const PETALS = ["#6d28d9", "#7c3aed", "#9333ea", "#a855f7", "#c084fc"];
const PETAL_COUNT = 7;
const BLOSSOM_PETAL = "#fbcfe8";   // soft pink
const BLOSSOM_CENTER = "#fce7f3";  // white-pink
const BLOSSOM_PETAL_COUNT = 5;

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

// One elliptical petal whose base sits near `cx,cy` and whose tip points
// outward along `angle`. `pc` is the centre-to-petal-centre distance.
function drawPetal(ctx, cx, cy, angle, pc, rx, ry, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.translate(0, -pc);
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function drawIcon(S) {
  const canvas = createCanvas(S, S);
  const ctx = canvas.getContext("2d");

  // ── Background: rounded square ──────────────────────────────────────────
  roundRectPath(ctx, 0, 0, S, S, 0.22 * S);
  ctx.fillStyle = BG;
  ctx.fill();

  // ── F geometry ───────────────────────────────────────────────────────────
  // Left edge ~20% in, vertically centred on the icon, ~55% of icon height,
  // stroke ~9% of icon size.
  const t = 0.09 * S;                       // stroke width
  const stemLeftX = 0.20 * S;               // left edge of the F
  const fHeight = 0.55 * S;
  const stemTopY = 0.5 * S - fHeight / 2;   // 0.225 * S
  const stemBottomY = 0.5 * S + fHeight / 2; // 0.775 * S
  const topBarLen = 0.34 * S;
  const crossBarLen = 0.24 * S;
  const crossBarY = 0.43 * S;               // crossbar sits just above centre
  const barR = t * 0.22;                    // soft corners on the strokes

  // ── F letterform (white) — drawn before the bloom so the bloom sits on top
  ctx.fillStyle = F_COLOR;
  roundRectPath(ctx, stemLeftX, stemTopY, t, stemBottomY - stemTopY, barR);  // stem
  ctx.fill();
  roundRectPath(ctx, stemLeftX, stemTopY, topBarLen, t, barR);               // top bar
  ctx.fill();
  roundRectPath(ctx, stemLeftX, crossBarY, crossBarLen, t, barR);            // crossbar
  ctx.fill();

  // ── Bloom centre = the top-right junction of the F (end of the top bar) ──
  const bloomX = stemLeftX + topBarLen;
  const bloomY = stemTopY + t / 2;

  // ── 7 purple petals, elliptical, medium length, varied angle + opacity ───
  const pc = 0.085 * S;        // centre -> petal-centre distance
  const ryBase = 0.10 * S;     // petal half-length (medium)
  const rx = 0.045 * S;        // petal half-width
  for (let i = 0; i < PETAL_COUNT; i++) {
    const jitter = i % 2 ? 0.12 : -0.08;                       // varying rotation angles
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / PETAL_COUNT + jitter;
    const ry = ryBase * (0.88 + 0.12 * (i % 3));               // layered lengths
    ctx.save();
    ctx.globalAlpha = 0.6 + 0.05 * i;                          // 0.60 -> 0.90
    drawPetal(ctx, bloomX, bloomY, angle, pc, rx, ry, PETALS[i % PETALS.length]);
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // ── Cherry blossom centre (~13% of icon) — 5 pink petals + white-pink core
  const blossomR = 0.065 * S;  // half of ~13% diameter
  const bpc = blossomR * 0.34;
  const bpry = blossomR * 0.62;
  const bprx = blossomR * 0.40;
  for (let i = 0; i < BLOSSOM_PETAL_COUNT; i++) {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / BLOSSOM_PETAL_COUNT;
    drawPetal(ctx, bloomX, bloomY, angle, bpc, bprx, bpry, BLOSSOM_PETAL);
  }
  ctx.beginPath();
  ctx.arc(bloomX, bloomY, blossomR * 0.42, 0, Math.PI * 2);
  ctx.fillStyle = BLOSSOM_CENTER;
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
