import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const rankDir = path.join(root, "public", "images", "ranks");
const rewardDir = path.join(root, "public", "images", "rank-rewards");

const tierColors = [
  "#10B981",
  "#0EA5E9",
  "#6366F1",
  "#8B5CF6",
  "#D946EF",
  "#F59E0B",
  "#F97316",
  "#EAB308",
  "#FB7185",
];

function starPoints(cx: number, cy: number, outer: number, inner: number): string {
  return Array.from({ length: 10 }, (_, index) => {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (index * Math.PI) / 5;
    return `${(cx + Math.cos(angle) * radius).toFixed(2)},${(cy + Math.sin(angle) * radius).toFixed(2)}`;
  }).join(" ");
}

function starLayout(count: number): Array<[number, number]> {
  const layouts: Record<number, Array<[number, number]>> = {
    1: [[48, 48]],
    2: [[48, 37], [48, 59]],
    3: [[48, 30], [48, 48], [48, 66]],
    4: [[36, 37], [60, 37], [36, 59], [60, 59]],
    5: [[48, 28], [33, 43], [63, 43], [39, 63], [57, 63]],
    6: [[34, 33], [48, 33], [62, 33], [34, 59], [48, 59], [62, 59]],
    7: [[48, 25], [31, 39], [65, 39], [31, 56], [65, 56], [40, 71], [56, 71]],
    8: [[31, 31], [48, 31], [65, 31], [31, 48], [65, 48], [31, 65], [48, 65], [65, 65]],
    9: [[32, 29], [48, 29], [64, 29], [32, 48], [48, 48], [64, 48], [32, 67], [48, 67], [64, 67]],
  };
  return layouts[count] ?? layouts[9];
}

