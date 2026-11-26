import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = "C:/Users/afzal/Downloads/Save Life Logo Symbol square  JPG with black and green background.png";
const targets = [
  path.join(root, "public", "images", "savelife-logo.png"),
  path.join(root, "src", "app", "icon.png"),
  path.join(root, "src", "app", "apple-icon.png"),
];

for (const target of targets) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

const bytes = fs.readFileSync(targets[0]);
console.log(
  bytes.subarray(1, 4).toString("ascii") === "PNG"
    ? `brand assets copied: ${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}, ${bytes.length} bytes`
    : "brand assets copied (source is not PNG)",
);
