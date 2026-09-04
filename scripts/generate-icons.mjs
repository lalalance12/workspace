import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Draw the app mark once, emit every format that asks for it.
 *
 * The mark is a white W on the brand violet — the wordmark's gradient square
 * turns to mush at 16px, and a favicon is read at 16px or not at all, so the
 * icon drops the gradient and keeps the one thing that survives the size.
 *
 * Everything is drawn from signed distance fields rather than rasterised from
 * the SVG, because there is no rasteriser in this project's dependency tree and
 * adding sharp to draw one letter is not a trade worth making. The upside is
 * that the SVG and the bitmaps come from the same numbers below, so they cannot
 * drift: edit the geometry here and re-run `pnpm icons`.
 *
 * Outputs, all committed:
 *   app/icon.svg          what modern browsers actually use
 *   app/favicon.ico       16/32/48, for /favicon.ico fetchers that ignore <link>
 *   app/apple-icon.png    180x180, full-bleed — iOS applies its own mask
 *   public/icon-192.png   the manifest, which needs stable unhashed URLs
 *   public/icon-512.png   ditto; Chrome wants a 192 and a 512 to offer install
 */

/* --- Geometry, on a 32-unit grid ------------------------------------------ */

const GRID = 32;

/**
 * --color-violet, oklch(55% 0.235 295), converted once. An .ico file has no
 * idea what oklch is, so hex is the portable spelling.
 */
const VIOLET = [0x81, 0x41, 0xe8];
const WHITE = [0xff, 0xff, 0xff];

/**
 * Tighter than --radius-control's 10/40. A softer corner reads as a blur at
 * 16px; this one still reads as a corner.
 */
const CORNER = 7;

/**
 * The W as a stroked polyline, not a filled outline. Round caps and joins are
 * free in a distance field — a segment's isosurface is a capsule — and they sit
 * with the rest of the system, where nothing is sharp.
 */
const STROKE = 4.4;
const W_PATH = [
  [7.6, 9.8],
  [11.8, 22.2],
  [16, 14.0],
  [20.2, 22.2],
  [24.4, 9.8],
];

/* --- Distance fields ------------------------------------------------------ */

/** Distance to a rounded box centred on the grid. Negative inside. */
function sdBox(x, y, half, radius) {
  const qx = Math.abs(x - GRID / 2) - (half - radius);
  const qy = Math.abs(y - GRID / 2) - (half - radius);
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  return outside + Math.min(Math.max(qx, qy), 0) - radius;
}

/** Distance to the nearest point on a segment. */
function sdSegment(x, y, [ax, ay], [bx, by]) {
  const pax = x - ax;
  const pay = y - ay;
  const bax = bx - ax;
  const bay = by - ay;
  const t = Math.min(1, Math.max(0, (pax * bax + pay * bay) / (bax * bax + bay * bay)));
  return Math.hypot(pax - bax * t, pay - bay * t);
}

/** Distance to the whole letter. */
function sdLetter(x, y) {
  let d = Infinity;
  for (let i = 0; i < W_PATH.length - 1; i++) {
    d = Math.min(d, sdSegment(x, y, W_PATH[i], W_PATH[i + 1]));
  }
  return d - STROKE / 2;
}

/* --- Raster --------------------------------------------------------------- */

/**
 * Coverage from a distance, in grid units, for a pixel one `px` wide. This is
 * the analytic antialias: at 16px a 4x supersample has only 16 levels to spend
 * on an edge, and the diagonals of the W show it.
 */
function coverage(d, px) {
  return Math.min(1, Math.max(0, 0.5 - d / px));
}

/**
 * RGBA8 for one square icon. `rounded` is false for the iOS icon, which the
 * platform masks itself and which looks pinched if it arrives pre-rounded.
 */
function render(size, rounded) {
  const px = GRID / size;
  const out = Buffer.alloc(size * size * 4);

  for (let py = 0; py < size; py++) {
    for (let pxi = 0; pxi < size; pxi++) {
      const x = ((pxi + 0.5) * GRID) / size;
      const y = ((py + 0.5) * GRID) / size;

      const plate = coverage(sdBox(x, y, GRID / 2, rounded ? CORNER : 0), px);
      const letter = Math.min(coverage(sdLetter(x, y), px), plate);

      const i = (py * size + pxi) * 4;
      for (let c = 0; c < 3; c++) {
        out[i + c] = Math.round(VIOLET[c] + (WHITE[c] - VIOLET[c]) * letter);
      }
      out[i + 3] = Math.round(plate * 255);
    }
  }

  return out;
}

/* --- PNG ------------------------------------------------------------------ */

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

function encodePNG(size, rgba) {
  // Filter type 0 on every scanline. These are tiny and mostly flat colour, so
  // deflate does the work and a smarter filter would save bytes we never spend.
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(size * stride);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0;
    rgba.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // truecolour with alpha

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* --- ICO ------------------------------------------------------------------ */

/**
 * PNG-compressed frames, which every browser and every Windows since Vista
 * reads. The alternative is a bottom-up BMP plus a vestigial AND mask, and the
 * two most common ways to ship a broken .ico are getting either of those wrong.
 */
function encodeICO(frames) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(frames.length, 4);

  let offset = 6 + frames.length * 16;
  const dir = [];

  for (const { size, png } of frames) {
    const entry = Buffer.alloc(16);
    entry[0] = size < 256 ? size : 0; // 0 means 256
    entry[1] = size < 256 ? size : 0;
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    dir.push(entry);
    offset += png.length;
  }

  return Buffer.concat([header, ...dir, ...frames.map((f) => f.png)]);
}

/* --- SVG ------------------------------------------------------------------ */

function encodeSVG() {
  const hex = "#" + VIOLET.map((c) => c.toString(16).padStart(2, "0")).join("");
  const d = W_PATH.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRID} ${GRID}" role="img" aria-label="Workspace">
  <rect width="${GRID}" height="${GRID}" rx="${CORNER}" fill="${hex}"/>
  <path d="${d}" fill="none" stroke="#ffffff" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;
}

/* --- Emit ----------------------------------------------------------------- */

const APP = "app";
const PUBLIC = "public";

const written = [];

function emit(path, bytes) {
  writeFileSync(path, bytes);
  written.push(`${path} (${bytes.length} bytes)`);
}

emit(join(APP, "icon.svg"), Buffer.from(encodeSVG()));

emit(
  join(APP, "favicon.ico"),
  encodeICO([16, 32, 48].map((size) => ({ size, png: encodePNG(size, render(size, true)) }))),
);

// Full-bleed: iOS rounds this itself, and a pre-rounded icon comes out pinched.
emit(join(APP, "apple-icon.png"), encodePNG(180, render(180, false)));

// Rounded: these are declared purpose "any", so Android draws them as supplied.
for (const size of [192, 512]) {
  emit(join(PUBLIC, `icon-${size}.png`), encodePNG(size, render(size, true)));
}

console.log(written.map((line) => `  ${line}`).join("\n"));
