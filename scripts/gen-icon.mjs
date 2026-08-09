// 앱/시작표시줄 아이콘 생성.
// 사용자가 제공한 벨 로고(src/renderer/assets/logo.png)를 정사각형 다크 타일 위에
// 합성해 build/icon.png(512) 와 build/icon.ico(256) 를 만든다. (의존성 없음)
import { deflateSync, inflateSync } from 'node:zlib';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'build');
const SRC = join(ROOT, 'src', 'renderer', 'assets', 'logo.png');
mkdirSync(OUT, { recursive: true });

// ── PNG 디코더(8bit, colorType 0/2/6) ─────────
function decodePNG(buf) {
  let pos = 8, ihdr = null;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') ihdr = { w: data.readUInt32BE(0), h: data.readUInt32BE(4), bd: data[8], ct: data[9] };
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const { w, h, ct } = ihdr;
  const ch = ct === 6 ? 4 : ct === 2 ? 3 : 1;
  const stride = w * ch;
  const out = Buffer.alloc(w * h * 4);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const ft = raw[y * (stride + 1)];
    const row = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const cur = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0;
      const b = prev[x];
      const c = x >= ch ? prev[x - ch] : 0;
      let v = row[x];
      if (ft === 1) v = (v + a) & 255;
      else if (ft === 2) v = (v + b) & 255;
      else if (ft === 3) v = (v + ((a + b) >> 1)) & 255;
      else if (ft === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
      cur[x] = v;
    }
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      if (ch === 4) { out[o] = cur[x*4]; out[o+1] = cur[x*4+1]; out[o+2] = cur[x*4+2]; out[o+3] = cur[x*4+3]; }
      else if (ch === 3) { out[o] = cur[x*3]; out[o+1] = cur[x*3+1]; out[o+2] = cur[x*3+2]; out[o+3] = 255; }
      else { out[o] = out[o+1] = out[o+2] = cur[x]; out[o+3] = 255; }
    }
    prev = cur;
  }
  return { w, h, data: out };
}

function sampleBilinear(img, sx, sy) {
  const x0 = Math.floor(sx), y0 = Math.floor(sy);
  const x1 = Math.min(x0 + 1, img.w - 1), y1 = Math.min(y0 + 1, img.h - 1);
  const fx = sx - x0, fy = sy - y0;
  const px = (x, y) => { const o = (y * img.w + x) * 4; return [img.data[o], img.data[o+1], img.data[o+2], img.data[o+3]]; };
  const a = px(Math.max(0,x0), Math.max(0,y0)), b = px(x1, Math.max(0,y0));
  const c = px(Math.max(0,x0), y1), d = px(x1, y1);
  const lerp = (p, q, t) => p + (q - p) * t;
  const out = [];
  for (let i = 0; i < 4; i++) out[i] = lerp(lerp(a[i], b[i], fx), lerp(c[i], d[i], fx), fy);
  return out;
}

// ── 아이콘 렌더 ───────────────────────────────
const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
function inRoundRect(x, y, size, margin, radius) {
  const lo = margin, hi = size - margin;
  if (x < lo || x > hi || y < lo || y > hi) return false;
  const rx = Math.min(Math.max(x, lo + radius), hi - radius);
  const ry = Math.min(Math.max(y, lo + radius), hi - radius);
  return Math.hypot(x - rx, y - ry) <= radius;
}

function renderIcon(size, bell) {
  const buf = Buffer.alloc(size * size * 4);
  const margin = size * 0.05, radius = size * 0.22;
  // 다크 타일 배경
  const bg = [42, 33, 46]; // #2a212e
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const o = (y * size + x) * 4;
      if (inRoundRect(x + .5, y + .5, size, margin, radius)) {
        buf[o] = bg[0]; buf[o+1] = bg[1]; buf[o+2] = bg[2]; buf[o+3] = 255;
      }
    }
  }
  // 벨 합성(높이 ~64%, 중앙, 살짝 위로)
  const targetH = Math.round(size * 0.6);
  const scale = targetH / bell.h;
  const dw = Math.round(bell.w * scale), dh = targetH;
  const ox = Math.round((size - dw) / 2), oy = Math.round((size - dh) / 2 - size * 0.02);
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const [r, g, b, a] = sampleBilinear(bell, x / scale, y / scale);
      if (a <= 1) continue;
      const dx = ox + x, dy = oy + y;
      if (dx < 0 || dy < 0 || dx >= size || dy >= size) continue;
      const o = (dy * size + dx) * 4;
      const af = a / 255;
      buf[o] = clamp(buf[o] * (1 - af) + r * af);
      buf[o+1] = clamp(buf[o+1] * (1 - af) + g * af);
      buf[o+2] = clamp(buf[o+2] * (1 - af) + b * af);
      buf[o+3] = Math.max(buf[o+3], clamp(a));
    }
  }
  return buf;
}

// ── PNG 인코더 ────────────────────────────────
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function encodePNG(rgba, size) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) { raw[y * (size * 4 + 1)] = 0; rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4); }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}
function encodeICO(png, size) {
  const dir = Buffer.alloc(6); dir.writeUInt16LE(0, 0); dir.writeUInt16LE(1, 2); dir.writeUInt16LE(1, 4);
  const entry = Buffer.alloc(16);
  entry[0] = size >= 256 ? 0 : size; entry[1] = size >= 256 ? 0 : size;
  entry.writeUInt16LE(1, 4); entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8); entry.writeUInt32LE(22, 12);
  return Buffer.concat([dir, entry, png]);
}

// ── 실행 ─────────────────────────────────────
const bell = decodePNG(readFileSync(SRC));
writeFileSync(join(OUT, 'icon.png'), encodePNG(renderIcon(512, bell), 512));
writeFileSync(join(OUT, 'icon.ico'), encodeICO(encodePNG(renderIcon(256, bell), 256), 256));
console.log('생성 완료: build/icon.png (512), build/icon.ico (256) — 벨 로고');
