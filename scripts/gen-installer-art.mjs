// NSIS 설치 마법사용 브랜드 이미지(BMP) 생성. (의존성 없음, 2x 슈퍼샘플링으로 고화질)
//  - build/installerHeader.bmp   150x57  (진행 페이지 상단)
//  - build/sidebarLogo.bmp        72x88  (커스텀 페이지 좌측 사이드바 상단 로고)
//  - build/installerSidebar.bmp  164x314 (호환용, 미사용 가능)
import { inflateSync } from 'node:zlib';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'build');
const ASSETS = join(ROOT, 'src', 'renderer', 'assets');
mkdirSync(OUT, { recursive: true });
const SS = 3; // 슈퍼샘플링 배율(화질)

function decodePNG(buf) {
  let pos = 8, ihdr = null; const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') ihdr = { w: data.readUInt32BE(0), h: data.readUInt32BE(4), ct: data[9] };
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
      if (ch === 4) { out[o]=cur[x*4]; out[o+1]=cur[x*4+1]; out[o+2]=cur[x*4+2]; out[o+3]=cur[x*4+3]; }
      else if (ch === 3) { out[o]=cur[x*3]; out[o+1]=cur[x*3+1]; out[o+2]=cur[x*3+2]; out[o+3]=255; }
      else { out[o]=out[o+1]=out[o+2]=cur[x]; out[o+3]=255; }
    }
    prev = cur;
  }
  return { w, h, data: out };
}
function sample(img, sx, sy) {
  const x0 = Math.max(0, Math.min(img.w - 1, Math.floor(sx)));
  const y0 = Math.max(0, Math.min(img.h - 1, Math.floor(sy)));
  const x1 = Math.min(img.w - 1, x0 + 1), y1 = Math.min(img.h - 1, y0 + 1);
  const fx = sx - Math.floor(sx), fy = sy - Math.floor(sy);
  const px = (x, y) => { const o = (y * img.w + x) * 4; return [img.data[o], img.data[o+1], img.data[o+2], img.data[o+3]]; };
  const a = px(x0, y0), b = px(x1, y0), c = px(x0, y1), d = px(x1, y1);
  const L = (p, q, t) => p + (q - p) * t;
  return [0,1,2,3].map((i) => L(L(a[i], b[i], fx), L(c[i], d[i], fx), fy));
}
// RGB 캔버스(top-down), 세로 그라디언트
function makeCanvas(w, h, top, bot) {
  const buf = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) {
    const t = h > 1 ? y / (h - 1) : 0;
    const r = top[0]+(bot[0]-top[0])*t, g = top[1]+(bot[1]-top[1])*t, b = top[2]+(bot[2]-top[2])*t;
    for (let x = 0; x < w; x++) { const o=(y*w+x)*3; buf[o]=r; buf[o+1]=g; buf[o+2]=b; }
  }
  return buf;
}
function drawImage(dst, W, H, img, dx, dy, dw, dh, alpha = 1) {
  const sx = img.w / dw, sy = img.h / dh;
  for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
    const px = dx + x, py = dy + y;
    if (px < 0 || py < 0 || px >= W || py >= H) continue;
    const [r, g, b, a] = sample(img, x * sx, y * sy);
    const af = (a / 255) * alpha;
    if (af <= 0) continue;
    const o = (py * W + px) * 3;
    dst[o]   = dst[o]   * (1 - af) + r * af;
    dst[o+1] = dst[o+1] * (1 - af) + g * af;
    dst[o+2] = dst[o+2] * (1 - af) + b * af;
  }
}
// 2x/3x 로 렌더 후 박스 다운샘플 → 화질 향상
function downsample(src, W, H, s) {
  const w = W / s, h = H / s, out = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let r=0,g=0,b=0;
    for (let j=0;j<s;j++) for (let i=0;i<s;i++){ const o=((y*s+j)*W+(x*s+i))*3; r+=src[o];g+=src[o+1];b+=src[o+2]; }
    const n=s*s, o=(y*w+x)*3; out[o]=r/n; out[o+1]=g/n; out[o+2]=b/n;
  }
  return { data: out, w, h };
}
function encodeBMP24(rgb, w, h) {
  const rowSize = Math.floor((24 * w + 31) / 32) * 4;
  const imgSize = rowSize * h, fileSize = 54 + imgSize;
  const buf = Buffer.alloc(fileSize);
  buf.write('BM', 0); buf.writeUInt32LE(fileSize, 2); buf.writeUInt32LE(54, 10);
  buf.writeUInt32LE(40, 14); buf.writeInt32LE(w, 18); buf.writeInt32LE(h, 22);
  buf.writeUInt16LE(1, 26); buf.writeUInt16LE(24, 28); buf.writeUInt32LE(0, 30); buf.writeUInt32LE(imgSize, 34);
  for (let y = 0; y < h; y++) {
    let o = 54 + (h - 1 - y) * rowSize;
    for (let x = 0; x < w; x++) { const s = (y * w + x) * 3; buf[o++]=Math.round(rgb[s+2]); buf[o++]=Math.round(rgb[s+1]); buf[o++]=Math.round(rgb[s]); }
  }
  return buf;
}

const bell = decodePNG(readFileSync(join(ASSETS, 'logo.png')));
const star = decodePNG(readFileSync(join(ASSETS, 'logo_star.png')));

// ── 사이드바 로고 72x88 (사이드바 색 #2b2230 위 벨) ──
{
  const W = 72 * SS, H = 88 * SS;
  const c = makeCanvas(W, H, [43, 34, 48], [43, 34, 48]);
  const bh = Math.round(H * 0.82), bw = Math.round(bell.w * (bh / bell.h));
  drawImage(c, W, H, bell, Math.round((W - bw) / 2), Math.round((H - bh) / 2), bw, bh, 1);
  const d = downsample(c, W, H, SS);
  writeFileSync(join(OUT, 'sidebarLogo.bmp'), encodeBMP24(d.data, d.w, d.h));
}

// ── 헤더 150x57 (진행 페이지 상단) ──
{
  const W = 150 * SS, H = 57 * SS;
  const c = makeCanvas(W, H, [34, 26, 30], [34, 26, 30]);
  const bh = Math.round(H * 0.72), bw = Math.round(bell.w * (bh / bell.h));
  drawImage(c, W, H, bell, W - bw - 12 * SS, Math.round((H - bh) / 2), bw, bh, 1);
  const d = downsample(c, W, H, SS);
  writeFileSync(join(OUT, 'installerHeader.bmp'), encodeBMP24(d.data, d.w, d.h));
}

// ── 사이드바(호환용) 164x314 ──
{
  const W = 164 * SS, H = 314 * SS;
  const c = makeCanvas(W, H, [43, 34, 48], [26, 20, 24]);
  drawImage(c, W, H, star, (W - 150*SS) / 2, H - 150*SS, 150*SS, 150*SS, 0.10);
  const bh = 116 * SS, bw = Math.round(bell.w * (bh / bell.h));
  drawImage(c, W, H, bell, Math.round((W - bw) / 2), 74*SS, bw, bh, 1);
  const d = downsample(c, W, H, SS);
  const bmp = encodeBMP24(d.data, d.w, d.h);
  writeFileSync(join(OUT, 'installerSidebar.bmp'), bmp);
  writeFileSync(join(OUT, 'uninstallerSidebar.bmp'), bmp);
}

console.log('생성 완료: sidebarLogo.bmp, installerHeader.bmp, installerSidebar.bmp (SSAA x' + SS + ')');
