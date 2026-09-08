import sharp from 'sharp';
import fs from 'fs';

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#061827;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#03111d;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#ffe566;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#ffc320;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="cyan" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#00bfff;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#0ea5e9;stop-opacity:1" />
    </linearGradient>
    <filter id="glow">
      <feDropShadow dx="0" dy="12" stdDeviation="18" flood-color="#00bfff" flood-opacity="0.35"/>
    </filter>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <!-- subtle inner border -->
  <rect x="2" y="2" width="508" height="508" rx="110" fill="none" stroke="rgba(0,191,255,0.18)" stroke-width="2"/>
  <!-- globe -->
  <g transform="translate(256,190)">
    <circle cx="0" cy="0" r="78" fill="none" stroke="url(#gold)" stroke-width="3.5" opacity="0.95"/>
    <ellipse cx="0" cy="0" rx="38" ry="78" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="2.2"/>
    <ellipse cx="0" cy="0" rx="58" ry="78" fill="none" stroke="rgba(0,191,255,0.9)" stroke-width="2"/>
    <line x1="-78" y1="0" x2="78" y2="0" stroke="rgba(255,255,255,0.7)" stroke-width="2"/>
    <path d="M -68 -28 Q 0 -48 68 -28" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M -68 28 Q 0 48 68 28" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="1.8" stroke-linecap="round"/>
    <!-- small plane -->
    <g transform="translate(62,-58) rotate(-28)">
      <text font-size="22" text-anchor="middle" dominant-baseline="middle">✈️</text>
    </g>
  </g>
  <!-- 7DIL text -->
  <g text-anchor="middle" font-family="Inter, Arial, sans-serif">
    <text x="256" y="342" font-size="96" font-weight="900" letter-spacing="-3">
      <tspan fill="#ffd52f">7</tspan><tspan fill="white">DİL</tspan>
    </text>
    <text x="256" y="372" font-size="13" font-weight="700" letter-spacing="5.5" fill="#00bfff">A1 → C1 • 14 DİL</text>
    <text x="256" y="392" font-size="11" font-weight="600" letter-spacing="2.2" fill="rgba(255,255,255,0.65)">HER DİLDE HER DİL</text>
  </g>
  <!-- bottom dots -->
  <g transform="translate(256,432)">
    <circle cx="-18" cy="0" r="4.5" fill="#ffd52f" opacity="0.95"/>
    <circle cx="0" cy="0" r="4.5" fill="white" opacity="0.9"/>
    <circle cx="18" cy="0" r="4.5" fill="#00bfff" opacity="0.95"/>
  </g>
</svg>`;

fs.writeFileSync('public/logo.svg', svg);
fs.writeFileSync('public/icon.svg', svg);

const sizes = [192, 512, 180, 32, 16];
for (const s of sizes) {
  const out = s === 180 ? 'public/icons/apple-touch-icon.png' : s === 32 ? 'public/favicon-32.png' : s === 16 ? 'public/favicon-16.png' : `public/icons/icon-${s}.png`;
  await sharp(Buffer.from(svg)).resize(s, s).png().toFile(out);
  console.log(`→ ${out} ${s}x${s}`);
}
// also copy 512 as icon.png and logo.png
await sharp(Buffer.from(svg)).resize(512,512).png().toFile('public/logo.png');
console.log('logo done');
