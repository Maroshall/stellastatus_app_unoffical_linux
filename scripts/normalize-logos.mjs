// 멤버 로고(assets/logos/*.png)를 시각적으로 통일한다.
// 투명 여백을 잘라내고(트리밍) 정사각형 캔버스에 동일 비율(약 74%)로 다시 배치해
// 각 로고가 화면에서 같은 크기로 보이도록 만든다. (의존성 없음)
import { deflateSync, inflateSync } from 'node:zlib';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'renderer', 'assets', 'logos');
const FILL = 0.74; // 캔버스 대비 로고 채움 비율

function decodePNG(buf) {
  let pos = 8, ihdr = null; const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') ihdr = { w: data.readUInt32BE(0), h: data.readUInt32BE(4), bd: data[8], ct: data[9] };
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const { w, h, ct } = ihdr;
  const ch = ct === 6 ? 4 : ct === 2 ? 3 : 1, stride = w * ch;
  const out = Buffer.alloc(w * h * 4); let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const ft = raw[y * (stride + 1)];
    const row = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const cur = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0, b = prev[x], c = x >= ch ? prev[x - ch] : 0;
      let v = row[x];
      if (ft === 1) v = (v + a) & 255; else if (ft === 2) v = (v + b) & 255;
      else if (ft === 3) v = (v + ((a + b) >> 1)) & 255;
      else if (ft === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255; }
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

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0); const t = Buffer.from(type, 'ascii'); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0); return Buffer.concat([len, t, data, crc]); }
function encodePNG(rgba, size) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) { raw[y * (size * 4 + 1)] = 0; rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4); }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function normalize(img) {
  // 알파 경계 상자
  let minX = img.w, minY = img.h, maxX = -1, maxY = -1;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    if (img.data[(y * img.w + x) * 4 + 3] > 16) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  if (maxX < 0) return null; // 빈 이미지
  const cw = maxX - minX + 1, chh = maxY - minY + 1;
  const side = Math.round(Math.max(cw, chh) / FILL);
  const canvas = Buffer.alloc(side * side * 4);
  const ox = Math.round((side - cw) / 2), oy = Math.round((side - chh) / 2);
  for (let y = 0; y < chh; y++) for (let x = 0; x < cw; x++) {
    const s = ((minY + y) * img.w + (minX + x)) * 4;
    const d = ((oy + y) * side + (ox + x)) * 4;
    canvas[d] = img.data[s]; canvas[d+1] = img.data[s+1]; canvas[d+2] = img.data[s+2]; canvas[d+3] = img.data[s+3];
  }
  return { data: canvas, size: side };
}

let count = 0;
for (const f of readdirSync(DIR)) {
  if (!f.toLowerCase().endsWith('.png')) continue;
  try {
    const img = decodePNG(readFileSync(join(DIR, f)));
    const norm = normalize(img);
    if (!norm) { console.log('건너뜀(빈 이미지):', f); continue; }
    writeFileSync(join(DIR, f), encodePNG(norm.data, norm.size));
    count++;
    console.log('정규화:', f, `${img.w}x${img.h} → ${norm.size}x${norm.size}`);
  } catch (e) { console.log('실패:', f, String(e?.message || e)); }
}
console.log(`완료: ${count}개 로고 정규화`);
