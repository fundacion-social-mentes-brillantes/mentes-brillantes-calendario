'use strict';
/**
 * Genera iconos PWA cuadrados (PNG) sin dependencias externas.
 * Emblema: destello dorado (astroide de 4 puntas) sobre azul institucional,
 * evocando "Mentes Brillantes". Zona segura para iconos maskable respetada.
 *
 * Salida en assets/: icon-192.png, icon-512.png, apple-touch-icon.png, favicon-32.png
 */
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const OUT_DIR = path.join(__dirname, '..', 'assets');

// --- CRC32 (para chunks PNG) ---
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type RGBA
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace
  // scanlines con filtro 0 (none)
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- utilidades de color ---
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
function blend(base, over, alpha) {
  return [
    lerp(base[0], over[0], alpha),
    lerp(base[1], over[1], alpha),
    lerp(base[2], over[2], alpha),
  ];
}

// Paleta institucional
const NAVY_TOP = [18, 46, 96];
const NAVY_BOT = [8, 21, 48];
const GOLD_HI = [247, 233, 193];
const GOLD = [214, 181, 94];
const GOLD_LO = [168, 132, 58];

// coverage de un pixel por supersampling SS x SS
function renderIcon(N) {
  const SS = 3;
  const rgba = Buffer.alloc(N * N * 4);
  const c = (N - 1) / 2;
  const sparkR = N * 0.30;        // radio del destello (dentro de zona segura 80%)
  const edge = Math.pow(sparkR, 2 / 3);
  const glowR = N * 0.46;

  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      // fondo: gradiente vertical navy
      const tBg = y / (N - 1);
      let col = [lerp(NAVY_TOP[0], NAVY_BOT[0], tBg), lerp(NAVY_TOP[1], NAVY_BOT[1], tBg), lerp(NAVY_TOP[2], NAVY_BOT[2], tBg)];

      // glow dorado radial sutil tras el destello
      const dC = Math.hypot(x - c, y - c);
      if (dC < glowR) {
        const g = (1 - dC / glowR);
        col = blend(col, GOLD, 0.10 * g * g);
      }

      // destello (astroide) con anti-alias por supersampling
      let cov = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS - 0.5;
          const py = y + (sy + 0.5) / SS - 0.5;
          const dx = Math.abs(px - c);
          const dy = Math.abs(py - c);
          const a = Math.pow(dx, 2 / 3) + Math.pow(dy, 2 / 3);
          if (a <= edge) cov++;
        }
      }
      if (cov > 0) {
        const alpha = cov / (SS * SS);
        // gradiente del destello: brillante arriba, profundo abajo
        const tS = Math.min(1, Math.max(0, (y - (c - sparkR)) / (2 * sparkR)));
        const goldCol = tS < 0.5
          ? blend(GOLD_HI, GOLD, tS * 2)
          : blend(GOLD, GOLD_LO, (tS - 0.5) * 2);
        col = blend(col, goldCol, alpha);
      }

      const i = (y * N + x) * 4;
      rgba[i] = clamp(col[0]);
      rgba[i + 1] = clamp(col[1]);
      rgba[i + 2] = clamp(col[2]);
      rgba[i + 3] = 255;
    }
  }
  return encodePNG(N, N, rgba);
}

const targets = [
  ['icon-512.png', 512],
  ['icon-192.png', 192],
  ['apple-touch-icon.png', 180],
  ['favicon-32.png', 32],
];

for (const [name, size] of targets) {
  const png = renderIcon(size);
  fs.writeFileSync(path.join(OUT_DIR, name), png);
  console.log(`[OK] ${name} (${size}x${size}, ${png.length} bytes)`);
}
console.log('Iconos PWA generados en assets/.');
