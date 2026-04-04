import sharp from "sharp";

// Static version of CelerLogo SVG (no CSS animations)
const svg = `<svg width="650" height="650" viewBox="0 0 650 650" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="celer-deep-sea" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0891b2" />
      <stop offset="100%" stop-color="#172554" />
    </linearGradient>
    <linearGradient id="celer-indigo" x1="100%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#818cf8" />
      <stop offset="100%" stop-color="#312e81" stop-opacity="0.1" />
    </linearGradient>
    <radialGradient id="celer-core-glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="40%" stop-color="#38bdf8" />
      <stop offset="100%" stop-color="#0284c7" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="bg-glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#0891b2" stop-opacity="0.3" />
      <stop offset="100%" stop-color="#0a0e1a" stop-opacity="1" />
    </radialGradient>
  </defs>

  <!-- Dark background with glow -->
  <rect width="650" height="650" rx="120" fill="#0a0e1a"/>
  <rect width="650" height="650" rx="120" fill="url(#bg-glow)"/>

  <g transform="translate(75, 75)">
    <!-- Ambient glow -->
    <circle cx="250" cy="250" r="160" fill="url(#celer-deep-sea)" opacity="0.2" style="filter: blur(40px)"/>

    <!-- Outer rings -->
    <path d="M250,50 A200,200 0 0,1 450,250" stroke="#312e81" stroke-width="2.5" stroke-linecap="round" opacity="0.7" fill="none"/>
    <path d="M250,450 A200,200 0 0,1 50,250" stroke="#312e81" stroke-width="2.5" stroke-linecap="round" opacity="0.7" fill="none"/>

    <!-- Mid rings -->
    <path d="M250,80 C360,80 420,170 420,250" stroke="url(#celer-deep-sea)" stroke-width="5" fill="none" opacity="0.9"/>
    <path d="M250,420 C140,420 80,330 80,250" stroke="url(#celer-deep-sea)" stroke-width="5" fill="none" opacity="0.9"/>

    <!-- Inner ring -->
    <circle cx="250" cy="250" r="110" stroke="#818cf8" stroke-width="1.5" stroke-dasharray="8 20" opacity="0.5" fill="none"/>
    <path d="M170,170 L330,330" stroke="url(#celer-indigo)" stroke-width="1.5" opacity="0.3"/>
    <path d="M330,170 L170,330" stroke="url(#celer-indigo)" stroke-width="1.5" opacity="0.3"/>

    <!-- Orbital ellipse -->
    <ellipse cx="250" cy="250" rx="140" ry="40" stroke="#0ea5e9" stroke-width="1" opacity="0.5" transform="rotate(45 250 250)" fill="none"/>

    <!-- Core -->
    <circle cx="250" cy="250" r="18" fill="url(#celer-core-glow)" opacity="0.9"/>
    <circle cx="250" cy="250" r="6" fill="#ffffff"/>
  </g>
</svg>`;

const svgBuffer = Buffer.from(svg);

async function generate() {
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile("public/icons/icon-512.png");

  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile("public/icons/icon-192.png");

  console.log("✅ Icons generated: icon-192.png, icon-512.png");
}

generate().catch(console.error);