function rankBadge(level: number): string {
  const color = tierColors[level - 1];
  const radius = level <= 5 ? 7.5 : level <= 7 ? 6 : 5;
  const stars = starLayout(level)
    .map(([x, y]) => `<polygon points="${starPoints(x, y, radius, radius * 0.44)}" fill="${color}" />`)
    .join("");
  const rays = level >= 7
    ? Array.from({ length: 16 }, (_, index) => {
        const angle = (index * Math.PI) / 8;
        const x1 = 48 + Math.cos(angle) * 43;
        const y1 = 48 + Math.sin(angle) * 43;
        const x2 = 48 + Math.cos(angle) * 47;
        const y2 = 48 + Math.sin(angle) * 47;
        return `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" stroke="${color}" stroke-width="2.5" stroke-linecap="round" />`;
      }).join("")
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">
  <circle cx="48" cy="48" r="39" fill="#07131F" fill-opacity="0.94" stroke="${color}" stroke-width="3" />
  <circle cx="48" cy="48" r="31" fill="none" stroke="${color}" stroke-opacity="0.45" stroke-width="1.5" />
  ${rays}
  ${stars}
</svg>`;
}

const defs = `<defs>
  <linearGradient id="green" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#34D399" />
    <stop offset="1" stop-color="#047857" />
  </linearGradient>
  <linearGradient id="metal" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#F8FAFC" />
    <stop offset="1" stop-color="#94A3B8" />
  </linearGradient>
  <linearGradient id="dark" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#1E293B" />
    <stop offset="1" stop-color="#020617" />
  </linearGradient>
  <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#FDE68A" />
    <stop offset="1" stop-color="#D97706" />
  </linearGradient>
</defs>`;

const motorcycle = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
${defs}
<g stroke-linecap="round" stroke-linejoin="round">
  <circle cx="135" cy="356" r="78" fill="none" stroke="url(#dark)" stroke-width="20" />
  <circle cx="135" cy="356" r="52" fill="none" stroke="url(#metal)" stroke-width="8" />
  <circle cx="135" cy="356" r="14" fill="url(#green)" />
  <circle cx="377" cy="356" r="78" fill="none" stroke="url(#dark)" stroke-width="20" />
  <circle cx="377" cy="356" r="52" fill="none" stroke="url(#metal)" stroke-width="8" />
  <circle cx="377" cy="356" r="14" fill="url(#green)" />
  <path d="M135 356 L219 264 L302 264 L377 356" fill="none" stroke="url(#dark)" stroke-width="14" />
  <path d="M190 286 Q226 247 288 256 L338 298 L304 330 L210 322 Z" fill="url(#green)" stroke="url(#dark)" stroke-width="10" />
  <path d="M204 270 Q244 246 292 250 L322 270 L286 284 L218 282 Z" fill="url(#dark)" />
  <path d="M304 264 L334 222 L372 222" fill="none" stroke="url(#dark)" stroke-width="12" />
  <path d="M362 222 L388 222" stroke="url(#metal)" stroke-width="12" />
  <path d="M334 298 L377 356" stroke="url(#metal)" stroke-width="12" />
  <circle cx="374" cy="286" r="24" fill="url(#gold)" stroke="url(#dark)" stroke-width="8" />
</g>
</svg>`;

const luxuryCar = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
${defs}
<g stroke-linecap="round" stroke-linejoin="round">
  <path d="M62 336 C80 276 132 242 204 234 L312 234 C374 240 420 274 446 320 L456 354 L56 354 Z" fill="url(#green)" stroke="url(#dark)" stroke-width="12" />
  <path d="M158 242 L212 198 L300 198 L350 242 Z" fill="url(#dark)" stroke="url(#metal)" stroke-width="8" />
  <path d="M214 202 L214 240 M304 202 L304 240" stroke="url(#metal)" stroke-width="6" />
  <path d="M76 330 L436 330" stroke="#ECFDF5" stroke-opacity="0.7" stroke-width="7" />
  <circle cx="150" cy="356" r="48" fill="url(#dark)" />
  <circle cx="150" cy="356" r="26" fill="url(#metal)" />
  <circle cx="150" cy="356" r="9" fill="url(#green)" />
  <circle cx="370" cy="356" r="48" fill="url(#dark)" />
  <circle cx="370" cy="356" r="26" fill="url(#metal)" />
  <circle cx="370" cy="356" r="9" fill="url(#green)" />
</g>
</svg>`;

const worldTour = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
${defs}
<g stroke-linecap="round" stroke-linejoin="round">
  <circle cx="256" cy="270" r="158" fill="url(#green)" stroke="url(#dark)" stroke-width="12" />
  <ellipse cx="256" cy="270" rx="70" ry="158" fill="none" stroke="#ECFDF5" stroke-opacity="0.55" stroke-width="6" />
  <ellipse cx="256" cy="270" rx="128" ry="158" fill="none" stroke="#ECFDF5" stroke-opacity="0.4" stroke-width="5" />
  <path d="M100 270 L412 270 M126 195 L386 195 M126 345 L386 345" fill="none" stroke="#ECFDF5" stroke-opacity="0.42" stroke-width="5" />
  <path d="M92 200 C170 88 340 78 430 184" fill="none" stroke="url(#gold)" stroke-width="10" stroke-dasharray="4 18" />
  <path d="M376 112 L400 140 L378 156 L378 142 L334 158 L318 190 L306 186 L316 148 L270 136 L270 124 L322 126 L346 100 Z" fill="url(#metal)" stroke="url(#dark)" stroke-width="8" transform="rotate(-12 356 150)" />
</g>
</svg>`;

const flat = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
${defs}
<g stroke-linecap="round" stroke-linejoin="round">
  <path d="M112 142 L396 142 L416 430 L96 430 Z" fill="url(#metal)" stroke="url(#dark)" stroke-width="12" />
  <path d="M104 142 L256 88 L404 142" fill="url(#green)" stroke="url(#dark)" stroke-width="12" />
  ${[0, 1, 2, 3].flatMap((row) =>
    [0, 1, 2].map((col) => {
      const x = 132 + col * 82;
      const y = 178 + row * 60;
      return `<rect x="${x}" y="${y}" width="48" height="38" rx="4" fill="url(#dark)" stroke="url(#metal)" stroke-width="5" />`;
    }),
  ).join("")}
  <path d="M220 430 L220 366 L272 366 L272 430" fill="url(#green)" stroke="url(#dark)" stroke-width="10" />
  <circle cx="260" cy="400" r="4" fill="url(#gold)" />
</g>
</svg>`;

const duplexHouse = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
${defs}
<g stroke-linecap="round" stroke-linejoin="round">
  <path d="M68 224 L256 82 L444 224 Z" fill="url(#green)" stroke="url(#dark)" stroke-width="14" />
  <path d="M104 218 L408 218 L408 430 L104 430 Z" fill="url(#metal)" stroke="url(#dark)" stroke-width="12" />
  <path d="M96 292 L416 292" stroke="url(#dark)" stroke-width="10" />
  <rect x="142" y="150" width="64" height="52" rx="5" fill="url(#dark)" stroke="url(#metal)" stroke-width="7" />
  <rect x="306" y="150" width="64" height="52" rx="5" fill="url(#dark)" stroke="url(#metal)" stroke-width="7" />
  <rect x="142" y="322" width="64" height="60" rx="5" fill="url(#dark)" stroke="url(#metal)" stroke-width="7" />
  <path d="M232 430 L232 322 L280 322 L280 430" fill="url(#green)" stroke="url(#dark)" stroke-width="10" />
  <path d="M316 322 L398 322 M316 322 L316 366 M356 322 L356 366 M398 322 L398 366 M316 366 L398 366" fill="none" stroke="url(#dark)" stroke-width="8" />
  <circle cx="268" cy="382" r="5" fill="url(#gold)" />
</g>
</svg>`;

const physicalRewards: Record<string, string> = {
  motorcycle,
  "luxury-car": luxuryCar,
  "world-tour": worldTour,
  flat,
  "duplex-house": duplexHouse,
};

async function main() {
  await mkdir(rankDir, { recursive: true });
  await mkdir(rewardDir, { recursive: true });

  await Promise.all(
    tierColors.map((_, index) =>
      writeFile(path.join(rankDir, `r${index + 1}.svg`), rankBadge(index + 1), "utf8"),
    ),
  );

  await Promise.all(
    Object.entries(physicalRewards).map(([name, svg]) =>
      sharp(Buffer.from(svg)).png({ compressionLevel: 9, palette: false }).toFile(
        path.join(rewardDir, `${name}.png`),
      ),
    ),
  );

  console.log(`Generated ${tierColors.length} rank badges and ${Object.keys(physicalRewards).length} reward images.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
